// KOORDIN IA — fonction serveur Supabase (Edge Function)
//
// Reçoit la conversation depuis l'application, rassemble les données de
// l'entreprise visibles par la personne connectée (les règles de sécurité
// de la base s'appliquent : un technicien ne transmet jamais les montants),
// puis interroge Claude. La clé ANTHROPIC_API_KEY reste sur le serveur.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const ROLES_AUTORISES = ["direction", "coordinateur", "achats", "comptable", "magasinier"];
const MAX_MESSAGES = 20;
const MAX_CARACTERES = 4000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const INSTRUCTIONS = `Tu es KOORDIN IA, l'assistant de pilotage intégré à la plateforme KOORDIN, utilisée par des entreprises du BTP pour coordonner leurs chantiers.

Tu reçois les données réelles de l'entreprise (projets, lots, planning, rapports de chantier, achats, factures, stock, alertes), limitées à ce que la personne connectée a le droit de voir.

Ta manière de répondre :
- Réponds en français, de façon directe et concrète, comme un conducteur de travaux expérimenté qui parle à un décideur.
- Appuie-toi uniquement sur les données fournies. Cite les chiffres, les noms de projets et les dates. Si une information manque, dis-le simplement au lieu d'inventer.
- Termine par une ou plusieurs actions concrètes à mener, avec la personne ou le service concerné.
- Les montants sont dans la devise de l'entreprise ; formate-les avec des espaces (ex. 1 250 000 FCFA).
- Reste bref (environ 200 mots) sauf si on te demande un rapport, un courrier ou une analyse détaillée.
- Tu ne peux pas modifier les données : tu conseilles, tu analyses et tu rédiges.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ erreur: "Non connecté" }, 401);

  // Client Supabase agissant AU NOM de l'utilisateur : les règles de sécurité s'appliquent
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: { user } } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!user) return json({ erreur: "Session expirée, reconnectez-vous" }, 401);

  const { data: profil } = await supabase
    .from("profils")
    .select("nom, role, entreprises(nom, devise, pays)")
    .eq("id", user.id)
    .single();
  if (!profil) return json({ erreur: "Compte non rattaché à une entreprise" }, 403);
  if (!ROLES_AUTORISES.includes(profil.role)) {
    return json({ erreur: "L'assistant IA n'est pas activé pour votre rôle" }, 403);
  }

  let corps: { messages?: { role: string; content: string }[] };
  try {
    corps = await req.json();
  } catch {
    return json({ erreur: "Requête invalide" }, 400);
  }
  const messages = (corps.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_CARACTERES) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ erreur: "Aucune question reçue" }, 400);
  }

  // Données de l'entreprise visibles par cette personne
  const depuis = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [projets, lots, taches, rapports, commandes, factures, stock, alertes] = await Promise.all([
    supabase.from("v_projets").select(
      "id, nom, reference, client, localisation, statut, budget, date_debut, date_fin_prevue, avancement, avancement_attendu, engage, facture, paye, rapports_en_attente, dernier_rapport, jours_de_retard, sante",
    ),
    supabase.from("v_budget_lots").select("projet_id, nom, budget, avancement, engage, facture, paye"),
    supabase.from("taches").select("projet_id, nom, date_debut, date_fin, avancement"),
    supabase.from("rapports")
      .select("projet_id, date_rapport, meteo, effectif, travaux, incidents, besoins, avancement, statut, profils!rapports_auteur_id_fkey(nom), lots(nom)")
      .gte("date_rapport", depuis).order("date_rapport", { ascending: false }).limit(60),
    supabase.from("commandes")
      .select("projet_id, reference, designation, montant, statut, date_commande, fournisseurs(nom), lots(nom)")
      .order("date_commande", { ascending: false }).limit(80),
    supabase.from("factures")
      .select("projet_id, numero, libelle, categorie, montant, date_facture, date_echeance, statut, fournisseurs(nom)")
      .order("date_facture", { ascending: false }).limit(80),
    supabase.from("v_stock").select("nom, unite, quantite, seuil_min, prix_unitaire, alerte"),
    supabase.from("activites").select("niveau, message, created_at")
      .eq("type", "alerte").order("created_at", { ascending: false }).limit(25),
  ]);

  const nomsProjets = new Map((projets.data ?? []).map((p) => [p.id, p.nom]));
  const avecProjet = <T extends { projet_id: string }>(rows: T[] | null) =>
    (rows ?? []).map(({ projet_id, ...reste }) => ({ projet: nomsProjets.get(projet_id) ?? projet_id, ...reste }));

  const entreprise = profil.entreprises as unknown as { nom: string; devise: string; pays: string } | null;
  const contexte = {
    date_du_jour: new Date().toISOString().slice(0, 10),
    entreprise: entreprise?.nom,
    pays: entreprise?.pays,
    devise: entreprise?.devise,
    utilisateur: { nom: profil.nom, role: profil.role },
    projets: (projets.data ?? []).map(({ id: _id, ...p }) => p),
    lots: avecProjet(lots.data),
    planning: avecProjet(taches.data),
    rapports_30_derniers_jours: avecProjet(rapports.data),
    commandes: avecProjet(commandes.data),
    factures: avecProjet(factures.data),
    stock: stock.data ?? [],
    alertes_recentes: alertes.data ?? [],
  };

  try {
    const reponse = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // Si le modèle décline une demande, l'API la relance automatiquement sur un modèle de repli
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: INSTRUCTIONS },
        { type: "text", text: "Données de l'entreprise (JSON) :\n" + JSON.stringify(contexte) },
      ],
      messages,
    } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

    if (reponse.stop_reason === "refusal") {
      return json({ reponse: "Je ne peux pas répondre à cette demande. Reformulez votre question sur vos chantiers." });
    }
    const texte = reponse.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return json({ reponse: texte || "Je n'ai pas pu formuler de réponse. Réessayez." });
  } catch (e) {
    console.error("Erreur Claude", e);
    if (e instanceof Anthropic.AuthenticationError) {
      return json({ erreur: "Clé ANTHROPIC_API_KEY absente ou invalide sur le serveur" }, 500);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json({ erreur: "L'assistant est très sollicité, réessayez dans une minute" }, 429);
    }
    return json({ erreur: "L'assistant IA est momentanément indisponible" }, 502);
  }
});
