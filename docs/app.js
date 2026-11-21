/* ═══════════════════════════════════════════════════════════════════
   KOORDIN — application web (PWA)
   Une seule page, connectée à Supabase. Chaque rôle voit ses écrans ;
   la base de données applique les habilitations (voir supabase/schema.sql).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const CFG = window.KOORDIN_CONFIG || {};
// Version de l'application : à augmenter en même temps que version.json à chaque mise à jour publiée.
const VERSION = '3.18';
const DEMO = !!window.KOORDIN_DEMO;
let sb = null;

// Navigation : par l'adresse (#/page) dans l'application installée,
// en mémoire dans la démonstration (la page de démo ne transmet pas l'adresse).
let routeDemo = '';
function allerA(h) {
  if (DEMO) { routeDemo = h; naviguer(); } else location.hash = h;
}
const hashCourant = () => (DEMO ? routeDemo : location.hash);
const memo = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* rien */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* rien */ } },
};

// ─────────────────────────────── Rôles et menu ───────────────────────────────

const ROLES = {
  direction:    { label: 'Direction',     ico: '👔' },
  coordinateur: { label: 'Coordination',  ico: '🗂️' },
  technicien:   { label: 'Technicien',    ico: '🔧' },
  achats:       { label: 'Achats',        ico: '🛒' },
  comptable:    { label: 'Comptabilité',  ico: '📊' },
  magasinier:   { label: 'Magasin',       ico: '📦' },
};
const TOUS = Object.keys(ROLES);
const ROLES_IA = ['direction', 'coordinateur', 'achats', 'comptable', 'magasinier'];
const ROLES_RAPPORT = ['technicien', 'coordinateur', 'direction'];

const MENU = [
  { r: 'dashboard', court: 'Accueil',       label: 'Tableau de bord', ico: '📊', roles: TOUS },
  { r: 'projets', court: 'Projets',         label: 'Projets',         ico: '🏗️', roles: TOUS, labelTech: 'Mes chantiers' },
  { r: 'communiques', court: 'Infos',       label: 'Communiqués',     ico: '📢', roles: TOUS },
  { r: 'appels', court: 'Appels', label: 'Appels et réunions', ico: '📹', roles: TOUS },
  { r: 'controles', court: 'Contrôles', label: 'Contrôles qualité', ico: '🔍', roles: ['direction', 'coordinateur', 'technicien'] },
  { r: 'savoir', court: 'Normes', label: 'Normes et conseils', ico: '📚', roles: TOUS },
  { r: 'nouveau-rapport', court: 'Rapport', label: 'Nouveau rapport', ico: '➕', roles: ['technicien'] },
  { r: 'rapports', court: 'Rapports',        label: 'Rapports',        ico: '📋', roles: ROLES_RAPPORT, labelTech: 'Mes rapports' },
  { r: 'pointage', court: 'Pointage', label: 'Pointage', ico: '👷', roles: ['direction', 'coordinateur', 'technicien', 'comptable'] },
  { r: 'achats', court: 'Achats',          label: 'Achats',          ico: '🛒', roles: ['direction', 'coordinateur', 'achats', 'comptable', 'magasinier'] },
  { r: 'compta', court: 'Compta',          label: 'Comptabilité',    ico: '💰', roles: ['direction', 'comptable'] },
  { r: 'mes-factures', court: 'Factures', label: 'Mes factures', ico: '🧾', roles: ['technicien', 'coordinateur', 'achats', 'magasinier'] },
  { r: 'caisse', court: 'Caisse', label: 'Caisse et dépenses', ico: '👛', roles: ['direction', 'comptable', 'technicien', 'coordinateur', 'achats', 'magasinier'] },
  { r: 'ventes', court: 'Clients', label: 'Facturation client', ico: '💼', roles: ['direction', 'comptable', 'coordinateur'] },
  { r: 'salaires', court: 'Salaires', label: 'Salaires', ico: '💵', roles: ['direction', 'comptable'] },
  { r: 'contrats', court: 'Contrats', label: 'Contrats et prestataires', ico: '📑', roles: ['direction', 'comptable', 'coordinateur', 'technicien'] },
  { r: 'stock', court: 'Stock',           label: 'Stock',           ico: '📦', roles: ['direction', 'coordinateur', 'achats', 'magasinier', 'technicien'] },
  { r: 'materiel', court: 'Matériel', label: 'Matériel et engins', ico: '🚜', roles: ['direction', 'coordinateur', 'magasinier', 'technicien', 'achats', 'comptable'] },
  { r: 'securite', court: 'Sécurité', label: 'Sécurité chantier', ico: '🦺', roles: ['direction', 'coordinateur', 'technicien'] },
  { r: 'equipe', court: 'Équipe',          label: 'Équipe',          ico: '👥', roles: ['direction'] },
  { r: 'ia', court: 'IA',              label: 'Assistant IA',    ico: '🧠', roles: ROLES_IA },
  { r: 'abonnement', court: 'Abonnement', label: 'Abonnement', ico: '💳', roles: ['direction'], licence: true },
  { r: 'mon-espace', court: 'Mon espace', label: 'Mon espace', ico: '👤', roles: TOUS },
  { r: 'parametres', court: 'Réglages',      label: 'Paramètres',      ico: '⚙️', roles: ['direction'] },
  { r: 'console', court: 'Console', label: 'Console KOORDIN', ico: '🛡️', roles: TOUS, admin: true },
];

const STATUT_PROJET = {
  preparation: ['info', '📐 En préparation'],
  en_cours:    ['ok', '🚧 En cours'],
  suspendu:    ['warn', '⏸️ Suspendu'],
  termine:     ['muted', '🏁 Terminé'],
};
const SANTE = {
  ok:        ['ok', '✅ Dans les temps'],
  attention: ['warn', '⚠️ À surveiller'],
  critique:  ['crit', '🚨 Critique'],
  termine:   ['muted', '🏁 Terminé'],
};
const STATUT_RAPPORT = {
  soumis: ['warn', '⏳ À vérifier'],
  pre_valide: ['info', '🔎 Vérifié · attend la Direction'],
  valide: ['ok', '✅ Validé'],
  rejete: ['crit', '↩️ Rejeté'],
};
const STATUT_COMMANDE = {
  demandee:  ['info', '📝 Demandée'],
  commandee: ['warn', '🚚 Commandée'],
  livree:    ['ok', '✅ Livrée'],
  annulee:   ['muted', '✖️ Annulée'],
};
const STATUT_FACTURE = {
  a_payer: ['warn', '⏳ À payer'],
  payee:   ['ok', '✅ Payée'],
};
const CATEGORIES = {
  materiaux: 'Matériaux', main_oeuvre: 'Main-d’œuvre', location: 'Location matériel',
  sous_traitance: 'Sous-traitance', autre: 'Autre',
};
const METEO = ['Ensoleillé', 'Nuageux', 'Pluie', 'Orage', 'Vent fort', 'Chaleur extrême'];

// ─────────────────────────────── État ───────────────────────────────

const S = {
  session: null,
  profil: null,
  entreprise: null,
  equipe: [],
  charts: [],
  ia: [],
  installPrompt: null,
  canal: null,
  nonLues: 0,
};

// ─────────────────────────────── Utilitaires ───────────────────────────────

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const role = () => S.profil?.role;
const can = (...roles) => roles.includes(role());
const num = (v) => Number(v) || 0;
const nf = new Intl.NumberFormat('fr-FR');
const devise = () => S.entreprise?.devise || 'FCFA';
const money = (v) => `${nf.format(Math.round(num(v)))} ${devise()}`;
function moneyShort(v) {
  const n = num(v), a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md ${devise()}`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M ${devise()}`;
  return money(n);
}
const pct = (a, b) => (num(b) > 0 ? Math.round((num(a) / num(b)) * 100) : 0);
const todayISO = () => new Date().toLocaleDateString('sv-SE');
const parseDay = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`);
const fdate = (d) => (d ? parseDay(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
function ago(ts) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
const initiales = (nom) => String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
// Comptes sans email : un numéro de téléphone devient un identifiant interne
// (ex. 07 01 02 03 04 → 2250701020304@tel.koordin.app). Aucun email n'y est jamais envoyé.
const DOMAINE_TEL = 'tel.koordin.app';
function versIdentifiant(saisie) {
  const v = String(saisie || '').trim().toLowerCase();
  if (v.includes('@')) return v;
  let n = v.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.length === 10 && n.startsWith('0')) n = `225${n}`;
  n = n.replace(/\D/g, '');
  if (n.length < 8) throw new Error('Numéro de téléphone incomplet. Exemple : 07 01 02 03 04');
  return `${n}@${DOMAINE_TEL}`;
}
const estTelephone = (id) => String(id || '').endsWith(`@${DOMAINE_TEL}`);
function afficherIdentifiant(id) {
  if (!estTelephone(id)) return id || '';
  const n = id.split('@')[0];
  return n.startsWith('225') && n.length === 13 ? `+225 ${n.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}` : `+${n}`;
}
const numeroWhatsApp = (id) => (estTelephone(id) ? id.split('@')[0] : null);
const badge = ([cls, txt]) => `<span class="badge ${cls}">${esc(txt)}</span>`;
const nomMembre = (id) => S.equipe.find((p) => p.id === id)?.nom || '—';
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

async function q(promesse) {
  const { data, error } = await promesse;
  if (error) throw error;
  return data;
}

function messageErreur(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet. Vérifiez le réseau puis réessayez.';
  if (/LICENCE_EXPIREE/.test(m)) return role() === 'direction'
    ? 'Votre licence KOORDIN a expiré : l’application est en lecture seule. Renouvelez-la dans Abonnement.'
    : 'La licence KOORDIN de votre entreprise a expiré : l’application est en lecture seule. Prévenez votre direction.';
  if (/LIMITE_PROJETS|LIMITE_UTILISATEURS/.test(m)) return `${e?.hint || 'Limite de votre formule atteinte.'} ${role() === 'direction' ? 'Passez à une formule supérieure dans Abonnement.' : 'Prévenez votre direction.'}`;
  if (/projet_photos|galerie_projet/i.test(m) && /does not exist|schema cache|could not find/i.test(m))
    return 'La galerie nécessite la mise à jour 1.6 de la base de données : dans Supabase → SQL Editor, exécutez le fichier supabase/mise-a-jour-1.6.sql.';
  if (/communiques/i.test(m) && /does not exist|schema cache|could not find/i.test(m))
    return 'Cette fonction nécessite la mise à jour 1.5 de la base de données : dans Supabase → SQL Editor, exécutez le fichier supabase/mise-a-jour-1.5.sql (voir le guide d’installation).';
  if (/row-level security|permission denied|42501/i.test(m)) return 'Vous n’avez pas l’autorisation pour cette action.';
  if (/factures_numero_unique|duplicate key/i.test(m)) return 'Ce numéro existe déjà pour ce fournisseur (doublon possible).';
  if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Confirmez d’abord votre adresse email (lien reçu par mail).';
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet email. Connectez-vous.';
  if (/Password should be/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives. Patientez quelques minutes.';
  if (/^[A-Z][A-Z_]{5,}$/.test(m) && e?.hint) return e.hint;
  return m || 'Une erreur est survenue.';
}

function toast(msg, type = 'ok', duree = 4200) {
  try { kokoReagir(type, msg); } catch { /* Koko absent */ }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const ico = document.createElement('span');
  ico.className = 'toast-ico';
  ico.textContent = type === 'err' ? '⚠️' : type === 'warn' ? '🔔' : '✓';
  const txt = document.createElement('span');
  txt.textContent = msg;
  t.append(ico, txt);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), duree);
  return t;
}

const empty = (ico, txt) => `<div class="empty"><div class="big">${ico}</div>${esc(txt)}</div>`;
const loading = () => `<div class="skeleton" aria-label="Chargement" role="status">
  <div class="sk sk-title"></div><div class="sk sk-sub"></div>
  <div class="sk-row"><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div></div>
  <div class="sk sk-block"></div></div>`;
// Anneau d'avancement (avec repère du prévu)
function anneau(valeur, attendu = null, taille = 56) {
  const v = Math.max(0, Math.min(100, num(valeur)));
  const r = 22, c = 2 * Math.PI * r;
  const retard = attendu != null && attendu - v > 15 ? 'crit' : attendu != null && attendu - v > 5 ? 'warn' : 'ok';
  const repere = attendu != null ? (() => { const a = (Math.max(0, Math.min(100, attendu)) / 100) * 2 * Math.PI - Math.PI / 2; return `<line x1="${28 + 17 * Math.cos(a)}" y1="${28 + 17 * Math.sin(a)}" x2="${28 + 27 * Math.cos(a)}" y2="${28 + 27 * Math.sin(a)}" class="ring-mark"/>`; })() : '';
  return `<svg class="ring ring-${retard}" width="${taille}" height="${taille}" viewBox="0 0 56 56" role="img" aria-label="Avancement ${v} %${attendu != null ? `, prévu ${attendu} %` : ''}">
    <circle cx="28" cy="28" r="${r}" class="ring-bg"/>
    <circle cx="28" cy="28" r="${r}" class="ring-val" stroke-dasharray="${(v / 100) * c} ${c}" transform="rotate(-90 28 28)"/>
    ${repere}<text x="28" y="32" text-anchor="middle" class="ring-txt">${v}%</text></svg>`;
}

function progressBar(valeur, { attendu = null, cls = '', label = null } = {}) {
  const v = Math.max(0, Math.min(100, num(valeur)));
  const mark = attendu != null ? `<i class="mark" style="left:${Math.max(0, Math.min(100, attendu))}%" title="Prévu : ${attendu} %"></i>` : '';
  return `<div class="progress-row"><div class="progress ${cls}"><span style="width:${v}%"></span>${mark}</div><span class="pct">${label ?? v} %</span></div>`;
}
function consoCls(consomme, budget) {
  const p = pct(consomme, budget);
  return p > 100 ? 'crit' : p > 90 ? 'warn' : 'ok';
}

// ─────────────────────────────── Images ───────────────────────────────

// Illustration de chantier dessinée (ville, immeuble en construction, grue).
// Les couleurs viennent du thème ; la variante dépend de « graine ».
let compteurIllu = 0;
function hasard(graine) {
  let s = (graine >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function empreinte(texte) {
  let h = 2166136261;
  for (const c of String(texte)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function sceneChantier(graine = 7, { classe = '' } = {}) {
  const r = hasard(graine);
  const id = `ill${++compteurIllu}`;
  const W = 400, sol = 206;
  let loin = '', milieu = '', fenetres = '';
  for (let x = -6; x < W;) {
    const w = 16 + r() * 26, h = 36 + r() * 74;
    loin += `<rect x="${x.toFixed(1)}" y="${(sol - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
    x += w + 1;
  }
  for (let x = -12; x < W;) {
    const w = 24 + r() * 30, h = 26 + r() * 48;
    milieu += `<rect x="${x.toFixed(1)}" y="${(sol - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
    for (let wy = sol - h + 7; wy < sol - 6; wy += 9) for (let wx = x + 5; wx < x + w - 5; wx += 7) if (r() > 0.6) fenetres += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4"/>`;
    x += w + 5 + r() * 10;
  }
  // Immeuble en construction
  const bx = 112 + r() * 50, bw = 96, etages = 7 + Math.floor(r() * 3), eh = 14, haut = sol - etages * eh, finis = 3 + Math.floor(r() * 2);
  let bat = `<rect class="i-bat" x="${bx}" y="${sol - finis * eh}" width="${bw}" height="${finis * eh}"/>`;
  for (let i = 0; i < finis; i++) for (let c = 0; c < 6; c++) bat += `<rect class="i-vitre" x="${bx + 6 + c * 15}" y="${sol - (i + 1) * eh + 4}" width="9" height="6"/>`;
  for (let i = finis; i <= etages; i++) bat += `<line class="i-acier" x1="${bx}" y1="${sol - i * eh}" x2="${bx + bw}" y2="${sol - i * eh}"/>`;
  for (let c = 0; c <= 4; c++) bat += `<line class="i-acier" x1="${bx + (c * bw) / 4}" y1="${haut}" x2="${bx + (c * bw) / 4}" y2="${sol - finis * eh}"/>`;
  for (let i = finis; i < etages; i++) bat += `<line class="i-echafaud" x1="${bx - 8}" y1="${sol - i * eh}" x2="${bx}" y2="${sol - (i + 1) * eh}"/>`;
  bat += `<line class="i-echafaud" x1="${bx - 8}" y1="${haut}" x2="${bx - 8}" y2="${sol}"/>`;
  // Grue à tour
  const mx = bx + bw + 30, mh = haut - 44, fleche = 170, contre = 52;
  let grue = `<rect class="i-grue-mat" x="${mx - 5}" y="${mh}" width="10" height="${sol - mh}"/>`;
  for (let y = mh; y < sol - 10; y += 10) grue += `<path class="i-grue" d="M${mx - 5} ${y} L${mx + 5} ${y + 10} M${mx + 5} ${y} L${mx - 5} ${y + 10}"/>`;
  grue += `<path class="i-grue" d="M${mx - fleche} ${mh} L${mx + contre} ${mh} M${mx} ${mh - 22} L${mx - fleche} ${mh} M${mx} ${mh - 22} L${mx + contre} ${mh}"/>`;
  grue += `<rect class="i-grue-mat" x="${mx + contre - 18}" y="${mh}" width="18" height="10"/><rect class="i-cabine" x="${mx - 9}" y="${mh + 2}" width="12" height="10" rx="1.5"/>`;
  const chariot = mx - 70 - r() * 60, crochet = haut - 14 + r() * 10;
  grue += `<line class="i-cable" x1="${chariot}" y1="${mh}" x2="${chariot}" y2="${crochet}"/><rect class="i-charge" x="${chariot - 16}" y="${crochet}" width="32" height="6" rx="1"/>`;
  const soleil = 300 + r() * 60;
  return `<svg class="illu ${classe}" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--illu-ciel-1)"/><stop offset="1" style="stop-color:var(--illu-ciel-2)"/></linearGradient></defs>
    <rect width="400" height="240" fill="url(#${id})"/>
    <circle class="i-soleil" cx="${soleil.toFixed(0)}" cy="${(64 + r() * 20).toFixed(0)}" r="26"/>
    <g class="i-loin">${loin}</g><g class="i-milieu">${milieu}</g><g class="i-fenetre">${fenetres}</g>
    ${bat}${grue}
    <rect class="i-sol" x="0" y="${sol}" width="400" height="${240 - sol}"/>
  </svg>`;
}

// Liens temporaires vers les photos privées des chantiers (valables une heure)
const URLS_PHOTOS = new Map();
async function urlsPhotos(chemins) {
  const manquants = [...new Set(chemins.filter((c) => c && !URLS_PHOTOS.has(c)))];
  if (manquants.length && !DEMO) {
    const { data } = await sb.storage.from('photos-chantier').createSignedUrls(manquants, 3600);
    (data || []).forEach((x) => { if (x.signedUrl) URLS_PHOTOS.set(x.path, x.signedUrl); });
    setTimeout(() => manquants.forEach((c) => URLS_PHOTOS.delete(c)), 50 * 60 * 1000);
  }
  return (c) => (c ? URLS_PHOTOS.get(c) || null : null);
}
const couvertureDe = (p) => p.photo || p.photo_terrain || null;
function visuelProjet(p, url, { classe = 'pc-cover' } = {}) {
  return `<div class="${classe}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : sceneChantier(empreinte(p.id || p.nom))}<div class="cover-voile"></div></div>`;
}

// ─────────────────────────────── Annonces ───────────────────────────────

let cacheAnnonces = null;
const urlImageAnnonce = (chemin) => `${CFG.SUPABASE_URL}/storage/v1/object/public/annonces/${chemin}`;
function lienAnnonce(lien) {
  const v = String(lien || '').trim();
  if (!v) return null;
  if (/^\+?[\d\s.-]{8,}$/.test(v)) return `https://wa.me/${v.replace(/\D/g, '').replace(/^0(?=\d{9}$)/, '2250')}`;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
async function placerAnnonce(zone) {
  if (DEMO || !zone) return;
  if (!cacheAnnonces) {
    const { data, error } = await sb.from('annonces').select('*');
    const auj = todayISO();
    cacheAnnonces = error ? [] : (data || []).filter((a) => a.actif && a.debut <= auj && (!a.fin || a.fin >= auj) && (!a.roles || a.roles.includes(role())));
    setTimeout(() => { cacheAnnonces = null; }, 10 * 60 * 1000);
  }
  if (!cacheAnnonces.length || !zone.isConnected) return;
  const a = cacheAnnonces[Math.floor(Math.random() * cacheAnnonces.length)];
  const lien = lienAnnonce(a.lien);
  zone.innerHTML = `<article class="annonce">
    ${a.image ? `<div class="annonce-img"><img src="${esc(urlImageAnnonce(a.image))}" alt="${esc(a.titre)}" loading="lazy"></div>` : ''}
    <div class="annonce-corps">
      <div class="annonce-tete"><span class="annonce-label">Sponsorisé</span><span class="muted">${esc(a.annonceur)}</span></div>
      <h3>${esc(a.titre)}</h3>
      ${a.texte ? `<p>${esc(a.texte)}</p>` : ''}
      ${lien ? `<a class="btn primary sm" href="${esc(lien)}" target="_blank" rel="noopener sponsored" data-annonce="${a.id}">${esc(a.bouton || 'En savoir plus')}</a>` : ''}
    </div></article>`;
  const cle = `koordin-vue-${a.id}`;
  if (!memo.get(cle)) { memo.set(cle, '1'); sb.rpc('annonce_evenement', { p_annonce: a.id, p_type: 'vue' }).then(() => {}, () => {}); }
  $('[data-annonce]', zone)?.addEventListener('click', () => { sb.rpc('annonce_evenement', { p_annonce: a.id, p_type: 'clic' }).then(() => {}, () => {}); });
}

// Champs de formulaire
const F = {
  text(name, label, value = '', o = {}) {
    return `<label class="field ${o.full ? 'full' : ''}">${esc(label)}${o.required ? ' *' : ''}
      <input name="${name}" type="${o.type || 'text'}" value="${esc(value ?? '')}" ${o.required ? 'required' : ''}
        ${o.min != null ? `min="${o.min}"` : ''} ${o.max != null ? `max="${o.max}"` : ''} ${o.step ? `step="${o.step}"` : ''}
        ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''} ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''}>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
  },
  area(name, label, value = '', o = {}) {
    return `<label class="field full">${esc(label)}${o.required ? ' *' : ''}
      <textarea name="${name}" ${o.required ? 'required' : ''} ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''}>${esc(value ?? '')}</textarea>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
  },
  select(name, label, options, value = '', o = {}) {
    const opts = options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<label class="field ${o.full ? 'full' : ''}">${esc(label)}${o.required ? ' *' : ''}
      <select name="${name}" ${o.required ? 'required' : ''}>${o.vide !== undefined ? `<option value="">${esc(o.vide)}</option>` : ''}${opts}</select>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
  },
};

function lireFormulaire(form) {
  const o = {};
  for (const [k, v] of new FormData(form).entries()) {
    if (v instanceof File) continue;
    const t = String(v).trim();
    o[k] = t === '' ? null : t;
  }
  return o;
}

// Fenêtre modale générique
function ouvrirModale({ titre, corps, large = false, onSubmit = null, boutonOk = 'Enregistrer', onOpen = null }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const contenu = onSubmit
    ? `<form id="mform" novalidate>${corps}<div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">${esc(boutonOk)}</button></div></form>`
    : corps;
  ov.innerHTML = `<div class="modal ${large ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${esc(titre)}</h3><button class="close" data-close aria-label="Fermer">×</button></div>
    <div class="modal-body">${contenu}</div></div>`;
  const fermer = () => { ov.remove(); document.removeEventListener('keydown', echap); };
  const echap = (e) => { if (e.key === 'Escape') fermer(); };
  document.addEventListener('keydown', echap);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) fermer(); });
  if (onSubmit) {
    const form = $('#mform', ov);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const res = await onSubmit(lireFormulaire(form), form);
        if (res !== false) fermer();
      } catch (err) {
        console.error(err);
        toast(messageErreur(err), 'err', 6000);
      } finally {
        btn.disabled = false;
      }
    });
  }
  document.body.appendChild(ov);
  onOpen?.(ov);
  $('input, select, textarea', ov)?.focus();
  return { el: ov, fermer };
}

function confirmer(message, libelle = 'Confirmer') {
  return new Promise((resolve) => {
    const m = ouvrirModale({
      titre: 'Confirmation',
      corps: `<p>${esc(message)}</p><div class="form-actions"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="ok-confirm">${esc(libelle)}</button></div>`,
    });
    $('#ok-confirm', m.el).onclick = () => { m.fermer(); resolve(true); };
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === m.el) resolve(false); });
  });
}

// Données partagées
async function listeProjets() {
  return q(sb.from('projets').select('id, nom, statut').order('nom'));
}
async function listeFournisseurs() {
  return q(sb.from('fournisseurs').select('id, nom').order('nom'));
}
async function chargerEquipe() {
  S.equipe = await avecCache('equipe', () => q(sb.from('profils').select('id, nom, email, role, actif, telephone').order('nom')), { defaut: [] });
}

// ─────────────────────────────── Graphiques ───────────────────────────────

function detruireGraphiques() {
  S.charts.forEach((c) => c.destroy());
  S.charts = [];
}

function graphiqueBarres(canvas, { labels, series, horizontal = false, format = (v) => v, max }) {
  const grille = cssVar('--grid');
  const texte = cssVar('--text-2');
  const surface = cssVar('--surface');
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        backgroundColor: cssVar(s.couleur),
        borderColor: surface,
        borderWidth: horizontal ? { top: 1, bottom: 1 } : { left: 1, right: 1 },
        borderRadius: 4,
        borderSkipped: 'start',
        barPercentage: 0.86,
        categoryPercentage: 0.72,
      })),
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      layout: { padding: { left: 6 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cssVar('--surface-3'),
          titleColor: cssVar('--text'),
          bodyColor: cssVar('--text'),
          borderColor: cssVar('--border-2'),
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label} : ${format(ctx.raw)}` },
        },
      },
      scales: {
        [horizontal ? 'x' : 'y']: {
          beginAtZero: true, max,
          grid: { color: grille }, border: { display: false },
          ticks: { color: texte, font: { family: 'Sora', size: 11 }, callback: (v) => format(v) },
        },
        [horizontal ? 'y' : 'x']: {
          grid: { display: false }, border: { color: grille },
          ticks: { color: texte, font: { family: 'Sora', size: 11 }, autoSkip: false, callback(v) { const l = this.getLabelForValue(v); const n = this.chart.width < 480 ? 11 : 22; return l.length > n ? `${l.slice(0, n - 1)}…` : l; } },
        },
      },
    },
  });
  S.charts.push(chart);
  return chart;
}

const legende = (items) => `<div class="legend">${items.map(([lbl, v]) => `<span><i style="background:var(${v})"></i>${esc(lbl)}</span>`).join('')}</div>`;

// ─────────────────────────────── Démarrage ───────────────────────────────

function appliquerTheme() {
  let t = null;
  try { t = localStorage.getItem('koordin-theme'); } catch { /* stockage indisponible */ }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else if (t === 'auto') delete document.documentElement.dataset.theme;
}

async function demarrer() {
  appliquerTheme();
  if (DEMO) {
    sb = window.koordinDemo.client();
    sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_OUT') { S.profil = null; ecranConnexion(); } });
    const { data: { session } } = await sb.auth.getSession();
    return session ? ouvrirApplication(session) : ecranConnexion();
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installPrompt = e; });

  if (!CFG.SUPABASE_URL || /VOTRE-PROJET/.test(CFG.SUPABASE_URL) || !CFG.SUPABASE_ANON_KEY || /VOTRE-CLE/.test(CFG.SUPABASE_ANON_KEY)) {
    return ecranConfiguration();
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  sb.auth.onAuthStateChange((evt) => {
    if (evt === 'PASSWORD_RECOVERY') setTimeout(ecranNouveauMotDePasse, 0);
    if (evt === 'SIGNED_OUT') { S.profil = null; ecranConnexion(); }
  });
  capterParrainage();
  const suivi = location.hash.match(/^#\/suivi\/([A-Za-z0-9]{32,})/);
  if (suivi) return ecranSuiviClient(suivi[1]);
  const { data: { session } } = await sb.auth.getSession();
  if (location.hash.includes('type=recovery')) return;
  if (!session && !navigator.onLine) {
    const locale = sessionLocale();
    if (locale) return ouvrirApplication(locale);
  }
  if (!session) return ecranConnexion(parrainEnAttente() ? 'creer' : 'connexion');
  await ouvrirApplication(session);
}

// Sans réseau, la session enregistrée sur le téléphone suffit pour ouvrir KOORDIN
function sessionLocale() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.*-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k)); if (v?.user?.id) return v; }
    }
  } catch { /* rien */ }
  return null;
}

function ecranConfiguration() {
  $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    <p class="auth-sub">Dernière étape d’installation</p>
    <div class="notice warn">L’application n’est pas encore reliée à votre base de données.</div>
    <p style="font-size:13px;line-height:1.7">Ouvrez le fichier <b>config.js</b> et remplacez :<br>
    • <code>SUPABASE_URL</code> par l’adresse de votre projet Supabase<br>
    • <code>SUPABASE_ANON_KEY</code> par sa clé « anon public »<br><br>
    Vous les trouvez dans Supabase → <b>Project Settings → API</b>.<br>
    Le guide <b>GUIDE-INSTALLATION.md</b> détaille chaque étape.</p>
  </div></div>`;
}

// ─────────────────────────────── Connexion ───────────────────────────────

function ecranDemo() {
  const desc = {
    direction: 'Vue globale, budgets, retards, validation, équipe',
    coordinateur: 'Tous les chantiers, planning, validation des rapports',
    technicien: 'Ses chantiers, rapport du jour avec photos',
    achats: 'Commandes, fournisseurs, budget par lot',
    comptable: 'Factures, paiements, échéances',
    magasinier: 'Stock, sorties chantier, réceptions',
  };
  const ordre = Object.keys(ROLES);
  const personnes = window.koordinDemo.personnes().sort((a, b) => ordre.indexOf(a.role) - ordre.indexOf(b.role));
  $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    <p class="auth-sub" style="margin-bottom:8px">Démonstration : entrez dans KOORDIN avec le rôle de votre choix.</p>
    <p class="muted" style="font-size:12px;margin-bottom:16px">Entreprise fictive. Vos saisies restent sur cet appareil et sont partagées entre les rôles : envoyez un rapport en technicien, puis validez-le en direction.</p>
    <div class="demo-roles">${personnes.map((p) => `
      <button class="demo-role" data-email="${esc(p.email)}">
        <span class="avatar">${ROLES[p.role].ico}</span>
        <span class="demo-txt"><b>${esc(ROLES[p.role].label)} · ${esc(p.nom)}</b><span>${esc(desc[p.role] || '')}</span></span>
        <span class="demo-go">›</span>
      </button>`).join('')}</div>
  </div></div>`;
  $$('[data-email]').forEach((b) => (b.onclick = async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: b.dataset.email, password: 'demo' });
    if (error) return toast(messageErreur(error), 'err');
    routeDemo = '';
    await ouvrirApplication(data.session);
  }));
}

// ─── Parrainage : code reçu par lien (?parrain=CODE) ───
function parrainEnAttente() { try { return localStorage.getItem('koordin-parrain') || ''; } catch { return ''; } }
function capterParrainage() {
  const code = new URLSearchParams(location.search).get('parrain');
  if (!code) return;
  try { localStorage.setItem('koordin-parrain', code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)); } catch { /* rien */ }
  history.replaceState(null, '', location.pathname + location.hash);
}
const lienParrainage = (code) => `${location.origin}${location.pathname}?parrain=${code}`;

function ecranConnexion(onglet = 'connexion', message = null) {
  if (DEMO) return ecranDemo();
  const mm = marqueMemorisee();
  if (mm?.couleur) appliquerMarque({ couleur_marque: mm.couleur, nom: mm.nom, logo: mm.logo });
  const onglets = { connexion: 'Se connecter', creer: 'Créer mon entreprise', invite: 'J’ai une invitation' };
  const formulaires = {
    connexion: `
      ${F.text('email', 'Email ou numéro de téléphone', '', { required: true, autocomplete: 'username', placeholder: 'nom@entreprise.ci ou 07 01 02 03 04' })}
      ${F.text('password', 'Mot de passe', '', { type: 'password', required: true, autocomplete: 'current-password' })}
      <button class="btn primary block" type="submit">Se connecter</button>
      <button class="auth-link" type="button" data-oubli>Mot de passe oublié ?</button>`,
    creer: `
      ${F.text('entreprise', 'Nom de votre entreprise', '', { required: true, placeholder: 'Ex. BTP Ivoire Construction' })}
      ${F.text('nom', 'Votre nom complet', '', { required: true, autocomplete: 'name' })}
      ${F.text('email', 'Email professionnel', '', { type: 'email', required: true, autocomplete: 'email' })}
      ${F.text('password', 'Mot de passe (8 caractères minimum)', '', { type: 'password', required: true, autocomplete: 'new-password' })}
      ${F.text('parrain', 'Code de parrainage (facultatif)', parrainEnAttente(), { placeholder: 'Ex. GEC4K9', autocomplete: 'off' })}
      <div class="auth-parrain hidden" id="auth-parrain"></div>
      <button class="btn primary block" type="submit">Créer mon espace KOORDIN</button>
      <p class="muted" style="font-size:12px">Vous serez l’administrateur (rôle Direction) et pourrez inviter votre équipe.</p>`,
    invite: `
      <p class="muted" style="font-size:12px">Utilisez <b>exactement</b> le numéro de téléphone ou l’email indiqué dans votre invitation.</p>
      ${F.text('nom', 'Votre nom complet', '', { required: true, autocomplete: 'name' })}
      ${F.text('email', 'Numéro de téléphone ou email (celui de l’invitation)', '', { required: true, autocomplete: 'username', placeholder: '07 01 02 03 04' })}
      ${F.text('password', 'Choisissez un mot de passe (8 caractères minimum)', '', { type: 'password', required: true, autocomplete: 'new-password' })}
      <button class="btn primary block" type="submit">Rejoindre mon équipe</button>`,
  };
  $('#root').innerHTML = `<div class="auth-wrap auth-split"><div class="aurore aurore-auth" aria-hidden="true"><i></i><i></i><i></i></div>
    <aside class="auth-visual" aria-hidden="true">
      <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
      <div class="auth-illu">${sceneChantier(11)}</div>
      <h2 class="auth-slogan">Tous vos chantiers,<br><span>une seule plateforme.</span></h2>
      <ul class="auth-points">
        <li><b>🔧 Terrain</b> Rapports du jour et photos depuis le téléphone</li>
        <li><b>📊 Direction</b> Avancement, budgets et retards en temps réel</li>
        <li><b>🛒 Achats · Compta · Magasin</b> Chaque service dans son espace</li>
      </ul>
    </aside>
    <div class="auth-card">
    <div class="auth-illu-mobile">${sceneChantier(11)}</div>
    <div class="brand auth-brand-mobile"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    ${marqueMemorisee()?.logo ? `<div class="auth-marque"><img src="${esc(marqueMemorisee().logo)}" alt=""><span>Espace ${esc(marqueMemorisee().nom)}</span></div>` : ''}
    <p class="auth-sub">Tous vos chantiers, une seule plateforme.</p>
    <div class="auth-tabs">${Object.entries(onglets).map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === onglet ? 'active' : ''}">${l}</button>`).join('')}</div>
    ${message ? `<div class="auth-msg ${message.type}" style="margin-bottom:14px">${esc(message.texte)}</div>` : ''}
    <form class="auth-form" id="auth-form" novalidate>${formulaires[onglet]}</form>
  </div></div>`;

  $$('[data-tab]').forEach((b) => (b.onclick = () => ecranConnexion(b.dataset.tab)));
  const champParrain = $('[name="parrain"]');
  if (champParrain) {
    let minuterie;
    const verifier = async () => {
      const code = champParrain.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const zone = $('#auth-parrain');
      if (code.length < 4) { zone.classList.add('hidden'); return; }
      const { data } = await sb.rpc('verifier_code_parrainage', { p_code: code });
      zone.classList.remove('hidden');
      zone.className = `auth-parrain ${data ? 'ok' : 'err'}`;
      zone.textContent = data ? `🎁 Invité par ${data} : votre essai gratuit dure 30 jours au lieu de 14.` : 'Code de parrainage inconnu : vérifiez-le ou laissez la case vide.';
    };
    champParrain.addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(verifier, 400); });
    if (champParrain.value) verifier();
  }
  $('[data-oubli]')?.addEventListener('click', ecranMotDePasseOublie);
  const form = $('#auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const v = lireFormulaire(form);
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      v.email = versIdentifiant(v.email);
      if (onglet === 'connexion') {
        const { data, error } = await sb.auth.signInWithPassword({ email: v.email, password: v.password });
        if (error) throw error;
        await ouvrirApplication(data.session);
        return;
      }
      if (v.password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
      const meta = onglet === 'creer' ? { nom: v.nom, entreprise: v.entreprise } : { nom: v.nom };
      if (onglet === 'creer' && v.parrain) meta.parrain = v.parrain.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { data, error } = await sb.auth.signUp({
        email: v.email, password: v.password,
        options: { data: meta, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      if (meta.parrain) { try { localStorage.removeItem('koordin-parrain'); } catch { /* rien */ } }
      if (data.session) {
        await ouvrirApplication(data.session);
      } else {
        ecranConnexion('connexion', { type: 'ok', texte: `Compte créé. Un email de confirmation a été envoyé à ${v.email} : cliquez sur le lien, puis connectez-vous ici.` });
      }
    } catch (err) {
      ecranConnexion(onglet, { type: 'err', texte: messageErreur(err) });
    } finally {
      btn.disabled = false;
    }
  });
}

function ecranMotDePasseOublie() {
  $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    <p class="auth-sub">Recevez un lien pour choisir un nouveau mot de passe.</p>
    <form class="auth-form" id="f">
      ${F.text('email', 'Votre email', '', { required: true })}
      <p class="muted" style="font-size:12px">Compte créé avec un numéro de téléphone ? Demandez à votre direction de vous choisir un nouveau mot de passe depuis l’écran Équipe.</p>
      <button class="btn primary block" type="submit">Envoyer le lien</button>
      <button class="auth-link" type="button" id="retour">← Retour à la connexion</button>
    </form></div></div>`;
  $('#retour').onclick = () => ecranConnexion();
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { email } = lireFormulaire(e.target);
    if (!email || !email.includes('@')) {
      ecranConnexion('connexion', { type: 'err', texte: 'Pour un compte créé avec un numéro de téléphone, demandez à votre direction de réinitialiser votre mot de passe.' });
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    ecranConnexion('connexion', error
      ? { type: 'err', texte: messageErreur(error) }
      : { type: 'ok', texte: 'Si un compte existe pour cette adresse, un lien vient d’être envoyé.' });
  };
}

function ecranNouveauMotDePasse() {
  $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    <p class="auth-sub">Choisissez votre nouveau mot de passe.</p>
    <form class="auth-form" id="f">
      ${F.text('password', 'Nouveau mot de passe (8 caractères minimum)', '', { type: 'password', required: true, autocomplete: 'new-password' })}
      <button class="btn primary block" type="submit">Enregistrer</button>
    </form></div></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { password } = lireFormulaire(e.target);
    if (!password || password.length < 8) return toast('8 caractères minimum.', 'err');
    const { error } = await sb.auth.updateUser({ password });
    if (error) return toast(messageErreur(error), 'err');
    history.replaceState(null, '', location.pathname);
    toast('Mot de passe modifié.');
    const { data: { session } } = await sb.auth.getSession();
    ouvrirApplication(session);
  };
}

async function ouvrirApplication(session) {
  S.session = session;
  $('#root').innerHTML = loading();
  try {
    let profil = await avecCache('profil', () => q(sb.from('profils').select('*, entreprises(*)').eq('id', session.user.id).maybeSingle()), { id: session.user.id });
    if (!profil && navigator.onLine) {
      const rejoint = await q(sb.rpc('accepter_invitation'));
      if (rejoint) profil = await q(sb.from('profils').select('*, entreprises(*)').eq('id', session.user.id).maybeSingle());
    }
    if (!profil) return ecranSansEntreprise(session.user.email);
    S.profil = profil;
    S.entreprise = profil.entreprises;
    appliquerMarque();
    S.plateformeAdmin = false;
    if (!DEMO) {
      const { data: admin, error: errAdmin } = navigator.onLine ? await sb.rpc('est_admin_plateforme') : { error: true };
      S.plateformeAdmin = errAdmin ? relire('admin') === true : admin === true;
      if (!errAdmin) memoriser('admin', S.plateformeAdmin);
    }
    await chargerEquipe();
    construireInterface();
    ecouterTempsReel();
    if (!DEMO) window.onhashchange = naviguer;
    await naviguer();
    if (!DEMO && notificationsActives()) activerNotifications({ silencieux: true });
    if (!DEMO) { suivreMisesAJour(); ecouterReseau(); majIndicateurReseau(); setTimeout(() => { synchroniser(); prechargerHorsLigne(); }, 1200); }
    let guideVu = '1';
    try { guideVu = localStorage.getItem(`koordin-guide-vu-${S.profil.id}`); } catch { /* rien */ }
    if (!DEMO && !guideVu) setTimeout(() => ouvrirGuide({ premiereFois: true }), 900);
  } catch (e) {
    console.error(e);
    $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card"><div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
      <div class="auth-msg err" style="margin:16px 0">${esc(messageErreur(e))}</div>
      <button class="btn primary block" onclick="location.reload()">Réessayer</button></div></div>`;
  }
}

// ═══════════════════════════════ FONCTIONNEMENT SANS RÉSEAU (2.5) ═══════════════════════════════
// • Les données utiles au terrain (chantiers, lots, ouvriers) sont gardées sur le téléphone.
// • Un rapport ou un appel fait sans réseau est rangé dans une « boîte d'envoi » (IndexedDB),
//   puis envoyé tout seul dès que le réseau revient. Rien n'est perdu si l'application est fermée.

const estErreurReseau = (e) => !navigator.onLine || /Failed to fetch|NetworkError|Load failed|fetch failed|ERR_INTERNET|network/i.test(String(e?.message || e || ''));
const cleCache = (k, id = S.profil?.id) => `koordin-cache-${id || 'x'}-${k}`;
function memoriser(k, donnees, id) { try { localStorage.setItem(cleCache(k, id), JSON.stringify(donnees)); } catch { /* stockage plein */ } }
function relire(k, id) { try { const v = localStorage.getItem(cleCache(k, id)); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
async function avecCache(k, charger, { defaut, id } = {}) {
  if (!navigator.onLine) {
    // Hors ligne : on lit directement le téléphone (une requête mettrait plusieurs secondes à échouer)
    const c = relire(k, id);
    if (c !== undefined) return c;
    if (defaut !== undefined) return defaut;
    throw new Error('Failed to fetch');
  }
  try {
    const d = await charger();
    memoriser(k, d, id);
    return d;
  } catch (e) {
    if (!estErreurReseau(e)) throw e;
    const c = relire(k, id);
    if (c !== undefined) return c;
    if (defaut !== undefined) return defaut;
    throw e;
  }
}

// ─── Boîte d'envoi ───
let baseEnvois = null;
function ouvrirBaseEnvois() {
  baseEnvois ||= new Promise((ok, ko) => {
    const r = indexedDB.open('koordin-envois', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('envois', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { baseEnvois = null; ko(r.error); };
  });
  return baseEnvois;
}
async function boiteEnvois(mode, action) {
  const db = await ouvrirBaseEnvois();
  return new Promise((ok, ko) => {
    const tx = db.transaction('envois', mode);
    const req = action(tx.objectStore('envois'));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => ko(tx.error);
  });
}
const ajouterEnvoi = (envoi) => boiteEnvois('readwrite', (s) => s.put({ id: crypto.randomUUID(), profil_id: S.profil.id, cree_le: new Date().toISOString(), essais: 0, erreur: null, ...envoi }));
const supprimerEnvoi = (id) => boiteEnvois('readwrite', (s) => s.delete(id));
const majEnvoi = (envoi) => boiteEnvois('readwrite', (s) => s.put(envoi));
async function listeEnvois() {
  try { return ((await boiteEnvois('readonly', (s) => s.getAll())) || []).filter((x) => x.profil_id === S.profil?.id).sort((a, b) => a.cree_le.localeCompare(b.cree_le)); } catch { return []; }
}

// ─── 3.11 : vidéos dans les rapports ───
const VIDEO_MAX_OCTETS = 48 * 1024 * 1024;   // Supabase accepte 50 Mo par fichier
const VIDEO_MAX_SECONDES = 180;              // 3 minutes filmées dans l'application
const tailleLisible = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const dureeLisible = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function formatEnregistrement() {
  const choix = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return choix.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}
const extensionVideo = (type) => (/mp4/.test(type) ? 'mp4' : /quicktime/.test(type) ? 'mov' : /3gpp/.test(type) ? '3gp' : 'webm');
const typeVideoServeur = (type) => (/mp4/.test(type) ? 'video/mp4' : /quicktime/.test(type) ? 'video/quicktime' : /3gpp/.test(type) ? 'video/3gpp' : 'video/webm');
async function dureeVideo(blob) {
  return new Promise((ok) => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    const u = URL.createObjectURL(blob);
    const fin = (d) => { URL.revokeObjectURL(u); ok(Number.isFinite(d) ? d : 0); };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return fin(v.duration);
      // WebM enregistrés : la durée n'est connue qu'en allant à la fin
      v.currentTime = 1e7; v.ontimeupdate = () => { v.ontimeupdate = null; fin(v.duration); };
    };
    v.onerror = () => fin(0);
    setTimeout(() => fin(0), 8000);
    v.src = u;
  });
}

// Filmer dans l'application : caméra arrière, qualité réglée pour un envoi léger (≈ 10 Mo par minute)
function filmerVideo() {
  return new Promise((resoudre) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Ce téléphone ne permet pas de filmer ici : utilisez « Vidéo de la galerie ».', 'warn', 7000); return resoudre(null); }
    let flux = null, rec = null, morceaux = [], debut = 0, minuterie = null, face = 'environment', fini = false;
    const m = ouvrirModale({
      titre: '🎥 Filmer le chantier',
      corps: `<div class="vf-zone"><video id="vf-apercu" autoplay playsinline muted></video><div class="vf-chrono hidden" id="vf-chrono"><i></i><span>0:00</span> / ${dureeLisible(VIDEO_MAX_SECONDES)}</div></div>
        <p class="muted vf-aide" id="vf-aide">Appuyez sur le rond rouge pour commencer. 3 minutes au maximum.</p>
        <div class="vf-boutons"><button type="button" class="btn" id="vf-retourner">🔄</button><button type="button" class="vf-rond" id="vf-rec" aria-label="Commencer à filmer"></button><button type="button" class="btn ghost" data-close>Annuler</button></div>`,
    });
    const el = m.el, apercu = $('#vf-apercu', el);
    const arreterFlux = () => flux?.getTracks().forEach((t) => t.stop());
    const terminer = (res) => { if (fini) return; fini = true; clearInterval(minuterie); arreterFlux(); obs.disconnect(); m.fermer(); resoudre(res); };
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { clearInterval(minuterie); if (rec?.state === 'recording') { fini = true; rec.onstop = null; rec.stop(); } arreterFlux(); if (!fini) { fini = true; resoudre(null); } obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    const ouvrirCamera = async () => {
      arreterFlux();
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: true }); } catch (e) { toast('Caméra inaccessible. Autorisez la caméra et le micro pour KOORDIN.', 'err', 7000); return terminer(null); }
      }
      apercu.srcObject = flux; apercu.classList.toggle('miroir', face === 'user');
    };
    $('#vf-retourner', el).onclick = () => { if (rec?.state === 'recording') return; face = face === 'environment' ? 'user' : 'environment'; ouvrirCamera(); };
    $('#vf-rec', el).onclick = () => {
      if (rec?.state === 'recording') { rec.stop(); return; }
      const type = formatEnregistrement();
      try { rec = new MediaRecorder(flux, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1200000, audioBitsPerSecond: 64000 }); } catch { rec = new MediaRecorder(flux); }
      morceaux = [];
      rec.ondataavailable = (e) => { if (e.data?.size) morceaux.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(morceaux, { type: rec.mimeType || type || 'video/webm' });
        const duree = (Date.now() - debut) / 1000;
        terminer(blob.size ? { blob, duree } : null);
      };
      rec.start(1000); debut = Date.now();
      $('#vf-rec', el).classList.add('enreg'); $('#vf-rec', el).setAttribute('aria-label', 'Arrêter');
      $('#vf-chrono', el).classList.remove('hidden'); $('#vf-retourner', el).disabled = true;
      $('#vf-aide', el).textContent = 'On filme… appuyez sur le carré pour arrêter.';
      minuterie = setInterval(() => {
        const s = (Date.now() - debut) / 1000;
        $('#vf-chrono span', el).textContent = dureeLisible(s);
        if (s >= VIDEO_MAX_SECONDES && rec.state === 'recording') rec.stop();
      }, 250);
    };
    ouvrirCamera();
  });
}

// Vidéo trop lourde (galerie) : on la réencode en 720p léger, en temps réel, sur le téléphone
async function alleger(fichier, progression = () => {}) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Vidéo trop lourde (plus de 48 Mo) et ce téléphone ne sait pas la réduire. Filmez plutôt dans KOORDIN avec « 🎥 Filmer ».');
  const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto';
  const u = URL.createObjectURL(fichier); v.src = u;
  await new Promise((ok, ko) => { v.onloadedmetadata = ok; v.onerror = () => ko(new Error('Vidéo illisible sur ce téléphone.')); });
  if (v.duration > 600) { URL.revokeObjectURL(u); throw new Error('Vidéo trop longue : 10 minutes au maximum. Coupez-la dans la galerie du téléphone.'); }
  const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k / 2) * 2; c.height = Math.round(v.videoHeight * k / 2) * 2;
  const ctx = c.getContext('2d');
  const flux = c.captureStream(25);
  let audio = null;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audio.createMediaStreamDestination();
    audio.createMediaElementSource(v).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => flux.addTrack(t));
  } catch { v.muted = true; }
  const type = formatEnregistrement();
  const rec = new MediaRecorder(flux, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1200000, audioBitsPerSecond: 64000 });
  const morceaux = []; rec.ondataavailable = (e) => { if (e.data?.size) morceaux.push(e.data); };
  const fin = new Promise((ok) => { rec.onstop = ok; });
  let actif = true;
  const dessiner = () => { if (!actif) return; ctx.drawImage(v, 0, 0, c.width, c.height); progression(Math.min(1, v.currentTime / v.duration)); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(dessiner); else requestAnimationFrame(dessiner); };
  rec.start(1000);
  await v.play();
  dessiner();
  await new Promise((ok) => { v.onended = ok; });
  actif = false; rec.stop(); await fin;
  try { audio?.close(); } catch { /* rien */ }
  URL.revokeObjectURL(u);
  const blob = new Blob(morceaux, { type: rec.mimeType || type || 'video/webm' });
  if (blob.size > VIDEO_MAX_OCTETS) throw new Error('Même réduite, la vidéo dépasse 48 Mo. Coupez-la en plusieurs morceaux.');
  return { blob, duree: v.duration };
}
async function preparerVideoGalerie(fichier, progression) {
  if (fichier.size <= VIDEO_MAX_OCTETS) return { blob: fichier, duree: await dureeVideo(fichier) };
  return alleger(fichier, progression);
}

// Envoi des vidéos d'un rapport (après les photos)
async function envoyerVideosRapport(rapport, videos, progression = () => {}) {
  if (!videos.length) return 0;
  let echecs = 0;
  let deja = [];
  try { deja = ((await sb.from('rapport_videos').select('chemin').eq('rapport_id', rapport.id)).data || []).map((x) => x.chemin); } catch { /* rien */ }
  for (let i = 0; i < videos.length; i++) {
    progression(i + 1, videos.length);
    const v = videos[i], blob = v.blob || v;
    const type = typeVideoServeur(blob.type || '');
    const chemin = `${S.entreprise.id}/${rapport.id}/video-${i + 1}.${extensionVideo(type)}`;
    if (deja.includes(chemin)) continue;
    const { error: e1 } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: type, upsert: false });
    if (e1 && !/exists|Duplicate/i.test(e1.message)) { if (estErreurReseau(e1)) throw e1; console.warn('vidéo', e1); echecs++; continue; }
    const { error: e2 } = await sb.from('rapport_videos').insert({ rapport_id: rapport.id, chemin, duree: v.duree ? Math.round(v.duree * 10) / 10 : null, taille: blob.size });
    if (e2) { if (estErreurReseau(e2)) throw e2; console.warn('vidéo', e2); echecs++; }
  }
  return echecs;
}

// ─── Envoi d'un rapport (même chemin en ligne et depuis la boîte d'envoi) ───
async function envoyerRapport(rapport, photos, progression = () => {}, videos = [], progressionVideo = () => {}) {
  const { error } = await sb.from('rapports').insert(rapport);
  if (error && !/duplicate key|rapports_pkey|23505/.test(`${error.message} ${error.code}`)) throw error;
  const { echecs, raison } = await envoyerPhotosRapport(rapport.id, photos, progression);
  const ev = await envoyerVideosRapport(rapport, videos, progressionVideo);
  return { echecs: echecs + ev, raison };
}

// Chaque photo est essayée 3 fois ; une photo déjà arrivée n'est jamais renvoyée
async function envoyerPhotosRapport(rapportId, photos, progression = () => {}, prefixe = 'photo') {
  let echecs = 0, raison = '';
  const deja = photos.length ? ((await sb.from('rapport_photos').select('chemin').eq('rapport_id', rapportId)).data || []).map((x) => x.chemin) : [];
  for (let i = 0; i < photos.length; i++) {
    progression(i + 1, photos.length);
    const blob = photos[i];
    const type = /^image\/(jpeg|png|webp)$/.test(blob?.type || '') ? blob.type : 'image/jpeg';
    const chemin = `${S.entreprise.id}/${rapportId}/${prefixe}-${i + 1}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`;
    if (deja.includes(chemin)) continue;
    let ok = false, derniere = null;
    for (let essai = 0; essai < 3 && !ok; essai++) {
      if (essai) await new Promise((r) => setTimeout(r, essai * 2000));
      const { error: e1 } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: type, upsert: false });
      if (e1 && !/exists|Duplicate/i.test(e1.message)) { derniere = e1; continue; }
      const { error: e2 } = await sb.from('rapport_photos').insert({ rapport_id: rapportId, chemin });
      if (e2) { derniere = e2; continue; }
      ok = true;
    }
    if (!ok) {
      if (estErreurReseau(derniere)) throw derniere;
      echecs++;
      raison ||= raisonEchecPhoto(derniere, blob);
      console.warn('photo', i + 1, derniere);
    }
  }
  return { echecs, raison };
}
function raisonEchecPhoto(e, blob) {
  const m = String(e?.message || e || '');
  if (/size|too large|exceeded|413/i.test(m)) return `photo trop lourde (${tailleLisible(blob?.size || 0)})`;
  if (/mime|type/i.test(m)) return 'format de photo non accepté';
  if (/row-level|policy|permission|403|Unauthorized/i.test(m)) return 'droits insuffisants';
  return m.slice(0, 80) || 'raison inconnue';
}

// ─── Envoi d'un appel de pointage ───
async function envoyerAppel({ projet_id, date, choix }) {
  const existants = await q(sb.from('pointages').select('id, ouvrier_id, presence, paye').eq('projet_id', projet_id).eq('date_pointage', date));
  const deja = new Map(existants.map((x) => [x.ouvrier_id, x]));
  const ajouts = [], modifs = [], suppr = [];
  choix.forEach(([id, v]) => {
    const ex = deja.get(id);
    if (ex?.paye) return;
    if (!ex && v) ajouts.push({ projet_id, ouvrier_id: id, date_pointage: date, presence: v });
    else if (ex && !v) suppr.push(ex.id);
    else if (ex && v && Number(ex.presence) !== v) modifs.push([ex.id, v]);
  });
  if (ajouts.length) await q(sb.from('pointages').insert(ajouts));
  for (const [id, v] of modifs) await q(sb.from('pointages').update({ presence: v }).eq('id', id));
  if (suppr.length) await q(sb.from('pointages').delete().in('id', suppr));
}

// ─── Synchronisation ───
let synchroEnCours = false;
async function synchroniser({ silencieux = false } = {}) {
  if (synchroEnCours || DEMO || !S.profil || !navigator.onLine) { majIndicateurReseau(); return; }
  const envois = await listeEnvois();
  if (!envois.length) { majIndicateurReseau(); return; }
  synchroEnCours = true;
  majIndicateurReseau();
  let reussis = 0, echoues = 0;
  try {
    await sb.auth.getSession(); // renouvelle la connexion si elle a expiré pendant la coupure
    for (const envoi of envois) {
      try {
        if (envoi.type === 'rapport') {
          const { echecs, raison } = await envoyerRapport(envoi.rapport, envoi.photos || [], undefined, envoi.videos || []);
          if (echecs && (envoi.essais || 0) < 6) {
            await majEnvoi({ ...envoi, essais: (envoi.essais || 0) + 1, erreur: `${echecs} photo(s) ou vidéo(s) pas encore envoyée(s) : ${raison}` });
            continue;
          }
          if (echecs) toast(`Rapport envoyé, mais ${echecs} photo(s) ou vidéo(s) n’ont pas pu partir (${raison}). Ajoutez-les depuis le rapport.`, 'warn', 9000);
        } else if (envoi.type === 'appel') {
          await envoyerAppel(envoi.appel);
        }
        await supprimerEnvoi(envoi.id);
        reussis++;
      } catch (e) {
        if (estErreurReseau(e)) break;
        echoues++;
        await majEnvoi({ ...envoi, essais: envoi.essais + 1, erreur: messageErreur(e) });
      }
    }
  } finally {
    synchroEnCours = false;
  }
  if (reussis && !silencieux) toast(`📶 Réseau retrouvé : ${reussis} envoi${reussis > 1 ? 's' : ''} terminé${reussis > 1 ? 's' : ''} ✅`);
  if (echoues) toast(`${echoues} envoi(s) refusé(s) : touchez l’indicateur en haut pour voir pourquoi.`, 'err', 7000);
  await majIndicateurReseau();
  if (reussis && /^#\/(rapports|pointage|dashboard)?$/.test(hashCourant() || '#/')) naviguer();
}

async function majIndicateurReseau() {
  const pastille = $('#reseau');
  if (!pastille || !S.profil) return;
  const n = (await listeEnvois()).length;
  const enLigne = navigator.onLine;
  pastille.classList.toggle('hidden', enLigne && !n);
  pastille.classList.toggle('hors', !enLigne);
  pastille.innerHTML = !enLigne
    ? `<span class="reseau-point"></span>Hors ligne${n ? ` · ${n}` : ''}`
    : synchroEnCours ? '<span class="reseau-point tourne"></span>Envoi…' : `<span class="reseau-point attente"></span>${n} à envoyer`;
  pastille.setAttribute('aria-label', !enLigne ? `Hors ligne, ${n} envoi(s) en attente` : `${n} envoi(s) en attente`);
}

async function ouvrirBoiteEnvois() {
  const envois = await listeEnvois();
  const m = ouvrirModale({
    titre: navigator.onLine ? '📤 Envois en attente' : '📶 Vous êtes hors ligne',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:12px">${navigator.onLine
      ? 'Ces éléments ont été enregistrés sur le téléphone pendant une coupure de réseau.'
      : 'Vous pouvez continuer à faire vos rapports et votre pointage : ils sont gardés sur le téléphone et partiront tout seuls dès que le réseau revient.'}</p>
      ${envois.length ? `<div class="paie-liste">${envois.map((x) => `<div class="paie-ligne">
        <div class="paie-nom"><b>${x.type === 'rapport' ? `📋 Rapport du ${fdate(x.rapport.date_rapport)}` : `👷 Appel du ${fdate(x.appel.date)}`}</b>
          <span>${esc(x.libelle || '')}${x.photos?.length ? ` · ${x.photos.length} photo(s)` : ''}</span>
          ${x.erreur ? `<span style="color:var(--crit)">⚠️ ${esc(x.erreur)}</span>` : `<span>Enregistré le ${new Date(x.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>`}</div>
        <div class="paie-montant"><button type="button" class="btn sm ghost" data-retirer="${x.id}">Retirer</button></div></div>`).join('')}</div>`
        : empty('✅', 'Rien en attente : tout est envoyé.')}
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button>${envois.length && navigator.onLine ? '<button type="button" class="btn primary" id="envoyer-tout">📤 Envoyer maintenant</button>' : ''}</div>`,
  });
  $('#envoyer-tout', m.el)?.addEventListener('click', async () => { m.fermer(); await synchroniser(); });
  $$('[data-retirer]', m.el).forEach((b) => (b.onclick = async () => {
    if (!(await confirmer('Retirer cet envoi ? Il sera définitivement perdu.', 'Retirer'))) return;
    await supprimerEnvoi(b.dataset.retirer);
    m.fermer(); majIndicateurReseau(); ouvrirBoiteEnvois();
  }));
}

// Préparer le téléphone pour travailler sans réseau (chantiers, lots, ouvriers)
async function prechargerHorsLigne() {
  if (DEMO || !navigator.onLine || !can('technicien', 'coordinateur', 'direction')) return;
  try {
    const projets = await avecCache('projets-actifs', () => q(sb.from('projets').select('id, nom, statut').neq('statut', 'termine').order('nom')));
    await Promise.all(projets.slice(0, 30).map((pr) => avecCache(`lots-${pr.id}`, () => q(sb.from('lots').select('id, nom, avancement').eq('projet_id', pr.id).order('ordre')))));
    await avecCache('ouvriers-actifs', () => q(sb.from('ouvriers').select('id, nom, metier, telephone, tarif_jour, actif').eq('actif', true).order('nom')), { defaut: [] });
  } catch { /* on réessaiera à la prochaine ouverture */ }
}

function ecouterReseau() {
  if (DEMO || ecouterReseau.fait) return;
  ecouterReseau.fait = true;
  window.addEventListener('online', () => { majIndicateurReseau(); setTimeout(() => synchroniser(), 1500); });
  window.addEventListener('offline', () => { majIndicateurReseau(); toast('📶 Réseau perdu : vous pouvez continuer, vos rapports et pointages seront envoyés plus tard.', 'warn', 6000); });
  setInterval(() => { if (navigator.onLine) synchroniser({ silencieux: false }); }, 60000);
}

// ─── Guide vidéo de prise en main ───
// Une vidéo courte par métier, montrée automatiquement à la première connexion.

const GUIDES = {
  direction: { video: 'guide-direction.mp4?v=2', titre: 'Piloter vos chantiers', duree: '1 min 25' },
  coordinateur: { video: 'guide-direction.mp4?v=2', titre: 'Piloter vos chantiers', duree: '1 min 25' },
  technicien: { video: 'guide-technicien.mp4?v=2', titre: 'Votre journée sur le chantier', duree: '1 min 35' },
  achats: { video: 'guide-services.mp4?v=2', titre: 'Achats, comptabilité et magasin', duree: '1 min 35' },
  comptable: { video: 'guide-services.mp4?v=2', titre: 'Achats, comptabilité et magasin', duree: '1 min 35' },
  magasinier: { video: 'guide-services.mp4?v=2', titre: 'Achats, comptabilité et magasin', duree: '1 min 35' },
};
function ouvrirGuide({ premiereFois = false } = {}) {
  const g = GUIDES[role()] || GUIDES.direction;
  try { localStorage.setItem(`koordin-guide-vu-${S.profil.id}`, '1'); } catch { /* rien */ }
  const m = ouvrirModale({
    titre: premiereFois ? `Bienvenue sur KOORDIN, ${S.profil.nom.split(' ')[0]} 👋` : '🎓 Guide vidéo',
    corps: `<p style="margin-bottom:12px">${premiereFois ? 'Découvrez l’essentiel en' : 'Revoir la prise en main :'} <b>${esc(g.titre)}</b> · ${esc(g.duree)}</p>
      <div class="guide-video"><video controls playsinline preload="metadata" poster="${g.video.replace('.mp4', '.jpg')}" src="${g.video}"></video>
        <p class="guide-erreur hidden">La vidéo n’a pas pu être chargée. Vérifiez votre connexion, puis réessayez depuis le menu (avatar → 🎓 Guide vidéo).</p></div>
      <p class="muted mt" style="font-size:12px">Vous pourrez revoir ce guide à tout moment : avatar en haut à droite → 🎓 Guide vidéo.</p>
      <div class="form-actions"><button class="btn primary" data-close>${premiereFois ? 'Commencer' : 'Fermer'}</button></div>`,
  });
  const v = $('video', m.el);
  v.addEventListener('error', () => { v.classList.add('hidden'); $('.guide-erreur', m.el).classList.remove('hidden'); });
  m.el.addEventListener('click', (e) => { if (e.target === m.el || e.target.closest('[data-close]')) v.pause(); });
}

// ─── Mises à jour de l'application ───
// version.json (publié avec l'application) annonce la dernière version et ses nouveautés.
// Si elle diffère de la version en cours, un bandeau propose de mettre à jour.

let infosVersion = null;
async function lireVersionPubliee() {
  try {
    const rep = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (rep.ok) infosVersion = await rep.json();
  } catch { /* hors ligne : on réessaiera */ }
  return infosVersion;
}
function suivreMisesAJour() {
  const verifier = async () => {
    const v = await lireVersionPubliee();
    if (v?.version && v.version !== VERSION && !$('#maj-bar')) {
      const bar = document.createElement('div');
      bar.id = 'maj-bar';
      bar.className = 'maj-bar';
      bar.innerHTML = `<span>✨ Une nouvelle version de KOORDIN est disponible.</span><button class="btn sm primary" type="button">Mettre à jour</button>`;
      $('button', bar).onclick = async () => {
        try { (await caches.keys()).forEach((k) => caches.delete(k)); } catch { /* rien */ }
        location.reload();
      };
      document.body.appendChild(bar);
    }
  };
  verifier();
  setInterval(verifier, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
  // Après une mise à jour : montrer les nouveautés une fois
  let vue = null;
  try { vue = localStorage.getItem('koordin-version-vue'); } catch { /* rien */ }
  try { localStorage.setItem('koordin-version-vue', VERSION); } catch { /* rien */ }
  if (vue && vue !== VERSION) setTimeout(() => afficherNouveautes(), 800);
}
async function afficherNouveautes() {
  const v = infosVersion || await lireVersionPubliee();
  const notes = v?.version === VERSION ? v.nouveautes || [] : [];
  ouvrirModale({
    titre: `✨ Nouveautés de KOORDIN ${VERSION}`,
    corps: `${notes.length ? `<ul class="nouveautes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p>Vous utilisez la dernière version de KOORDIN.</p>'}
      <p class="muted mt" style="font-size:12px">Version ${esc(VERSION)}${v?.date ? ` · publiée le ${new Date(v.date).toLocaleDateString('fr-FR')}` : ''}</p>
      <div class="form-actions"><button class="btn primary" data-close>Compris</button></div>`,
  });
}

function ecranSansEntreprise(email) {
  $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
    <p class="auth-sub">Connecté en tant que ${esc(afficherIdentifiant(email))}</p>
    <div class="notice warn">Votre compte n’est rattaché à aucune entreprise, ou il a été désactivé.</div>
    <p style="font-size:13px">Demandez à la direction de votre entreprise de vous inviter avec ce numéro ou cette adresse email, puis reconnectez-vous.</p>
    <div class="form-actions"><button class="btn" id="re">Réessayer</button><button class="btn primary" id="out">Se déconnecter</button></div>
  </div></div>`;
  $('#re').onclick = () => location.reload();
  $('#out').onclick = () => sb.auth.signOut();
}

// ─────────────────────────────── Interface ───────────────────────────────

// ─── Icônes dessinées (remplacent les emojis de navigation) ───
const TRACES = {
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
  projets: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9.5 21v-6h5v6"/><path d="M9 11h.01M15 11h.01"/>',
  communiques: '<path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l6 4V5L7 9H4.5A1.5 1.5 0 0 0 3 10.5Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  'nouveau-rapport': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  rapports: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5V3h6v1.5"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  pointage: '<circle cx="12" cy="12.5" r="8.5"/><path d="M12 8v4.5l3 2"/><path d="M9.5 2.5h5"/>',
  achats: '<path d="M3 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.3"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  compta: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M16 14.5h2"/><path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  ventes: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3 12.5h18"/><path d="M11 12.5v2h2v-2"/>',
  stock: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  equipe: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.3"/>',
  ia: '<path d="M12 3.5 13.8 9 19.5 11l-5.7 2-1.8 5.5-1.8-5.5L4.5 11l5.7-2L12 3.5Z"/><path d="M19 3v3M17.5 4.5h3M5 17.5v3M3.5 19h3"/>',
  abonnement: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  parametres: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/>',
  console: '<path d="M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  materiel: '<path d="M2.5 17V9.5h9l3 4.5h4a2 2 0 0 1 2 2v1"/><path d="M11.5 9.5V6h-5v3.5"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/><path d="M8.5 17.5h6.5"/>',
  securite: '<path d="M4 14a8 8 0 0 1 16 0v2H4v-2Z"/><path d="M12 6V3.5"/><path d="M9.5 6.5 9 4M14.5 6.5 15 4"/><path d="M3 16h18v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V16Z"/>',
  'mon-espace': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  appels: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/>',
  contrats: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h3"/><path d="M4 7v13a1 1 0 0 0 1 1h2"/>',
  salaires: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  controles: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/>',
  savoir: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M9 7.5h7M9 11h5"/>',
  ajouter: '<path d="M12 5v14M5 12h14"/>',
  plus: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
  cloche: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  tendance: '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
  oeil: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icone = (nom, taille = 22) => TRACES[nom]
  ? `<svg class="ic" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRACES[nom]}</svg>`
  : '';
const ICONE_EMOJI = { '🏗️': 'projets', '📈': 'tendance', '💰': 'compta', '📋': 'rapports', '📣': 'communiques', '👁️': 'oeil' };

// Menu du bas : 4 raccourcis par métier + « Plus »
const NAV_PRIORITE = {
  direction: ['dashboard', 'projets', 'rapports', 'compta'],
  coordinateur: ['dashboard', 'projets', 'rapports', 'pointage'],
  technicien: ['dashboard', 'rapports', 'pointage', 'nouveau-rapport'],
  achats: ['dashboard', 'achats', 'stock', 'projets'],
  comptable: ['dashboard', 'compta', 'ventes', 'pointage'],
  magasinier: ['dashboard', 'stock', 'achats', 'projets'],
};
function separerNavigation(items) {
  if (items.length <= 4) return { principaux: items, autres: [] };
  const voulus = (NAV_PRIORITE[role()] || []).filter((r) => items.some((m) => m.r === r));
  const principaux = [...voulus, ...items.map((m) => m.r).filter((r) => !voulus.includes(r))].slice(0, 3).map((r) => items.find((m) => m.r === r));
  return { principaux, autres: items.filter((m) => !principaux.includes(m)) };
}
function ouvrirFeuilleMenu() {
  const items = menuVisible();
  const actif = hashCourant().replace(/^#\//, '').split('/')[0];
  const ov = document.createElement('div');
  ov.className = 'feuille-fond';
  const groupes = GROUPES_MENU.map(([k, t]) => [k, t, items.filter((m) => groupeDe(m.r) === k)]).filter((g) => g[2].length);
  let n = 0;
  ov.innerHTML = `<div class="feuille feuille-lanceur" role="dialog" aria-modal="true" aria-label="Toutes les rubriques">
    <div class="feuille-poignee"></div>
    <div class="lanceur-tete"><div class="feuille-titre">Toutes les rubriques</div>
      <label class="lanceur-recherche">${icone('oeil', 16)}<input type="search" placeholder="Rechercher une rubrique…" aria-label="Rechercher une rubrique"></label></div>
    <div class="lanceur-corps">${groupes.map(([k, t, l]) => `<div class="lanceur-groupe"><div class="lanceur-titre">${esc(t)}</div>
      <div class="feuille-grille">${l.map((m) => `<a class="feuille-item g-${k} ${m.r === actif ? 'active' : ''}" href="#/${m.r}" data-cherche="${esc(`${m.label} ${m.court}`.toLowerCase())}" style="--i:${n++}"><span class="feuille-ic">${icone(m.r, 24) || m.ico}</span><span>${esc(m.court)}</span></a>`).join('')}</div></div>`).join('')}</div>
  </div>`;
  const fermer = () => { ov.classList.add('sortie'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.feuille-item')) fermer(); });
  document.body.appendChild(ov);
  const champ = $('input', ov);
  champ.addEventListener('input', () => {
    const t = champ.value.trim().toLowerCase();
    $$('.feuille-item', ov).forEach((a) => a.classList.toggle('hidden', !!t && !a.dataset.cherche.includes(t)));
    $$('.lanceur-groupe', ov).forEach((g) => g.classList.toggle('hidden', !$$('.feuille-item:not(.hidden)', g).length));
  });
}

function menuVisible() {
  return MENU.filter((m) => m.roles.includes(role()) && (!m.admin || S.plateformeAdmin) && (!m.licence || !DEMO)).map((m) => ({ ...m, label: role() === 'technicien' && m.labelTech ? m.labelTech : m.label }));
}

function construireInterface() {
  const items = menuVisible();
  const lien = (m) => `<a class="nav-item g-${groupeDe(m.r)}" href="#/${m.r}" data-nav="${m.r}"><span class="ico">${icone(m.r) || m.ico}</span><span class="lbl-long">${esc(m.label)}</span><span class="lbl-court">${esc(m.court)}</span></a>`;
  const { principaux, autres } = separerNavigation(items);
  const p = S.profil;
  $('#root').innerHTML = `<div class="app">
    <header class="topbar">
      ${brandHTML()}
      <div class="sep"></div>
      <div class="company">${entrepriseHTML()}</div>
      <div class="topbar-right">
        <button type="button" class="reseau-pill hidden" id="reseau"></button>
        <button class="icon-btn" id="btn-notif" title="Activité et alertes" aria-label="Activité et alertes">${icone('cloche', 20)}<span class="count hidden" id="notif-count"></span></button>
        <button class="user-chip" id="btn-user">
          <div class="avatar">${esc(initiales(p.nom))}</div>
          <div class="who"><b>${esc(p.nom)}</b><span>${ROLES[p.role].ico} ${esc(ROLES[p.role].label)}</span></div>
        </button>
      </div>
    </header>
    <nav class="sidebar">${GROUPES_MENU.map(([k, t]) => [t, items.filter((m) => groupeDe(m.r) === k)]).filter(([, l]) => l.length).map(([t, l]) => `<div class="nav-groupe">${esc(t)}</div>${l.map(lien).join('')}`).join('')}</nav>
    <main class="main" id="main"></main>
    <nav class="bottom-nav"><span class="nav-bulle" aria-hidden="true"></span>${principaux.slice(0, 2).map(lien).join('')}<button type="button" class="nav-fab" id="nav-fab" aria-label="Créer : actions rapides"><span>${icone('ajouter', 26)}</span></button>${principaux.slice(2).map(lien).join('')}${autres.length ? `<button type="button" class="nav-item nav-plus" id="nav-plus" aria-label="Toutes les rubriques"><span class="ico">${icone('plus')}</span><span class="lbl-court">Plus</span></button>` : ''}</nav>
  </div>`;
  $('#nav-plus')?.addEventListener('click', ouvrirFeuilleMenu);
  $('#nav-fab')?.addEventListener('click', ouvrirFeuilleCreer);
  initKoko();
  $('#reseau')?.addEventListener('click', ouvrirBoiteEnvois);
  $('#btn-user').onclick = ouvrirMenuUtilisateur;
  $('#btn-notif').onclick = ouvrirNotifications;
  majCompteurNotifications();
}

function ouvrirMenuUtilisateur(e) {
  e.stopPropagation();
  fermerPanneaux();
  const m = document.createElement('div');
  m.className = 'menu';
  m.id = 'menu-user';
  let theme = 'auto';
  try { theme = localStorage.getItem('koordin-theme') || 'auto'; } catch { /* rien */ }
  m.innerHTML = `
    <div style="padding:8px 10px 10px;border-bottom:1px solid var(--border);margin-bottom:4px">
      <b style="font-size:13px">${esc(S.profil.nom)}</b><div class="muted" style="font-size:12px">${esc(afficherIdentifiant(S.profil.email))}</div></div>
    <button data-theme-set="auto">${theme === 'auto' ? '●' : '○'} Thème automatique</button>
    <button data-theme-set="light">${theme === 'light' ? '●' : '○'} Thème clair (chantier)</button>
    <button data-theme-set="dark">${theme === 'dark' ? '●' : '○'} Thème sombre</button>
    ${S.installPrompt ? '<button id="m-install">📲 Installer l’application</button>' : ''}
    ${DEMO ? '' : '<button id="m-espace">👤 Mon espace</button>'}
    ${DEMO ? '' : '<button id="m-guide">🎓 Guide vidéo</button>'}
    <button id="m-koko">👷🏾 ${KOKO.el ? 'Masquer Koko' : 'Afficher Koko'}</button>
    ${DEMO ? '' : `<button id="m-push">${notificationsActives() ? '🔕 Couper les notifications' : '🔔 Activer les notifications'}</button>`}
    ${DEMO ? '' : `<button id="m-news">✨ Nouveautés <span class="muted" style="margin-left:auto">v${VERSION}</span></button>`}
    <button id="m-out">${DEMO ? '🔄 Changer de rôle' : '🚪 Se déconnecter'}</button>`;
  document.body.appendChild(m);
  $$('[data-theme-set]', m).forEach((b) => (b.onclick = () => {
    try {
      localStorage.setItem('koordin-theme', b.dataset.themeSet);
    } catch { /* rien */ }
    appliquerTheme();
    fermerPanneaux();
    naviguer();
  }));
  $('#m-install', m)?.addEventListener('click', async () => { S.installPrompt.prompt(); S.installPrompt = null; fermerPanneaux(); });
  $('#m-news', m)?.addEventListener('click', () => { fermerPanneaux(); afficherNouveautes(); });
  $('#m-guide', m)?.addEventListener('click', () => { fermerPanneaux(); ouvrirGuide(); });
  $('#m-koko', m).onclick = () => { fermerPanneaux(); if (KOKO.el) masquerKoko(false); else afficherKoko(); };
  $('#m-push', m)?.addEventListener('click', () => { fermerPanneaux(); if (notificationsActives()) desactiverNotifications(); else activerNotifications(); });
  $('#m-espace', m)?.addEventListener('click', () => { fermerPanneaux(); allerA('#/mon-espace'); });
  $('#m-out', m).onclick = async () => { fermerPanneaux(); S.canal?.unsubscribe(); if (S.canalAppels) sb.removeChannel(S.canalAppels); KOKO.el?.remove(); KOKO.el = null; KOKO.vus.clear(); await oublierAbonnementPush(); await sb.auth.signOut(); };
}

function fermerPanneaux() {
  $('#menu-user')?.remove();
  $('#panel-notif')?.remove();
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#menu-user, #panel-notif, #btn-user, #btn-notif')) fermerPanneaux();
});

// ─── Notifications temps réel ───

function cleVu() { return `koordin-vu-${S.profil?.id}`; }
function dernierVu() {
  try { return localStorage.getItem(cleVu()) || '1970-01-01T00:00:00Z'; } catch { return '1970-01-01T00:00:00Z'; }
}
async function majCompteurNotifications() {
  const { count } = await sb.from('activites').select('id', { count: 'exact', head: true }).gt('created_at', dernierVu());
  S.nonLues = count || 0;
  const el = $('#notif-count');
  if (!el) return;
  el.textContent = S.nonLues > 99 ? '99+' : S.nonLues;
  el.classList.toggle('hidden', !S.nonLues);
}

function ecouterTempsReel() {
  S.canal?.unsubscribe();
  S.canal = sb.channel('koordin-activites')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activites' }, (payload) => {
      const a = payload.new;
      if (a.destinataire_id && a.destinataire_id === S.profil.id) {
        toast(a.message, a.niveau === 'info' ? 'ok' : 'warn', 10000);
        try { navigator.vibrate?.([120, 60, 120]); } catch { /* rien */ }
        majCompteurNotifications();
        if (/^#\/(rapports|dashboard|mon-espace|salaires)?$/.test(hashCourant() || '#/')) naviguer();
        return;
      }
      if (a.destinataire_id) return;
      if (a.type === 'equipe') chargerEquipe();
      if (a.acteur_id !== S.profil.id && a.niveau !== 'info') toast(a.message, a.niveau === 'critique' ? 'err' : 'warn', 7000);
      else if (a.acteur_id !== S.profil.id && (a.type === 'rapport' || (a.type === 'equipe' && a.roles?.length))) toast(a.message, 'ok', 7000);
      majCompteurNotifications();
    })
    .subscribe();
  // Canal séparé : si la mise à jour 3.0 n'est pas installée, le reste du temps réel continue de fonctionner
  if (S.canalAppels) sb.removeChannel(S.canalAppels);
  S.canalAppels = sb.channel('koordin-appels')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appels' }, (pl) => gererAppelTempsReel(pl))
    .subscribe((st) => { if (st === 'SUBSCRIBED') verifierAppelsEnAttente(); });
}

const ICONES_ACTIVITE = { projet: '🏗️', rapport: '📋', validation: '✅', commande: '🛒', facture: '🧾', stock: '📦', alerte: '🚨', equipe: '👥', communique: '📢' };
function feedHTML(activites) {
  if (!activites.length) return empty('🕊️', 'Aucune activité pour le moment');
  return `<div class="feed">${activites.map((a) => `
    <div class="feed-item"><div class="feed-dot ${a.niveau}">${ICONES_ACTIVITE[a.type] || '•'}</div>
    <div><div>${esc(a.message)}</div><div class="when">${ago(a.created_at)}</div></div></div>`).join('')}</div>`;
}

async function ouvrirNotifications(e) {
  e.stopPropagation();
  const deja = $('#panel-notif');
  fermerPanneaux();
  if (deja) return;
  const p = document.createElement('div');
  p.className = 'panel';
  p.id = 'panel-notif';
  p.innerHTML = `<div class="card-title" style="margin:10px 0 4px">Activité et alertes</div>${loading()}`;
  document.body.appendChild(p);
  const activites = await q(sb.from('activites').select('*').order('created_at', { ascending: false }).limit(40));
  p.innerHTML = `<div class="card-title" style="margin:10px 0 4px">Activité et alertes</div>${feedHTML(activites)}`;
  try { localStorage.setItem(cleVu(), new Date().toISOString()); } catch { /* rien */ }
  majCompteurNotifications();
}

// ─── Navigation ───

const PAGES = {};

async function naviguer() {
  if (!S.profil) return;
  appliquerMarque();
  const h = hashCourant().startsWith('#/') ? hashCourant().slice(2) : 'dashboard';
  const [page, id] = h.split('/');
  const autorise = page === 'projet' || (page === 'nouveau-rapport' && can(...ROLES_RAPPORT)) || menuVisible().some((m) => m.r === page);
  const cible = PAGES[page] && autorise ? page : 'dashboard';
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (cible === 'projet' ? 'projets' : cible)));
  const plus = $('#nav-plus');
  if (plus) plus.classList.toggle('active', !$$('.bottom-nav [data-nav]').some((a) => a.classList.contains('active')));
  placerBulle();
  fermerPanneaux();
  detruireGraphiques();
  const main = $('#main');
  main.innerHTML = loading();
  main.scrollTop = 0;
  if (!DEMO && !navigator.onLine && !['nouveau-rapport', 'pointage'].includes(cible)) { pageHorsLigne(); return; }
  try {
    await PAGES[cible](id);
    animerPage($('#main'));
    kokoNaviguer(cible);
    banniereEnvois(cible);
  } catch (e) {
    console.error(e);
    if (estErreurReseau(e)) { pageHorsLigne(); return; }
    main.innerHTML = `<div class="page"><div class="card">${empty('⚠️', messageErreur(e))}<div class="right"><button class="btn" onclick="location.reload()">Recharger</button></div></div></div>`;
  }
}

function pageHorsLigne() {
  const raccourcis = [
    can(...ROLES_RAPPORT) && ['#/nouveau-rapport', 'rapports', 'Faire un rapport'],
    can('direction', 'coordinateur', 'technicien') && ['#/pointage', 'pointage', 'Faire l’appel'],
  ].filter(Boolean);
  $('#main').innerHTML = `<div class="page"><div class="card hors-ligne">
    <div class="hors-ligne-ic">${icone('communiques', 30)}</div>
    <h2>Vous êtes hors ligne</h2>
    <p>Cette page a besoin d’internet. ${raccourcis.length ? 'Vous pouvez quand même faire votre <b>rapport</b> et votre <b>pointage</b> : ils seront envoyés tout seuls dès que le réseau revient.' : 'Elle s’affichera dès que le réseau revient.'}</p>
    <div class="rc-boutons">${raccourcis.map(([h, ic, l]) => `<a class="btn primary" href="${h}">${icone(ic, 18)} ${l}</a>`).join('')}<button type="button" class="btn" id="hl-envois">📤 Envois en attente</button></div>
  </div></div>`;
  $('#hl-envois').onclick = ouvrirBoiteEnvois;
}
async function banniereEnvois(cible) {
  if (DEMO || !['dashboard', 'rapports', 'pointage'].includes(cible)) return;
  const n = (await listeEnvois()).length;
  const pg = $('#main .page');
  if (!n || !pg || $('.bandeau-envois', pg)) return;
  const div = document.createElement('div');
  div.className = 'notice warn bandeau-envois';
  div.innerHTML = `⏳ <b>${n} envoi${n > 1 ? 's' : ''}</b> enregistré${n > 1 ? 's' : ''} sur le téléphone, en attente de réseau. <button type="button" class="btn sm">Voir</button>`;
  $('button', div).onclick = ouvrirBoiteEnvois;
  pg.prepend(div);
}

// ─── Licence ───

function etatLicence() {
  if (DEMO || !S.entreprise?.licence_fin) return null;
  const fin = new Date(S.entreprise.licence_fin);
  const jours = Math.ceil((fin.getTime() - Date.now()) / 86400000);
  return { fin, jours, expiree: fin.getTime() <= Date.now(), essai: S.entreprise.plan === 'essai', illimitee: jours > 3650 };
}
function bandeauLicence() {
  const l = etatLicence();
  if (!l || l.illimitee) return '';
  const dir = role() === 'direction';
  const lien = dir ? ' <a href="#/abonnement"><b>Choisir une formule →</b></a>' : ' Prévenez votre direction.';
  if (l.expiree) {
    return `<div class="notice warn" style="border:1px solid var(--crit)">🔒 <b>${l.essai ? 'Votre essai gratuit est terminé' : 'Votre licence a expiré'}</b> : KOORDIN est en lecture seule. Vos données sont conservées.${dir ? ' <a href="#/abonnement"><b>Renouveler →</b></a>' : ' Prévenez votre direction.'}</div>`;
  }
  if (l.essai) return `<div class="notice">🎁 Essai gratuit : <b>${l.jours} jour${l.jours > 1 ? 's' : ''} restant${l.jours > 1 ? 's' : ''}</b>.${dir ? lien : ''}</div>`;
  if (l.jours <= 7) return `<div class="notice warn">⏳ Votre licence expire dans <b>${l.jours} jour${l.jours > 1 ? 's' : ''}</b> (le ${l.fin.toLocaleDateString('fr-FR')}).${lien}</div>`;
  return '';
}

function page(html) {
  $('#main').innerHTML = `<div class="page">${bandeauLicence()}${html}</div>`;
  return $('#main .page');
}
const entete = (titre, sousTitre = '', actions = '') => `<div class="page-head"><div><h1 class="page-title">${titre}</h1>${sousTitre ? `<p class="page-sub">${sousTitre}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
const kpi = (label, valeur, pied = '', cls = '', ico = '') => `<div class="kpi ${cls}">${ico ? `<div class="kpi-ico" aria-hidden="true">${ICONE_EMOJI[ico] ? icone(ICONE_EMOJI[ico], 20) : ico}</div>` : ''}<div class="kpi-label">${esc(label)}</div><div class="kpi-value">${valeur}</div>${pied ? `<div class="kpi-foot">${pied}</div>` : ''}</div>`;

function bonjour() {
  const h = new Date().getHours();
  return `${h < 18 ? 'Bonjour' : 'Bonsoir'} ${esc(S.profil.nom.split(' ')[0])}`;
}

// ═══════════════════════════════ 3.1 : NOUVEAU DESIGN ═══════════════════════════════
const GROUPES_MENU = [
  ['pilotage', 'Pilotage', ['dashboard', 'projets', 'rapports', 'communiques', 'appels', 'ia']],
  ['terrain', 'Terrain', ['nouveau-rapport', 'pointage', 'controles', 'securite', 'materiel', 'savoir']],
  ['argent', 'Argent', ['compta', 'caisse', 'mes-factures', 'ventes', 'contrats', 'salaires', 'achats']],
  ['logistique', 'Logistique', ['stock']],
  ['equipe', 'Équipe', ['equipe', 'mon-espace']],
  ['compte', 'Compte', ['abonnement', 'parametres', 'console']],
];
const groupeDe = (r) => GROUPES_MENU.find((g) => g[2].includes(r))?.[0] || 'compte';
const reduireAnimations = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function actionsDisponibles() {
  const visibles = new Set(menuVisible().map((m) => m.r));
  return [
    { r: 'nouveau-rapport', ic: 'nouveau-rapport', t: 'Rapport du jour', s: 'Travaux et photos', ok: can(...ROLES_RAPPORT) },
    { r: 'appels', ic: 'appels', t: 'Appel vidéo', s: 'Chantier en direct' },
    { r: 'pointage', ic: 'pointage', t: 'Pointage', s: 'Présences du jour' },
    { r: 'controles', ic: 'controles', t: 'Contrôle', s: 'Vérifier une étape' },
    { r: 'projets', ic: 'projets', t: 'Nouveau projet', s: 'Créer un chantier', attr: 'data-nouveau-projet', ok: can('direction', 'coordinateur') },
    { r: 'compta', ic: 'compta', t: 'Facture', s: 'Scanner ou saisir', attr: 'data-nouvelle-facture' },
    { r: 'mes-factures', ic: 'compta', t: 'Facture', s: 'Photo d’un achat', attr: 'data-nouvelle-facture' },
    { r: 'caisse', ic: 'salaires', t: 'Dépense', s: 'Noter une dépense du jour', attr: 'data-nouvelle-depense', ok: !can('direction', 'comptable') },
    { r: 'achats', ic: 'achats', t: 'Commande', s: 'Achat fournisseur', attr: 'data-nouvelle-commande', ok: can('direction', 'coordinateur', 'achats') },
    { r: 'contrats', ic: 'contrats', t: 'Contrat', s: 'Prestataire' },
    { r: 'securite', ic: 'securite', t: 'Sécurité', s: 'Signaler un risque' },
    { r: 'stock', ic: 'stock', t: 'Stock', s: 'Entrées et sorties' },
    { r: 'ia', ic: 'ia', t: 'Assistant IA', s: 'Poser une question' },
  ].filter((a) => (a.ok ?? true) && (visibles.has(a.r) || (a.r === 'nouveau-rapport' && can(...ROLES_RAPPORT))));
}
const tuileAction = (a, i = 0) => `<a class="ar-tuile g-${groupeDe(a.r)}" href="#/${a.r}" ${a.attr || ''} style="--i:${i}"><span class="ar-ic">${icone(a.ic, 22)}</span><b>${esc(a.t)}</b><small>${esc(a.s)}</small></a>`;

function jauge(valeur, libelle, prevu = null) {
  const v = Math.max(0, Math.min(100, Math.round(num(valeur))));
  const r = 52, c = 2 * Math.PI * r;
  const id = `jg${Math.random().toString(36).slice(2, 7)}`;
  const repere = prevu != null ? (() => { const a = (Math.max(0, Math.min(100, prevu)) / 100) * 2 * Math.PI - Math.PI / 2; return `<circle cx="${64 + r * Math.cos(a)}" cy="${64 + r * Math.sin(a)}" r="4.5" class="jauge-prevu"><title>Prévu : ${prevu} %</title></circle>`; })() : '';
  return `<div class="jauge" data-val="${v}"><svg viewBox="0 0 128 128" role="img" aria-label="${esc(libelle)} : ${v} %">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset=".55" stop-color="#f0a92a"/><stop offset="1" stop-color="#c47a0c"/></linearGradient></defs>
    <circle cx="64" cy="64" r="${r}" class="jauge-fond"/>
    <circle cx="64" cy="64" r="${r}" class="jauge-val" stroke="url(#${id})" stroke-dasharray="${c}" stroke-dashoffset="${reduireAnimations() ? c * (1 - v / 100) : c}" data-cible="${c * (1 - v / 100)}" transform="rotate(-90 64 64)"/>
    ${repere}</svg><div class="jauge-txt"><b class="jauge-n">${v} %</b><span>${esc(libelle)}</span></div></div>`;
}

function heroAccueil({ resume = '', jaugeVal = null, jaugeLib = '', prevu = null, puces = [], actions = '' } = {}) {
  const h = new Date().getHours();
  const [salut, emoji] = h < 5 ? ['Bonsoir', '🌙'] : h < 12 ? ['Bonjour', '☀️'] : h < 18 ? ['Bon après-midi', '🌤️'] : ['Bonsoir', '🌙'];
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const actionsRap = actionsDisponibles();
  return `<section class="cockpit">
    <div class="aurore" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="cockpit-trame" aria-hidden="true"></div>
    <div class="cockpit-corps">
      <div class="cockpit-txt">
        <p class="cockpit-date"><span class="point-direct"></span>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · <span data-horloge>${heure}</span></p>
        <h1 class="cockpit-titre">${salut}<br><span class="texte-or">${esc(String(S.profil.nom).split(' ')[0])}</span> <span class="cockpit-salut" aria-hidden="true">${emoji}</span></h1>
        ${resume ? `<p class="cockpit-resume">${esc(resume)}</p>` : ''}
      </div>
      ${jaugeVal != null ? `<div class="cockpit-jauge" data-val="${Math.round(num(jaugeVal))}" data-lib="${esc(jaugeLib)}">${jauge(jaugeVal, jaugeLib, prevu)}</div>` : ''}
    </div>
    ${puces.length ? `<div class="cockpit-puces">${puces.map(([t, lien, cls]) => `<a class="puce ${cls || ''}" href="${lien}">${t}</a>`).join('')}</div>` : ''}
    ${actions ? `<div class="cockpit-actions">${actions}</div>` : ''}
  </section>
  ${actionsRap.length ? `<section class="actions-rapides" aria-label="Actions rapides"><div class="section-tete"><h2>Actions rapides</h2><span>Glissez →</span></div>
    <div class="ar-rail">${actionsRap.map(tuileAction).join('')}</div></section>` : ''}`;
}

function railChantiers(projets, url) {
  if (!projets.length) return '';
  return `<section class="section rail-chantiers"><div class="section-tete"><h2>Vos chantiers</h2><a href="#/projets">Tout voir →</a></div>
    <div class="ch-rail">${projets.map((p, i) => `<a class="ch-carte" href="#/projet/${p.id}" style="--i:${i}">
      ${visuelProjet(p, url(couvertureDe(p)), { classe: 'ch-photo' })}
      <div class="ch-haut">${badge(SANTE[p.sante])}</div>
      <div class="ch-bas"><div class="ch-info"><b>${esc(p.nom)}</b><span>${esc(p.localisation || p.client || '')}</span>
        <span class="ch-fin">Fin ${fdate(p.date_fin_prevue)}${p.rapports_en_attente ? ` · <i>${p.rapports_en_attente} rapport${p.rapports_en_attente > 1 ? 's' : ''}</i>` : ''}</span></div>
        ${anneau(p.avancement, p.avancement_attendu, 54)}</div>
    </a>`).join('')}</div></section>`;
}

// Animation des chiffres, des jauges, horloge
function animerPage(racine = document) {
  $$('.jauge-val', racine).forEach((c) => requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.cible; })));
  lancerMaquette3D($('.cockpit-jauge[data-val]', racine));
  if (reduireAnimations()) return;
  $$('.kpi-value, .jauge-n', racine).forEach(compteur);
}
function compteur(el) {
  if (el.children.length || el.dataset.anime) return;
  const txt = el.textContent;
  const m = /^(\D*?)(-?\d[\d\s  ]*(?:,\d+)?)(.*)$/s.exec(txt);
  if (!m) return;
  const cible = parseFloat(m[2].replace(/[\s  ]/g, '').replace(',', '.'));
  if (!isFinite(cible) || cible === 0) return;
  el.dataset.anime = '1';
  const dec = (m[2].split(',')[1] || '').length;
  const fmt = (v) => m[1] + v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
  const t0 = performance.now(), duree = 1000;
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree);
    el.textContent = k < 1 ? fmt(cible * (1 - Math.pow(1 - k, 3))) : txt;
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}
setInterval(() => {
  const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $$('[data-horloge]').forEach((x) => { if (x.textContent !== h) x.textContent = h; });
}, 15000);

// Bulle dorée qui glisse sous l'onglet actif du menu du bas
function placerBulle() {
  const nav = $('.bottom-nav');
  const bulle = $('.nav-bulle', nav || document);
  if (!nav || !bulle) return;
  const actif = $('.nav-item.active', nav);
  if (!actif) { bulle.style.opacity = '0'; return; }
  bulle.style.opacity = '1';
  bulle.style.transform = `translateX(${actif.offsetLeft}px)`;
  bulle.style.width = `${actif.offsetWidth}px`;
}
window.addEventListener('resize', () => placerBulle());

// Effet d'onde au toucher + petite vibration sur le menu
document.addEventListener('pointerdown', (e) => {
  const cible = e.target.closest('.btn, .nav-item, .nav-fab, .feuille-item, .ar-tuile, .appel-gros, .ch-carte, .puce');
  if (!cible || reduireAnimations()) return;
  const r = cible.getBoundingClientRect();
  const o = document.createElement('span');
  const t = Math.max(r.width, r.height) * 2;
  o.className = 'onde';
  o.style.cssText = `width:${t}px;height:${t}px;left:${e.clientX - r.left - t / 2}px;top:${e.clientY - r.top - t / 2}px`;
  if (getComputedStyle(cible).position === 'static') cible.style.position = 'relative';
  const zone = document.createElement('span');
  zone.className = 'onde-zone';
  zone.appendChild(o);
  cible.appendChild(zone);
  setTimeout(() => zone.remove(), 650);
  if (cible.matches('.nav-item, .nav-fab')) { try { navigator.vibrate?.(8); } catch { /* rien */ } }
}, { passive: true });

// Halo lumineux qui suit la souris sur les cartes (ordinateur)
if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest?.('.card, .kpi, .ar-tuile, .ch-carte, .cockpit');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// Feuille « Créer » (bouton doré central)
function ouvrirFeuilleCreer() {
  const actions = actionsDisponibles();
  const ov = document.createElement('div');
  ov.className = 'feuille-fond';
  ov.innerHTML = `<div class="feuille feuille-creer" role="dialog" aria-modal="true" aria-label="Que voulez-vous faire ?">
    <div class="feuille-poignee"></div>
    <div class="feuille-titre">Que voulez-vous faire ?</div>
    <div class="creer-grille">${actions.map(tuileAction).join('')}</div>
  </div>`;
  const fermer = () => { ov.classList.add('sortie'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.ar-tuile')) fermer(); });
  document.body.appendChild(ov);
}

// ═══════════════════════════════ 3.2 : KOKO, LA MASCOTTE ═══════════════════════════════
// Petit chef de chantier dessiné : il change de tenue selon la rubrique, suit le doigt du regard,
// donne des conseils, réagit aux réussites et aux erreurs. Masquable dans le menu de l'avatar.
const KOKO = { el: null, page: null, vus: new Set(), minuterieBulle: null, minuterieDefile: null, cote: 'droite' };
const KOKO_TENUES = { pilotage: 'chef', terrain: 'terrain', argent: 'costume', logistique: 'magasin', equipe: 'polo', compte: 'polo' };
const KOKO_PAGES = { appels: 'casque-audio', ia: 'ia', 'nouveau-rapport': 'terrain', pointage: 'terrain' };
const KOKO_NOMS = { chef: 'chef de chantier', terrain: 'tenue de chantier', costume: 'costume', magasin: 'tenue de magasinier', polo: 'polo de l’équipe', 'casque-audio': 'casque d’appel', ia: 'mode IA' };
const KOKO_CONSEILS = {
  dashboard: ['Touchez une bulle « Story de la semaine » pour revivre la semaine en 30 secondes 📱', 'Dites-moi « conseil du jour » et je vous lis la règle de chantier du jour 📚', 'Voici votre cockpit du jour ! La jauge montre l’avancement moyen de vos chantiers.', 'Le bouton doré ＋ en bas permet de tout créer en un geste.', 'Touchez une pastille du cockpit pour aller droit au problème.', 'Appuyez longtemps sur moi et dites « ouvre la compta » ou « appelle Koffi » 🎤'],
  projets: ['Dans un chantier, essayez 🎬 « Film du chantier » : toutes les photos deviennent une vidéo à envoyer au client.', 'Touchez un chantier pour voir son planning, ses photos et son budget.', 'Une photo de couverture rend vos chantiers bien plus faciles à reconnaître 📸'],
  rapports: ['Les rapports du terrain arrivent ici, avec leurs photos.', 'Quand un rapport est validé ou rejeté, son auteur est prévenu tout de suite.'],
  'nouveau-rapport': ['Deux ou trois photos valent mieux qu’un long texte 📸', 'Pas de réseau ? Pas de souci : j’enverrai le rapport dès que ça revient.'],
  pointage: ['Cochez les présents : je calcule la paie tout seul 💪', 'Le pointage marche même sans réseau.'],
  securite: ['La sécurité d’abord ! Signalez même les presque-accidents ⛑️', 'Une causerie sécurité de 5 minutes le matin, ça sauve des vies.'],
  materiel: ['Notez qui a quel engin : plus rien ne se perd 🚜', 'Pensez aux visites d’entretien avant les pannes.'],
  compta: ['Prenez une facture en photo : je la lis pour vous 🧾', 'Le bouton Excel prépare un vrai tableau pour votre comptable.'],
  ventes: ['Devis, situations, encaissements : tout pour être payé à temps 💼', 'La Trésorerie montre ce que le client vous doit.'],
  contrats: ['Remplissez les cases : je rédige le contrat pour vous ✍️', 'Chaque paiement au prestataire a son reçu signé.'],
  salaires: ['Chaque salaire est confirmé et signé par celui qui le reçoit ✅'],
  achats: ['Une commande passée ici est suivie jusqu’à la livraison 🚚'],
  stock: ['Je vous préviens quand un article passe sous le seuil 📦'],
  equipe: ['Invitez votre équipe avec un simple numéro de téléphone 📱'],
  appels: ['Appelez un technicien pour voir le chantier en direct 📹', 'Pendant l’appel, le bouton 📸 met une photo dans la galerie du chantier.'],
  ia: ['Posez n’importe quelle question sur vos chantiers 🧠'],
  communiques: ['Un communiqué ici, et toute l’équipe est informée 📢'],
  'mon-espace': ['Votre espace personnel : vos salaires et vos signatures 🔒'],
  controles: ['Une étape terminée ? Demandez un contrôle avant de passer à la suite 🔍', 'L’agent coche chaque point, prend des photos et signe : la fiche PDF est prête aussitôt.'],
  savoir: ['Chaque jour une fiche : béton armé, topo, métré, OGC, RDM, VRD… 📚', 'Testez-vous avec le quiz, et partagez les fiches à votre équipe sur WhatsApp 🎯'],
  abonnement: ['Votre formule KOORDIN se gère ici.'],
  parametres: ['Les réglages de votre entreprise sont ici ⚙️'],
};
const KOKO_BRAVO = ['Bravo ! 🎉', 'Super travail ! 💪', 'C’est noté ✅', 'Parfait ! 👌'];
const kokoActif = () => { try { return localStorage.getItem('koordin-koko') !== 'off'; } catch { return true; } };

function svgKoko() {
  return `<svg class="koko-svg" viewBox="0 0 100 124" aria-hidden="true">
    <ellipse class="k-ombre" cx="50" cy="118" rx="22" ry="4"/>
    <g class="k-tout">
      <g class="k-jambes"><rect x="38" y="94" width="9" height="18" rx="4"/><rect x="53" y="94" width="9" height="18" rx="4"/>
        <ellipse class="k-chaussure" cx="42" cy="113" rx="7" ry="3.6"/><ellipse class="k-chaussure" cx="58" cy="113" rx="7" ry="3.6"/></g>
      <rect class="k-torse" x="29" y="62" width="42" height="38" rx="15"/>
      <g class="k-t k-t-terrain"><path class="k-gilet" d="M31 70 Q31 63 41 63 L45 63 L45 99 L37 99 Q31 99 31 92 Z"/><path class="k-gilet" d="M69 70 Q69 63 59 63 L55 63 L55 99 L63 99 Q69 99 69 92 Z"/>
        <rect class="k-bande" x="31" y="82" width="14" height="3.5"/><rect class="k-bande" x="55" y="82" width="14" height="3.5"/></g>
      <g class="k-t k-t-costume"><path class="k-veste" d="M30 72 Q30 63 42 63 L50 80 L50 100 L37 100 Q30 100 30 92 Z"/><path class="k-veste" d="M70 72 Q70 63 58 63 L50 80 L50 100 L63 100 Q70 100 70 92 Z"/>
        <path class="k-cravate" d="M48 64 L52 64 L53.5 68 L51.5 86 L50 89 L48.5 86 L46.5 68 Z"/></g>
      <g class="k-t k-t-magasin"><rect class="k-salopette" x="38" y="74" width="24" height="26" rx="4"/><rect class="k-salopette" x="38" y="63" width="4" height="13"/><rect class="k-salopette" x="58" y="63" width="4" height="13"/><circle class="k-bouton" cx="40" cy="76" r="1.6"/><circle class="k-bouton" cx="60" cy="76" r="1.6"/></g>
      <g class="k-t k-t-polo"><path class="k-col" d="M42 62 L50 70 L58 62 Z"/><rect class="k-badge" x="54" y="74" width="9" height="11" rx="2"/></g>
      <g class="k-t k-t-chef"><path class="k-col-blanc" d="M42 62 L50 69 L58 62 L55 62 L50 66 L45 62 Z"/></g>
      <g class="k-bras-g"><path class="k-manche" d="M31 68 Q22 76 24 88" /><circle class="k-peau" cx="24.5" cy="89" r="5"/></g>
      <g class="k-bras-d"><path class="k-manche" d="M69 68 Q78 76 76 88" /><circle class="k-peau" cx="75.5" cy="89" r="5"/>
        <g class="k-t k-t-chef"><rect class="k-tablette" x="70" y="80" width="15" height="19" rx="2.5"/><rect class="k-ecran" x="72" y="82.5" width="11" height="12" rx="1"/></g>
        <g class="k-t k-t-magasin"><rect class="k-carton" x="68" y="81" width="18" height="15" rx="1.5"/><path class="k-scotch" d="M68 86 H86"/></g>
        <g class="k-t k-t-costume"><rect class="k-calc" x="70" y="81" width="12" height="16" rx="2"/><rect class="k-ecran-calc" x="72" y="83" width="8" height="4" rx="1"/></g>
      </g>
      <rect class="k-peau" x="45" y="56" width="10" height="9" rx="3"/>
      <g class="k-tete">
        <circle class="k-peau" cx="28.5" cy="44" r="4.5"/><circle class="k-peau" cx="71.5" cy="44" r="4.5"/>
        <circle class="k-peau" cx="50" cy="40" r="22"/>
        <path class="k-cheveux" d="M29 36 Q31 18 50 18 Q69 18 71 36 Q66 26 50 26 Q34 26 29 36 Z"/>
        <g class="k-sourcils"><path d="M38 33 Q42 31 46 33"/><path d="M54 33 Q58 31 62 33"/></g>
        <g class="k-yeux"><ellipse class="k-blanc" cx="42" cy="41" rx="4.6" ry="5.4"/><ellipse class="k-blanc" cx="58" cy="41" rx="4.6" ry="5.4"/>
          <g class="k-pupilles"><circle cx="42" cy="41.5" r="2.5"/><circle cx="58" cy="41.5" r="2.5"/><circle class="k-reflet" cx="43" cy="40.3" r=".8"/><circle class="k-reflet" cx="59" cy="40.3" r=".8"/></g></g>
        <circle class="k-joue" cx="36" cy="49" r="3.4"/><circle class="k-joue" cx="64" cy="49" r="3.4"/>
        <path class="k-bouche k-b-sourire" d="M43 50 Q50 56.5 57 50"/>
        <path class="k-bouche-pleine k-b-rire" d="M42.5 49.5 Q50 59 57.5 49.5 Z"/>
        <ellipse class="k-bouche-pleine k-b-o" cx="50" cy="52" rx="3" ry="3.6"/>
        <g class="k-t k-t-costume"><rect class="k-lunette" x="36.5" y="36.5" width="11" height="9" rx="3.5"/><rect class="k-lunette" x="52.5" y="36.5" width="11" height="9" rx="3.5"/><path class="k-lunette-p" d="M47.5 40 H52.5"/></g>
        <g class="k-t k-t-terrain k-t-magasin"><path class="k-casque" d="M26 33 Q27 13 50 12 Q73 13 74 33 Z"/><rect class="k-casque" x="22" y="31" width="56" height="5" rx="2.5"/><path class="k-casque-arete" d="M50 12.5 V31"/></g>
        <g class="k-t k-t-chef"><path class="k-casque-blanc" d="M26 33 Q27 13 50 12 Q73 13 74 33 Z"/><rect class="k-casque-blanc" x="22" y="31" width="56" height="5" rx="2.5"/><circle class="k-logo" cx="50" cy="24" r="3.2"/></g>
        <g class="k-t k-t-casque-audio"><path class="k-arceau" d="M27 42 Q27 16 50 16 Q73 16 73 42"/><rect class="k-ecouteur" x="22" y="37" width="9" height="14" rx="4"/><rect class="k-ecouteur" x="69" y="37" width="9" height="14" rx="4"/><path class="k-arceau" d="M27 49 Q30 58 40 57"/><circle class="k-micro" cx="41" cy="57" r="2.2"/></g>
        <g class="k-t k-t-ia"><path class="k-antenne" d="M50 18 V8"/><path class="k-etoile" d="M50 1 L52 6 L57 8 L52 10 L50 15 L48 10 L43 8 L48 6 Z"/></g>
      </g>
    </g>
  </svg>`;
}

function initKoko() {
  if (KOKO.el || !kokoActif()) return;
  try { KOKO.cote = localStorage.getItem('koordin-koko-cote') || 'droite'; } catch { /* rien */ }
  const el = document.createElement('div');
  el.className = `koko koko-${KOKO.cote}`;
  el.dataset.humeur = 'sourire';
  el.innerHTML = `<div class="koko-bulle hidden" role="status" aria-live="polite"><span class="koko-texte"></span><div class="koko-outils">${Reconnaissance ? '<button type="button" class="koko-micro" aria-label="Parler à Koko">🎤 Me parler</button>' : ''}<button type="button" class="koko-clavier" aria-label="Écrire à Koko">⌨️</button><button type="button" class="koko-voix" aria-label="Voix de Koko">🔊</button><button type="button" class="koko-masquer" aria-label="Masquer Koko">Masquer</button></div></div>
    <button type="button" class="koko-corps" aria-label="Koko, votre assistant : touchez pour un conseil">${svgKoko()}<span class="koko-pouf" aria-hidden="true"></span></button>`;
  document.body.appendChild(el);
  KOKO.el = el;
  const corps = $('.koko-corps', el);
  // Le regard suit le doigt ou la souris
  const regarder = (x, y) => {
    const r = corps.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.33;
    const a = Math.atan2(y - cy, x - cx), d = Math.min(1, Math.hypot(x - cx, y - cy) / 220);
    $('.k-pupilles', el).setAttribute('transform', `translate(${(Math.cos(a) * 1.8 * d).toFixed(2)} ${(Math.sin(a) * 2 * d).toFixed(2)})`);
  };
  document.addEventListener('pointermove', (e) => regarder(e.clientX, e.clientY), { passive: true });
  document.addEventListener('pointerdown', (e) => regarder(e.clientX, e.clientY), { passive: true });
  // Clignement des yeux
  const cligner = () => { el.classList.add('cligne'); setTimeout(() => el.classList.remove('cligne'), 160); setTimeout(cligner, 2500 + Math.random() * 3500); };
  setTimeout(cligner, 2000);
  // Toucher : conseil ; glisser : changer de côté
  let depart = null, glisse = false;
  let appuiLong = null, ecouteLancee = false;
  corps.addEventListener('pointerdown', (e) => {
    depart = { x: e.clientX, y: e.clientY }; glisse = false; ecouteLancee = false; corps.setPointerCapture(e.pointerId);
    clearTimeout(appuiLong);
    appuiLong = setTimeout(() => { if (depart && !glisse) { ecouteLancee = true; kokoEcouter(); } }, 650);
  });
  corps.addEventListener('pointermove', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    if (Math.abs(dx) > 10) { glisse = true; clearTimeout(appuiLong); el.classList.add('glisse'); el.style.setProperty('--dx', `${dx}px`); }
  });
  corps.addEventListener('pointerup', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    depart = null;
    clearTimeout(appuiLong);
    if (ecouteLancee) return;
    el.classList.remove('glisse'); el.style.removeProperty('--dx');
    if (glisse) {
      const cote = e.clientX < window.innerWidth / 2 ? 'gauche' : 'droite';
      if (cote !== KOKO.cote) { KOKO.cote = cote; el.classList.remove('koko-gauche', 'koko-droite'); el.classList.add(`koko-${cote}`); try { localStorage.setItem('koordin-koko-cote', cote); } catch { /* rien */ } }
      return;
    }
    if (Math.abs(dx) < 10) kokoToucher();
  });
  corps.addEventListener('pointercancel', () => { depart = null; clearTimeout(appuiLong); el.classList.remove('glisse'); });
  corps.addEventListener('contextmenu', (e) => e.preventDefault());
  $('.koko-masquer', el).onclick = () => masquerKoko(true);
  $('.koko-voix', el).onclick = kokoBasculerVoix;
  $('.koko-micro', el)?.addEventListener('click', kokoEcouter);
  $('.koko-clavier', el)?.addEventListener('click', (e) => { e.stopPropagation(); kokoEcrire(); });
  majBoutonsKoko();
  // Il se pousse quand on fait défiler la page
  document.addEventListener('scroll', (e) => {
    if (!KOKO.el || KOKO.el.contains(e.target)) return;
    KOKO.el.classList.add('cache');
    clearTimeout(KOKO.minuterieDefile);
    KOKO.minuterieDefile = setTimeout(() => KOKO.el?.classList.remove('cache'), 1100);
  }, { capture: true, passive: true });
  let premiere = false;
  try { premiere = !localStorage.getItem('koordin-koko-presente'); localStorage.setItem('koordin-koko-presente', '1'); } catch { /* rien */ }
  setTimeout(() => {
    const h = new Date().getHours();
    const salut = `${h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'} ${String(S.profil?.nom || '').split(' ')[0]} !`;
    kokoHumeur('rire', 1600); kokoAnim('saute');
    kokoDire(premiere ? `${salut} Moi c’est Koko 👷🏾, votre assistant de chantier. Touchez-moi pour un conseil, appuyez longtemps pour me parler, glissez-moi pour me déplacer.` : `${salut} 👋`, premiere ? 10000 : 3500);
  }, 900);
}

function masquerKoko(avecMessage) {
  try { localStorage.setItem('koordin-koko', 'off'); } catch { /* rien */ }
  KOKO.el?.remove(); KOKO.el = null;
  if (avecMessage) toast('Koko est parti se reposer. Pour le faire revenir : avatar en haut à droite → 👷🏾 Afficher Koko.', 'ok', 7000);
}
function afficherKoko() {
  try { localStorage.setItem('koordin-koko', 'on'); } catch { /* rien */ }
  initKoko();
  kokoNaviguer(hashCourant().replace(/^#\//, '').split('/')[0] || 'dashboard', true);
}

function kokoAnim(nom) {
  const el = KOKO.el;
  if (!el || reduireAnimations()) return;
  el.classList.remove('saute', 'salue', 'tourne', 'secoue');
  void el.offsetWidth;
  el.classList.add(nom);
  setTimeout(() => el.classList.remove(nom), 1200);
}
function kokoHumeur(h, duree = 1800) {
  if (!KOKO.el) return;
  KOKO.el.dataset.humeur = h;
  clearTimeout(KOKO.minuterieHumeur);
  KOKO.minuterieHumeur = setTimeout(() => { if (KOKO.el) KOKO.el.dataset.humeur = 'sourire'; }, duree);
}
function kokoDire(texte, duree = 5000, parler = true) {
  const el = KOKO.el;
  if (!el) return;
  if (parler) kokoParler(texte);
  const b = $('.koko-bulle', el);
  $$('.koko-sugg, .koko-ecrire', b).forEach((x) => x.remove());
  $('.koko-texte', b).textContent = texte;
  b.classList.remove('hidden', 'sort');
  clearTimeout(KOKO.minuterieBulle);
  KOKO.minuterieBulle = setTimeout(() => { b.classList.add('sort'); setTimeout(() => b.classList.add('hidden'), 250); }, duree);
}

function kokoNaviguer(page, forcer = false) {
  if (!KOKO.el) return;
  const tenue = KOKO_PAGES[page] || KOKO_TENUES[groupeDe(page)] || 'chef';
  const change = KOKO.el.dataset.tenue !== tenue;
  if (change) {
    if (KOKO.el.dataset.tenue && !reduireAnimations()) { KOKO.el.classList.remove('pouf'); void KOKO.el.offsetWidth; KOKO.el.classList.add('pouf'); setTimeout(() => KOKO.el?.classList.remove('pouf'), 700); }
    setTimeout(() => { if (KOKO.el) KOKO.el.dataset.tenue = tenue; }, KOKO.el.dataset.tenue ? 220 : 0);
  }
  if (KOKO.page !== page) kokoAnim('saute');
  KOKO.page = page;
  KOKO.el.dataset.page = page;
  if (forcer || !KOKO.vus.has(page)) {
    KOKO.vus.add(page);
    if (KOKO.vus.size > 1 || forcer) {
      const c = KOKO_CONSEILS[page];
      if (c) setTimeout(() => { if (!(KOKO.occupe > Date.now())) kokoDire(c[0], 4500); }, 450);
    }
  }
}

function kokoToucher() {
  const page = KOKO.page || 'dashboard';
  kokoAnim(Math.random() < .5 ? 'salue' : 'saute');
  kokoHumeur('rire', 1400);
  try { navigator.vibrate?.(12); } catch { /* rien */ }
  // Sur l'accueil, Koko signale d'abord les alertes du cockpit
  const alertes = page === 'dashboard' ? $$('.cockpit-puces .puce.crit, .cockpit-puces .puce.warn').map((x) => x.textContent.trim()) : [];
  KOKO.compteur = (KOKO.compteur || 0) + 1;
  if (alertes.length && KOKO.compteur % 3 === 1) { kokoDire(`À regarder aujourd’hui : ${alertes.join(' · ')}. Touchez une pastille pour y aller.`, 6000); return; }
  const liste = [...(KOKO_CONSEILS[page] || []), `Aujourd’hui je porte ma ${KOKO_NOMS[KOKO.el.dataset.tenue] || 'tenue'} 😎`, ...KOKO_CONSEILS.dashboard.slice(1)];
  kokoDire(liste[KOKO.compteur % liste.length], 5000);
}

function kokoReagir(type, msg) {
  if (!KOKO.el || $('.appel-ecran')) return;
  if (type === 'ok' && /✅|enregistr|envoy|valid|sign|ajout|créé|cré/i.test(String(msg))) {
    kokoHumeur('rire', 2000); kokoAnim('saute');
    if (Math.random() < .45) kokoDire(KOKO_BRAVO[Math.floor(Math.random() * KOKO_BRAVO.length)], 2200, false);
  } else if (type === 'err') { kokoHumeur('o', 2200); kokoAnim('secoue'); }
}

// ═══════════════════════════════ 3.3 : NOTIFICATIONS SUR LE TÉLÉPHONE ═══════════════════════════════
const PUSH_FONCTION = () => `${CFG.SUPABASE_URL}/functions/v1/koordin-push`;
const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const estInstallee = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const octetsCle = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));

async function activerNotifications({ silencieux = false } = {}) {
  if (DEMO) return false;
  if (!pushPossible()) {
    if (!silencieux) toast(estIOS() && !estInstallee() ? 'Sur iPhone : ajoutez d’abord KOORDIN à l’écran d’accueil (bouton Partager ⬆️ → « Sur l’écran d’accueil »), puis ouvrez KOORDIN depuis son icône.' : 'Ce téléphone ou ce navigateur ne permet pas les notifications. Utilisez Chrome à jour.', 'warn', 10000);
    return false;
  }
  try {
    const perm = silencieux ? Notification.permission : await Notification.requestPermission();
    if (perm !== 'granted') {
      if (!silencieux) toast(perm === 'denied' ? 'Les notifications sont bloquées pour KOORDIN. Ouvrez les réglages du site (🔒 à côté de l’adresse) → Notifications → Autoriser.' : 'Notifications non activées.', 'warn', 9000);
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const adresse = (await sb.rpc('url_fonction_push')).data || PUSH_FONCTION();
    const rep = await fetch(adresse, { method: 'GET' });
    const { cle } = await rep.json().catch(() => ({}));
    if (!rep.ok || !cle) throw new Error('PUSH_FONCTION');
    let abo = await reg.pushManager.getSubscription();
    const actuelle = abo?.options?.applicationServerKey ? btoa(String.fromCharCode(...new Uint8Array(abo.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null;
    if (abo && actuelle && actuelle !== cle) { await abo.unsubscribe(); abo = null; }
    if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octetsCle(cle) });
    const j = abo.toJSON();
    await q(sb.rpc('enregistrer_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_appareil: navigator.userAgent.slice(0, 200) }));
    try { localStorage.setItem('koordin-push', 'on'); } catch { /* rien */ }
    if (!silencieux) { toast('🔔 Notifications activées ! Vous serez prévenu même quand KOORDIN est fermé.', 'ok', 7000); kokoDire('Je vous préviendrai même quand KOORDIN est fermé 🔔', 4000); }
    $('#encart-push')?.remove();
    return true;
  } catch (e) {
    console.warn('notifications', e);
    if (!silencieux) {
      const m = String(e?.message || '');
      toast(m === 'PUSH_FONCTION' || /Failed to fetch|NetworkError/i.test(m) ? 'Les notifications ne sont pas encore installées côté serveur (fonction « koordin-push » du kit d’installation).' : /enregistrer_push|schema cache|does not exist/i.test(m) ? 'Les notifications nécessitent la mise à jour 3.3 de la base de données.' : `Impossible d’activer les notifications : ${messageErreur(e)}`, 'err', 9000);
    }
    return false;
  }
}

async function desactiverNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    if (abo) { await sb.rpc('supprimer_push', { p_endpoint: abo.endpoint }); await abo.unsubscribe(); }
  } catch { /* rien */ }
  try { localStorage.setItem('koordin-push', 'off'); } catch { /* rien */ }
  toast('🔕 Notifications désactivées sur ce téléphone.');
}
async function oublierAbonnementPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const abo = await reg?.pushManager?.getSubscription();
    if (abo) await sb.rpc('supprimer_push', { p_endpoint: abo.endpoint });
  } catch { /* rien */ }
}
const notificationsActives = () => pushPossible() && Notification.permission === 'granted' && (() => { try { return localStorage.getItem('koordin-push') !== 'off'; } catch { return true; } })();

function encartNotifications() {
  if (DEMO || $('#encart-push')) return;
  const ios = estIOS() && !estInstallee();
  if (!ios && (!pushPossible() || Notification.permission !== 'default')) return;
  try { if (Date.now() - Number(localStorage.getItem('koordin-push-plus-tard') || 0) < 3 * 864e5) return; } catch { /* rien */ }
  const cible = $('#main .actions-rapides') || $('#main .cockpit');
  if (!cible) return;
  const el = document.createElement('div');
  el.id = 'encart-push';
  el.className = 'encart-push';
  el.innerHTML = `<div class="encart-push-ic">🔔</div><div class="encart-push-txt"><b>Ne manquez plus rien</b><span>${ios ? 'Sur iPhone, ajoutez d’abord KOORDIN à l’écran d’accueil : bouton Partager ⬆️ → « Sur l’écran d’accueil ». Ouvrez-le ensuite depuis l’icône pour activer les notifications.' : 'Appels, rapports validés, salaires, alertes : recevez-les même quand KOORDIN est fermé.'}</span>
    <div class="encart-push-boutons">${ios ? '' : '<button type="button" class="btn sm primary" id="push-oui">Activer les notifications</button>'}<button type="button" class="btn sm ghost" id="push-tard">Plus tard</button></div></div>`;
  cible.insertAdjacentElement('beforebegin', el);
  $('#push-oui', el)?.addEventListener('click', () => activerNotifications());
  $('#push-tard', el).onclick = () => { try { localStorage.setItem('koordin-push-plus-tard', String(Date.now())); } catch { /* rien */ } el.remove(); };
}

// Clic sur une notification alors que KOORDIN est déjà ouvert
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'koordin-aller' && e.data.lien) allerA(e.data.lien);
});

// ═══════════════════════════════ 3.3 : KOKO PARLE ET ÉCOUTE ═══════════════════════════════
const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
const kokoVoixActive = () => { try { return localStorage.getItem('koordin-koko-voix') !== 'off'; } catch { return true; } };
let voixKoko = null;
function choisirVoix() {
  const voix = window.speechSynthesis?.getVoices?.() || [];
  const fr = voix.filter((v) => /^fr/i.test(v.lang));
  voixKoko = fr.find((v) => /fr-FR/i.test(v.lang) && /Thomas|Paul|Henri|Mathieu|Nicolas|Daniel|male|homme/i.test(v.name))
    || fr.find((v) => /Google/i.test(v.name) && /fr-FR/i.test(v.lang)) || fr.find((v) => /fr-FR/i.test(v.lang)) || fr[0] || null;
}
if ('speechSynthesis' in window) { choisirVoix(); window.speechSynthesis.onvoiceschanged = choisirVoix; }

// Sur Android, Chrome peut perdre une phrase si on l'annule juste avant (bug connu) :
// on garde une référence, on attend un instant après une annulation, et on vérifie que la voix démarre.
let phraseKoko = null, essaiVoix = 0;
function kokoParler(texte, { test = false } = {}) {
  const synthe = window.speechSynthesis;
  if (!synthe || !KOKO.el || (!test && !kokoVoixActive())) return;
  if (!test && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const propre = String(texte).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/«|»/g, '').replace(/\s+/g, ' ').trim();
  if (!propre) return;
  if (!voixKoko) choisirVoix();
  const u = new SpeechSynthesisUtterance(propre);
  u.lang = 'fr-FR'; if (voixKoko) u.voice = voixKoko;
  u.rate = 1; u.pitch = 1.25; u.volume = 1;
  const numero = ++essaiVoix;
  let demarre = false;
  u.onstart = () => { demarre = true; KOKO.el?.classList.add('parle'); };
  u.onend = u.onerror = () => KOKO.el?.classList.remove('parle');
  phraseKoko = u;
  const lancer = () => { try { synthe.resume(); synthe.speak(u); } catch { /* rien */ } };
  if (synthe.speaking || synthe.pending) { synthe.cancel(); setTimeout(lancer, 150); } else lancer();
  // Si la voix ne démarre pas, on explique pourquoi (une seule fois par session, ou à la demande)
  setTimeout(() => {
    if (demarre || numero !== essaiVoix || (KOKO.aideVoix && !test)) return;
    KOKO.aideVoix = true;
    const aucune = !(synthe.getVoices?.() || []).some((v) => /^fr/i.test(v.lang));
    kokoDire(aucune
      ? 'Je n’ai pas de voix française sur ce téléphone 😕 Installez « Speech Services by Google » depuis le Play Store, puis réessayez.'
      : 'Je n’arrive pas à parler 😕 Montez le volume des médias (touche volume puis ⋮ ou ⚙️), et vérifiez que le téléphone n’est pas en silencieux.', 9000, false);
  }, 2500);
}
function kokoBasculerVoix() {
  const on = !kokoVoixActive();
  try { localStorage.setItem('koordin-koko-voix', on ? 'on' : 'off'); } catch { /* rien */ }
  if (!on) window.speechSynthesis?.cancel();
  majBoutonsKoko();
  if (on) { kokoDire('Bonjour ! Vous m’entendez ? 🔊', 3500, false); kokoParler('Bonjour ! Vous m’entendez ?', { test: true }); }
  else kokoDire('D’accord, je me tais 🤐', 2500, false);
}
function majBoutonsKoko() {
  const b = $('.koko-voix', KOKO.el || document);
  if (b) { b.textContent = kokoVoixActive() ? '🔊' : '🔇'; b.setAttribute('aria-label', kokoVoixActive() ? 'Couper la voix de Koko' : 'Activer la voix de Koko'); }
}

const sansAccents = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const KOKO_ROUTES = [
  [/nouveau rapport|faire (mon|un) rapport|rapport du jour|ecrire un rapport/, 'nouveau-rapport'],
  [/controle|verification|point d arret/, 'controles'],
  [/valider|rapports?/, 'rapports'],
  [/compta|comptabilite|factures? fournisseur|depense/, 'compta'],
  [/caisse|depense|j ai depense|argent recu|fonds/, 'caisse'],
  [/factures?|ticket|achat (fait|paye)/, 'mes-factures'],
  [/devis|situation|encaissement|tresorerie|facturation|client/, 'ventes'],
  [/contrat|prestataire|sous.?traitant/, 'contrats'],
  [/salaire|paie|paye/, 'salaires'],
  [/pointage|presence|appel des ouvriers/, 'pointage'],
  [/achat|commande|fournisseur/, 'achats'],
  [/stock|magasin|article/, 'stock'],
  [/materiel|engin|machine/, 'materiel'],
  [/securite|accident|danger/, 'securite'],
  [/reunion|visio|appels?/, 'appels'],
  [/equipe|membre|inviter/, 'equipe'],
  [/communique|annonce|info/, 'communiques'],
  [/intelligence|assistant|\bia\b/, 'ia'],
  [/mon espace|mes salaires|mon profil/, 'mon-espace'],
  [/parametre|reglage/, 'parametres'],
  [/abonnement|formule|licence/, 'abonnement'],
  [/chantiers?|projets?/, 'projets'],
  [/accueil|tableau de bord|cockpit|maison/, 'dashboard'],
  [/norme|bael|eurocode|dtu|conseil|savoir|quiz/, 'savoir'],
];

// ─── 3.13 : Koko comprend mieux (avancement, retards, suggestions, écrire) ───
// Mots proches tolérés (fautes de frappe, reconnaissance vocale approximative)
const KOKO_MOTS = [
  ['comptabilite', 'compta'], ['facture', 'compta'], ['depenses', 'compta'], ['devis', 'ventes'], ['encaissement', 'ventes'], ['situation', 'ventes'],
  ['contrat', 'contrats'], ['prestataire', 'contrats'], ['salaire', 'salaires'], ['pointage', 'pointage'], ['presences', 'pointage'],
  ['commande', 'achats'], ['fournisseur', 'achats'], ['stock', 'stock'], ['magasin', 'stock'], ['materiel', 'materiel'], ['securite', 'securite'],
  ['reunion', 'appels'], ['appel', 'appels'], ['equipe', 'equipe'], ['communique', 'communiques'], ['parametres', 'parametres'],
  ['abonnement', 'abonnement'], ['chantier', 'projets'], ['projet', 'projets'], ['accueil', 'dashboard'], ['rapport', 'rapports'], ['controle', 'controles'],
];
function distanceMots(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const motsDe = (t) => sansAccents(t).replace(/[^a-z0-9%\s]/g, ' ').split(/\s+/).filter(Boolean);

// Bulle avec boutons de suggestions
function kokoSuggerer(texte, suggestions = [], duree = 14000) {
  kokoDire(texte, duree);
  const b = $('.koko-bulle', KOKO.el || document); if (!b || !suggestions.length) return;
  const zone = document.createElement('div'); zone.className = 'koko-sugg';
  suggestions.slice(0, 4).forEach(([libelle, phrase]) => {
    const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = libelle;
    bt.onclick = (e) => { e.stopPropagation(); kokoComprendre(phrase || libelle); };
    zone.appendChild(bt);
  });
  $('.koko-texte', b).after(zone);
}
function kokoEcrire() {
  const b = $('.koko-bulle', KOKO.el || document); if (!b) return;
  kokoDire('Écrivez-moi votre question 👇', 60000, false);
  const f = document.createElement('form'); f.className = 'koko-ecrire';
  f.innerHTML = '<input type="text" placeholder="Ex. pourquoi Villa Cocody est à 6 % ?" aria-label="Votre question à Koko" enterkeyhint="send"><button type="submit" aria-label="Envoyer">➤</button>';
  f.onsubmit = (e) => { e.preventDefault(); const v = $('input', f).value.trim(); if (v) kokoComprendre(v); };
  $('.koko-texte', b).after(f);
  setTimeout(() => $('input', f).focus(), 50);
}
const kokoSuggestionsBase = () => [
  ['📊 Où en sont mes chantiers ?', 'avancement des chantiers'],
  ...(can('direction', 'coordinateur') ? [['📋 Rapports à valider', 'combien de rapports à valider']] : [['📝 Nouveau rapport', 'nouveau rapport']]),
  ['⏰ Chantiers en retard', 'chantiers en retard'],
  ['⌨️ Écrire ma question', '__ecrire'],
];

async function kokoProjets() {
  return avecCache('koko-projets', () => q(sb.from('v_projets').select('id, nom, statut, avancement, avancement_attendu, sante, jours_de_retard, rapports_en_attente, date_fin_prevue').neq('statut', 'termine').order('nom')), { defaut: [] });
}
// Le chantier cité dans la phrase (mots du nom, avec tolérance)
function projetCite(t, projets) {
  const mots = motsDe(t);
  let meilleur = null, score = 0;
  for (const pr of projets) {
    const nm = motsDe(pr.nom).filter((m) => m.length > 2 && !['villa', 'immeuble', 'chantier', 'projet', 'residence', 'batiment'].includes(m));
    const s = nm.filter((m) => mots.some((x) => x === m || (m.length > 4 && distanceMots(x, m) <= 1))).length;
    if (s > score) { score = s; meilleur = pr; }
  }
  return meilleur;
}

async function kokoExpliquerAvancement(pr) {
  const [lots, sansLot] = await Promise.all([
    q(sb.from('lots').select('nom, avancement, budget').eq('projet_id', pr.id).order('ordre')).catch(() => []),
    can('direction', 'coordinateur')
      ? sb.from('rapports').select('id', { count: 'exact', head: true }).eq('projet_id', pr.id).is('lot_id', null).gte('date_rapport', decalerJour(todayISO(), -30)).then((r) => r.count || 0, () => 0)
      : Promise.resolve(0),
  ]);
  const phrases = [`${pr.nom} est à ${pr.avancement} %.`];
  if (!lots.length) phrases.push('Ce chantier n’a pas encore de lots : ajoutez-en dans l’onglet « Lots », sinon l’avancement reste à 0.');
  else {
    const tries = [...lots].sort((a, b) => num(b.budget) - num(a.budget));
    const zero = lots.filter((l) => !num(l.avancement)).length;
    phrases.push(lots.length === 1 ? `Il n’a qu’un lot : ${lots[0].nom}, à ${lots[0].avancement} %.` : `Il se calcule sur ${lots.length} lots, les plus gros comptant davantage : ${tries.slice(0, 3).map((l) => `${l.nom} ${l.avancement} %`).join(', ')}${lots.length > 3 ? '…' : '.'}`);
    if (zero) phrases.push(`${zero} lot${zero > 1 ? 's sont' : ' est'} encore à 0 %.`);
  }
  if (pr.avancement_attendu != null && pr.avancement_attendu - pr.avancement > 5) phrases.push(`D’après les dates du chantier, il devrait être vers ${pr.avancement_attendu} %.`);
  if (pr.rapports_en_attente) phrases.push(`${pr.rapports_en_attente} rapport${pr.rapports_en_attente > 1 ? 's attendent' : ' attend'} ${can('direction') ? 'votre validation finale' : 'une validation'} : l’avancement bougera après.`);
  if (sansLot) phrases.push(`${sansLot} rapport${sansLot > 1 ? 's' : ''} récent${sansLot > 1 ? 's' : ''} n’indique${sansLot > 1 ? 'nt' : ''} pas de lot : ils ne font pas monter le chiffre.`);
  if (lots.length && !pr.rapports_en_attente && pr.avancement < 15) phrases.push('Astuce : l’avancement d’un lot monte quand un rapport choisit ce lot, indique un pourcentage, puis est validé.');
  return phrases.join(' ');
}

async function kokoAvancement(t) {
  const projets = await kokoProjets();
  if (!projets.length) return kokoSuggerer('Vous n’avez aucun chantier en cours pour le moment.', [['🏗️ Ouvrir les chantiers', 'ouvre les chantiers']]);
  const pr = projetCite(t, projets) || (projets.length === 1 ? projets[0] : null);
  if (pr) {
    kokoDire(`Je regarde ${pr.nom}… 🔎`, 3000, false);
    const txt = await kokoExpliquerAvancement(pr);
    ongletProjet = 'lots';
    allerA(`#/projet/${pr.id}`);
    setTimeout(() => kokoSuggerer(txt, [
      ...(pr.rapports_en_attente && can('direction', 'coordinateur') ? [['📋 Voir les rapports à valider', 'rapports à valider']] : []),
      ['📅 Voir le planning', `__planning:${pr.id}`],
    ], 26000), 600);
    return;
  }
  const moyen = Math.round(projets.reduce((s, x) => s + num(x.avancement), 0) / projets.length);
  const bas = [...projets].sort((a, b) => a.avancement - b.avancement);
  allerA('#/projets');
  setTimeout(() => kokoSuggerer(`Vos ${projets.length} chantiers sont en moyenne à ${moyen} %. Les moins avancés : ${bas.slice(0, 3).map((x) => `${x.nom} (${x.avancement} %)`).join(', ')}. Touchez un chantier pour que je vous explique son chiffre.`,
    bas.slice(0, 3).map((x) => [`🔎 ${x.nom}`, `pourquoi avancement ${x.nom}`]), 24000), 600);
}

async function kokoRetards() {
  const projets = await kokoProjets();
  const soucis = projets.filter((x) => x.jours_de_retard > 0 || x.sante === 'critique' || (x.avancement_attendu != null && x.avancement_attendu - x.avancement > 10));
  if (!soucis.length) return kokoSuggerer('Aucun chantier en retard pour le moment ✅', [['📊 Où en sont mes chantiers ?', 'avancement des chantiers']]);
  allerA('#/projets');
  setTimeout(() => kokoSuggerer(`${soucis.length} chantier${soucis.length > 1 ? 's' : ''} à surveiller : ${soucis.slice(0, 3).map((x) => `${x.nom} (${x.jours_de_retard > 0 ? `${x.jours_de_retard} j de retard` : `${x.avancement} % au lieu de ${x.avancement_attendu} %`})`).join(', ')}.`,
    soucis.slice(0, 3).map((x) => [`🔎 ${x.nom}`, `pourquoi avancement ${x.nom}`]), 22000), 600);
}

let kokoIncompris = 0;
async function kokoComprendre(phrase) {
  KOKO.occupe = Date.now() + 5000;
  if (phrase === '__ecrire') return kokoEcrire();
  if (phrase.startsWith('__planning:')) { ongletProjet = 'planning'; allerA(`#/projet/${phrase.slice(11)}`); return kokoDire('Voici le planning 📅', 3000); }
  const t = sansAccents(phrase);
  const visibles = new Set(menuVisible().map((m) => m.r));
  const repondre = (txt) => kokoDire(txt, 5500);
  try {
    if (/^(bonjour|salut|bonsoir|coucou|hello)\b/.test(t) && t.split(' ').length < 4) return kokoSuggerer(`Bonjour ${String(S.profil.nom).split(' ')[0]} ! Que puis-je faire pour vous ?`, kokoSuggestionsBase());
    if (/^merci/.test(t)) return repondre('Avec plaisir ! 😊');
    if (/quelle heure|l heure/.test(t)) return repondre(`Il est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
    if (/aide|que sais.tu|tu sais faire|comment ca marche|tu peux faire/.test(t)) return kokoSuggerer('Je peux ouvrir les pages, expliquer l’avancement d’un chantier, trouver les retards, compter les rapports à valider, appeler quelqu’un… Essayez :', kokoSuggestionsBase());
    // Appeler quelqu'un
    const appel = /(appelle|appeler|telephone a|lance un appel avec|visio avec)\s+(.+)/.exec(t);
    if (appel) {
      const nom = appel[2].replace(/^(le |la |l |monsieur |madame |m )/, '').replace(/\b(en )?(video|vocal)\b/g, '').trim();
      const qui = (S.equipe || []).filter((x) => x.actif && x.id !== S.profil.id).find((x) => sansAccents(x.nom).split(/\s+/).some((m) => m.length > 1 && nom.split(/\s+/).includes(m)) || sansAccents(x.nom).includes(nom));
      if (qui) {
        const video = /video|camera|chantier en direct/.test(t);
        repondre(`J’appelle ${qui.nom} ${video ? '📹' : '📞'}`);
        setTimeout(() => lancerAppel({ mode: !video ? 'audio' : role() === 'technicien' || qui.role === 'technicien' ? 'chantier' : 'reunion', invites: [qui.id] }), 900); return;
      }
      return repondre(`Je ne trouve pas « ${nom} » dans votre équipe.`);
    }
    if (/(savoir|conseil|astuce|regle) du jour/.test(t)) { const sj = savoirDuJour(); kokoDire(`${sj.t}. ${sj.x}`, 12000); return; }
    // Avancement : « où en est… », « pourquoi 6 % », « état d'avancement »…
    if (!DEMO && /avancement|avancer|progression|ou en (est|sont)|pourquoi.*(%|pour ?cent|chiffre|bas|faible)|\d+ ?(%|pour ?cent)|etat des (travaux|chantiers)|niveau des travaux/.test(t)) return kokoAvancement(t);
    if (!DEMO && /retard|a surveiller|en danger|critique|qui traine|en panne de/.test(t) && !/salaire|paie/.test(t)) return kokoRetards();
    if (/combien/.test(t) && /rapport/.test(t) || /rapports? (a|en attente de) valid/.test(t)) {
      if (DEMO) return allerA('#/rapports');
      try {
        const p = await q(sb.from('v_projets').select('rapports_en_attente'));
        const n = p.reduce((s, x) => s + num(x.rapports_en_attente), 0);
        if (n && visibles.has('rapports')) setTimeout(() => allerA('#/rapports'), 700);
        return repondre(n ? `Vous avez ${n} rapport${n > 1 ? 's' : ''} à valider. Je vous les ouvre 📋` : 'Aucun rapport en attente. Tout est à jour ✅');
      } catch { return repondre('Je n’arrive pas à compter les rapports pour le moment.'); }
    }
    if (/combien/.test(t) && /chantier|projet/.test(t) && !DEMO) {
      try { const p = await kokoProjets(); return repondre(`Vous avez ${p.length} chantier${p.length > 1 ? 's' : ''} en cours.`); } catch { /* rien */ }
    }
    // Un chantier cité par son nom : on l'ouvre
    if (!DEMO) {
      const pr = projetCite(t, await kokoProjets());
      if (pr && !/stock|salaire|compta|devis|contrat/.test(t)) {
        if (/planning|calendrier|taches/.test(t)) ongletProjet = 'planning';
        else if (/photo|galerie/.test(t)) ongletProjet = 'galerie';
        else if (/lot|budget/.test(t)) ongletProjet = 'lots';
        repondre(`J’ouvre ${pr.nom} 🏗️`);
        setTimeout(() => allerA(`#/projet/${pr.id}`), 700);
        return;
      }
    }
    const nettoye = t.replace(/\b(ouvre|ouvrir|ouvres|va|aller|vas|montre|montrer|affiche|afficher|la|le|les|des|de|du|page|moi|sur|l|stp|svp|s il te plait|je veux|voir)\b/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [motif, r] of KOKO_ROUTES) {
      if ((motif.test(t) || motif.test(nettoye)) && (visibles.has(r) || (r === 'nouveau-rapport' && can(...ROLES_RAPPORT)))) {
        const nom = menuVisible().find((m) => m.r === r)?.label || 'Nouveau rapport';
        kokoIncompris = 0;
        repondre(`J’ouvre ${nom} 👍`);
        setTimeout(() => allerA(`#/${r}`), 700);
        return;
      }
    }
    // Mot mal reconnu : on cherche le plus proche
    for (const m of motsDe(nettoye).filter((x) => x.length >= 4)) {
      const proche = KOKO_MOTS.find(([mot]) => distanceMots(m, mot) <= (mot.length > 6 ? 2 : 1));
      if (proche && visibles.has(proche[1])) {
        const nom = menuVisible().find((x) => x.r === proche[1])?.label;
        return kokoSuggerer(`Vous voulez ouvrir « ${nom} » ?`, [[`✅ Oui, ${nom}`, `ouvre ${proche[1]}`], ['Non', '__ecrire']], 12000);
      }
    }
  } catch (e) { console.warn('koko', e); return repondre('Oups, je n’ai pas réussi à trouver l’information. Réessayez dans un instant 🙏'); }
  kokoIncompris++;
  const debuts = ['Je n’ai pas bien compris', 'Hmm, je ne suis pas sûr de comprendre', 'Désolé, ça je ne sais pas encore faire'];
  kokoSuggerer(`${debuts[(kokoIncompris - 1) % debuts.length]} « ${phrase} ». Voulez-vous plutôt :`, kokoSuggestionsBase(), 16000);
}

function kokoEcouter() {
  if (!KOKO.el) return;
  if (!Reconnaissance) { kokoDire('Votre téléphone ne me permet pas d’écouter. Essayez avec Chrome 🙏', 4500); return; }
  if (KOKO.reco) { KOKO.reco.abort(); return; }
  window.speechSynthesis?.cancel();
  const rec = new Reconnaissance();
  rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
  KOKO.reco = rec;
  KOKO.el.classList.add('ecoute');
  kokoDire('Je vous écoute… 👂', 8000);
  try { navigator.vibrate?.(20); } catch { /* rien */ }
  rec.onresult = (e) => { const p = e.results?.[0]?.[0]?.transcript || ''; if (p) { kokoDire(`« ${p} »`, 1500); setTimeout(() => kokoComprendre(p), 600); } };
  rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') kokoDire('Autorisez le micro pour que je puisse vous écouter 🎤', 5000); else if (e.error === 'no-speech') kokoDire('Je n’ai rien entendu. Réessayez 🎤', 3500); };
  rec.onend = () => { KOKO.reco = null; KOKO.el?.classList.remove('ecoute'); };
  try { rec.start(); } catch { KOKO.reco = null; KOKO.el.classList.remove('ecoute'); }
}

// Koko s'endort quand personne ne touche le téléphone
(() => {
  let minuterie;
  const reveil = () => {
    if (KOKO.el?.classList.contains('dort')) { KOKO.el.classList.remove('dort'); kokoAnim('saute'); }
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { if (KOKO.el && !KOKO.reco && !$('.appel-ecran')) KOKO.el.classList.add('dort'); }, 60000);
  };
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, reveil, { passive: true, capture: true }));
  reveil();
})();

// ═══════════════════════════════ 3.4 : LA 3D ═══════════════════════════════
// Maquette 3D du chantier dans le cockpit (Three.js chargé à la demande) et relief des cartes
// qui suit l'inclinaison du téléphone (ou la souris sur ordinateur).
let troisCharge = null;
function chargerTrois() {
  if (window.THREE) return Promise.resolve(window.THREE);
  troisCharge ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'three.min.js?v=1';
    s.onload = () => (window.THREE ? ok(window.THREE) : ko(new Error('3D')));
    s.onerror = () => { troisCharge = null; ko(new Error('3D')); };
    document.head.appendChild(s);
  });
  return troisCharge;
}
const webglPossible = () => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; } };

async function lancerMaquette3D(hote) {
  if (!hote || hote.dataset.lance || reduireAnimations() || !webglPossible()) return;
  hote.dataset.lance = '1';
  let T;
  try { T = await chargerTrois(); } catch { return; }
  if (!hote.isConnected) return;
  const avancement = Math.max(0, Math.min(100, num(hote.dataset.val)));
  const libelle = hote.dataset.lib || 'avancement';
  const zone = document.createElement('div');
  zone.className = 'maquette3d';
  zone.innerHTML = `<div class="maquette3d-info"><b class="jauge-n">${avancement} %</b><span>${esc(libelle)}</span></div><span class="maquette3d-aide">↔ Faites-moi tourner</span>`;
  hote.appendChild(zone);
  hote.classList.add('en-3d');
  compteur($('.jauge-n', zone));

  const nuit = (() => { const h = new Date().getHours(); return h < 6 || h >= 19; })();
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
  zone.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);

  // Lumières : soleil doré le jour, lune bleutée la nuit
  scene.add(new T.HemisphereLight(nuit ? 0x6f86c9 : 0xfff1d6, nuit ? 0x10131f : 0x2a2418, nuit ? 0.9 : 1.15));
  const soleil = new T.DirectionalLight(nuit ? 0x9fb4ff : 0xffd38a, nuit ? 0.9 : 1.9);
  soleil.position.set(6, 12, 7);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  Object.assign(soleil.shadow.camera, { left: -8, right: 8, top: 10, bottom: -6 });
  scene.add(soleil);

  const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, ...o });
  const boite = (l, h, p, m) => { const b = new T.Mesh(new T.BoxGeometry(l, h, p), m); b.castShadow = true; b.receiveShadow = true; return b; };

  // Plateau du chantier
  const plateau = new T.Mesh(new T.CylinderGeometry(6.6, 6.9, 0.45, 64), mat(0x1b2131, { roughness: 0.9 }));
  plateau.position.y = -0.23; plateau.receiveShadow = true; scene.add(plateau);
  const liseré = new T.Mesh(new T.TorusGeometry(6.75, 0.06, 8, 96), mat(0xe8a020, { emissive: 0x6b4405, metalness: 0.6, roughness: 0.3 }));
  liseré.rotation.x = Math.PI / 2; liseré.position.y = 0.01; scene.add(liseré);
  const grille = new T.GridHelper(11, 22, 0xe8a020, 0x3a4560);
  grille.material.transparent = true; grille.material.opacity = 0.18; grille.position.y = 0.012; scene.add(grille);

  // Immeuble : un étage construit par tranche de 10 %
  const ETAGES = 10, H = 0.52, faits = avancement / 10;
  const immeuble = new T.Group(); immeuble.position.set(-0.6, 0, 0.2); scene.add(immeuble);
  const fenetres = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#c9cdd6'; x.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 6; i++) { x.fillStyle = nuit ? (Math.random() < 0.65 ? '#ffd56b' : '#2a3350') : '#5c7fb3'; x.fillRect(6 + i * 20.5, 8, 13, 16); }
    const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const murMat = new T.MeshStandardMaterial({ map: fenetres, roughness: 0.6, emissive: nuit ? 0xffd56b : 0x000000, emissiveMap: nuit ? fenetres : null, emissiveIntensity: nuit ? 0.55 : 0 });
  const dalleMat = mat(0x8d93a3); const poteauMat = mat(0xb9bec9);
  const fantome = new T.LineBasicMaterial({ color: 0xf5bf50, transparent: true, opacity: 0.28 });
  const apparitions = [];
  for (let i = 0; i < ETAGES; i++) {
    const y = i * H;
    if (i < Math.floor(faits)) {
      const etage = new T.Group(); etage.position.y = y;
      const mur = boite(3, H - 0.08, 2.4, murMat); mur.position.y = (H - 0.08) / 2 + 0.08; etage.add(mur);
      const dalle = boite(3.25, 0.08, 2.65, dalleMat); dalle.position.y = 0.04; etage.add(dalle);
      etage.scale.y = 0.001; immeuble.add(etage); apparitions.push(etage);
    } else if (i === Math.floor(faits) && avancement < 100) {
      const etage = new T.Group(); etage.position.y = y;
      const dalle = boite(3.25, 0.08, 2.65, dalleMat); dalle.position.y = 0.04; etage.add(dalle);
      const part = faits - Math.floor(faits);
      [[-1.45, -1.15], [1.45, -1.15], [-1.45, 1.15], [1.45, 1.15], [0, -1.15], [0, 1.15]].slice(0, 2 + Math.round(part * 4)).forEach(([px, pz]) => {
        const p = boite(0.12, H - 0.08, 0.12, poteauMat); p.position.set(px, (H - 0.08) / 2 + 0.08, pz); etage.add(p);
      });
      const halo = new T.Mesh(new T.BoxGeometry(3.3, 0.04, 2.7), new T.MeshBasicMaterial({ color: 0xf5bf50, transparent: true, opacity: 0.55 }));
      halo.position.y = 0.1; halo.name = 'halo'; etage.add(halo);
      etage.scale.y = 0.001; immeuble.add(etage); apparitions.push(etage);
    } else {
      const lignes = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(3, H - 0.04, 2.4)), fantome);
      lignes.position.y = y + H / 2; immeuble.add(lignes);
    }
  }
  // Échafaudage doré le long de la façade
  const echafMat = new T.LineBasicMaterial({ color: 0xf0a92a, transparent: true, opacity: 0.75 });
  const hautEchaf = Math.max(1, Math.ceil(faits)) * H + 0.2;
  const ptsEchaf = [];
  for (let k = 0; k <= Math.ceil(hautEchaf / H); k++) { const y = Math.min(k * H, hautEchaf); ptsEchaf.push(-1.6, y, 1.45, 1.6, y, 1.45); }
  [-1.6, -0.5, 0.6, 1.6].forEach((x) => ptsEchaf.push(x, 0, 1.45, x, hautEchaf, 1.45));
  const echafGeo = new T.BufferGeometry(); echafGeo.setAttribute('position', new T.Float32BufferAttribute(ptsEchaf, 3));
  immeuble.add(new T.LineSegments(echafGeo, echafMat));

  // Grue à tour
  const jaune = mat(0xf2b01e, { roughness: 0.5, metalness: 0.2 });
  const grue = new T.Group(); grue.position.set(2.6, 0, -1.4); scene.add(grue);
  const mat2 = boite(0.28, 7.2, 0.28, jaune); mat2.position.y = 3.6; grue.add(mat2);
  const treillis = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.28, 7.2, 0.28, 1, 12, 1)), new T.LineBasicMaterial({ color: 0x7a5205 }));
  treillis.position.y = 3.6; grue.add(treillis);
  const tete = new T.Group(); tete.position.y = 7.25; grue.add(tete);
  const fleche = boite(6.2, 0.2, 0.22, jaune); fleche.position.x = -2.2; tete.add(fleche);
  const contre = boite(1.8, 0.2, 0.22, jaune); contre.position.x = 1.6; tete.add(contre);
  const lest = boite(0.6, 0.45, 0.5, mat(0x3b4256)); lest.position.set(2.3, -0.25, 0); tete.add(lest);
  const cabine = boite(0.5, 0.4, 0.45, mat(0xe6e9f0)); cabine.position.set(0.15, -0.3, 0.3); tete.add(cabine);
  const chariot = new T.Group(); chariot.position.x = -3.4; tete.add(chariot);
  const cable = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, -2.6, 0)]), new T.LineBasicMaterial({ color: 0x222833 }));
  chariot.add(cable);
  const charge = boite(0.7, 0.35, 0.5, mat(0xc08a4c)); charge.position.y = -2.8; chariot.add(charge);
  const gyro = new T.Mesh(new T.SphereGeometry(0.11, 12, 12), new T.MeshBasicMaterial({ color: 0xff3b30 }));
  gyro.position.y = 0.25; tete.add(gyro);
  const gyroLum = new T.PointLight(0xff3b30, 0, 5); gyroLum.position.y = 0.4; tete.add(gyroLum);

  // Poussière dorée qui flotte
  const N = 70, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 12; pos[i * 3 + 1] = Math.random() * 8; pos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const poussiere = new T.Points(pg, new T.PointsMaterial({ color: 0xffd98a, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(poussiere);

  // Caméra en orbite, que l'on fait tourner au doigt
  let angle = 0.7, cible = 0.7, vitesse = 0.0025, glisse = null;
  const toile = renderer.domElement;
  toile.addEventListener('pointerdown', (e) => { glisse = { x: e.clientX, a: cible }; toile.setPointerCapture(e.pointerId); zone.classList.add('touche'); });
  toile.addEventListener('pointermove', (e) => { if (glisse) cible = glisse.a - (e.clientX - glisse.x) * 0.012; });
  const lacher = () => { glisse = null; };
  toile.addEventListener('pointerup', lacher); toile.addEventListener('pointercancel', lacher);

  const taille = () => { const r = zone.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); };
  taille();
  const ro = new ResizeObserver(taille); ro.observe(zone);
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(zone);

  const t0 = performance.now();
  const boucle = (t) => {
    if (!zone.isConnected) { ro.disconnect(); io.disconnect(); renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); }); return; }
    requestAnimationFrame(boucle);
    if (!visible || document.hidden) return;
    const s = (t - t0) / 1000;
    apparitions.forEach((e, i) => { const k = Math.min(1, Math.max(0, (s - 0.25 - i * 0.12) / 0.45)); e.scale.y = 0.001 + (1 - Math.pow(1 - k, 3)) * 0.999; });
    if (!glisse) cible += vitesse;
    angle += (cible - angle) * 0.12;
    const inc = INCLINAISON.x * 0.35;
    camera.position.set(Math.sin(angle + inc) * 19, 9.5 - INCLINAISON.y * 1.2, Math.cos(angle + inc) * 19);
    camera.lookAt(0, 3.3, 0);
    tete.rotation.y = Math.sin(s * 0.35) * 1.1;
    chariot.position.x = -3.4 + Math.sin(s * 0.5) * 1.4;
    const balance = Math.sin(s * 1.6) * 0.06;
    charge.position.set(Math.sin(balance) * 2.8, -2.8 + Math.sin(s * 0.8) * 0.4, 0);
    cable.geometry.setFromPoints([new T.Vector3(0, 0, 0), charge.position.clone().add(new T.Vector3(0, 0.17, 0))]);
    const clign = (Math.sin(s * 5) > 0.3) ? 1 : 0;
    gyro.material.color.setHex(clign ? 0xff3b30 : 0x5a1512); gyroLum.intensity = clign * 2.5;
    const halo = immeuble.getObjectByName('halo'); if (halo) halo.material.opacity = 0.35 + Math.sin(s * 3) * 0.25;
    const p = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += 0.006; if (p[i * 3 + 1] > 8) p[i * 3 + 1] = 0; }
    pg.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  };
  requestAnimationFrame(boucle);
}

// Relief : les cartes suivent l'inclinaison du téléphone (ou la souris)
const INCLINAISON = { x: 0, y: 0 };
(() => {
  if (reduireAnimations()) return;
  const racine = document.documentElement;
  let vise = { x: 0, y: 0 }, prevu = false;
  const lisser = () => {
    prevu = false;
    INCLINAISON.x += (vise.x - INCLINAISON.x) * 0.2;
    INCLINAISON.y += (vise.y - INCLINAISON.y) * 0.2;
    racine.style.setProperty('--incl-x', INCLINAISON.x.toFixed(3));
    racine.style.setProperty('--incl-y', INCLINAISON.y.toFixed(3));
    if (Math.abs(vise.x - INCLINAISON.x) > 0.002 || Math.abs(vise.y - INCLINAISON.y) > 0.002) demander();
  };
  const demander = () => { if (!prevu) { prevu = true; requestAnimationFrame(lisser); } };
  const borne = (v) => Math.max(-1, Math.min(1, v));
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    vise = { x: borne((e.gamma || 0) / 25), y: borne(((e.beta || 0) - 40) / 25) };
    demander();
  }, { passive: true });
  if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      vise = { x: borne((e.clientX / window.innerWidth - 0.5) * 2), y: borne((e.clientY / window.innerHeight - 0.5) * 2) };
      demander();
    }, { passive: true });
  }
})();

// ═══════════════════════════════ 3.5 : LE SAVOIR DU JOUR ═══════════════════════════════
// Résumés pratiques des règles BAEL 91 révisé 99, Eurocodes, DTU et bonnes pratiques de chantier.
// Ils ne remplacent pas les textes officiels ni l'avis du bureau d'études ou du bureau de contrôle.
const SAVOIR_CATS = {
  bael: ['📐', 'BAEL'], euro: ['🇪🇺', 'Eurocodes'], beton: ['🧱', 'Béton et mise en œuvre'], techno: ['🏗️', 'Technologie du bâtiment'],
  secu: ['🦺', 'Sécurité'], tropical: ['☀️', 'Climat tropical'], second: ['🔧', 'Second œuvre'],
  topo: ['📏', 'Topographie'], metre: ['🧮', 'Métré et quantités'], ogc: ['📋', 'Organisation et gestion de chantier'],
  rdm: ['⚖️', 'Résistance des matériaux'], geo: ['🪨', 'Géotechnique et fondations'], vrd: ['🛣️', 'Routes et VRD'],
  hydro: ['💧', 'Hydraulique et assainissement'], metal: ['🔩', 'Charpente métallique et bois'],
};
const SAVOIR = [
  { c: 'bael', t: 'Enrobage minimal des armatures', x: 'Distance entre l’acier et la paroi : 5 cm pour les ouvrages à la mer ou exposés aux embruns ; 3 cm pour les parois exposées aux intempéries ou aux condensations (2 cm si le béton dépasse 40 MPa) ; 1 cm pour les parois à l’abri, en local clos et couvert. Sur chantier, utilisez toujours des cales d’enrobage.', r: 'BAEL 91 révisé 99, art. A.7.1' },
  { c: 'bael', t: 'Combinaisons de charges', x: 'À l’état limite ultime (ELU) : 1,35 G + 1,5 Q, avec G les charges permanentes (poids propre, revêtements) et Q les charges d’exploitation. À l’état limite de service (ELS) : G + Q.', r: 'BAEL 91 révisé 99, art. A.3.3' },
  { c: 'bael', t: 'Résistance de calcul du béton', x: 'À l’ELU, la contrainte de calcul du béton comprimé est fbu = 0,85 × fc28 / (θ × γb), avec γb = 1,5 en situation courante (1,15 en situation accidentelle). Pour un béton de 25 MPa : fbu ≈ 14,2 MPa.', r: 'BAEL 91 révisé 99, art. A.4.3,41' },
  { c: 'bael', t: 'Résistance du béton à la traction', x: 'La résistance caractéristique à la traction se déduit de la compression : ft28 = 0,6 + 0,06 × fc28 (en MPa). Pour fc28 = 25 MPa, ft28 = 2,1 MPa. Le béton résiste mal à la traction : c’est le rôle des aciers.', r: 'BAEL 91 révisé 99, art. A.2.1,12' },
  { c: 'bael', t: 'Résistance du béton à j jours', x: 'Pour un béton courant (fc28 ≤ 40 MPa) : fcj = j / (4,76 + 0,83 j) × fc28. À 7 jours, le béton atteint environ 66 % de sa résistance à 28 jours. C’est utile pour juger les éprouvettes écrasées à 7 jours.', r: 'BAEL 91 révisé 99, art. A.2.1,11' },
  { c: 'bael', t: 'Résistance de calcul des aciers', x: 'À l’ELU : σs = fe / γs avec γs = 1,15. Pour un acier FeE400 : 348 MPa ; pour un FeE500 : 435 MPa. Vérifiez toujours la nuance livrée (marquage des barres, certificat du fournisseur).', r: 'BAEL 91 révisé 99, art. A.4.3,2' },
  { c: 'bael', t: 'Condition de non-fragilité des poutres', x: 'Une poutre doit contenir un minimum d’acier tendu : As ≥ 0,23 × b × d × ft28 / fe. Sans ce minimum, la poutre peut se rompre brutalement dès la première fissure.', r: 'BAEL 91 révisé 99, art. A.4.2' },
  { c: 'bael', t: 'Armatures longitudinales des poteaux', x: 'Section d’acier comprise entre le plus grand de 4 cm² par mètre de périmètre et 0,2 % de la section du béton, et au plus 5 % de la section. Espacement entre barres ≤ la plus petite dimension + 10 cm, sans dépasser 40 cm.', r: 'BAEL 91 révisé 99, art. A.8.1,21' },
  { c: 'bael', t: 'Cadres des poteaux', x: 'Diamètre des cadres ≥ 1/3 du plus gros diamètre longitudinal. Espacement ≤ le plus petit de : 15 fois le plus petit diamètre longitudinal, 40 cm, et la plus petite dimension du poteau + 10 cm.', r: 'BAEL 91 révisé 99, art. A.8.1,3' },
  { c: 'bael', t: 'Élancement des poteaux', x: 'L’élancement λ = longueur de flambement / rayon de giration. La méthode forfaitaire du BAEL s’applique jusqu’à λ = 70. Au-delà de 50, la résistance chute fortement : élargissez la section plutôt qu’ajouter de l’acier.', r: 'BAEL 91 révisé 99, art. B.8.4' },
  { c: 'bael', t: 'Espacement des armatures d’effort tranchant', x: 'Dans une poutre, l’espacement des cadres ou étriers ne dépasse pas le plus petit de 0,9 d et 40 cm. Resserrez les cadres près des appuis, là où l’effort tranchant est maximal.', r: 'BAEL 91 révisé 99, art. A.5.1,22' },
  { c: 'bael', t: 'Longueur d’ancrage des barres', x: 'Sans calcul précis, on admet couramment une longueur de scellement droit de 40 diamètres pour un acier HA FeE400 et 50 diamètres pour un FeE500. Une barre de 12 mm en FeE400 doit donc être ancrée sur environ 48 cm.', r: 'BAEL 91 révisé 99, art. A.6.1,23' },
  { c: 'bael', t: 'Espacement minimal entre barres', x: 'L’écart horizontal entre deux barres doit être au moins égal au plus grand du diamètre de la barre et de 1,5 fois la taille du plus gros gravillon. Sinon le béton passe mal et des vides se forment.', r: 'BAEL 91 révisé 99, art. A.7.2' },
  { c: 'bael', t: 'Les trois cas de fissuration', x: 'Le BAEL distingue la fissuration peu préjudiciable, préjudiciable et très préjudiciable. Plus le milieu est agressif (eau, sel, humidité), plus on limite la contrainte des aciers à l’ELS et plus on soigne l’enrobage.', r: 'BAEL 91 révisé 99, art. A.4.5,3' },
  { c: 'bael', t: 'Semelle isolée rigide', x: 'Pour la méthode des bielles, la hauteur utile d’une semelle doit vérifier d ≥ (B − b) / 4, avec B la largeur de la semelle et b celle du poteau. Une semelle trop mince poinçonne ou fissure.', r: 'BAEL 91 révisé 99, chapitre B.9 (fondations)' },
  { c: 'euro', t: 'Notation des bétons selon l’Eurocode 2', x: 'Un béton C25/30 a une résistance caractéristique de 25 MPa sur cylindre et 30 MPa sur cube. Le premier chiffre sert aux calculs, le second aux essais sur cubes.', r: 'Eurocode 2 (NF EN 1992-1-1), tableau 3.1' },
  { c: 'euro', t: 'Classes d’exposition', x: 'L’Eurocode classe l’environnement : XC (carbonatation, béton à l’air), XS (eau de mer, embruns), XD (chlorures hors mer), XA (sols agressifs). Plus la classe est sévère, plus l’enrobage et le dosage en ciment augmentent.', r: 'NF EN 206 et Eurocode 2, section 4' },
  { c: 'euro', t: 'Enrobage nominal', x: 'L’Eurocode 2 calcule l’enrobage nominal : cnom = cmin + Δcdev, avec Δcdev = 10 mm en général pour tenir compte des tolérances d’exécution. En bord de mer, prévoir largement plus de 4 cm.', r: 'Eurocode 2, art. 4.4.1' },
  { c: 'euro', t: 'Combinaison ELU de l’Eurocode 0', x: 'Comme au BAEL, la combinaison courante est 1,35 G + 1,5 Q. Avec plusieurs charges variables (vent, exploitation), une seule est prise en entier, les autres sont réduites par des coefficients ψ0.', r: 'Eurocode 0 (NF EN 1990), art. 6.4.3.2' },
  { c: 'euro', t: 'Charges d’exploitation courantes', x: 'Valeurs usuelles : 1,5 kN/m² pour un logement, 2,5 kN/m² pour un bureau, 4 à 5 kN/m² pour les salles de réunion et lieux recevant du public. Vérifiez l’annexe nationale applicable.', r: 'Eurocode 1 (NF EN 1991-1-1), tableau 6.2' },
  { c: 'beton', t: 'Dosages courants', x: 'Repères de chantier : béton de propreté ≈ 150 kg de ciment par m³ ; béton armé courant ≈ 350 kg/m³ ; mortier de pose des parpaings ≈ 300 kg/m³. Le dosage exact dépend de la formulation et des granulats.', r: 'Bonnes pratiques de chantier (DTU 21)' },
  { c: 'beton', t: 'Ne jamais rajouter d’eau', x: 'Ajouter de l’eau rend le béton plus facile à couler mais fait chuter sa résistance et augmente le retrait et les fissures : chaque litre en trop compte. Utilisez plutôt un adjuvant plastifiant prévu dans la formule.', r: 'Bonnes pratiques (DTU 21)' },
  { c: 'beton', t: 'Le cône d’Abrams', x: 'L’essai d’affaissement mesure la consistance du béton frais. Pour un béton armé courant vibré, on vise souvent 5 à 9 cm (classe S2). Faites l’essai à chaque toupie ou gâchée importante.', r: 'NF EN 12350-2' },
  { c: 'beton', t: 'Les éprouvettes', x: 'Prélevez des éprouvettes cylindriques 16 × 32 cm, conservées humides, et faites-les écraser à 7 et 28 jours. Notez la date, l’ouvrage et la toupie : c’est la preuve de la qualité du béton.', r: 'NF EN 12390' },
  { c: 'beton', t: 'La vibration', x: 'Plongez l’aiguille vibrante verticalement, tous les 30 à 50 cm environ, en couches de 50 cm maximum. Retirez-la lentement. Ne vibrez pas les armatures et ne vibrez pas trop longtemps : le béton se sépare.', r: 'Bonnes pratiques (DTU 21)' },
  { c: 'beton', t: 'La cure du béton', x: 'Gardez le béton humide pendant au moins 7 jours : arrosage, bâches, toile de jute mouillée ou produit de cure. Une dalle qui sèche trop vite fissure et perd de la résistance.', r: 'DTU 21 et NF EN 13670' },
  { c: 'beton', t: 'Délais de décoffrage', x: 'Repères indicatifs : joues de poutres et poteaux après 1 à 3 jours ; fonds de dalles et de poutres étayés pas avant 7 jours, et étais laissés jusqu’à ce que le béton ait une résistance suffisante (souvent 21 à 28 jours pour les grandes portées). Suivez le bureau d’études.', r: 'DTU 21' },
  { c: 'beton', t: 'Les reprises de bétonnage', x: 'Avant de couler contre un béton déjà durci, nettoyez, piquez la surface pour la rendre rugueuse et humidifiez-la. Placez les reprises aux endroits prévus par le bureau d’études, et évitez les zones proches des appuis où l’effort tranchant est fort.', r: 'Bonnes pratiques (DTU 21)' },
  { c: 'beton', t: 'Stockage du ciment', x: 'Sacs sur palettes, à l’abri de la pluie et de l’humidité, sans dépasser environ 10 sacs de hauteur. Utilisez les plus anciens en premier. Un ciment qui a fait des grumeaux durs ne doit plus servir au béton armé.', r: 'Bonnes pratiques de chantier' },
  { c: 'beton', t: 'Les aciers sur chantier', x: 'Stockez les aciers hors du sol, sur des bastaings. Une légère rouille superficielle n’est pas grave ; une rouille qui s’écaille l’est. Les barres ne doivent pas être pliées à chaud ni redressées plusieurs fois.', r: 'Bonnes pratiques (NF A 35-080)' },
  { c: 'techno', t: 'Prédimensionner une poutre', x: 'Règle pratique de départ : hauteur d’une poutre ≈ portée / 12 (entre L/10 et L/15), largeur ≈ 0,3 à 0,5 fois la hauteur. Pour 5 m de portée : environ 40 cm de haut. Le calcul du bureau d’études reste obligatoire.', r: 'Règles de prédimensionnement usuelles' },
  { c: 'techno', t: 'Prédimensionner une dalle pleine', x: 'Une dalle porte dans un seul sens si le petit côté divisé par le grand est inférieur à 0,4. Épaisseur de départ : environ portée / 30 pour une dalle sur deux appuis, portée / 40 pour une dalle continue appuyée sur quatre côtés.', r: 'BAEL 91 révisé 99, annexe E3 et règles usuelles' },
  { c: 'techno', t: 'Plancher à corps creux', x: 'Le plancher « 16 + 4 » combine des hourdis de 16 cm et une dalle de compression de 4 cm armée d’un treillis soudé. Il couvre couramment jusqu’à environ 5 m selon les poutrelles. Étayez les poutrelles selon la notice du fabricant.', r: 'Avis techniques des fabricants, DTU 23.5' },
  { c: 'techno', t: 'Chaînages des murs en parpaings', x: 'Prévoir des chaînages horizontaux à chaque niveau de plancher et des chaînages verticaux aux angles, aux jonctions de murs et autour des grandes ouvertures. Ils tiennent le bâtiment comme une cage.', r: 'DTU 20.1 et Eurocode 6' },
  { c: 'techno', t: 'Appui des linteaux', x: 'Un linteau doit reposer d’au moins 20 cm de chaque côté de l’ouverture. Un appui trop court fissure la maçonnerie au-dessus des portes et fenêtres.', r: 'DTU 20.1' },
  { c: 'techno', t: 'Joints de dilatation', x: 'Un bâtiment long doit être coupé par des joints de dilatation, couramment tous les 25 à 50 m selon le climat. En climat chaud et sec, restez plutôt vers 25 à 30 m. Le joint traverse la structure, pas les fondations.', r: 'BAEL 91 révisé 99, art. B.5.1 et DTU' },
  { c: 'techno', t: 'Formule de Blondel', x: 'Un escalier est confortable si 2 × hauteur de marche + giron ≈ 60 à 64 cm. Exemple : marches de 17 cm et giron de 28 cm donnent 62 cm. Gardez la même hauteur sur toutes les marches.', r: 'Règle de Blondel, DTU et usages' },
  { c: 'techno', t: 'Étude de sol', x: 'Avant de fonder, faites une étude géotechnique (mission G2) : elle donne la contrainte admissible du sol et le type de fondation. Les fissures en escalier dans les murs viennent souvent d’un tassement des fondations.', r: 'NF P 94-500' },
  { c: 'techno', t: 'Les fondations', x: 'Coulez toujours un béton de propreté d’environ 5 cm sous les semelles. Il protège les aciers de la terre et donne une surface plane pour poser les cales d’enrobage.', r: 'DTU 13.11 et 13.12' },
  { c: 'secu', t: 'Garde-corps des échafaudages', x: 'Un garde-corps complet comprend une lisse à 1 m de haut, une sous-lisse à mi-hauteur et une plinthe d’au moins 15 cm qui empêche les outils de tomber. Sans eux, on travaille attaché avec un harnais.', r: 'Règles de prévention des chutes de hauteur' },
  { c: 'secu', t: 'Tranchées et fouilles', x: 'Au-delà d’environ 1,30 m de profondeur, une tranchée doit être blindée ou talutée. Ne stockez jamais les déblais au bord : laissez au moins 40 cm de distance.', r: 'Règles de prévention des éboulements' },
  { c: 'secu', t: 'Les EPI obligatoires', x: 'Casque, chaussures de sécurité, gants et gilet haute visibilité pour tous. Lunettes pour le meulage et le piquage, masque pour la poussière de ciment, protections auditives près des engins.', r: 'Prévention des risques sur chantier' },
  { c: 'secu', t: 'Le ciment brûle la peau', x: 'Le ciment frais est très alcalin : il peut brûler la peau et les yeux. Gants et bottes étanches pour le bétonnage, et rinçage immédiat à l’eau claire en cas de projection dans les yeux.', r: 'Fiches de sécurité des ciments' },
  { c: 'secu', t: 'La causerie du matin', x: '5 minutes chaque matin pour rappeler les dangers du jour : levage, travail en hauteur, électricité. C’est le moment de vérifier les EPI. Notez-la dans KOORDIN, rubrique Sécurité.', r: 'Bonnes pratiques de prévention' },
  { c: 'secu', t: 'Sous la charge, jamais', x: 'Personne ne doit stationner sous une charge levée par la grue. Balisez la zone de levage, utilisez des élingues en bon état et un signaleur qui voit le grutier.', r: 'Règles de levage' },
  { c: 'tropical', t: 'Bétonner à la fraîche', x: 'Sous fort soleil ou par harmattan, le béton sèche trop vite et fissure. Bétonnez tôt le matin ou en fin de journée, mouillez les coffrages avant de couler et protégez la surface dès la fin du coulage.', r: 'Bétonnage par temps chaud (DTU 21, NF EN 13670)' },
  { c: 'tropical', t: 'Les termites', x: 'Traitez le sol sous les dallages et autour des fondations contre les termites avant de couler, et protégez les bois de charpente. Les dégâts sont invisibles pendant des années.', r: 'Bonnes pratiques en zone tropicale' },
  { c: 'tropical', t: 'Bord de mer', x: 'À proximité de la lagune ou de la mer, le sel attaque les aciers. Augmentez l’enrobage, utilisez un béton plus dosé et plus compact, et soignez la cure : c’est la durée de vie de l’ouvrage qui en dépend.', r: 'BAEL A.7.1 et Eurocode 2 classes XS' },
  { c: 'tropical', t: 'Saison des pluies', x: 'Prévoyez des bâches pour protéger le béton frais, une pente pour évacuer l’eau des fouilles et des planchers, et ne coulez pas sous une forte pluie : l’eau délave le ciment en surface.', r: 'Bonnes pratiques de chantier' },
  { c: 'second', t: 'Étanchéité des toitures-terrasses', x: 'Pente minimale d’environ 1 % vers les évacuations. Les relevés d’étanchéité remontent d’au moins 15 cm au-dessus de la protection. Une terrasse sans pente garde l’eau et finit par fuir.', r: 'DTU 43.1' },
  { c: 'second', t: 'Descentes d’eaux pluviales', x: 'Règle pratique : environ 1 cm² de section de descente par m² de toiture. Pour 100 m² de toiture : environ 100 cm² de descentes, soit un tube d’environ 110 à 125 mm. Prévoyez-en au moins deux pour une grande toiture.', r: 'DTU 60.11' },
  { c: 'second', t: 'Les enduits', x: 'Un enduit traditionnel se fait en couches : gobetis d’accrochage, corps d’enduit, puis couche de finition, pour 15 à 20 mm au total. Humidifiez le support et ne travaillez pas en plein soleil.', r: 'DTU 26.1' },
  { c: 'second', t: 'Peindre un enduit neuf', x: 'Un enduit ciment doit sécher plusieurs semaines (souvent 3 à 4) avant d’être peint, ou recevoir un fixateur adapté. Sinon, la peinture cloque et farine.', r: 'DTU 59.1' },
  { c: 'second', t: 'Électricité : les sections', x: 'Repères de la norme NF C 15-100 : 1,5 mm² pour les circuits d’éclairage, 2,5 mm² pour les prises de courant 16 A (20 A au disjoncteur), et un interrupteur différentiel 30 mA pour protéger les personnes.', r: 'NF C 15-100' },
  { c: 'second', t: 'Pente des évacuations', x: 'Les canalisations d’eaux usées se posent avec une pente de 1 à 3 cm par mètre. Trop faible, elles se bouchent ; trop forte, l’eau part sans les matières.', r: 'DTU 60.11' },
  { c: 'topo', t: 'Le nivellement direct', x: 'Avec le niveau de chantier : dénivelée = lecture arrière − lecture avant. Altitude du point visé = altitude connue + lecture arrière − lecture avant. Revenez toujours sur un repère connu (cheminement fermé) pour contrôler : l’écart de fermeture doit être presque nul.', r: 'Topographie de chantier, nivellement géométrique' },
  { c: 'topo', t: 'Des portées égales annulent l’erreur du niveau', x: 'Placez le niveau à égale distance des deux mires (arrière et avant). Une petite erreur de réglage de l’appareil s’annule alors dans la différence des lectures. Contrôlez aussi le calage de la bulle à chaque station.', r: 'Topographie, méthode des portées équidistantes' },
  { c: 'topo', t: 'L’angle droit avec le 3-4-5', x: 'Pour tracer un angle droit sans appareil : 3 m sur un côté, 4 m sur l’autre, la diagonale doit faire exactement 5 m (ou 6-8-10 pour plus de précision). Pour un rectangle, vérifiez que les deux diagonales sont égales.', r: 'Théorème de Pythagore, implantation' },
  { c: 'topo', t: 'Les chaises d’implantation', x: 'Les chaises se placent hors de la zone de fouille, à 1 à 2 m environ des axes. Les clous et cordeaux tendus entre elles permettent de retrouver les axes des murs et poteaux après le terrassement. Protégez-les des engins.', r: 'Implantation des ouvrages' },
  { c: 'topo', t: 'Pente en pour cent', x: 'Pente (%) = dénivelée ÷ distance horizontale × 100. 1 % = 1 cm par mètre ; 2 cm de chute sur 1 m = 2 %. Sur 25 m à 1,5 %, la chute est de 37,5 cm.', r: 'Topographie, calcul des pentes' },
  { c: 'topo', t: 'Les grades', x: 'Beaucoup de théodolites et stations totales lisent en grades (gon) : un tour complet fait 400 gon, un angle droit 100 gon. 1 gon = 0,9 degré.', r: 'Unités d’angle en topographie' },
  { c: 'topo', t: 'Distance entre deux points connus', x: 'Avec les coordonnées : distance = √(ΔX² + ΔY²). Exemple : ΔX = 30 m et ΔY = 40 m donnent 50 m. Le gisement est l’angle mesuré depuis le nord (axe des Y) dans le sens des aiguilles d’une montre.', r: 'Topographie, coordonnées rectangulaires' },
  { c: 'topo', t: 'Les échelles des plans', x: 'Au 1/100, 1 cm sur le plan = 1 m sur le terrain ; au 1/50, 1 cm = 50 cm ; au 1/200, 1 cm = 2 m ; au 1/500, 1 cm = 5 m. Ne mesurez jamais sur un plan photocopié : l’échelle peut être faussée, utilisez les cotes.', r: 'Lecture de plans' },
  { c: 'topo', t: 'Protéger ses repères', x: 'Gardez au moins deux repères de nivellement fixes (borne, clou dans un ouvrage stable) hors de la zone des travaux, et notez leurs altitudes dans le dossier. Un seul repère détruit et toute l’altimétrie du chantier est à refaire.', r: 'Bonnes pratiques topographiques' },

  { c: 'metre', t: 'Le poids des aciers', x: 'Masse d’une barre (kg/m) ≈ 0,00617 × d² (d en mm). HA 8 : 0,395 kg/m ; HA 10 : 0,617 ; HA 12 : 0,888 ; HA 14 : 1,208 ; HA 16 : 1,578. Une barre de 12 m en HA 12 pèse environ 10,7 kg.', r: 'Tables des aciers pour béton armé' },
  { c: 'metre', t: 'Les ingrédients d’1 m³ de béton dosé à 350', x: 'Repère courant : 350 kg de ciment (7 sacs de 50 kg), environ 400 litres de sable, 800 litres de gravillons et 175 litres d’eau. La formulation exacte dépend des granulats : faites-la valider pour les ouvrages importants.', r: 'Formulation courante des bétons' },
  { c: 'metre', t: 'Combien de parpaings au m² ?', x: 'Un parpaing de 20 × 40 cm couvre 0,08 m² : il en faut 12,5 par m² de mur. Ajoutez environ 5 % de casse. Pour 80 m² de murs : 1 000 blocs + 50.', r: 'Métré de maçonnerie' },
  { c: 'metre', t: 'Le foisonnement des terres', x: 'Une terre creusée prend plus de place : coefficient de foisonnement d’environ 1,1 à 1,4 selon le sol (souvent 1,25 pour une terre ordinaire). 40 m³ en place donnent environ 50 m³ à évacuer : comptez les camions en conséquence.', r: 'Terrassements, cubatures' },
  { c: 'metre', t: 'Les unités du métré', x: 'Béton en m³, coffrages en m², aciers en kg, maçonnerie et enduits en m², canalisations et bordures en mètre linéaire (ml), appareils et menuiseries à l’unité (u) ou au m². Le métré par ouvrage alimente le devis quantitatif et estimatif (DQE).', r: 'Règles du métré, DQE' },
  { c: 'metre', t: 'Volume d’une semelle', x: 'Volume = longueur × largeur × hauteur. Une semelle de 1,20 × 1,20 × 0,40 m fait 0,576 m³. Pour 12 semelles identiques : environ 6,9 m³, plus 3 à 5 % de pertes.', r: 'Métré du béton' },
  { c: 'metre', t: 'Prévoir les pertes', x: 'Ajoutez une marge de pertes : environ 3 à 5 % pour le béton, 5 % pour les parpaings, 5 à 10 % pour le carrelage (plus pour la pose en diagonale), 5 à 10 % pour les aciers (chutes et recouvrements).', r: 'Usages de métré' },
  { c: 'metre', t: 'Quantité de peinture', x: 'Une peinture couvre souvent 8 à 12 m² par litre et par couche selon le support (voir la fiche technique). Pour 300 m² en deux couches à 10 m²/L : 60 litres, plus l’impression sur un enduit neuf.', r: 'Fiches techniques des fabricants' },
  { c: 'metre', t: 'Ratios d’acier indicatifs', x: 'Ordres de grandeur pour vérifier un métré : environ 40 à 60 kg d’acier par m³ pour des semelles, 70 à 100 kg/m³ pour des dalles, 100 à 150 kg/m³ pour poteaux et poutres. Un écart important doit faire vérifier les plans d’armatures.', r: 'Ratios usuels, à confirmer par les plans BA' },

  { c: 'ogc', t: 'Le chemin critique', x: 'Dans un planning (PERT ou Gantt), le chemin critique est la suite de tâches sans marge. Tout retard sur une de ces tâches retarde la fin du chantier. Surveillez-les en priorité et renforcez-les en moyens.', r: 'Planification, méthode PERT' },
  { c: 'ogc', t: 'Calculer une durée de tâche', x: 'Durée = quantité ÷ (rendement × nombre d’équipes). Exemple : 120 m² de maçonnerie, 8 m² par jour et par maçon, 2 maçons : 7,5 jours. Les rendements varient selon l’équipe et le chantier : mesurez les vôtres avec les rapports journaliers.', r: 'Organisation de chantier, temps unitaires' },
  { c: 'ogc', t: 'Le plan d’installation de chantier', x: 'Le PIC montre les accès, la clôture, la base vie, les zones de stockage, l’aire de ferraillage, la centrale à béton, la grue et sa zone de survol. Un bon PIC évite les manutentions inutiles et les accidents.', r: 'Organisation et gestion de chantier' },
  { c: 'ogc', t: 'Commander tôt ce qui est long', x: 'Les aciers, menuiseries, équipements et matériaux importés ont de longs délais. Établissez dès le début un tableau des approvisionnements avec les dates de commande et de livraison au plus tard.', r: 'Gestion des approvisionnements' },
  { c: 'ogc', t: 'La réunion de chantier', x: 'Une réunion par semaine avec un compte rendu diffusé à tous : avancement, décisions, qui fait quoi et pour quand. Ce document fait foi en cas de litige sur les délais ou les travaux supplémentaires.', r: 'Pilotage de chantier' },
  { c: 'ogc', t: 'Le journal de chantier', x: 'Notez chaque jour la météo, l’effectif, les travaux, les livraisons et les incidents. C’est la preuve des jours d’intempéries ou des retards causés par d’autres. Dans KOORDIN, c’est le rapport du jour.', r: 'Bonnes pratiques de gestion de chantier' },
  { c: 'ogc', t: 'L’ordre de service', x: 'Le démarrage des travaux, une modification ou un arrêt se donnent par ordre de service écrit. Ne lancez pas de travaux supplémentaires sans écrit signé : ils risquent de ne jamais être payés.', r: 'Marchés de travaux' },
  { c: 'ogc', t: 'Suivre le budget chaque semaine', x: 'Comparez pour chaque lot le budget, l’engagé (commandes) et le réalisé. Un écart de plus de 5 à 10 % doit déclencher une analyse et une décision. KOORDIN vous alerte dès 90 % du budget engagé.', r: 'Contrôle des coûts' },
  { c: 'ogc', t: 'La situation de travaux', x: 'Chaque mois, la situation facture les travaux réalisés : quantités exécutées × prix unitaires du marché, moins l’avance à rembourser et la retenue de garantie (souvent 5 %). Elle s’appuie sur un métré contradictoire.', r: 'Marchés de travaux, facturation' },
  { c: 'ogc', t: 'Le coût d’un engin', x: 'Coût horaire d’un engin = amortissement + entretien et pièces + carburant + assurance + conducteur. Un engin immobilisé coûte aussi : planifiez son arrivée au plus près du besoin.', r: 'Gestion du matériel' },

  { c: 'rdm', t: 'Poutre sur deux appuis, charge répartie', x: 'Avec une charge q (kN/m) sur une portée L : moment maximal M = qL²/8 au milieu, réactions et effort tranchant maximal V = qL/2 aux appuis. Doubler la portée multiplie le moment par 4.', r: 'Résistance des matériaux' },
  { c: 'rdm', t: 'La console (porte-à-faux)', x: 'Pour une console de longueur L avec une charge répartie q : M = qL²/2 à l’encastrement, soit 4 fois plus qu’une poutre sur deux appuis de même portée. Les aciers principaux d’un balcon sont donc en haut.', r: 'Résistance des matériaux' },
  { c: 'rdm', t: 'Charge ponctuelle au milieu', x: 'Une charge P au milieu d’une poutre sur deux appuis donne un moment maximal M = PL/4 au milieu et des réactions P/2 sur chaque appui.', r: 'Résistance des matériaux' },
  { c: 'rdm', t: 'La hauteur fait la rigidité', x: 'Moment d’inertie d’une section rectangulaire : I = b × h³ / 12. Doubler la hauteur multiplie la rigidité par 8 ; doubler la largeur seulement par 2. Une poutre posée « à plat » est beaucoup plus souple.', r: 'Résistance des matériaux' },
  { c: 'rdm', t: 'La flèche d’une poutre', x: 'Pour une charge répartie sur deux appuis : f = 5qL⁴ / (384 EI). La flèche varie avec la portée à la puissance 4 : une portée 20 % plus longue donne environ deux fois plus de flèche.', r: 'Résistance des matériaux' },
  { c: 'rdm', t: 'Poids des matériaux', x: 'Béton armé : 25 kN/m³ (2,5 t/m³) ; acier : 78,5 kN/m³ ; eau : 10 kN/m³. Une dalle pleine de 15 cm pèse donc 0,15 × 25 = 3,75 kN/m², avant revêtements et cloisons.', r: 'Eurocode 1 et usages' },
  { c: 'rdm', t: 'Les unités de contrainte', x: '1 MPa = 1 N/mm² ≈ 10 kg/cm². 1 bar = 0,1 MPa ≈ 10 t/m². Un béton de 25 MPa supporte donc environ 250 kg par cm² avant rupture.', r: 'Conversions usuelles' },
  { c: 'rdm', t: 'Le flambement', x: 'Charge critique d’Euler : Pcr = π² EI / Lf². La longueur de flambement Lf dépend des appuis : L pour un poteau articulé aux deux bouts, environ 2L pour un poteau encastré en pied et libre en tête. Un poteau élancé flambe bien avant d’écraser.', r: 'Résistance des matériaux' },

  { c: 'geo', t: 'Dimensionner la surface d’une semelle', x: 'Surface ≈ charge transmise à l’état de service ÷ contrainte admissible du sol. Exemple : 30 t sur un sol à 2 bars (20 t/m²) demande 1,5 m², soit environ 1,25 × 1,25 m. La contrainte du sol vient de l’étude géotechnique.', r: 'Fondations superficielles, DTU 13.12' },
  { c: 'geo', t: 'Jamais sur la terre végétale', x: 'Décapez toujours la terre végétale et ne fondez jamais sur des remblais non compactés ou des déchets. Les fondations doivent toutes reposer sur le même bon sol pour éviter les tassements différentiels.', r: 'DTU 13.12' },
  { c: 'geo', t: 'Compacter par couches', x: 'Un remblai se compacte par couches de 20 à 30 cm, à la bonne humidité, jusqu’à la densité demandée (souvent 95 % de l’optimum Proctor modifié). Une épaisse couche compactée d’un seul coup reste molle en profondeur.', r: 'Essai Proctor (NF P 94-093)' },
  { c: 'geo', t: 'Les argiles gonflantes', x: 'Certaines argiles gonflent en saison des pluies et se rétractent en saison sèche : les murs fissurent. Fondez plus profond, drainez autour du bâtiment, faites des trottoirs étanches et éloignez les grands arbres.', r: 'Retrait-gonflement des argiles' },
  { c: 'geo', t: 'Les essais de sol', x: 'Le pénétromètre dynamique donne rapidement la résistance du sol en profondeur ; le pressiomètre (essai Ménard) sert au calcul des fondations ; les sondages carottés montrent les couches. Une étude G2 adapte les essais au projet.', r: 'NF P 94-500, missions géotechniques' },
  { c: 'geo', t: 'L’eau dans les fouilles', x: 'Pompez les eaux avant de couler et ne bétonnez jamais dans une fouille noyée. Si la nappe est haute, prévoyez un drainage périphérique et un sous-sol étanche (cuvelage).', r: 'Bonnes pratiques de terrassement' },

  { c: 'vrd', t: 'Les couches d’une chaussée', x: 'De bas en haut : plate-forme (sol support), couche de forme, couche de fondation, couche de base, puis couche de roulement (enduit, enrobé ou pavés). Chaque couche est compactée et contrôlée avant la suivante.', r: 'Conception des chaussées' },
  { c: 'vrd', t: 'Le dévers de la chaussée', x: 'Une chaussée en ligne droite a une pente transversale d’environ 2 à 2,5 % pour évacuer l’eau vers les fossés ou caniveaux. Sans pente, l’eau stagne et détruit la route.', r: 'Géométrie routière' },
  { c: 'vrd', t: 'L’indice CBR', x: 'L’essai CBR mesure la portance d’un sol ou d’un matériau de chaussée. Plus le CBR est élevé, plus le sol porte. Un sol support faible demande une couche de forme ou une chaussée plus épaisse.', r: 'Essai CBR (NF P 94-078)' },
  { c: 'vrd', t: 'Pente des caniveaux', x: 'Donnez aux caniveaux et collecteurs d’eaux pluviales une pente suffisante, en général au moins 0,5 %, pour que l’eau entraîne le sable. Vérifiez la pente au niveau avant de couler.', r: 'Assainissement routier' },
  { c: 'vrd', t: 'Les regards de visite', x: 'Prévoyez un regard à chaque changement de direction, de pente ou de diamètre, à chaque jonction, et en ligne droite environ tous les 50 à 80 m pour pouvoir curer les canalisations.', r: 'Réseaux d’assainissement' },

  { c: 'hydro', t: 'Débit, vitesse, section', x: 'Débit Q = vitesse × section. Un tuyau de 100 mm (0,00785 m²) où l’eau circule à 1 m/s débite environ 7,9 litres par seconde.', r: 'Hydraulique générale' },
  { c: 'hydro', t: 'La pression de l’eau', x: '10 m de hauteur d’eau donnent environ 1 bar de pression. Un réservoir placé 15 m au-dessus du robinet le plus haut donne environ 1,5 bar, avant les pertes dans les tuyaux.', r: 'Hydrostatique' },
  { c: 'hydro', t: 'Le débit des eaux de pluie', x: 'Méthode rationnelle : Q = C × i × A, avec C le coefficient de ruissellement (environ 0,9 pour une toiture ou du béton, 0,1 à 0,3 pour un espace vert), i l’intensité de la pluie et A la surface. Les surfaces bétonnées font beaucoup ruisseler.', r: 'Hydrologie urbaine' },
  { c: 'hydro', t: 'Fosse septique et puits', x: 'Placez la fosse et l’épandage le plus loin possible des puits d’eau potable (souvent au moins 15 à 30 m selon le sol) et en aval. Faites vidanger la fosse régulièrement.', r: 'Assainissement autonome' },
  { c: 'hydro', t: 'Le coup de bélier', x: 'Fermer une vanne brusquement crée une surpression qui peut casser les canalisations. Fermez lentement et prévoyez des anti-béliers sur les réseaux sous pompe.', r: 'Hydraulique des réseaux' },

  { c: 'metal', t: 'Les nuances d’acier de charpente', x: 'S235 : limite élastique de 235 MPa ; S355 : 355 MPa. Le chiffre est la limite élastique. Vérifiez la nuance sur les certificats matière à la livraison.', r: 'Eurocode 3 et NF EN 10025' },
  { c: 'metal', t: 'Les classes de boulons', x: 'Un boulon 8.8 a une résistance à la rupture de 800 MPa et une limite élastique de 0,8 × 800 = 640 MPa. Un boulon 10.9 : 1 000 MPa et 900 MPa. Ne remplacez jamais un boulon par une classe inférieure.', r: 'Eurocode 3, NF EN ISO 898-1' },
  { c: 'metal', t: 'Protéger l’acier de la rouille', x: 'Galvanisation à chaud, ou primaire anticorrosion puis peinture de finition. En bord de mer ou de lagune, renforcez la protection et prévoyez l’entretien.', r: 'NF EN ISO 12944' },
  { c: 'metal', t: 'Le bois de charpente', x: 'Utilisez un bois sec (humidité de moins de 20 % environ) et traité contre les insectes et champignons, surtout contre les termites en zone tropicale. Un bois trop humide se déforme en séchant.', r: 'Eurocode 5, DTU 31.1' },
  { c: 'metal', t: 'Pente des toitures en tôle', x: 'La pente minimale dépend du profil de tôle et des recouvrements : souvent autour de 10 à 15 % pour une tôle ondulée courante. Suivez la notice du fabricant ; une pente trop faible fait refouler l’eau aux recouvrements.', r: 'DTU 40.35 et notices des fabricants' },
  { c: 'second', t: 'Carrelage de salle d’eau', x: 'Donnez une pente d’environ 1 à 2 % vers le siphon et posez une étanchéité sous carrelage dans les douches. Laissez des joints de fractionnement sur les grandes surfaces.', r: 'DTU 52.2' },
];
const SAVOIR_QUIZ = [
  { q: 'À l’ELU, quelle est la combinaison courante des charges ?', o: ['G + Q', '1,35 G + 1,5 Q', '1,5 G + 1,35 Q'], b: 1 },
  { q: 'Quel enrobage minimal le BAEL demande-t-il pour un ouvrage exposé aux embruns marins ?', o: ['1 cm', '3 cm', '5 cm'], b: 2 },
  { q: 'À 7 jours, un béton courant atteint environ…', o: ['33 % de sa résistance à 28 jours', '66 %', '95 %'], b: 1 },
  { q: 'Combien de temps faut-il garder le béton humide au minimum ?', o: ['24 heures', '7 jours', 'Ce n’est pas utile'], b: 1 },
  { q: 'Que signifie « C25/30 » ?', o: ['25 MPa sur cylindre, 30 MPa sur cube', '25 % de ciment, 30 % d’eau', '25 cm d’épaisseur, 30 cm de large'], b: 0 },
  { q: 'Selon Blondel, 2 × hauteur de marche + giron doit faire environ…', o: ['45 cm', '62 cm', '80 cm'], b: 1 },
  { q: 'Au-delà de quelle profondeur une tranchée doit-elle être blindée ?', o: ['0,50 m', '1,30 m', '3 m'], b: 1 },
  { q: 'Que faire si le béton est trop ferme sur chantier ?', o: ['Rajouter de l’eau', 'Utiliser un plastifiant', 'Rajouter du sable'], b: 1 },
  { q: 'Quelle est la longueur d’appui minimale d’un linteau de chaque côté ?', o: ['5 cm', '10 cm', '20 cm'], b: 2 },
  { q: 'Quelle pente minimale pour une toiture-terrasse ?', o: ['Environ 1 %', '0 %', '10 %'], b: 0 },
  { q: 'Combien de parpaings 20 × 40 faut-il par m² de mur ?', o: ['8', '12,5', '20'], b: 1 },
  { q: 'Combien pèse environ un mètre de HA 12 ?', o: ['0,4 kg', '0,89 kg', '1,6 kg'], b: 1 },
  { q: 'En nivellement, la dénivelée est égale à…', o: ['lecture avant − lecture arrière', 'lecture arrière − lecture avant', 'lecture arrière + lecture avant'], b: 1 },
  { q: 'Pour tracer un angle droit au ruban, on utilise le triangle…', o: ['2-3-4', '3-4-5', '5-5-5'], b: 1 },
  { q: 'Combien de grades fait un angle droit ?', o: ['90', '100', '400'], b: 1 },
  { q: 'Une pente de 2 % correspond à…', o: ['2 mm par mètre', '2 cm par mètre', '20 cm par mètre'], b: 1 },
  { q: 'Le moment maximal d’une poutre sur deux appuis avec charge répartie vaut…', o: ['qL²/8', 'qL/2', 'qL²/2'], b: 0 },
  { q: 'Doubler la hauteur d’une poutre rectangulaire multiplie sa rigidité par…', o: ['2', '4', '8'], b: 2 },
  { q: '10 m de hauteur d’eau donnent environ…', o: ['0,1 bar', '1 bar', '10 bars'], b: 1 },
  { q: 'Dans un planning, le chemin critique est…', o: ['la suite de tâches sans marge', 'le chemin d’accès au chantier', 'la tâche la plus chère'], b: 0 },
  { q: 'Une terre creusée occupe plus de place : on parle de…', o: ['tassement', 'foisonnement', 'retrait'], b: 1 },
  { q: 'Un béton armé pèse environ…', o: ['1,5 t/m³', '2,5 t/m³', '7,8 t/m³'], b: 1 },
  { q: 'Que signifie la classe de boulon 8.8 ?', o: ['8 mm de diamètre, 8 cm de long', '800 MPa à la rupture, limite à 80 %', '8 boulons par platine'], b: 1 },
  { q: 'Un remblai se compacte par couches d’environ…', o: ['5 cm', '20 à 30 cm', '1 m'], b: 1 },
];
const jourDeLAnnee = (d = new Date()) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
// Pas de 37 : on passe d'un domaine à l'autre d'un jour à l'autre (topo, métré, BA, OGC…)
const savoirDuJour = (decalage = 0) => SAVOIR[((jourDeLAnnee() + d0Savoir() + decalage) * 37) % SAVOIR.length];
const d0Savoir = () => (new Date().getFullYear() * 7) % SAVOIR.length;
const texteSavoir = (s) => `💡 Le savoir du jour (${SAVOIR_CATS[s.c][1]}) — ${s.t}\n${s.x}\nRéférence : ${s.r}.\n— Partagé depuis KOORDIN`;

function carteSavoir(s, { jour = true } = {}) {
  const [ic, cat] = SAVOIR_CATS[s.c];
  return `<div class="savoir-carte s-${s.c}">
    <div class="savoir-tete"><span class="savoir-cat">${ic} ${esc(cat)}</span>${jour ? '<span class="savoir-jour">💡 Le savoir du jour</span>' : ''}</div>
    <h3>${esc(s.t)}</h3><p>${esc(s.x)}</p>
    <div class="savoir-ref">📖 ${esc(s.r)}</div>
    <div class="savoir-boutons"><button type="button" class="btn sm" data-ecouter>🔊 Écouter</button><button type="button" class="btn sm" data-partager>📤 Partager à l’équipe</button>${jour ? '<button type="button" class="btn sm ghost" data-autre>🔄 Un autre</button><a class="btn sm ghost" href="#/savoir">📚 Tout voir</a>' : ''}</div>
  </div>`;
}
function brancherSavoir(el, s, { jour = true } = {}) {
  let courant = s, decalage = 0;
  const rendre = () => { el.innerHTML = carteSavoir(courant, { jour }); brancher(); };
  const brancher = () => {
    $('[data-ecouter]', el).onclick = () => {
      if (!KOKO.el) afficherKoko();
      kokoAnim('saute'); kokoDire(`${courant.t}. ${courant.x}`, 12000, false); kokoParler(`${courant.t}. ${courant.x}`, { test: true });
    };
    $('[data-partager]', el).onclick = async () => {
      const texte = texteSavoir(courant);
      try { if (navigator.share) { await navigator.share({ text: texte }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
      window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank', 'noopener');
    };
    $('[data-autre]', el)?.addEventListener('click', () => { decalage++; courant = savoirDuJour(decalage); el.classList.remove('tourne'); void el.offsetWidth; el.classList.add('tourne'); setTimeout(rendre, 180); });
  };
  rendre();
}
function encartSavoir() {
  const cible = $('#main .actions-rapides');
  if (!cible || $('#encart-savoir')) return;
  const el = document.createElement('section');
  el.id = 'encart-savoir'; el.className = 'encart-savoir';
  cible.insertAdjacentElement('afterend', el);
  brancherSavoir(el, savoirDuJour());
}

let filtreSavoir = 'tous';
PAGES.savoir = async () => {
  const p = page(`
    ${entete('Normes et conseils', 'Béton armé, topographie, métré, OGC, RDM, géotechnique, VRD, hydraulique, charpente, sécurité…')}
    <div id="sv-jour" class="encart-savoir"></div>
    <div class="card">
      <div class="toolbar"><input class="input" id="sv-cherche" type="search" placeholder="Rechercher : enrobage, poteau, cure, escalier…" style="flex:1;min-width:0">
        <button type="button" class="btn sm primary" id="sv-quiz">🎯 Quiz</button></div>
      <div class="sv-filtres">${[['tous', '✨ Tout'], ...Object.entries(SAVOIR_CATS).map(([k, [ic, l]]) => [k, `${ic} ${l}`])].map(([k, l]) => `<button type="button" class="puce-filtre ${k === filtreSavoir ? 'actif' : ''}" data-f="${k}">${esc(l)}</button>`).join('')}</div>
      <div id="sv-liste" class="sv-liste"></div>
      <p class="sv-avert">⚠️ Ces fiches sont des résumés pratiques. Elles ne remplacent pas les textes officiels (BAEL 91 révisé 99, Eurocodes et leurs annexes nationales, DTU, normes NF) ni les notes de calcul du bureau d’études et l’avis du bureau de contrôle.</p>
    </div>`);
  brancherSavoir($('#sv-jour', p), savoirDuJour());
  const liste = $('#sv-liste', p);
  const rendre = () => {
    const t = sansAccents($('#sv-cherche', p).value.trim());
    const l = SAVOIR.filter((s) => (filtreSavoir === 'tous' || s.c === filtreSavoir) && (!t || sansAccents(`${s.t} ${s.x} ${s.r}`).includes(t)));
    liste.innerHTML = l.length ? l.map((s, i) => `<details class="sv-fiche s-${s.c}" style="--i:${Math.min(i, 12)}"><summary><span class="sv-ic">${SAVOIR_CATS[s.c][0]}</span><b>${esc(s.t)}</b><small>${esc(SAVOIR_CATS[s.c][1])}</small></summary><div class="sv-detail" data-i="${SAVOIR.indexOf(s)}"></div></details>`).join('') : empty('🔎', 'Aucune fiche ne correspond à votre recherche.');
    $$('.sv-fiche', liste).forEach((d) => d.addEventListener('toggle', () => { const z = $('.sv-detail', d); if (d.open && !z.innerHTML) brancherSavoir(z, SAVOIR[+z.dataset.i], { jour: false }); }));
  };
  $('#sv-cherche', p).addEventListener('input', rendre);
  $$('[data-f]', p).forEach((b) => (b.onclick = () => { filtreSavoir = b.dataset.f; $$('[data-f]', p).forEach((x) => x.classList.toggle('actif', x === b)); rendre(); }));
  $('#sv-quiz', p).onclick = lancerQuiz;
  rendre();
};

function lancerQuiz() {
  const melanger = (t) => t.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const questions = melanger(SAVOIR_QUIZ).slice(0, 5).map((q) => { const o = melanger(q.o.map((txt, i) => ({ txt, bon: i === q.b }))); return { q: q.q, o: o.map((x) => x.txt), b: o.findIndex((x) => x.bon) }; });
  let n = 0, score = 0;
  const m = ouvrirModale({ titre: '🎯 Quiz du chantier', corps: '<div id="qz"></div>' });
  const zone = $('#qz', m.el);
  const afficher = () => {
    if (n >= questions.length) {
      const bravo = score === questions.length ? 'Parfait, vous êtes un vrai chef de chantier ! 🏆' : score >= 3 ? 'Très bien ! 💪' : 'Revoyez les fiches, et retentez votre chance 📚';
      zone.innerHTML = `<div class="qz-fin"><div class="qz-score">${score} / ${questions.length}</div><p>${bravo}</p><div class="rc-boutons" style="justify-content:center"><button type="button" class="btn primary" id="qz-encore">🔄 Rejouer</button><button type="button" class="btn ghost" data-close>Fermer</button></div></div>`;
      if (KOKO.el) { kokoHumeur(score >= 3 ? 'rire' : 'o', 2500); kokoAnim(score >= 3 ? 'saute' : 'secoue'); kokoDire(bravo, 5000); }
      $('#qz-encore', zone).onclick = () => { m.fermer(); lancerQuiz(); };
      return;
    }
    const q = questions[n];
    zone.innerHTML = `<div class="qz-progres"><i style="width:${(n / questions.length) * 100}%"></i></div><p class="qz-num">Question ${n + 1} sur ${questions.length}</p><h4 class="qz-q">${esc(q.q)}</h4>
      <div class="qz-options">${q.o.map((o, i) => `<button type="button" class="qz-opt" data-o="${i}">${esc(o)}</button>`).join('')}</div>`;
    $$('.qz-opt', zone).forEach((b) => (b.onclick = () => {
      const ok = +b.dataset.o === q.b;
      if (ok) score++;
      $$('.qz-opt', zone).forEach((x) => { x.disabled = true; x.classList.toggle('bon', +x.dataset.o === q.b); });
      if (!ok) b.classList.add('faux');
      try { navigator.vibrate?.(ok ? 15 : [40, 40, 40]); } catch { /* rien */ }
      setTimeout(() => { n++; afficher(); }, 1100);
    }));
  };
  afficher();
}

// ═══════════════════════════════ 3.6 : CONTRÔLES PAR CORPS D'ÉTAT ═══════════════════════════════
// Points d'arrêt : une étape terminée est vérifiée par un agent de l'entreprise avant de passer à la suivante.
const PHASES = [
  { k: 'implantation', c: 'gros', t: 'Implantation', ic: '📏', p: ['Axes et cotes conformes au plan', 'Repère de niveau (point zéro) en place', 'Équerrage et alignements vérifiés', 'Distances aux limites de parcelle respectées'] },
  { k: 'fouilles', c: 'gros', t: 'Fouilles', ic: '⛏️', p: ['Dimensions et profondeur conformes au plan', 'Bon sol atteint, fond de fouille propre et sec', 'Talus ou blindage sécurisés', 'Béton de propreté coulé (environ 5 cm)'] },
  { k: 'ferraillage-fondations', c: 'gros', t: 'Ferraillage des fondations', ic: '🔩', p: ['Diamètres et nombre de barres conformes au plan', 'Cales d’enrobage en place', 'Attentes des poteaux en place et bien positionnées', 'Longueurs d’ancrage et de recouvrement respectées', 'Aciers propres (ni terre, ni huile, ni rouille qui s’écaille)'] },
  { k: 'ferraillage', c: 'gros', t: 'Ferraillage poteaux, poutres, voiles', ic: '🔩', p: ['Diamètres et nombre de barres conformes au plan', 'Espacement des cadres et étriers (resserrés aux appuis)', 'Longueurs de recouvrement et d’ancrage', 'Cales d’enrobage en place', 'Ligatures solides, cages bien d’aplomb'] },
  { k: 'coffrage', c: 'gros', t: 'Coffrage et étaiement', ic: '🪵', p: ['Dimensions et aplomb des coffrages', 'Joints étanches (pas de fuite de laitance)', 'Étais suffisants, stables et contreventés', 'Huile de décoffrage appliquée', 'Réservations (gaines, passages) en place'] },
  { k: 'plancher', c: 'gros', t: 'Plancher avant coulage', ic: '🧱', p: ['Poutrelles et hourdis bien posés (appuis suffisants)', 'Treillis soudé et chapeaux sur appuis', 'Gaines électriques et réservations posées', 'Étaiement des poutrelles conforme à la notice', 'Niveau et épaisseur de la dalle de compression'] },
  { k: 'beton', c: 'gros', t: 'Bétonnage', ic: '🚚', p: ['Béton conforme à la formule (bon de livraison)', 'Essai d’affaissement réalisé', 'Éprouvettes prélevées et étiquetées', 'Vibration correcte, sans nids de cailloux', 'Cure prévue (arrosage, bâche ou produit de cure)'] },
  { k: 'maconnerie', c: 'gros', t: 'Maçonnerie', ic: '🧱', p: ['Aplomb et alignement des murs', 'Joints remplis et réguliers', 'Liaison avec les poteaux (harpage, attentes)', 'Chaînages et linteaux (appui ≥ 20 cm)', 'Réservations des portes et fenêtres aux bonnes cotes'] },
  { k: 'toiture', c: 'gros', t: 'Charpente et couverture', ic: '🏠', p: ['Fixations et contreventement de la charpente', 'Pente conforme au plan', 'Recouvrement et fixation des tôles', 'Faîtage, rives et chéneaux posés'] },
  { k: 'etancheite', c: 'gros', t: 'Étanchéité', ic: '💧', p: ['Support propre et sec', 'Pentes vers les évacuations (≥ 1 %)', 'Relevés d’au moins 15 cm', 'Essai de mise en eau réalisé sans fuite'] },
  { k: 'electricite', c: 'second', t: 'Électricité', ic: '⚡', p: ['Gaines et boîtes en place avant enduit', 'Sections des câbles conformes (1,5 / 2,5 mm²)', 'Tableau avec différentiel 30 mA', 'Mise à la terre mesurée', 'Circuits repérés au tableau'] },
  { k: 'plomberie', c: 'second', t: 'Plomberie', ic: '🚿', p: ['Essai de pression réalisé sans fuite', 'Pentes des évacuations (1 à 3 cm/m)', 'Canalisations bien fixées', 'Siphons et regards accessibles'] },
  { k: 'menuiserie', c: 'second', t: 'Menuiseries', ic: '🚪', p: ['Dimensions et aplomb', 'Ouverture et fermeture sans forcer', 'Quincaillerie complète (serrures, poignées)', 'Calfeutrement et joints'] },
  { k: 'enduits', c: 'second', t: 'Enduits', ic: '🪣', p: ['Planéité vérifiée à la règle de 2 m', 'Angles d’aplomb et bien dressés', 'Pas de fissures, cloques ni décollements', 'Épaisseur régulière'] },
  { k: 'carrelage', c: 'second', t: 'Carrelage', ic: '🔲', p: ['Planéité et alignement des joints', 'Pentes vers les siphons', 'Aucun carreau ne sonne creux', 'Joints remplis, plinthes posées'] },
  { k: 'faux-plafond', c: 'second', t: 'Faux plafond', ic: '🧩', p: ['Ossature et suspentes', 'Planéité', 'Trappes de visite prévues', 'Finition des joints'] },
  { k: 'peinture', c: 'second', t: 'Peinture', ic: '🎨', p: ['Support préparé (rebouché, poncé, fixateur)', 'Nombre de couches respecté', 'Teinte conforme au choix du client', 'Pas de coulures, traces ni manques'] },
];
const STATUT_CONTROLE = {
  demande: ['warn', '⏳ À contrôler'], accepte: ['ok', '✅ Accepté'], reserve: ['info', '⚠️ Accepté avec réserves'], refuse: ['crit', '⛔ Refusé — à reprendre'],
};
const ETATS_POINT = { ok: ['✅', 'Conforme'], nok: ['❌', 'Non conforme'], na: ['➖', 'Sans objet'] };
const phaseDe = (k) => PHASES.find((x) => x.k === k);
const agentControle = () => can('direction', 'coordinateur');
const erreurControle = (e) => {
  const m = String(e?.message || '');
  if (/^CONTROLE_/.test(m) && e?.hint) return e.hint;
  if (/relation .*controles/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Les contrôles nécessitent la mise à jour 3.6 de la base de données (kit d’installation).';
  return messageErreur(e);
};
const libelleControle = (c) => `${c.titre}${c.zone ? ` — ${c.zone}` : ''}`;
const peutControlerFiche = (c) => c.statut === 'demande' && (c.demande_par !== S.profil.id || can('direction'))
  && (c.controleur_designe ? c.controleur_designe === S.profil.id || can('direction') : agentControle());
const pourMoi = (c) => c.statut === 'demande' && (c.controleur_designe === S.profil.id || (!c.controleur_designe && agentControle() && c.demande_par !== S.profil.id) || (can('direction') && c.demande_par !== S.profil.id));
const controleursPossibles = () => (S.equipe || []).filter((x) => x.actif && x.id !== S.profil.id && ['direction', 'coordinateur', 'technicien'].includes(x.role));
const optionsControleurs = () => [['', '— La Direction ou la Coordination —'], ...controleursPossibles().map((x) => [x.id, `${x.nom} · ${ROLES[x.role]?.label || x.role}`])];

// Frise des étapes d'un chantier : dernier contrôle de chaque phase
function friseControles(controles) {
  const dernier = (k) => controles.filter((c) => c.phase === k).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const bloc = (corps, titre) => {
    const ph = PHASES.filter((x) => x.c === corps);
    let bloque = false;
    return `<div class="frise"><div class="frise-titre">${titre}</div>${ph.map((x) => {
      const d = dernier(x.k);
      const etat = d ? d.statut : bloque ? 'attente' : 'libre';
      if (!d || d.statut === 'refuse' || d.statut === 'demande') bloque = bloque || !!d;
      const st = d ? STATUT_CONTROLE[d.statut] : null;
      return `<button type="button" class="frise-etape e-${etat}" data-phase="${x.k}" ${d ? `data-ctl="${d.id}"` : ''}>
        <span class="frise-point">${d?.statut === 'accepte' ? '✓' : d?.statut === 'refuse' ? '!' : d?.statut === 'reserve' ? '~' : x.ic}</span>
        <span class="frise-txt"><b>${esc(x.t)}</b><small>${st ? esc(st[1]) : 'Pas encore contrôlé'}${d?.zone ? ` · ${esc(d.zone)}` : ''}</small></span></button>`;
    }).join('')}</div>`;
  };
  return `<div class="frises">${bloc('gros', '🏗️ Gros œuvre')}${bloc('second', '🔧 Second œuvre')}</div>`;
}

async function ongletControles(projet, zone) {
  const controles = await q(sb.from('controles').select('*').eq('projet_id', projet.id).order('created_at', { ascending: false }));
  const valides = new Set(controles.filter((c) => c.statut === 'accepte' || c.statut === 'reserve').map((c) => c.phase)).size;
  const attente = controles.filter((c) => c.statut === 'demande');
  zone.innerHTML = `<div class="card"><div class="card-title">Contrôles par corps d’état <button type="button" class="btn sm primary" id="nctl">🔍 Demander un contrôle</button></div>
    <p class="muted" style="font-size:13px;margin-bottom:10px">Avant de passer à l’étape suivante, faites vérifier l’étape terminée par un agent de l’entreprise. Touchez une étape pour voir sa fiche.</p>
    <div class="ctl-progres"><div class="ctl-barre"><i style="width:${pct(valides, PHASES.length)}%"></i></div><span><b>${valides}</b> étape(s) validée(s) sur ${PHASES.length}${attente.length ? ` · <b class="warn-txt">${attente.length} à contrôler</b>` : ''}</span></div>
    ${friseControles(controles)}
    ${controles.length ? `<div class="card-title mt">Historique</div><div class="paie-liste">${controles.map(ligneControle).join('')}</div>` : ''}</div>`;
  const rafraichir = () => ongletControles(projet, zone);
  $('#nctl', zone).onclick = () => demanderControle(projet, null, controles, rafraichir);
  $$('.frise-etape', zone).forEach((b) => (b.onclick = () => (b.dataset.ctl ? ficheControle(b.dataset.ctl, rafraichir) : demanderControle(projet, b.dataset.phase, controles, rafraichir))));
  $$('[data-voir-ctl]', zone).forEach((b) => (b.onclick = () => ficheControle(b.dataset.voirCtl, rafraichir)));
}
const ligneControle = (c) => `<button type="button" class="paie-ligne vente-ligne ${pourMoi(c) ? 'ctl-pour-moi' : ''}" data-voir-ctl="${c.id}"><div class="paie-nom"><b>${phaseDe(c.phase)?.ic || '🔍'} ${esc(libelleControle(c))}</b><span>${c.projets?.nom ? `${esc(c.projets.nom)} · ` : ''}demandé par ${esc(nomMembre(c.demande_par))} · ${ago(c.demande_le)}${c.controle_le ? ` · contrôlé par ${esc(c.nom_controleur || '')}` : c.controleur_designe ? ` · 👤 confié à ${c.controleur_designe === S.profil.id ? '<b>vous</b>' : esc(nomMembre(c.controleur_designe))}` : ''}</span></div><div class="paie-montant">${badge(STATUT_CONTROLE[c.statut])}</div></button>`;

async function demanderControle(projet, phase, controles, apres) {
  const projets = projet ? [projet] : (await listeProjets()).filter((x) => x.statut !== 'termine');
  if (!projets.length) { toast('Aucun chantier disponible.', 'warn'); return; }
  ouvrirModale({
    titre: '🔍 Demander un contrôle ou une réception',
    boutonOk: 'Envoyer la demande',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">Choisissez l’ouvrage à réceptionner et la personne qui doit le contrôler : elle sera prévenue sur son téléphone.</p>
      <div class="form-grid">
        ${projet ? '' : F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), projets.length === 1 ? projets[0].id : '', { required: true, full: true, vide: '— Choisir —' })}
        ${F.select('phase', 'Étape à contrôler', [['gros', '— Gros œuvre —'], ...PHASES.filter((x) => x.c === 'gros').map((x) => [x.k, `${x.ic} ${x.t}`]), ['second', '— Second œuvre —'], ...PHASES.filter((x) => x.c === 'second').map((x) => [x.k, `${x.ic} ${x.t}`])], phase || '', { required: true, full: true, vide: '— Choisir —' })}
        ${F.text('zone', 'Où exactement ?', '', { full: true, placeholder: 'Ex. Dalle du R+1, poteaux P1 à P8, salle de bain 2…' })}
        ${F.select('controleur_designe', 'Qui doit contrôler ?', optionsControleurs(), '', { full: true, hint: 'Un collègue technicien, la Coordination ou la Direction.' })}
        ${F.area('note_demande', 'Message pour l’agent (facultatif)', '', { placeholder: 'Ex. Coulage prévu demain à 7 h.' })}
      </div><div id="ctl-avert"></div>`,
    onOpen: (el) => {
      const sel = $('[name="phase"]', el);
      $$('option[value="gros"], option[value="second"]', sel).forEach((o) => { o.disabled = true; });
      const avert = () => {
        const i = PHASES.findIndex((x) => x.k === sel.value);
        const prec = i > 0 && PHASES[i - 1].c === PHASES[i].c ? PHASES[i - 1] : null;
        const ok = prec && (controles || []).some((c) => c.phase === prec.k && ['accepte', 'reserve'].includes(c.statut));
        $('#ctl-avert', el).innerHTML = prec && !ok && projet ? `<div class="notice warn mt">⚠️ L’étape précédente « ${esc(prec.t)} » n’a pas encore été validée sur ce chantier.</div>` : '';
      };
      sel.addEventListener('change', avert); avert();
    },
    onSubmit: async (d) => {
      const ph = phaseDe(d.phase);
      if (!ph) throw new Error('Choisissez l’étape à contrôler.');
      try {
        await q(sb.from('controles').insert({ projet_id: projet?.id || d.projet_id, corps: ph.c, phase: ph.k, titre: ph.t, zone: d.zone || null, note_demande: d.note_demande || null, controleur_designe: d.controleur_designe || null, points: ph.p.map((texte) => ({ texte, etat: null, note: '' })) }));
      } catch (e) { throw new Error(erreurControle(e)); }
      toast(d.controleur_designe ? `🔍 Demande envoyée à ${nomMembre(d.controleur_designe)}.` : '🔍 Demande envoyée : un agent va venir contrôler.');
      apres?.();
    },
  });
}

async function ficheControle(id, apres) {
  const c = await q(sb.from('controles').select('*, projets(nom, localisation)').eq('id', id).single());
  const ouvert = c.statut === 'demande';
  const peutControler = peutControlerFiche(c);
  const peutReattribuer = ouvert && (c.demande_par === S.profil.id || agentControle());
  const urls = await urlsPhotos(c.photos || []);
  let points = (c.points || []).map((x) => ({ ...x }));
  let photos = [...(c.photos || [])];
  const m = ouvrirModale({ titre: `${phaseDe(c.phase)?.ic || '🔍'} ${libelleControle(c)}`, large: true, corps: `
    <div class="split" style="flex-wrap:wrap;gap:8px;margin-bottom:8px"><span class="muted">${esc(c.projets?.nom || '')} · ${c.corps === 'gros' ? 'Gros œuvre' : 'Second œuvre'}</span>${badge(STATUT_CONTROLE[c.statut])}</div>
    <p class="muted" style="font-size:13px">Demandé par <b>${esc(nomMembre(c.demande_par))}</b> le ${new Date(c.demande_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${c.note_demande ? ` — « ${esc(c.note_demande)} »` : ''}</p>
    ${ouvert ? `<div class="ctl-confie">👤 Contrôle confié à <b>${c.controleur_designe ? (c.controleur_designe === S.profil.id ? 'vous' : esc(nomMembre(c.controleur_designe))) : 'la Direction ou la Coordination'}</b>${peutReattribuer ? ' <button type="button" class="btn sm ghost" id="ctl-reattribuer">Changer</button>' : ''}</div>` : ''}
    <div class="detail-block mt"><h4>Points à vérifier</h4><div class="ctl-points" id="ctl-points"></div>
      ${peutControler ? '<button type="button" class="btn sm ghost mt" id="ctl-ajout">＋ Ajouter un point</button>' : ''}</div>
    <div class="detail-block"><h4>Photos</h4><div class="ctl-photos" id="ctl-photos"></div>
      ${peutControler ? '<label class="btn sm mt">📷 Ajouter des photos<input type="file" accept="image/*" capture="environment" multiple hidden id="ctl-fichiers"></label>' : ''}</div>
    <div class="detail-block"><h4>Observations</h4>${peutControler ? '<textarea class="input" id="ctl-obs" rows="3" placeholder="Obligatoire en cas de réserves ou de refus : ce qu’il faut reprendre, où, pour quand."></textarea>' : `<p>${esc(c.observations || '—')}</p>`}</div>
    ${peutControler ? `<div class="detail-block"><h4>Signature de l’agent de contrôle</h4>
      <label class="field">Nom de l’agent<input class="input" id="ctl-nom" value="${esc(S.profil.nom)}"></label><div class="sig" id="ctl-sig"></div></div>
      <div class="ctl-decisions"><button type="button" class="btn ctl-ok" data-dec="accepte">✅ Accepter</button><button type="button" class="btn ctl-res" data-dec="reserve">⚠️ Accepter avec réserves</button><button type="button" class="btn ctl-ko" data-dec="refuse">⛔ Refuser</button></div>`
      : c.controle_le ? `<div class="detail-block"><h4>Contrôlé par ${esc(c.nom_controleur || '')} le ${new Date(c.controle_le).toLocaleString('fr-FR')}</h4>${c.signature ? `<img class="signature-img" src="${esc(c.signature)}" alt="Signature de l’agent">` : ''}</div>`
      : `<div class="notice">${c.demande_par === S.profil.id ? '⏳ Vous avez fait cette demande : la personne désignée doit faire le contrôle.' : '⏳ En attente du passage de la personne chargée du contrôle.'}</div>`}
    <div class="rc-boutons mt">
      ${!ouvert ? '<button type="button" class="btn" id="ctl-pdf">📄 Fiche PDF</button>' : ''}
      ${c.statut === 'refuse' || c.statut === 'reserve' ? '<button type="button" class="btn primary" id="ctl-redemande">🔁 Redemander un contrôle</button>' : ''}
      ${ouvert && (c.demande_par === S.profil.id || can('direction')) ? '<button type="button" class="btn danger" id="ctl-annule">Annuler la demande</button>' : ''}
    </div>` });
  const el = m.el;
  const rendrePoints = () => {
    $('#ctl-points', el).innerHTML = points.map((x, i) => `<div class="ctl-point ${x.etat ? `p-${x.etat}` : ''}">
      <div class="ctl-point-txt">${esc(x.texte)}${!peutControler && x.note ? `<small>${esc(x.note)}</small>` : ''}</div>
      ${peutControler ? `<div class="ctl-etats">${Object.entries(ETATS_POINT).map(([k, [ic, l]]) => `<button type="button" class="ctl-etat ${x.etat === k ? 'actif' : ''}" data-i="${i}" data-e="${k}" aria-label="${l}" title="${l}">${ic}</button>`).join('')}</div>
        ${x.etat === 'nok' ? `<input class="input ctl-note" data-note="${i}" placeholder="Ce qui ne va pas…" value="${esc(x.note || '')}">` : ''}` : `<span class="ctl-etat-lu">${x.etat ? ETATS_POINT[x.etat].join(' ') : '—'}</span>`}</div>`).join('') || '<p class="muted">Aucun point.</p>';
    $$('.ctl-etat', el).forEach((b) => (b.onclick = () => { points[+b.dataset.i].etat = b.dataset.e; rendrePoints(); }));
    $$('[data-note]', el).forEach((inp) => (inp.oninput = () => { points[+inp.dataset.note].note = inp.value; }));
  };
  const rendrePhotos = async () => {
    const u = await urlsPhotos(photos);
    $('#ctl-photos', el).innerHTML = photos.length ? photos.map((ph) => `<img src="${esc(u(ph))}" alt="Photo du contrôle" loading="lazy">`).join('') : '<p class="muted" style="font-size:13px">Aucune photo.</p>';
  };
  rendrePoints();
  $('#ctl-photos', el).innerHTML = photos.length ? photos.map((ph) => `<img src="${esc(urls(ph))}" alt="Photo du contrôle" loading="lazy">`).join('') : '<p class="muted" style="font-size:13px">Aucune photo.</p>';
  const sig = peutControler ? padSignature($('#ctl-sig', el)) : null;
  $('#ctl-ajout', el)?.addEventListener('click', () => { const t = prompt('Point à vérifier :'); if (t?.trim()) { points.push({ texte: t.trim(), etat: null, note: '' }); rendrePoints(); } });
  $('#ctl-fichiers', el)?.addEventListener('change', async (e) => {
    const fichiers = [...e.target.files].slice(0, 12 - photos.length);
    for (const f of fichiers) { try { photos.push(await envoyerPhotoChantier(f, `controles/${c.projet_id}`)); } catch (err) { toast(messageErreur(err), 'err'); } }
    try { await q(sb.from('controles').update({ photos }).eq('id', c.id)); } catch (err) { toast(erreurControle(err), 'err'); }
    rendrePhotos();
  });
  $$('[data-dec]', el).forEach((b) => (b.onclick = async () => {
    const statut = b.dataset.dec;
    const nonNotes = points.filter((x) => !x.etat).length;
    if (nonNotes) { toast(`Notez chaque point (${nonNotes} restant${nonNotes > 1 ? 's' : ''}).`, 'warn'); return; }
    if (statut === 'accepte' && points.some((x) => x.etat === 'nok')) { toast('Un point est non conforme : choisissez « Accepter avec réserves » ou « Refuser ».', 'warn', 6000); return; }
    const obs = $('#ctl-obs', el).value.trim();
    const signature = sig.valeur(); const nom = $('#ctl-nom', el).value.trim();
    if (!signature || !nom) { toast('Signez avec le doigt et indiquez votre nom.', 'warn'); return; }
    if (statut !== 'accepte' && !obs) { toast('Expliquez les réserves ou le motif du refus dans les observations.', 'warn'); $('#ctl-obs', el).focus(); return; }
    if (!(await confirmer(statut === 'accepte' ? 'Valider ce contrôle ? L’équipe pourra passer à l’étape suivante.' : statut === 'reserve' ? 'Accepter avec réserves ?' : 'Refuser ? L’équipe devra reprendre avant de continuer.', 'Signer'))) return;
    try {
      await q(sb.from('controles').update({ statut, points, photos, observations: obs || null, nom_controleur: nom, signature }).eq('id', c.id));
      toast(statut === 'accepte' ? '✅ Contrôle validé, le demandeur est prévenu.' : statut === 'reserve' ? '⚠️ Accepté avec réserves, le demandeur est prévenu.' : '⛔ Contrôle refusé, le demandeur est prévenu.');
      m.fermer(); apres?.();
    } catch (e) { toast(erreurControle(e), 'err', 7000); }
  }));
  $('#ctl-pdf', el)?.addEventListener('click', () => pdfControle(c));
  $('#ctl-reattribuer', el)?.addEventListener('click', () => ouvrirModale({
    titre: '👤 Qui doit contrôler ?',
    boutonOk: 'Confier le contrôle',
    corps: `<div class="form-grid">${F.select('controleur_designe', 'Personne chargée du contrôle', optionsControleurs().filter(([v]) => v !== c.demande_par), c.controleur_designe || '', { full: true })}</div>`,
    onSubmit: async (d) => {
      try { await q(sb.from('controles').update({ controleur_designe: d.controleur_designe || null }).eq('id', c.id)); } catch (e) { throw new Error(erreurControle(e)); }
      toast(d.controleur_designe ? `Contrôle confié à ${nomMembre(d.controleur_designe)} : prévenu sur son téléphone.` : 'Contrôle confié à la Direction ou la Coordination.');
      m.fermer(); apres?.(); setTimeout(() => ficheControle(c.id, apres), 300);
    },
  }));
  $('#ctl-redemande', el)?.addEventListener('click', async () => {
    try {
      const ph = phaseDe(c.phase);
      await q(sb.from('controles').insert({ projet_id: c.projet_id, corps: c.corps, phase: c.phase, titre: c.titre, zone: c.zone, note_demande: 'Nouveau contrôle après reprise', controleur_designe: c.controleur_id && c.controleur_id !== S.profil.id ? c.controleur_id : null, points: (ph?.p || points.map((x) => x.texte)).map((texte) => ({ texte, etat: null, note: '' })) }));
      toast('🔁 Nouvelle demande envoyée.'); m.fermer(); apres?.();
    } catch (e) { toast(erreurControle(e), 'err'); }
  });
  $('#ctl-annule', el)?.addEventListener('click', async () => {
    if (!(await confirmer('Annuler cette demande de contrôle ?', 'Annuler la demande'))) return;
    try { await q(sb.from('controles').delete().eq('id', c.id)); toast('Demande annulée.'); m.fermer(); apres?.(); } catch (e) { toast(erreurControle(e), 'err'); }
  });
}

async function pdfControle(c) {
  try {
    const JsPDF = await chargerJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, 'FICHE DE CONTRÔLE', c.titre, `${STATUT_CONTROLE[c.statut][1].replace(/^[^ ]+ /, '')}`);
    let y = 46;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 34, 46);
    [[`Chantier : ${c.projets?.nom || ''}${c.projets?.localisation ? ` (${c.projets.localisation})` : ''}`], [`Étape : ${c.titre}${c.zone ? ` — ${c.zone}` : ''} (${c.corps === 'gros' ? 'gros œuvre' : 'second œuvre'})`],
      [`Demandé par ${nomMembre(c.demande_par)} le ${new Date(c.demande_le).toLocaleString('fr-FR')}`], [`Contrôlé par ${c.nom_controleur || ''} le ${c.controle_le ? new Date(c.controle_le).toLocaleString('fr-FR') : ''}`]]
      .forEach(([l]) => { doc.text(textePDF(l), 16, y); y += 5.5; });
    y += 4;
    y = tableauPDF(doc, y, [{ titre: 'Point vérifié (et remarque)', x: 16, l: 140 }, { titre: 'Résultat', x: 160, l: 34, align: 'right' }],
      (c.points || []).map((x) => ({ gras: x.etat === 'nok', cells: [`${x.texte}${x.note ? ` — ${x.note}` : ''}`, x.etat ? ETATS_POINT[x.etat][1] : '—'] })));
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.text('Observations', 16, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.splitTextToSize(textePDF(c.observations || 'Aucune.'), 178).forEach((l) => { if (y > 270) { doc.addPage(); y = 20; } doc.text(l, 16, y); y += 4.8; });
    if (c.photos?.length) {
      const u = await urlsPhotos(c.photos);
      y += 4; let x = 16;
      for (const ph of c.photos.slice(0, 6)) {
        try {
          const img = await imagePourPDF(u(ph), 56 / 40);
          if (y + 42 > 275) { doc.addPage(); y = 20; }
          if (img) { doc.addImage(img.data, 'JPEG', x, y, 56, 40); x += 60; }
          if (x > 150) { x = 16; y += 44; }
        } catch { /* photo indisponible */ }
      }
      if (x !== 16) y += 44;
    }
    if (y > 235) { doc.addPage(); y = 25; }
    y += 4; doc.setFont('helvetica', 'bold'); doc.text(textePDF(`Décision : ${STATUT_CONTROLE[c.statut][1].replace(/^[^ ]+ /, '')}`), 16, y); y += 6;
    doc.text(textePDF(`Agent de contrôle : ${c.nom_controleur || ''}`), 16, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 84, 30);
    if (c.signature) doc.addImage(c.signature, 'PNG', 18, y + 5, 80, 26);
    piedPDF(doc, `${S.entreprise?.nom || ''} - Contrôle ${c.titre}`);
    presenterPDF(doc.output('blob'), `Controle-${c.phase}-${(c.controle_le || c.created_at).slice(0, 10)}.pdf`, `Fiche de contrôle ${c.titre}${c.zone ? ` (${c.zone})` : ''} — ${c.projets?.nom || ''} : ${STATUT_CONTROLE[c.statut][1]}`);
  } catch (e) { console.error(e); toast(messageErreur(e), 'err'); }
}

// Page générale : ce qu'il y a à contrôler sur tous les chantiers
PAGES.controles = async () => {
  const p = page(`${entete('Contrôles', 'Réception des ouvrages, étape par étape, avant de passer à la suite', '<button class="btn primary" id="nctl">🔍 Demander un contrôle</button>')}<div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('🔍', 'Les contrôles fonctionnent dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try {
      const tous = await q(sb.from('controles').select('*, projets(nom)').order('created_at', { ascending: false }).limit(200));
      const aFaire = tous.filter(pourMoi);
      const autres = tous.filter((c) => c.statut === 'demande' && !pourMoi(c) && c.demande_par !== S.profil.id);
      const mes = tous.filter((c) => c.demande_par === S.profil.id);
      zone.innerHTML = `<div class="grid k3 paie-kpis">
          ${kpi('À contrôler par moi', aFaire.length, 'demandes qui vous attendent', aFaire.length ? 'warn' : '')}
          ${kpi('Acceptés', tous.filter((c) => c.statut === 'accepte' || c.statut === 'reserve').length, `dont ${tous.filter((c) => c.statut === 'reserve').length} avec réserves`)}
          ${kpi('Refusés', tous.filter((c) => c.statut === 'refuse').length, 'à reprendre', tous.some((c) => c.statut === 'refuse') ? 'alert' : '')}
        </div>
        <div class="card"><div class="card-title">⏳ À contrôler par moi</div><div class="paie-liste">${aFaire.length ? aFaire.map(ligneControle).join('') : empty('✅', 'Aucun contrôle ne vous attend.')}</div></div>
        <div class="card"><div class="card-title">📤 Mes demandes</div><div class="paie-liste">${mes.length ? mes.map(ligneControle).join('') : empty('🔍', 'Quand une étape est terminée, demandez un contrôle ou une réception à un collègue.')}</div></div>
        ${autres.length ? `<div class="card"><div class="card-title">👥 En attente chez les autres</div><div class="paie-liste">${autres.map(ligneControle).join('')}</div></div>` : ''}
        <div class="card"><div class="card-title">Derniers contrôles</div><div class="paie-liste">${tous.filter((c) => c.statut !== 'demande').slice(0, 30).map(ligneControle).join('') || empty('📋', 'Aucun contrôle signé pour le moment.')}</div></div>`;
      $$('[data-voir-ctl]', zone).forEach((b) => (b.onclick = () => ficheControle(b.dataset.voirCtl, rendre)));
    } catch (e) { zone.innerHTML = `<div class="card">${empty('🔍', erreurControle(e))}</div>`; }
  };
  $('#nctl', p).onclick = () => demanderControle(null, null, null, rendre);
  await rendre();
};

// Pastille sur le cockpit pour les agents
async function puceControles() {
  if (DEMO || !can('direction', 'coordinateur', 'technicien')) return;
  try {
    const { data } = await sb.from('controles').select('id, statut, demande_par, controleur_designe').eq('statut', 'demande');
    const count = (data || []).filter(pourMoi).length;
    const zone = $('#main .cockpit-puces') || (() => { const c = $('#main .cockpit'); if (!c) return null; c.insertAdjacentHTML('beforeend', '<div class="cockpit-puces"></div>'); return $('.cockpit-puces', c); })();
    if (count && zone) zone.insertAdjacentHTML('afterbegin', `<a class="puce warn" href="#/controles">🔍 ${count} contrôle${count > 1 ? 's' : ''} à faire</a>`);
  } catch { /* table absente */ }
}

// ═══════════════════════════════ 3.7 : FILM DU CHANTIER, AVANT / APRÈS, STORY DE LA SEMAINE ═══════════════════════════════
// Un petit studio vidéo dans le téléphone : les scènes sont dessinées sur un canvas vertical (format statut WhatsApp),
// lues en plein écran comme une story, et peuvent être enregistrées en vidéo pour être partagées.
const FILM = { W: 720, H: 1280, POLICE: 'Sora, system-ui, sans-serif' };
const moisCourt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function chargerBitmap(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob());
  } catch { return null; }
}
function couvrir(ctx, img, W, H, t, sens = 1) {
  const z = 1.06 + 0.12 * t;
  const k = Math.max(W / img.width, H / img.height) * z;
  const w = img.width * k, h = img.height * k;
  const dx = (W - w) / 2 + sens * (t - 0.5) * W * 0.06, dy = (H - h) / 2 - (t - 0.5) * H * 0.03;
  ctx.drawImage(img, dx, dy, w, h);
}
function lignesTexte(ctx, txt, maxW) {
  const mots = String(txt || '').split(/\s+/).filter(Boolean), lignes = [];
  let l = '';
  mots.forEach((m) => { const essai = l ? `${l} ${m}` : m; if (ctx.measureText(essai).width > maxW && l) { lignes.push(l); l = m; } else l = essai; });
  if (l) lignes.push(l);
  return lignes;
}
function ecrire(ctx, txt, x, y, { taille = 34, poids = 600, couleur = '#fff', max = FILM.W - 96, lh = 1.3, lignes = 4, align = 'left', ombre = true } = {}) {
  ctx.font = `${poids} ${taille}px ${FILM.POLICE}`; ctx.fillStyle = couleur; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (ombre) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 14; }
  const ls = lignesTexte(ctx, txt, max);
  const garde = ls.slice(0, lignes);
  if (ls.length > lignes) garde[lignes - 1] = `${garde[lignes - 1].replace(/\s+\S*$/, '')}…`;
  garde.forEach((l, i) => ctx.fillText(l, x, y + i * taille * lh));
  ctx.shadowBlur = 0;
  return y + garde.length * taille * lh;
}
const facile = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function fondFilm(ctx, W, H, t, teinte = 0) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, ['#1a1530', '#0f2a22', '#2a1a0b'][teinte % 3]); g.addColorStop(1, '#070a12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  [[0.2 + 0.1 * Math.sin(t * 3), 0.25, 'rgba(247,190,80,.35)'], [0.85, 0.55 + 0.08 * Math.cos(t * 2), 'rgba(235,105,45,.25)'], [0.4, 0.95, 'rgba(90,140,255,.22)']].forEach(([x, y, c]) => {
    const r = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, W * 0.75);
    r.addColorStop(0, c); r.addColorStop(1, 'transparent'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  });
}
function filigrane(ctx, W, H, nom) {
  ctx.globalAlpha = 0.9;
  if (FILM.logo) {
    const h = 54, l = Math.min(150, (FILM.logo.width / FILM.logo.height) * h), hh = (FILM.logo.height / FILM.logo.width) * l;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(40, H - 58 - hh / 2 - 8, l + 16, hh + 16, 12); ctx.fill();
    ctx.drawImage(FILM.logo, 48, H - 58 - hh / 2, l, hh);
    ecrire(ctx, `${nom || ''} · avec KOORDIN`, 48 + l + 26, H - 50, { taille: 22, poids: 700, couleur: 'rgba(255,255,255,.95)', lignes: 1 });
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = '#e8a020';
  ctx.beginPath(); const cx = 58, cy = H - 58, r = 16;
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6; ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
  ecrire(ctx, `KOORDIN · ${nom || ''}`, 84, H - 50, { taille: 22, poids: 700, couleur: 'rgba(255,255,255,.9)', lignes: 1 });
  ctx.globalAlpha = 1;
}
function barreAvancement(ctx, x, y, w, pct, t) {
  const v = Math.max(0, Math.min(100, pct)) * facile(t * 1.6) / 100;
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x, y, w, 14, 7); ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ffe29a'); g.addColorStop(1, '#e8a020');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, Math.max(14, w * v), 14, 7); ctx.fill();
}

function dessinerScene(ctx, s, t) {
  const { W, H } = FILM;
  ctx.save();
  if (s.type === 'photo') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (s.img) couvrir(ctx, s.img, W, H, t, s.sens || 1); else fondFilm(ctx, W, H, t);
    let g = ctx.createLinearGradient(0, 0, 0, H * 0.32); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.32);
    g = ctx.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, 'transparent'); g.addColorStop(1, 'rgba(0,0,0,.88)'); ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ecrire(ctx, s.surtitre || '', 48, 110, { taille: 26, poids: 700, couleur: '#f7cf6f', lignes: 1 });
    ecrire(ctx, s.titre || '', 48, 168, { taille: 50, poids: 800, lignes: 2 });
    let y = H - 330;
    if (s.legende) y = ecrire(ctx, s.legende, 48, y, { taille: 32, poids: 500, couleur: '#e9ecf4', lignes: 4 }) + 10;
    if (s.pct != null) {
      ecrire(ctx, `Avancement ${Math.round(s.pct * facile(t * 1.6))} %`, 48, H - 140, { taille: 30, poids: 800, lignes: 1 });
      barreAvancement(ctx, 48, H - 118, W - 96, s.pct, t);
    }
    filigrane(ctx, W, H, s.marque);
  } else if (s.type === 'titre') {
    fondFilm(ctx, W, H, t, s.teinte || 0);
    const a = facile(t * 2.2);
    ctx.globalAlpha = a;
    ctx.font = `${160}px ${FILM.POLICE}`; ctx.textAlign = 'center'; ctx.fillText(s.icone || '🏗️', W / 2, H * 0.36 + (1 - a) * 40);
    let y = ecrire(ctx, s.titre, W / 2, H * 0.5, { taille: 64, poids: 800, align: 'center', lignes: 3, max: W - 100 });
    ctx.globalAlpha = facile(t * 2.2 - 0.3);
    (s.lignes || []).forEach((l) => { y = ecrire(ctx, l, W / 2, y + 26, { taille: 32, poids: 500, couleur: '#c9cede', align: 'center', lignes: 2, max: W - 120 }); });
    ctx.globalAlpha = 1;
    filigrane(ctx, W, H, s.marque);
  } else if (s.type === 'chiffres') {
    fondFilm(ctx, W, H, t, 1);
    ecrire(ctx, s.titre, 48, 190, { taille: 56, poids: 800, lignes: 2 });
    (s.items || []).slice(0, 6).forEach(([v, l, ic], i) => {
      const col = i % 2, lig = Math.floor(i / 2), x = 48 + col * ((W - 120) / 2 + 24), y = 330 + lig * 270, w = (W - 120) / 2;
      const k = facile(t * 2 - i * 0.12);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.strokeStyle = 'rgba(247,207,111,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y + (1 - k) * 30, w, 230, 28); ctx.fill(); ctx.stroke();
      ctx.font = `56px ${FILM.POLICE}`; ctx.textAlign = 'left'; ctx.fillText(ic || '', x + 28, y + 80 + (1 - k) * 30);
      const n = typeof v === 'number' ? Math.round(v * facile(t * 1.5)) : v;
      ecrire(ctx, `${n}${typeof v === 'number' && s.suffixes?.[i] ? s.suffixes[i] : ''}`, x + 28, y + 160 + (1 - k) * 30, { taille: 58, poids: 800, couleur: '#ffe29a', lignes: 1, max: w - 40 });
      ecrire(ctx, l, x + 28, y + 205 + (1 - k) * 30, { taille: 24, poids: 600, couleur: '#c9cede', lignes: 1, max: w - 40 });
    });
    ctx.globalAlpha = 1;
    filigrane(ctx, W, H, s.marque);
  } else if (s.type === 'liste') {
    fondFilm(ctx, W, H, t, s.teinte ?? 2);
    ecrire(ctx, s.titre, 48, 200, { taille: 56, poids: 800, lignes: 2 });
    let y = 330;
    (s.items || []).slice(0, 6).forEach(([ic, txt], i) => {
      const k = facile(t * 2.4 - i * 0.18);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.roundRect(48 + (1 - k) * 40, y, W - 96, 136, 24); ctx.fill();
      ctx.font = `48px ${FILM.POLICE}`; ctx.textAlign = 'left'; ctx.fillText(ic, 72 + (1 - k) * 40, y + 84);
      ecrire(ctx, txt, 140 + (1 - k) * 40, y + 60, { taille: 28, poids: 600, lignes: 2, max: W - 220 });
      y += 156;
    });
    ctx.globalAlpha = 1;
    filigrane(ctx, W, H, s.marque);
  } else if (s.type === 'fin') {
    fondFilm(ctx, W, H, t, 2);
    const k = facile(t * 2);
    ctx.save(); ctx.translate(W / 2, H * 0.4); ctx.rotate((1 - k) * -1.2); ctx.scale(k, k);
    const g = ctx.createLinearGradient(-90, -90, 90, 90); g.addColorStop(0, '#ffe29a'); g.addColorStop(1, '#c47a0c'); ctx.fillStyle = g;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6; ctx[i ? 'lineTo' : 'moveTo'](90 * Math.cos(a), 90 * Math.sin(a)); } ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = k;
    ecrire(ctx, s.titre || 'KOORDIN', W / 2, H * 0.58, { taille: 60, poids: 800, couleur: '#ffe29a', align: 'center', lignes: 2 });
    (s.lignes || []).forEach((l, i) => ecrire(ctx, l, W / 2, H * 0.58 + 80 + i * 50, { taille: 30, poids: 500, couleur: '#c9cede', align: 'center', lignes: 2 }));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ─── Lecteur plein écran (story) et enregistrement vidéo ───
function lireFilm(scenes, { titre = 'Film', nomFichier = 'koordin' } = {}) {
  if (!scenes.length) { toast('Pas encore assez de photos pour faire un film.', 'warn'); return; }
  if (S.entreprise?.logo && FILM.logoSrc !== S.entreprise.logo) {
    FILM.logoSrc = S.entreprise.logo; FILM.logo = null;
    fetch(S.entreprise.logo).then((r) => r.blob()).then(createImageBitmap).then((b) => { FILM.logo = b; }).catch(() => {});
  } else if (!S.entreprise?.logo) FILM.logo = null;
  const ov = document.createElement('div');
  ov.className = 'film';
  ov.innerHTML = `<div class="film-barres">${scenes.map(() => '<i><b></b></i>').join('')}</div>
    <button type="button" class="film-fermer" aria-label="Fermer">✕</button>
    <canvas width="${FILM.W}" height="${FILM.H}" class="film-toile"></canvas>
    <div class="film-zones"><button type="button" data-z="prec" aria-label="Précédent"></button><button type="button" data-z="suiv" aria-label="Suivant"></button></div>
    <div class="film-outils"><button type="button" class="btn sm" id="fl-pause">⏸ Pause</button><button type="button" class="btn sm primary" id="fl-video">🎬 Créer la vidéo à partager</button></div>
    <div class="film-enreg hidden"><div class="film-enreg-boite"><b>🎬 Création de la vidéo…</b><span id="fl-pct">0 %</span><div class="ctl-barre"><i id="fl-barre" style="width:0"></i></div><small>Laissez l’écran allumé, ça prend la durée du film.</small></div></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('en-film');
  const toile = $('canvas', ov), ctx = toile.getContext('2d');
  const barres = $$('.film-barres b', ov);
  const FONDU = 0.45;
  let idx = 0, debut = performance.now(), pause = false, pauseDepuis = 0, fini = false, enreg = null, verrou = null;
  const duree = (i) => scenes[i].d || 3.2;
  const dessiner = (maintenant) => {
    const ecoule = (maintenant - debut) / 1000, d = duree(idx), t = Math.min(1, ecoule / d);
    dessinerScene(ctx, scenes[idx], t);
    const reste = d - ecoule;
    if (reste < FONDU && idx < scenes.length - 1) { ctx.globalAlpha = 1 - reste / FONDU; dessinerScene(ctx, scenes[idx + 1], 0); ctx.globalAlpha = 1; }
    barres.forEach((b, i) => { b.style.width = i < idx ? '100%' : i === idx ? `${t * 100}%` : '0'; });
    if (enreg) { const total = scenes.reduce((s, _x, i) => s + duree(i), 0), fait = scenes.slice(0, idx).reduce((s, _x, i) => s + duree(i), 0) + Math.min(ecoule, d); $('#fl-pct', ov).textContent = `${Math.round((fait / total) * 100)} %`; $('#fl-barre', ov).style.width = `${(fait / total) * 100}%`; }
    if (ecoule >= d) {
      if (idx < scenes.length - 1) { idx++; debut = maintenant; }
      else if (enreg) { enreg.stop(); enreg = null; }
      else if (!pause) { pause = true; pauseDepuis = maintenant; $('#fl-pause', ov).textContent = '↺ Revoir'; }
    }
  };
  const boucle = (m) => { if (fini) return; if (!pause) dessiner(m); requestAnimationFrame(boucle); };
  requestAnimationFrame(boucle);
  const aller = (n) => { idx = Math.max(0, Math.min(scenes.length - 1, n)); debut = performance.now(); if (pause) { pause = false; $('#fl-pause', ov).textContent = '⏸ Pause'; } };
  const fermer = () => { fini = true; try { enreg?.stop(); } catch { /* rien */ } try { verrou?.release(); } catch { /* rien */ } ov.remove(); document.body.classList.remove('en-film'); };
  $('.film-fermer', ov).onclick = fermer;
  $('[data-z="prec"]', ov).onclick = () => { if (!enreg) aller(idx - 1); };
  $('[data-z="suiv"]', ov).onclick = () => { if (!enreg) { if (idx === scenes.length - 1) fermer(); else aller(idx + 1); } };
  $('#fl-pause', ov).onclick = (e) => {
    if (enreg) return;
    if (pause && idx === scenes.length - 1 && performance.now() - debut > duree(idx) * 1000) { aller(0); return; }
    pause = !pause;
    if (pause) pauseDepuis = performance.now(); else debut += performance.now() - pauseDepuis;
    e.currentTarget.textContent = pause ? '▶ Lecture' : '⏸ Pause';
  };
  $('#fl-video', ov).onclick = () => {
    if (!toile.captureStream || !window.MediaRecorder) { toast('Ce téléphone ne permet pas de créer la vidéo. Utilisez Chrome à jour.', 'warn', 6000); return; }
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const type = types.find((x) => MediaRecorder.isTypeSupported?.(x)) || '';
    const morceaux = [];
    const rec = new MediaRecorder(toile.captureStream(30), { mimeType: type || undefined, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    rec.onstop = async () => {
      $('.film-enreg', ov).classList.add('hidden');
      const ext = /mp4/.test(rec.mimeType || type) ? 'mp4' : 'webm';
      const blob = new Blob(morceaux, { type: rec.mimeType || type || 'video/webm' });
      const fichier = new File([blob], `${nomFichier}.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [fichier] })) {
        try { await navigator.share({ files: [fichier], title: titre, text: `${titre} — ${S.entreprise?.nom || ''}` }); return; } catch (err) { if (err?.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fichier.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast(`🎬 Vidéo enregistrée (${fichier.name}).`);
    };
    $('.film-enreg', ov).classList.remove('hidden');
    enreg = rec;
    rec.start(500);
    aller(0); pause = false;
  };
  navigator.wakeLock?.request('screen').then((v) => { verrou = v; }).catch(() => {});
}

// ─── 1. Film de l'avancement (timelapse) ───
async function filmChantier(projet) {
  toast('🎬 Préparation du film…', 'ok', 2500);
  try {
    const [{ data: photos }, rapports] = await Promise.all([
      sb.rpc('galerie_projet', { p_projet: projet.id }),
      q(sb.from('rapports').select('date_rapport, avancement').eq('projet_id', projet.id).not('avancement', 'is', null).order('date_rapport')),
    ]);
    let liste = (photos || []).slice().sort((a, b) => new Date(a.date_photo) - new Date(b.date_photo));
    if (!liste.length) { toast('Aucune photo pour ce chantier : ajoutez des photos ou des rapports avec photos.', 'warn', 6000); return; }
    if (liste.length > 36) { const pas = (liste.length - 1) / 35; liste = Array.from({ length: 36 }, (_, i) => liste[Math.round(i * pas)]); }
    const url = await urlsPhotos(liste.map((x) => x.chemin));
    const imgs = await Promise.all(liste.map((x) => chargerBitmap(url(x.chemin))));
    const pctA = (d) => { let v = null; rapports.forEach((r) => { if (new Date(r.date_rapport) <= new Date(d)) v = r.avancement; }); return v; };
    const marque = S.entreprise?.nom;
    const scenes = [
      { type: 'titre', icone: '🏗️', titre: projet.nom, lignes: [projet.localisation || projet.client || '', `De ${moisCourt(liste[0].date_photo)} à ${moisCourt(liste[liste.length - 1].date_photo)}`].filter(Boolean), d: 3, marque },
      ...liste.map((x, i) => imgs[i] && ({ type: 'photo', img: imgs[i], surtitre: projet.nom, titre: moisCourt(x.date_photo), legende: x.legende || '', pct: pctA(x.date_photo), d: 1.7, sens: i % 2 ? -1 : 1, marque })).filter(Boolean),
      { type: 'fin', titre: `${Math.max(num(projet.avancement), num(rapports[rapports.length - 1]?.avancement))} % réalisés`, lignes: [projet.nom, marque || ''], d: 3 },
    ];
    lireFilm(scenes, { titre: `Film du chantier ${projet.nom}`, nomFichier: `film-${projet.nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` });
  } catch (e) { toast(messageErreur(e), 'err'); }
}

// ─── 2. Avant / Après ───
async function avantApres(projet) {
  const { data, error } = await sb.rpc('galerie_projet', { p_projet: projet.id });
  if (error) { toast(messageErreur(error), 'err'); return; }
  const photos = (data || []).slice().sort((a, b) => new Date(a.date_photo) - new Date(b.date_photo));
  if (photos.length < 2) { toast('Il faut au moins deux photos du chantier pour faire un avant / après.', 'warn', 6000); return; }
  const url = await urlsPhotos(photos.map((x) => x.chemin));
  let iAvant = 0, iApres = photos.length - 1;
  const m = ouvrirModale({ titre: '↔️ Avant / Après', large: true, corps: `
    <div class="aa" id="aa"><img class="aa-apres" alt="Après"><div class="aa-avant-zone"><img class="aa-avant" alt="Avant"></div>
      <div class="aa-poignee"><span>↔</span></div><span class="aa-etiquette g">AVANT<small></small></span><span class="aa-etiquette d">APRÈS<small></small></span></div>
    <p class="muted" style="font-size:12.5px;margin:8px 0">Glissez le doigt sur la photo pour comparer.</p>
    <div class="aa-choix"><b>Avant</b><div class="aa-rail" data-rail="avant"></div><b>Après</b><div class="aa-rail" data-rail="apres"></div></div>
    <div class="rc-boutons mt"><button type="button" class="btn primary" id="aa-partager">📤 Partager l’image</button></div>` });
  const el = m.el, zone = $('#aa', el);
  const rails = () => ['avant', 'apres'].forEach((k) => {
    $(`[data-rail="${k}"]`, el).innerHTML = photos.map((p, i) => `<button type="button" class="${(k === 'avant' ? iAvant : iApres) === i ? 'actif' : ''}" data-k="${k}" data-i="${i}"><img src="${esc(url(p.chemin))}" alt="" loading="lazy"><small>${new Date(p.date_photo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small></button>`).join('');
    $$(`[data-k="${k}"]`, el).forEach((b) => (b.onclick = () => { if (k === 'avant') iAvant = +b.dataset.i; else iApres = +b.dataset.i; maj(); }));
  });
  const maj = () => {
    $('.aa-avant', el).src = url(photos[iAvant].chemin); $('.aa-apres', el).src = url(photos[iApres].chemin);
    $('.aa-etiquette.g small', el).textContent = fdate(photos[iAvant].date_photo); $('.aa-etiquette.d small', el).textContent = fdate(photos[iApres].date_photo);
    rails();
  };
  const placer = (x) => { const r = zone.getBoundingClientRect(); const p = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)); zone.style.setProperty('--aa', `${p}%`); };
  zone.addEventListener('pointerdown', (e) => { zone.setPointerCapture(e.pointerId); placer(e.clientX); zone.dataset.glisse = '1'; });
  zone.addEventListener('pointermove', (e) => { if (zone.dataset.glisse) placer(e.clientX); });
  zone.addEventListener('pointerup', () => { delete zone.dataset.glisse; });
  maj();
  // Petite démonstration du curseur à l'ouverture
  if (!reduireAnimations()) { let t0 = null; const demo = (t) => { t0 ??= t; const k = (t - t0) / 1600; if (k > 1 || zone.dataset.glisse) { zone.style.setProperty('--aa', '50%'); return; } zone.style.setProperty('--aa', `${50 + Math.sin(k * Math.PI * 2) * 25}%`); requestAnimationFrame(demo); }; requestAnimationFrame(demo); }
  $('#aa-partager', el).onclick = async () => {
    const [a, b] = await Promise.all([chargerBitmap(url(photos[iAvant].chemin)), chargerBitmap(url(photos[iApres].chemin))]);
    if (!a || !b) { toast('Images indisponibles.', 'err'); return; }
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#0b0e18'; x.fillRect(0, 0, W, H);
    const cadre = (img, y, h) => { x.save(); x.beginPath(); x.rect(0, y, W, h); x.clip(); const k = Math.max(W / img.width, h / img.height); x.drawImage(img, (W - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k); x.restore(); };
    cadre(a, 0, H / 2 - 4); cadre(b, H / 2 + 4, H / 2 - 4);
    x.fillStyle = '#e8a020'; x.fillRect(0, H / 2 - 4, W, 8);
    const etiquette = (t, d, y) => { x.fillStyle = 'rgba(8,11,20,.72)'; x.beginPath(); x.roundRect(28, y, 360, 96, 20); x.fill(); x.fillStyle = '#ffe29a'; x.font = `800 40px ${FILM.POLICE}`; x.textAlign = 'left'; x.fillText(t, 52, y + 46); x.fillStyle = '#e9ecf4'; x.font = `500 26px ${FILM.POLICE}`; x.fillText(d, 52, y + 80); };
    etiquette('AVANT', moisCourt(photos[iAvant].date_photo), 28); etiquette('APRÈS', moisCourt(photos[iApres].date_photo), H / 2 + 32);
    x.fillStyle = 'rgba(8,11,20,.72)'; x.beginPath(); x.roundRect(W - 470, H - 92, 442, 64, 18); x.fill();
    x.fillStyle = '#fff'; x.font = `700 26px ${FILM.POLICE}`; x.textAlign = 'right'; x.fillText(`${projet.nom} · ${S.entreprise?.nom || ''}`.slice(0, 40), W - 48, H - 50);
    c.toBlob(async (blob) => {
      const f = new File([blob], `avant-apres-${projet.nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], text: `Avant / après — ${projet.nom}` }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      const lien = document.createElement('a'); lien.href = URL.createObjectURL(blob); lien.download = f.name; lien.click();
    }, 'image/jpeg', 0.9);
  };
}

// ─── 3. Story de la semaine ───
const debutSemaine = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6); return d; };
async function storySemaine(projetId = null) {
  toast('📱 Préparation de la story…', 'ok', 2500);
  try {
    const depuis = debutSemaine(), depuisISO = depuis.toLocaleDateString('sv-SE');
    const projets = await q(sb.from('v_projets').select('*').neq('statut', 'termine').order('nom'));
    const cibles = projetId ? projets.filter((p) => p.id === projetId) : projets;
    if (!cibles.length) { toast('Aucun chantier en cours.', 'warn'); return; }
    const ids = cibles.map((p) => p.id);
    const [rapports, controles] = await Promise.all([
      q(sb.from('rapports').select('id, projet_id, date_rapport, travaux, incidents, effectif, avancement, statut').in('projet_id', ids).gte('date_rapport', depuisISO).order('date_rapport')),
      sb.from('controles').select('projet_id, titre, zone, statut, controle_le').in('projet_id', ids).gte('created_at', depuis.toISOString()).then((r) => r.data || [], () => []),
    ]);
    const photosRap = rapports.length ? await q(sb.from('rapport_photos').select('rapport_id, chemin, created_at').in('rapport_id', rapports.map((r) => r.id))) : [];
    const nomP = (id) => cibles.find((p) => p.id === id)?.nom || '';
    const marque = S.entreprise?.nom;
    const periode = `Du ${depuis.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    // Une photo forte par jour et par chantier (la dernière), au plus 6
    const choix = [];
    [...rapports].reverse().forEach((r) => {
      const ph = photosRap.filter((x) => x.rapport_id === r.id);
      if (ph.length && !choix.some((c) => c.r.projet_id === r.projet_id && c.r.date_rapport === r.date_rapport)) choix.push({ r, chemin: ph[ph.length - 1].chemin });
    });
    const retenues = choix.slice(0, 6).reverse();
    const url = await urlsPhotos([...retenues.map((c) => c.chemin), ...cibles.map(couvertureDe)]);
    const imgs = await Promise.all(retenues.map((c) => chargerBitmap(url(c.chemin))));
    const couv = projetId ? await chargerBitmap(url(couvertureDe(cibles[0]))) : null;
    const valides = controles.filter((c) => c.statut === 'accepte' || c.statut === 'reserve');
    const alertes = [
      ...controles.filter((c) => c.statut === 'refuse').map((c) => ['⛔', `${c.titre}${c.zone ? ` — ${c.zone}` : ''} à reprendre (${nomP(c.projet_id)})`]),
      ...controles.filter((c) => c.statut === 'demande').map((c) => ['⏳', `Contrôle à faire : ${c.titre}${c.zone ? ` — ${c.zone}` : ''} (${nomP(c.projet_id)})`]),
      ...cibles.filter((p) => p.jours_de_retard > 0).map((p) => ['⏱️', `${p.nom} : ${p.jours_de_retard} jour(s) de retard`]),
      ...rapports.filter((r) => r.incidents).slice(-3).map((r) => ['⚠️', `${nomP(r.projet_id)} : ${r.incidents}`]),
    ];
    const effectifs = rapports.filter((r) => r.effectif).map((r) => r.effectif);
    const titre = projetId ? cibles[0].nom : 'Nos chantiers';
    const scenes = [
      couv ? { type: 'photo', img: couv, surtitre: 'La semaine en images', titre, legende: periode, d: 3.2, marque } : { type: 'titre', icone: '📱', titre: `La semaine ${projetId ? 'du chantier' : 'de nos chantiers'}`, lignes: [projetId ? cibles[0].nom : marque || '', periode], d: 3.2, marque },
      { type: 'chiffres', titre: 'En chiffres', items: [
        [Math.round(cibles.reduce((s, p) => s + Math.max(num(p.avancement), num([...rapports].reverse().find((r) => r.projet_id === p.id && r.avancement != null)?.avancement)), 0) / cibles.length), projetId ? 'avancement' : 'avancement moyen', '📈'],
        [rapports.length, 'rapports du terrain', '📋'],
        [photosRap.length, 'photos prises', '📸'],
        [valides.length, 'étapes validées', '✅'],
        ...(effectifs.length ? [[Math.round(effectifs.reduce((a, b) => a + b, 0) / effectifs.length), 'ouvriers par jour', '👷🏾']] : []),
        ...(!projetId ? [[cibles.length, 'chantiers en cours', '🏗️']] : []),
      ], suffixes: [' %'], d: 4.2, marque },
      ...retenues.map((c, i) => imgs[i] && { type: 'photo', img: imgs[i], surtitre: nomP(c.r.projet_id), titre: (() => { const j = new Date(c.r.date_rapport).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return j.charAt(0).toUpperCase() + j.slice(1); })(), legende: c.r.travaux, pct: c.r.avancement ?? cibles.find((p) => p.id === c.r.projet_id)?.avancement, d: 3.4, sens: i % 2 ? -1 : 1, marque }).filter(Boolean),
      ...(valides.length ? [{ type: 'liste', titre: '✅ Étapes validées', items: valides.slice(0, 6).map((c) => [c.statut === 'accepte' ? '✅' : '⚠️', `${c.titre}${c.zone ? ` — ${c.zone}` : ''}${projetId ? '' : ` (${nomP(c.projet_id)})`}`]), teinte: 1, d: 3.8, marque }] : []),
      { type: 'liste', titre: alertes.length ? '👀 Points d’attention' : '👍 Tout roule', items: alertes.length ? alertes.slice(0, 5) : [['✅', 'Aucun point bloquant cette semaine.'], ['💪', 'Bravo à toute l’équipe !']], teinte: alertes.length ? 2 : 1, d: 3.8, marque },
      { type: 'fin', titre: marque || 'KOORDIN', lignes: ['Rendez-vous la semaine prochaine', 'Suivi de chantier avec KOORDIN'], d: 3 },
    ];
    if (!rapports.length && !retenues.length) scenes.splice(1, 0, { type: 'titre', icone: '😴', titre: 'Semaine calme', lignes: ['Aucun rapport n’a été envoyé cette semaine.'], d: 3, marque });
    lireFilm(scenes, { titre: `Story de la semaine — ${titre}`, nomFichier: `story-${titre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toLocaleDateString('sv-SE')}` });
  } catch (e) { console.error(e); toast(messageErreur(e), 'err'); }
}

// Bulles « story » sur l'accueil : toute l'entreprise + un rond par chantier
async function encartStories() {
  if (DEMO || $('#encart-stories')) return;
  const cible = $('#main .actions-rapides');
  if (!cible) return;
  let projets;
  try { projets = await q(sb.from('v_projets').select('id, nom, photo, photo_terrain, statut').neq('statut', 'termine').order('nom')); } catch { return; }
  if (!projets.length || !cible.isConnected) return;
  const url = await urlsPhotos(projets.map(couvertureDe));
  const el = document.createElement('section');
  el.id = 'encart-stories'; el.className = 'stories';
  el.innerHTML = `<div class="section-tete"><h2>📱 Story de la semaine</h2><span>7 derniers jours</span></div>
    <div class="stories-rail">${projets.length > 1 ? `<button type="button" class="story-bulle tous" data-story=""><span class="story-anneau"><span class="story-rond">🏗️</span></span><small>Tous</small></button>` : ''}
    ${projets.map((p) => `<button type="button" class="story-bulle" data-story="${p.id}"><span class="story-anneau"><span class="story-rond">${url(couvertureDe(p)) ? `<img src="${esc(url(couvertureDe(p)))}" alt="">` : sceneChantier(empreinte(p.id), { classe: 'mini' })}</span></span><small>${esc(p.nom)}</small></button>`).join('')}</div>`;
  cible.insertAdjacentElement('afterend', el);
  $$('[data-story]', el).forEach((b) => (b.onclick = () => { b.classList.add('vu'); storySemaine(b.dataset.story || null); }));
}

// ═══════════════════════════════ 3.8 : VOTRE MARQUE (LOGO ET COULEUR) ═══════════════════════════════
const MARQUE_DEFAUT = '#e8a020';
const PALETTE_MARQUE = [['#e8a020', 'Or KOORDIN'], ['#e4572e', 'Orange brique'], ['#d62839', 'Rouge'], ['#2f7ae6', 'Bleu'], ['#0b5394', 'Bleu marine'], ['#13a676', 'Vert'], ['#2e7d32', 'Vert forêt'], ['#7a5cf0', 'Violet'], ['#37474f', 'Gris ardoise']];
const hexRgb = (h) => { const n = parseInt(String(h || MARQUE_DEFAUT).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function rgbHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h * 360, s * 100, l * 100];
}
const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${Math.max(0, Math.min(100, s)).toFixed(0)}% ${Math.max(0, Math.min(100, l)).toFixed(0)}%)`;
const encreSur = (hex) => { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1203' : '#ffffff'; };

function appliquerMarque(ent = S.entreprise) {
  const racine = document.documentElement.style;
  const noms = ['--or-1', '--or-2', '--or-3', '--gold', '--gold-2', '--gold-dim', '--liseré-or', '--gold-ink', '--marque-encre'];
  const c = ent?.couleur_marque;
  if (!c || c.toLowerCase() === MARQUE_DEFAUT) { noms.forEach((n) => racine.removeProperty(n)); }
  else {
    const [h, s, l] = rgbHsl(hexRgb(c)); const [r, g, b] = hexRgb(c);
    racine.setProperty('--or-1', hsl(h, s + 5, l + 20)); racine.setProperty('--or-2', c); racine.setProperty('--or-3', hsl(h, s, l - 14));
    racine.setProperty('--gold', c); racine.setProperty('--gold-2', hsl(h, s, l + 12));
    racine.setProperty('--gold-dim', `rgba(${r}, ${g}, ${b}, .13)`); racine.setProperty('--liseré-or', `rgba(${r}, ${g}, ${b}, .32)`);
    racine.setProperty('--gold-ink', encreSur(c)); racine.setProperty('--marque-encre', encreSur(c));
  }
  try { localStorage.setItem('koordin-marque', JSON.stringify({ nom: ent?.nom || '', logo: ent?.logo || null, couleur: ent?.couleur_marque || null })); } catch { /* rien */ }
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta && c) meta.content = hsl(...rgbHsl(hexRgb(c)).slice(0, 2), 12);
}
const marqueMemorisee = () => { try { return JSON.parse(localStorage.getItem('koordin-marque') || 'null'); } catch { return null; } };
const brandHTML = () => '<div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>';
const entrepriseHTML = (ent = S.entreprise) => `${ent?.logo ? `<img class="company-logo" src="${esc(ent.logo)}" alt="">` : ''}<span class="company-nom">${esc(ent?.nom || '')}</span>`;

// Taille du logo pour le PDF (gardée en mémoire)
let logoPDF = { src: null, l: 0, h: 0 };
async function dimensionsLogo() {
  const src = S.entreprise?.logo;
  if (!src) return null;
  if (logoPDF.src === src) return logoPDF;
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch { return null; }
  logoPDF = { src, l: img.naturalWidth, h: img.naturalHeight };
  return logoPDF;
}

// Réduit l'image choisie (logo) : PNG au plus 480 px, fond transparent conservé
async function preparerLogo(fichier) {
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let data = c.toDataURL('image/png');
  if (data.length > 380000) data = c.toDataURL('image/webp', 0.9);
  if (data.length > 380000) throw new Error('Logo trop lourd, même réduit. Essayez une image plus simple.');
  return data;
}

function carteMarque() {
  const e = S.entreprise;
  return `<div class="card section" id="carte-marque"><div class="card-title">🎨 Votre marque</div>
    <p class="muted" style="font-size:13px;margin-bottom:12px">Votre logo et votre couleur apparaissent dans l’application, sur l’écran de connexion, dans tous les PDF (devis, situations, contrats, fiches de contrôle…), dans les films et sur la page de suivi de vos clients.</p>
    <div class="marque-grille">
      <div><div class="field">Logo</div>
        <div class="marque-logo" id="mq-logo">${e.logo ? `<img src="${esc(e.logo)}" alt="Logo">` : '<span>Aucun logo</span>'}</div>
        <div class="rc-boutons"><label class="btn sm">📷 Choisir le logo<input type="file" id="mq-fichier" accept="image/png,image/jpeg,image/webp" hidden></label>${e.logo ? '<button type="button" class="btn sm ghost" id="mq-sans">Retirer</button>' : ''}</div>
        <p class="hint">Idéalement un PNG à fond transparent.</p></div>
      <div><div class="field">Couleur principale</div>
        <div class="marque-palette">${PALETTE_MARQUE.map(([h, n]) => `<button type="button" class="pastille ${(e.couleur_marque || MARQUE_DEFAUT) === h ? 'actif' : ''}" data-c="${h}" style="--c:${h}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('')}
          <label class="pastille perso" title="Autre couleur"><input type="color" id="mq-perso" value="${esc(e.couleur_marque || MARQUE_DEFAUT)}">🎨</label></div>
        <div class="marque-apercu" id="mq-apercu"></div></div>
    </div>
    <div class="form-actions"><button type="button" class="btn ghost" id="mq-defaut">Revenir à KOORDIN</button><button type="button" class="btn primary" id="mq-ok">💾 Enregistrer ma marque</button></div></div>`;
}
function brancherMarque(p) {
  const zone = $('#carte-marque', p);
  if (!zone) return;
  let logo = S.entreprise.logo || null, couleur = S.entreprise.couleur_marque || MARQUE_DEFAUT;
  const apercu = () => {
    const test = { ...S.entreprise, logo, couleur_marque: couleur };
    appliquerMarque(test);
    $('#mq-apercu', zone).innerHTML = `<div class="apercu-barre">${brandHTML()}<span class="apercu-sep"></span><span class="company">${entrepriseHTML(test)}</span></div><div class="apercu-pdf" style="--c:${couleur}"><div class="apercu-pdf-tete">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<b>${esc(S.entreprise.nom)}</b><span>DEVIS</span></div><i></i><p>Aperçu de l’en-tête de vos PDF</p></div><button type="button" class="btn primary sm">Bouton</button>`;
    $('#mq-logo', zone).innerHTML = logo ? `<img src="${esc(logo)}" alt="Logo">` : '<span>Aucun logo</span>';
    $$('.pastille[data-c]', zone).forEach((b) => b.classList.toggle('actif', b.dataset.c === couleur));
  };
  $$('.pastille[data-c]', zone).forEach((b) => (b.onclick = () => { couleur = b.dataset.c; apercu(); }));
  $('#mq-perso', zone).oninput = (e) => { couleur = e.target.value.toLowerCase(); apercu(); };
  $('#mq-fichier', zone).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { logo = await preparerLogo(f); apercu(); } catch (err) { toast(err.message || 'Image illisible.', 'err'); }
  };
  zone.addEventListener('click', (e) => { if (e.target.id === 'mq-sans') { logo = null; apercu(); } });
  $('#mq-defaut', zone).onclick = () => { couleur = MARQUE_DEFAUT; logo = null; apercu(); };
  $('#mq-ok', zone).onclick = async () => {
    try {
      await q(sb.rpc('maj_marque', { p_logo: logo, p_couleur: couleur === MARQUE_DEFAUT ? null : couleur }));
      S.entreprise = { ...S.entreprise, logo, couleur_marque: couleur === MARQUE_DEFAUT ? null : couleur };
      memoriser('profil', { ...S.profil, entreprises: S.entreprise }, S.profil.id);
      appliquerMarque(); logoPDF = { src: null };
      const b = $('.topbar .company'); if (b) b.innerHTML = entrepriseHTML();
      toast('🎨 Votre marque est enregistrée : toute l’équipe la verra.');
    } catch (err) {
      const m = String(err?.message || '');
      toast(/^MARQUE_/.test(m) && err?.hint ? err.hint : /maj_marque|schema cache|does not exist/i.test(m) ? 'Cette fonction nécessite la mise à jour 3.8 de la base de données (kit d’installation).' : messageErreur(err), 'err', 7000);
    }
  };
  apercu();
}

// ═══════════════════════════════ TABLEAUX DE BORD ═══════════════════════════════

PAGES.dashboard = async () => {
  const tableaux = { technicien: dashTechnicien, achats: dashAchats, comptable: dashComptable, magasinier: dashMagasinier };
  await (tableaux[role()] || dashDirection)();
  await encartRapportsDuJour();
  await encartVersementsAConfirmer().catch(() => {});
  placerAnnonce($('#zone-annonce'));
  encartSavoir();
  encartStories();
  puceControles();
  encartNotifications();
  await encartCommuniques();
};

function tableauProjets(projets, { montants = true } = {}) {
  if (!projets.length) return empty('🏗️', 'Aucun projet');
  return `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Projet</th><th>État</th><th style="min-width:170px">Avancement (│ = prévu)</th>
      ${montants ? '<th class="num">Budget</th><th class="num">Engagé</th>' : ''}<th class="num">Fin prévue</th><th class="num">Rapports à valider</th></tr></thead><tbody>
    ${projets.map((p) => `<tr class="click" data-go="#/projet/${p.id}">
      <td><b>${esc(p.nom)}</b><div class="muted" style="font-size:12px">${esc(p.localisation || p.client || '')}</div></td>
      <td>${badge(SANTE[p.sante])}</td>
      <td>${progressBar(p.avancement, { attendu: p.avancement_attendu })}</td>
      ${montants ? `<td class="num">${moneyShort(p.budget)}</td>
      <td class="num"><span class="badge ${consoCls(Math.max(num(p.engage), num(p.facture)), p.budget)}">${pct(Math.max(num(p.engage), num(p.facture)), p.budget)} %</span></td>` : ''}
      <td class="num">${fdate(p.date_fin_prevue)}${p.jours_de_retard > 0 ? `<div class="badge crit" style="margin-top:3px">⏱ +${p.jours_de_retard} j</div>` : ''}</td>
      <td class="num">${p.rapports_en_attente ? `<span class="badge warn">${p.rapports_en_attente}</span>` : '<span class="muted">0</span>'}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function dashDirection() {
  const [projets, activites, stock] = await Promise.all([
    q(sb.from('v_projets').select('*').order('nom')),
    q(sb.from('activites').select('*').order('created_at', { ascending: false }).limit(12)),
    q(sb.from('v_stock').select('id, alerte')),
  ]);
  const actifs = projets.filter((p) => p.statut !== 'termine');
  const critiques = actifs.filter((p) => p.sante === 'critique').length;
  const budget = actifs.reduce((s, p) => s + num(p.budget), 0);
  const engage = actifs.reduce((s, p) => s + Math.max(num(p.engage), num(p.facture)), 0);
  const avMoyen = actifs.length ? Math.round(actifs.reduce((s, p) => s + p.avancement, 0) / actifs.length) : 0;
  const avPrevu = actifs.filter((p) => p.avancement_attendu != null);
  const prevuMoyen = avPrevu.length ? Math.round(avPrevu.reduce((s, p) => s + p.avancement_attendu, 0) / avPrevu.length) : null;
  const attente = projets.reduce((s, p) => s + p.rapports_en_attente, 0);
  const alertesStock = stock.filter((a) => a.alerte).length;

  const resume = !actifs.length ? 'Aucun chantier en cours pour le moment.'
    : critiques || attente ? [critiques ? `${critiques} chantier${critiques > 1 ? 's' : ''} à surveiller de près` : '', attente ? `${attente} rapport${attente > 1 ? 's' : ''} à valider` : ''].filter(Boolean).join(' · ')
    : `${actifs.length} chantier${actifs.length > 1 ? 's' : ''} en cours, tout est sous contrôle.`;
  const urlCouv = await urlsPhotos(actifs.map(couvertureDe));
  page(`
    ${heroAccueil({
      resume,
      jaugeVal: actifs.length ? avMoyen : null, jaugeLib: 'avancement moyen', prevu: prevuMoyen,
      puces: [
        actifs.length && [`🏗️ ${actifs.length} chantier${actifs.length > 1 ? 's' : ''}`, '#/projets'],
        critiques && [`🚨 ${critiques} critique${critiques > 1 ? 's' : ''}`, '#/projets', 'crit'],
        attente && [`📋 ${attente} à valider`, '#/rapports', 'warn'],
        alertesStock && [`📦 ${alertesStock} sous le seuil`, '#/stock', 'warn'],
      ].filter(Boolean),
    })}
    ${!projets.length && can('direction') ? `<div class="notice">Bienvenue ! Créez votre premier projet, ou chargez des <b>données de démonstration</b> depuis <a href="#/parametres">Paramètres</a> pour découvrir KOORDIN.</div>` : ''}
    <div class="grid k4">
      ${kpi('Projets actifs', actifs.length, critiques ? `<span style="color:var(--crit)">🚨 ${critiques} en situation critique</span>` : '✅ Aucun projet critique', critiques ? 'alert' : '', '🏗️')}
      ${kpi('Avancement moyen', `${avMoyen} %`, prevuMoyen != null ? `Prévu à date : ${prevuMoyen} %` : '', '', '📈')}
      ${kpi('Budget consommé', `${pct(engage, budget)} %`, `${moneyShort(engage)} sur ${moneyShort(budget)}`, pct(engage, budget) > 100 ? 'alert' : '', '💰')}
      ${kpi('Rapports à valider', attente, alertesStock ? `📦 ${alertesStock} article(s) sous le seuil` : 'Stock : aucune alerte', attente ? 'warn' : '', '📋')}
    </div>
    ${railChantiers(actifs, urlCouv)}
    ${actifs.length ? `<div class="grid c2 section">
      <div class="card"><div class="card-title">Avancement réel et prévu</div>
        ${legende([['Réel', '--series-1'], ['Prévu à date', '--series-ref']])}
        <div class="chart-box"><canvas id="ch-av"></canvas></div></div>
      <div class="card"><div class="card-title">Budget, engagé et facturé</div>
        ${legende([['Budget', '--series-1'], ['Engagé (commandes)', '--series-2'], ['Facturé', '--series-3']])}
        <div class="chart-box"><canvas id="ch-bud"></canvas></div></div>
    </div>` : ''}
    <div class="grid c21 section">
      <div class="card"><div class="card-title">Tableau détaillé des projets <small>Cliquez pour le détail</small></div>${tableauProjets(projets)}</div>
      <div class="col-droite"><div id="zone-annonce"></div><div class="card"><div class="card-title">Activité récente</div>${feedHTML(activites)}</div></div>
    </div>`);

  if (actifs.length) {
    const labels = actifs.map((p) => p.nom);
    graphiqueBarres($('#ch-av'), {
      labels, horizontal: true, max: 100, format: (v) => `${v} %`,
      series: [
        { label: 'Réel', data: actifs.map((p) => p.avancement), couleur: '--series-1' },
        { label: 'Prévu à date', data: actifs.map((p) => p.avancement_attendu ?? 0), couleur: '--series-ref' },
      ],
    });
    graphiqueBarres($('#ch-bud'), {
      labels, format: moneyShort,
      series: [
        { label: 'Budget', data: actifs.map((p) => num(p.budget)), couleur: '--series-1' },
        { label: 'Engagé', data: actifs.map((p) => num(p.engage)), couleur: '--series-2' },
        { label: 'Facturé', data: actifs.map((p) => num(p.facture)), couleur: '--series-3' },
      ],
    });
  }
}

async function dashTechnicien() {
  const uid = S.profil.id;
  const [projets, rapports, taches] = await Promise.all([
    q(sb.from('v_projets').select('*').neq('statut', 'termine').order('nom')),
    q(sb.from('rapports').select('id, date_rapport, statut, travaux, projet_id, commentaire_validation').eq('auteur_id', uid).order('created_at', { ascending: false }).limit(6)),
    q(sb.from('taches').select('nom, date_debut, date_fin, avancement, projet_id').gte('date_fin', todayISO()).order('date_debut').limit(8)),
  ]);
  const nomP = (id) => projets.find((p) => p.id === id)?.nom || '';
  const aujourdhui = rapports.some((r) => r.date_rapport === todayISO());
  setTimeout(() => rappelRapportTechnicien(aujourdhui, projets.length > 0), 900);
  const url = await urlsPhotos(projets.map(couvertureDe));
  page(`
    ${heroAccueil({
      resume: !projets.length ? 'Votre journée sur le terrain.' : aujourdhui ? 'Rapport du jour envoyé ✅ Bon travail !' : 'Pensez à envoyer votre rapport du jour.',
      jaugeVal: projets.length ? Math.round(projets.reduce((t, x) => t + num(x.avancement), 0) / projets.length) : null, jaugeLib: projets.length > 1 ? 'avancement moyen' : 'avancement',
      puces: [projets.length && [`🏗️ ${projets.length} chantier${projets.length > 1 ? 's' : ''}`, '#/projets'], !aujourdhui && projets.length && ['⏰ Rapport à faire', '#/nouveau-rapport', 'warn']].filter(Boolean),
    })}
    ${!projets.length ? '<div class="notice warn">Vous n’êtes affecté à aucun chantier pour le moment. Demandez à votre coordinateur de vous ajouter à un projet.</div>' : ''}
    ${projets.length ? `<a class="btn primary block" style="padding:16px;font-size:15px;margin-bottom:16px" href="#/nouveau-rapport">➕ ${aujourdhui ? 'Faire un autre rapport' : 'Faire mon rapport du jour'}</a>` : ''}
    ${!aujourdhui && projets.length ? '<div class="notice warn">⏰ Vous n’avez pas encore envoyé de rapport aujourd’hui.</div>' : ''}
    <div class="card"><div class="card-title">Mes chantiers</div>
      <div class="projects">${projets.map((p) => `
        <div class="card project-card a-couverture" data-go="#/projet/${p.id}">
          ${visuelProjet(p, url(couvertureDe(p)))}
          <div class="pc-body"><div class="pc-head">${anneau(p.avancement, p.avancement_attendu)}
            <div class="pc-titre"><h3>${esc(p.nom)}</h3><div class="meta">${esc(p.localisation || '')}</div><div class="pc-badges">${badge(SANTE[p.sante])}</div></div></div>
          <div class="meta">Fin prévue : ${fdate(p.date_fin_prevue)}</div></div>
        </div>`).join('') || empty('🏗️', 'Aucun chantier')}</div></div>
    <div id="zone-annonce" class="section"></div>
    <div class="grid c2 section">
      <div class="card"><div class="card-title">Mes derniers rapports <a href="#/rapports" class="btn sm">Tout voir</a></div>
        ${rapports.length ? rapports.map((r) => `<div class="report" data-rapport="${r.id}">
          <div class="r-body"><div class="r-title">${fdate(r.date_rapport)} · ${esc(nomP(r.projet_id))} ${badge(STATUT_RAPPORT[r.statut])}</div>
          <div class="r-text">${esc(r.travaux)}</div>
          ${r.statut === 'rejete' && r.commentaire_validation ? `<div class="r-meta" style="color:var(--crit)">Motif : ${esc(r.commentaire_validation)}</div>` : ''}</div></div>`).join('') : empty('📋', 'Aucun rapport envoyé')}
      </div>
      <div class="card"><div class="card-title">Tâches en cours et à venir</div>
        ${taches.length ? `<div class="table-wrap"><table class="tbl"><tbody>${taches.map((t) => `<tr>
          <td><b>${esc(t.nom)}</b><div class="muted" style="font-size:12px">${esc(nomP(t.projet_id))} · ${fdate(t.date_debut)} → ${fdate(t.date_fin)}</div></td>
          <td style="width:130px">${progressBar(t.avancement)}</td></tr>`).join('')}</tbody></table></div>` : empty('📅', 'Rien de planifié')}
      </div>
    </div>`);
}

async function dashAchats() {
  const [projets, lots, commandes] = await Promise.all([
    q(sb.from('v_projets').select('id, nom, budget, engage, facture, statut').neq('statut', 'termine').order('nom')),
    q(sb.from('v_budget_lots').select('*')),
    q(sb.from('commandes').select('*, projets(nom), fournisseurs(nom)').order('date_commande', { ascending: false }).limit(10)),
  ]);
  const totalEngage = projets.reduce((s, p) => s + num(p.engage), 0);
  const enCours = commandes.filter((c) => c.statut === 'commandee');
  const demandes = commandes.filter((c) => c.statut === 'demandee');
  const lotsHors = lots.filter((l) => num(l.budget) > 0 && num(l.engage) > num(l.budget));
  page(`
    ${heroAccueil({ resume: 'Achats et suivi budgétaire.', puces: [demandes.length && [`🛒 ${demandes.length} demande${demandes.length > 1 ? 's' : ''} à traiter`, '#/achats', 'warn'], enCours.length && [`🚚 ${enCours.length} en livraison`, '#/achats']].filter(Boolean) })}
    <div class="grid k4">
      ${kpi('Total engagé', moneyShort(totalEngage), `${projets.length} projet(s) actif(s)`)}
      ${kpi('Commandes en cours', enCours.length, 'En attente de livraison')}
      ${kpi('Demandes à traiter', demandes.length, '', demandes.length ? 'warn' : '')}
      ${kpi('Lots hors budget', lotsHors.length, lotsHors.length ? lotsHors.map((l) => esc(l.nom)).slice(0, 2).join(', ') : '✅ Tout est maîtrisé', lotsHors.length ? 'alert' : '')}
    </div>
    <div class="grid c2 section">
      <div class="card"><div class="card-title">Budget engagé par projet</div>${tableauBudgetProjets(projets)}</div>
      <div class="card"><div class="card-title">Dernières commandes <a class="btn sm" href="#/achats">Tout voir</a></div>${tableauCommandes(commandes, { compact: true })}</div>
    </div>
    <div id="zone-annonce" class="section"></div>`);
}

function tableauBudgetProjets(projets) {
  if (!projets.length) return empty('💰', 'Aucun projet');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Projet</th><th class="num">Budget</th><th class="num">Engagé</th><th class="num">Facturé</th><th style="min-width:150px">Consommé</th></tr></thead><tbody>
    ${projets.map((p) => {
      const c = Math.max(num(p.engage), num(p.facture));
      return `<tr class="click" data-go="#/projet/${p.id}"><td><b>${esc(p.nom)}</b></td><td class="num">${moneyShort(p.budget)}</td>
        <td class="num">${moneyShort(p.engage)}</td><td class="num">${moneyShort(p.facture)}</td>
        <td>${progressBar(pct(c, p.budget), { cls: consoCls(c, p.budget), label: pct(c, p.budget) })}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

async function dashComptable() {
  const [factures, projets] = await Promise.all([
    q(sb.from('factures').select('*, projets(nom), fournisseurs(nom)').order('date_echeance', { ascending: true })),
    q(sb.from('v_projets').select('id, nom, budget, engage, facture, paye, statut').order('nom')),
  ]);
  const total = factures.reduce((s, f) => s + num(f.montant), 0);
  const paye = factures.filter((f) => f.statut === 'payee').reduce((s, f) => s + num(f.montant), 0);
  const aPayer = factures.filter((f) => f.statut === 'a_payer');
  const echues = aPayer.filter((f) => f.date_echeance && f.date_echeance < todayISO());
  page(`
    ${heroAccueil({ resume: 'Situation financière des chantiers.' })}
    <div class="grid k4">
      ${kpi('Total facturé', moneyShort(total), `${factures.length} pièce(s)`)}
      ${kpi('Payé', moneyShort(paye), `${pct(paye, total)} % du facturé`)}
      ${kpi('Reste à payer', moneyShort(total - paye), `${aPayer.length} facture(s)`, aPayer.length ? 'warn' : '')}
      ${kpi('Échéances dépassées', echues.length, echues.length ? moneyShort(echues.reduce((s, f) => s + num(f.montant), 0)) : '✅ Aucune', echues.length ? 'alert' : '')}
    </div>
    <div class="grid c2 section">
      <div class="card"><div class="card-title">Factures échues ou proches de l’échéance</div>
        ${tableauFactures(aPayer.slice(0, 10), { compact: true })}</div>
      <div class="card"><div class="card-title">Budget et réalisé par projet</div>${tableauBudgetProjets(projets.filter((p) => p.statut !== 'termine'))}</div>
    </div>
    <div id="zone-annonce" class="section"></div>`);
}

async function dashMagasinier() {
  const [stock, commandes, mouvements] = await Promise.all([
    q(sb.from('v_stock').select('*').order('nom')),
    q(sb.from('commandes').select('*, projets(nom), fournisseurs(nom)').eq('statut', 'commandee').order('date_commande')),
    q(sb.from('mouvements_stock').select('*, articles(*), projets!mouvements_stock_projet_id_fkey(nom)').order('created_at', { ascending: false }).limit(10)),
  ]);
  const alertes = stock.filter((a) => a.alerte);
  const valeur = stock.reduce((s, a) => s + num(a.quantite) * num(a.prix_unitaire), 0);
  page(`
    ${heroAccueil({ resume: 'Magasin et approvisionnement.' })}
    <div class="grid k4">
      ${kpi('Articles suivis', stock.length)}
      ${kpi('Sous le seuil', alertes.length, alertes.length ? 'À réapprovisionner' : '✅ Aucun', alertes.length ? 'alert' : '')}
      ${kpi('Valeur du stock', moneyShort(valeur))}
      ${kpi('Livraisons attendues', commandes.length, 'Commandes à réceptionner', commandes.length ? 'warn' : '')}
    </div>
    <div class="grid c2 section">
      <div class="card"><div class="card-title">Articles sous le seuil</div>${tableauStock(alertes, { compact: true })}</div>
      <div class="card"><div class="card-title">Commandes à réceptionner</div>${tableauCommandes(commandes, { compact: true })}</div>
    </div>
    <div class="card section"><div class="card-title">Derniers mouvements</div>${tableauMouvements(mouvements)}</div>
    <div id="zone-annonce" class="section"></div>`);
}

// ═══════════════════════════════ PROJETS ═══════════════════════════════

PAGES.projets = async () => {
  const projets = await q(sb.from('v_projets').select('*').order('nom'));
  const url = await urlsPhotos(projets.map(couvertureDe));
  const tech = role() === 'technicien';
  let filtre = 'actifs';
  let recherche = '';
  const p = page(`
    ${entete(tech ? 'Mes chantiers' : 'Projets', `${projets.length} projet(s)`, can('direction', 'coordinateur') ? '<button class="btn primary" id="np">＋ Nouveau projet</button>' : '')}
    <div class="toolbar">
      <select class="input" id="f-statut"><option value="actifs">Projets actifs</option><option value="tous">Tous</option>
        ${Object.entries(STATUT_PROJET).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input class="input" id="f-q" placeholder="🔍 Rechercher…">
    </div>
    <div class="projects" id="liste"></div>`);
  const rendre = () => {
    const l = projets.filter((x) => (filtre === 'tous' || (filtre === 'actifs' ? x.statut !== 'termine' : x.statut === filtre))
      && (!recherche || `${x.nom} ${x.client || ''} ${x.localisation || ''} ${x.reference || ''}`.toLowerCase().includes(recherche)));
    $('#liste', p).innerHTML = l.map((x) => `
      <div class="card project-card a-couverture" data-go="#/projet/${x.id}">
        ${visuelProjet(x, url(couvertureDe(x)))}
        <div class="pc-body"><div class="pc-head">${anneau(x.avancement, x.avancement_attendu)}
          <div class="pc-titre"><h3>${esc(x.nom)}</h3><div class="meta">${esc([x.reference, x.localisation].filter(Boolean).join(' · '))}</div>
          <div class="pc-badges">${badge(SANTE[x.sante])}</div></div></div>
        <div class="pc-stats">
          ${tech ? `<div><b>${x.avancement} %</b><span>Avancement</span></div>` : `<div><b>${moneyShort(x.budget)}</b><span>Budget</span></div>`}
          ${tech ? `<div><b>${x.avancement_attendu ?? '—'} %</b><span>Prévu</span></div>` : `<div><b>${pct(Math.max(num(x.engage), num(x.facture)), x.budget)} %</b><span>Consommé</span></div>`}
          <div><b>${x.jours_de_retard > 0 ? `+${x.jours_de_retard} j` : fdate(x.date_fin_prevue).replace(/ \d{4}$/, '')}</b><span>${x.jours_de_retard > 0 ? 'Retard' : 'Fin prévue'}</span></div>
        </div>
        <div class="split meta"><span>${badge(STATUT_PROJET[x.statut])}</span><span>👥 ${x.equipe} · 📋 ${x.rapports_en_attente} à valider</span></div></div>
      </div>`).join('') || `<div class="card" style="grid-column:1/-1">${empty('🏗️', tech ? 'Aucun chantier affecté' : 'Aucun projet pour ce filtre')}</div>`;
  };
  rendre();
  $('#f-statut', p).onchange = (e) => { filtre = e.target.value; rendre(); };
  $('#f-q', p).oninput = (e) => { recherche = e.target.value.toLowerCase(); rendre(); };
  $('#np', p)?.addEventListener('click', () => formulaireProjet());
  if (memo.get('koordin-ouvrir') === 'projet') { memo.del('koordin-ouvrir'); formulaireProjet(); }
};

function formulaireProjet(projet = null) {
  const v = projet || { statut: 'en_cours', date_debut: todayISO() };
  ouvrirModale({
    titre: projet ? 'Modifier le projet' : 'Nouveau projet',
    large: true,
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom du projet', v.nom, { required: true, full: true, placeholder: 'Ex. Résidence Les Palmiers' })}
      ${F.text('reference', 'Référence', v.reference)}
      ${F.text('client', 'Client / maître d’ouvrage', v.client)}
      ${F.text('localisation', 'Localisation', v.localisation)}
      ${F.text('budget', `Budget total (${devise()})`, v.budget, { type: 'number', min: 0, step: '1', required: true, inputmode: 'numeric' })}
      ${F.text('date_debut', 'Date de début', v.date_debut, { type: 'date', required: true })}
      ${F.text('date_fin_prevue', 'Date de fin prévue', v.date_fin_prevue, { type: 'date', required: true })}
      ${F.select('statut', 'Statut', Object.entries(STATUT_PROJET).map(([k, [, l]]) => [k, l]), v.statut)}
      ${F.area('description', 'Description / spécificités du projet', v.description)}
      ${!projet ? `<label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="lots_standard" checked style="width:auto"> Créer les lots standard (Gros œuvre, Électricité, Plomberie, Menuiserie, Finitions) — modifiables ensuite</label>` : ''}
    </div>`,
    onSubmit: async (d) => {
      if (d.date_fin_prevue < d.date_debut) throw new Error('La date de fin doit être après la date de début.');
      const data = {
        nom: d.nom, reference: d.reference, client: d.client, localisation: d.localisation,
        budget: num(d.budget), date_debut: d.date_debut, date_fin_prevue: d.date_fin_prevue,
        statut: d.statut, description: d.description,
        date_fin_reelle: d.statut === 'termine' ? (projet?.date_fin_reelle || todayISO()) : null,
      };
      if (projet) {
        await q(sb.from('projets').update(data).eq('id', projet.id));
        toast('Projet mis à jour.');
        naviguer();
      } else {
        const cree = await q(sb.from('projets').insert(data).select('id').single());
        if (d.lots_standard) {
          const parts = [['Gros œuvre', 0.45], ['Électricité', 0.15], ['Plomberie', 0.12], ['Menuiserie', 0.1], ['Finitions', 0.18]];
          await q(sb.from('lots').insert(parts.map(([nom, k], i) => ({ projet_id: cree.id, nom, budget: Math.round(num(d.budget) * k), ordre: i + 1 }))));
        }
        toast('Projet créé.');
        allerA(`#/projet/${cree.id}`);
      }
    },
  });
}

// ─── Rapport hebdomadaire pour le client (PDF) ───
// Fabriqué sur le téléphone, sans serveur : avancement, travaux de la semaine,
// points d'attention, prochaines étapes et photos. Aucune donnée financière.

let jsPDFCharge = null;
function chargerJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  jsPDFCharge ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'jspdf.umd.min.js';
    s.onload = () => ok(window.jspdf.jsPDF);
    s.onerror = () => { jsPDFCharge = null; ko(new Error('Impossible de charger l’outil PDF. Vérifiez votre connexion internet.')); };
    document.head.appendChild(s);
  });
  return jsPDFCharge;
}

function periodeRapport(choix) {
  const auj = parseDay(todayISO());
  const iso = (d) => d.toLocaleDateString('sv-SE');
  const decale = (d, j) => { const x = new Date(d); x.setDate(x.getDate() + j); return x; };
  const lundi = decale(auj, -((auj.getDay() + 6) % 7));
  if (choix === 'semaine') return { du: iso(lundi), au: iso(auj) };
  if (choix === 'precedente') return { du: iso(decale(lundi, -7)), au: iso(decale(lundi, -1)) };
  return { du: iso(decale(auj, -6)), au: iso(auj) };
}

// Les polices intégrées du PDF ne connaissent que l'alphabet latin : on remplace le reste.
const textePDF = (v) => String(v ?? '')
  .replace(/[‘’ʼ]/g, "'").replace(/[“”«»]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
  .replace(/[   ]/g, ' ').replace(/→/g, '->')
  .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '').replace(/[ \t]+\n/g, '\n').trim();

// Recadre la photo au format de la vignette (sans bandes vides) et l'allège.
async function imagePourPDF(url, ratio = 4 / 3, max = 1000) {
  try {
    const rep = await fetch(url);
    if (!rep.ok) return null;
    const bmp = await createImageBitmap(await rep.blob());
    let sw = bmp.width, sh = bmp.height;
    if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
    const k = Math.min(1, max / sw);
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.72), l: c.width, h: c.height };
  } catch { return null; }
}

async function donneesRapportClient(projet, { du, au, valides }) {
  const [lots, rapports, taches] = await Promise.all([
    q(sb.from('lots').select('id, nom, avancement, ordre').eq('projet_id', projet.id).order('ordre')),
    q(sb.from('rapports').select('id, lot_id, date_rapport, meteo, effectif, travaux, incidents, statut')
      .eq('projet_id', projet.id).gte('date_rapport', du).lte('date_rapport', au).order('date_rapport').order('created_at')),
    q(sb.from('taches').select('nom, lot_id, date_debut, date_fin, avancement').eq('projet_id', projet.id).order('date_debut')),
  ]);
  const retenus = rapports.filter((r) => (valides ? r.statut === 'valide' : r.statut !== 'rejete'));
  // Photos de la période : galerie du projet (version 1.6) sinon photos des rapports
  let photos = [];
  const { data: galerie, error } = await sb.rpc('galerie_projet', { p_projet: projet.id });
  if (!error && galerie) {
    const ids = new Set(retenus.map((r) => r.id));
    photos = galerie.filter((x) => {
      const jour = new Date(x.date_photo).toLocaleDateString('sv-SE');
      return jour >= du && jour <= au && (x.source !== 'rapport' || ids.has(x.rapport_id));
    }).map((x) => ({ chemin: x.chemin, date: x.date_photo, legende: x.legende }));
  } else if (retenus.length) {
    const { data } = await sb.from('rapport_photos').select('chemin, created_at, rapport_id').in('rapport_id', retenus.map((r) => r.id));
    photos = (data || []).map((x) => ({ chemin: x.chemin, date: x.created_at, legende: retenus.find((r) => r.id === x.rapport_id)?.travaux }));
  }
  photos.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const auj = todayISO();
  const dans15 = parseDay(auj); dans15.setDate(dans15.getDate() + 15);
  const prochaines = taches.filter((t) => t.avancement < 100 && t.date_fin >= auj && t.date_debut <= dans15.toLocaleDateString('sv-SE')).slice(0, 6);
  return { lots, rapports: retenus, prochaines, photos: photos.slice(0, 6) };
}

async function fabriquerPDFClient(projet, d, { du, au, message }) {
  const JsPDF = await chargerJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const L = 210, H = 297, M = 16, LU = L - 2 * M;
  const OR = [232, 160, 32], NUIT = [17, 21, 33], GRIS = [100, 108, 128], CLAIR = [244, 245, 249], TRAIT = [226, 229, 238];
  const nomLot = (id) => d.lots.find((l) => l.id === id)?.nom || '';
  const jourLong = (s) => parseDay(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const periode = `Du ${parseDay(du).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${parseDay(au).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  let y = 0;

  const police = (taille, gras = false, couleur = NUIT) => { doc.setFont('helvetica', gras ? 'bold' : 'normal'); doc.setFontSize(taille); doc.setTextColor(...couleur); };
  const place = (h) => { if (y + h > H - 20) { doc.addPage(); y = M + 4; } };
  const titre = (t) => {
    place(16);
    y += 4;
    doc.setFillColor(...OR); doc.rect(M, y - 4, 1.6, 6, 'F');
    police(12.5, true); doc.text(textePDF(t), M + 4.5, y + 0.6);
    y += 8;
  };
  const paragraphe = (t, { taille = 10, couleur = NUIT, retrait = 0, gras = false, interligne = 4.6 } = {}) => {
    police(taille, gras, couleur);
    for (const ligne of doc.splitTextToSize(textePDF(t), LU - retrait)) { place(interligne); doc.text(ligne, M + retrait, y); y += interligne; }
  };

  // En-tête
  doc.setFillColor(...NUIT); doc.rect(0, 0, L, 40, 'F');
  doc.setFillColor(...OR); doc.rect(0, 40, L, 1.4, 'F');
  police(19, true, [255, 255, 255]); doc.text(textePDF(S.entreprise?.nom || ''), M, 17);
  police(10.5, false, [200, 205, 220]); doc.text('Rapport hebdomadaire de chantier', M, 25);
  police(10.5, true, OR); doc.text(textePDF(periode), M, 32);
  y = 54;
  police(17, true); doc.text(doc.splitTextToSize(textePDF(projet.nom), LU)[0], M, y); y += 6.5;
  const infos = [projet.client && `Client : ${projet.client}`, projet.localisation, projet.reference && `Réf. ${projet.reference}`].filter(Boolean).join('   ·   ');
  if (infos) { police(10, false, GRIS); doc.text(doc.splitTextToSize(textePDF(infos), LU)[0], M, y); y += 5; }
  y += 4;

  // Chiffres clés
  const retard = num(projet.jours_de_retard);
  const etat = projet.statut === 'termine' ? 'Chantier terminé'
    : retard > 0 ? `${retard} jour${retard > 1 ? 's' : ''} de retard`
      : projet.sante === 'critique' ? 'En retard sur le planning' : projet.sante === 'attention' ? 'À surveiller' : 'Dans les temps';
  const couleurEtat = projet.sante === 'critique' || retard > 0 ? [214, 69, 69] : projet.sante === 'attention' ? [196, 128, 10] : [25, 150, 100];
  const effectifs = d.rapports.map((r) => r.effectif).filter((x) => x != null);
  const cases = [
    ['Avancement', `${num(projet.avancement)} %`, `Prévu à date : ${num(projet.avancement_attendu)} %`, NUIT],
    ['État du planning', etat, `Fin prévue : ${fdate(projet.date_fin_prevue)}`, couleurEtat],
    ['Cette semaine', `${d.rapports.length} rapport${d.rapports.length > 1 ? 's' : ''}`, effectifs.length ? `Effectif moyen : ${Math.round(effectifs.reduce((a, b) => a + b, 0) / effectifs.length)} pers.` : 'Effectif non renseigné', NUIT],
  ];
  const lc = (LU - 8) / 3;
  cases.forEach(([lib, val, sous, coul], i) => {
    const x = M + i * (lc + 4);
    doc.setFillColor(...CLAIR); doc.roundedRect(x, y, lc, 25, 2.5, 2.5, 'F');
    police(8.5, false, GRIS); doc.text(textePDF(lib).toUpperCase(), x + 4, y + 6.5);
    police(val.length > 14 ? 11 : 15, true, coul); doc.text(doc.splitTextToSize(textePDF(val), lc - 8)[0], x + 4, y + 14.5);
    police(8.5, false, GRIS); doc.text(doc.splitTextToSize(textePDF(sous), lc - 8)[0], x + 4, y + 20.5);
  });
  y += 31;

  // Barre d'avancement global avec repère du prévu
  const barre = (x, yy, l, h, v, prevu = null) => {
    doc.setFillColor(...TRAIT); doc.roundedRect(x, yy, l, h, h / 2, h / 2, 'F');
    if (v > 0) { doc.setFillColor(...OR); doc.roundedRect(x, yy, Math.max(h, l * Math.min(v, 100) / 100), h, h / 2, h / 2, 'F'); }
    if (prevu != null) { doc.setFillColor(...NUIT); doc.rect(x + l * Math.min(prevu, 100) / 100 - 0.4, yy - 1.2, 0.8, h + 2.4, 'F'); }
  };
  barre(M, y, LU, 3.2, num(projet.avancement), num(projet.avancement_attendu));
  y += 7.5;
  police(8, false, GRIS); doc.text('Barre orange : avancement réel   |   Repère noir : avancement prévu à date', M, y); y += 4;

  if (message?.trim()) {
    titre('Le mot de l’entreprise');
    paragraphe(corrigerTexte(message).texte, { taille: 10.5 });
  }

  // Résumé de la période, écrit automatiquement
  if (d.rapports.length) {
    const jours = new Set(d.rapports.map((r) => r.date_rapport)).size;
    const lotsTouches = [...new Set(d.rapports.map((r) => nomLot(r.lot_id)).filter(Boolean))];
    const pluie = new Set(d.rapports.filter((r) => /pluie|orage/i.test(r.meteo || '')).map((r) => r.date_rapport)).size;
    const attention = d.rapports.filter((r) => r.incidents?.trim()).length;
    titre('En résumé');
    paragraphe(`${jours} jour${jours > 1 ? 's' : ''} de travail sur la période${lotsTouches.length ? `, principalement sur : ${lotsTouches.slice(0, 4).join(', ')}` : ''}. `
      + `${pluie ? `${pluie} jour${pluie > 1 ? 's' : ''} de pluie. ` : ''}${attention ? `${attention} point${attention > 1 ? 's' : ''} d’attention détaillé${attention > 1 ? 's' : ''} plus bas.` : 'Aucun incident à signaler.'}`, { taille: 10.5 });
  }

  if (d.lots.length) {
    titre('Avancement par lot');
    d.lots.forEach((l) => {
      place(8);
      police(10); doc.text(doc.splitTextToSize(textePDF(l.nom), 62)[0], M, y + 2.6);
      barre(M + 66, y, LU - 84, 3.2, num(l.avancement));
      police(10, true); doc.text(`${num(l.avancement)} %`, M + LU, y + 2.6, { align: 'right' });
      y += 7.5;
    });
  }

  titre('Travaux réalisés');
  if (!d.rapports.length) paragraphe('Aucun rapport de chantier sur cette période.', { couleur: GRIS });
  d.rapports.forEach((r) => {
    place(10);
    const lot = nomLot(r.lot_id);
    police(9.5, true, OR); doc.text(textePDF(`${jourLong(r.date_rapport)}${lot ? `  ·  ${lot}` : ''}${r.meteo ? `  ·  ${r.meteo}` : ''}`), M, y); y += 4.8;
    paragraphe(corrigerTexte(r.travaux).texte, { retrait: 0 });
    y += 2;
  });

  const incidents = d.rapports.filter((r) => r.incidents?.trim());
  titre('Points d’attention');
  if (!incidents.length) paragraphe('Aucun incident signalé sur cette période.', { couleur: GRIS });
  incidents.forEach((r) => { paragraphe(`${jourLong(r.date_rapport)} : ${corrigerTexte(r.incidents).texte}`); y += 1.5; });

  if (d.prochaines.length) {
    titre('En cours et à venir (15 prochains jours)');
    d.prochaines.forEach((t) => {
      const lot = nomLot(t.lot_id);
      paragraphe(`-  ${t.nom}${lot ? ` (${lot})` : ''} : du ${fdate(t.date_debut)} au ${fdate(t.date_fin)}`);
      y += 0.8;
    });
  }

  // Photos
  const url = await urlsPhotos(d.photos.map((p) => p.chemin));
  const images = (await Promise.all(d.photos.map(async (p) => {
    const u = url(p.chemin);
    const img = u ? await imagePourPDF(u, 1 / 0.72) : null;
    return img ? { ...img, date: p.date, legende: p.legende } : null;
  }))).filter(Boolean);
  if (images.length) {
    titre('Photos du chantier');
    const lp = (LU - 6) / 2, hp = lp * 0.72;
    for (let i = 0; i < images.length; i += 2) {
      place(hp + 13);
      images.slice(i, i + 2).forEach((im, j) => {
        const x = M + j * (lp + 6);
        doc.addImage(im.data, 'JPEG', x, y, lp, hp);
        police(8, false, GRIS);
        const leg = `${new Date(im.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}${im.legende ? ` - ${im.legende}` : ''}`;
        const lignes = doc.splitTextToSize(textePDF(leg), lp);
        doc.text(lignes.length > 1 ? `${lignes[0].replace(/\s+\S*$/, '')}...` : lignes[0], x, y + hp + 4.5);
      });
      y += hp + 10;
    }
  }

  // Pied de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...TRAIT); doc.setLineWidth(0.3); doc.line(M, H - 13, L - M, H - 13);
    police(8, false, GRIS);
    doc.text(textePDF(`${S.entreprise?.nom || ''}  ·  ${projet.nom}  ·  page ${i}/${n}`), M, H - 8);
    police(8, true, OR); doc.text('Rapport généré avec KOORDIN', L - M, H - 8, { align: 'right' });
  }
  return doc.output('blob');
}

function rapportClient(projet) {
  const m = ouvrirModale({
    titre: '📄 Rapport pour le client',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:12px">Un PDF clair et professionnel pour votre client : avancement, travaux, points d’attention, prochaines étapes et photos. <b>Aucune information financière</b> n’y figure.</p>
      <form id="f-rc" class="form-grid" novalidate>
        ${F.select('periode', 'Période', [['7j', 'Les 7 derniers jours'], ['semaine', 'Cette semaine (depuis lundi)'], ['precedente', 'La semaine dernière']], '7j', { full: true })}
        ${F.area('message', 'Message au client (facultatif)', '', { placeholder: 'Ex. Le coulage de la dalle du R+3 est prévu lundi. Merci pour votre confiance.' })}
        <label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="valides" style="width:auto"> N’inclure que les rapports validés</label>
      </form>
      <div class="rc-resultat hidden"></div>
      <div class="rc-relecture hidden"></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" id="rc-creer">👀 Préparer et relire</button></div>`,
  });
  const btn = $('#rc-creer', m.el);
  const zone = $('.rc-resultat', m.el);
  let lienPDF = null;
  m.el.addEventListener('click', (e) => { if ((e.target === m.el || e.target.closest('[data-close]')) && lienPDF) URL.revokeObjectURL(lienPDF); });
  const relecture = $('.rc-relecture', m.el);
  let donnees = null, etapeRelue = false;
  $('#f-rc', m.el).addEventListener('change', (e) => { if (e.target.name === 'periode' || e.target.name === 'valides') { etapeRelue = false; relecture.classList.add('hidden'); zone.classList.add('hidden'); btn.textContent = '👀 Préparer et relire'; btn.classList.add('primary'); } });
  btn.onclick = async () => {
    const d = lireFormulaire($('#f-rc', m.el));
    const { du, au } = periodeRapport(d.periode);
    btn.disabled = true;
    try {
      // Étape 1 : préparer et montrer les textes corrigés, à relire
      if (!etapeRelue) {
        btn.textContent = 'Préparation…';
        donnees = await donneesRapportClient(projet, { du, au, valides: !!d.valides });
        let n = 0;
        donnees.rapports.forEach((r) => { ['travaux', 'incidents'].forEach((k) => { if (r[k]) { const c = corrigerTexte(r[k]); n += c.n; r[`${k}_propre`] = c.texte; } }); });
        relecture.innerHTML = donnees.rapports.length ? `<div class="notice">👀 <b>Relisez ce que verra le client.</b> ${n ? `✨ ${n} correction${n > 1 ? 's' : ''} automatique${n > 1 ? 's' : ''} déjà faite${n > 1 ? 's' : ''}.` : ''} Vous pouvez modifier chaque texte.</div>
          ${donnees.rapports.map((r) => `<div class="rc-texte" data-rid="${r.id}"><b>${esc(parseDay(r.date_rapport).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</b>
            <textarea class="input" data-k="travaux" rows="3">${esc(r.travaux_propre || r.travaux || '')}</textarea>
            ${r.incidents ? `<small>Point d’attention (visible par le client)</small><textarea class="input" data-k="incidents" rows="2">${esc(r.incidents_propre || r.incidents)}</textarea>` : ''}</div>`).join('')}
          <label class="reunion-membre"><input type="checkbox" id="rc-enregistrer" checked><span><b>Enregistrer aussi ces corrections dans les rapports</b><small>Le texte d’origine du technicien reste consultable</small></span></label>`
          : '<div class="notice">Aucun rapport sur cette période : le PDF contiendra l’avancement, le planning et les photos.</div>';
        relecture.classList.remove('hidden');
        activerCorrecteurNavigateur(relecture);
        etapeRelue = true;
        btn.textContent = '📄 Créer le PDF';
        return;
      }
      // Étape 2 : reprendre les textes relus, les enregistrer si demandé, puis faire le PDF
      const aEnregistrer = [];
      $$('.rc-texte', relecture).forEach((bloc) => {
        const r = donnees.rapports.find((x) => x.id === bloc.dataset.rid); if (!r) return;
        const maj = {};
        $$('textarea', bloc).forEach((ta) => { const v = ta.value.trim(); if (v && v !== (r[ta.dataset.k] || '').trim()) maj[ta.dataset.k] = v; r[ta.dataset.k] = v || r[ta.dataset.k]; });
        if (Object.keys(maj).length) aEnregistrer.push([r.id, maj]);
      });
      if ($('#rc-enregistrer', relecture)?.checked && aEnregistrer.length) {
        btn.textContent = 'Enregistrement des corrections…';
        for (const [id, maj] of aEnregistrer) { try { await q(sb.from('rapports').update(maj).eq('id', id)); } catch (e) { console.warn('correction', e); } }
      }
      btn.textContent = donnees.photos.length ? 'Mise en page des photos…' : 'Mise en page…';
      const blob = await fabriquerPDFClient(projet, donnees, { du, au, message: d.message });
      const nom = `Rapport-${projet.nom}-${parseDay(au).toLocaleDateString('fr-FR')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.pdf';
      const fichier = new File([blob], nom, { type: 'application/pdf' });
      if (lienPDF) URL.revokeObjectURL(lienPDF);
      lienPDF = URL.createObjectURL(blob);
      const partage = navigator.canShare?.({ files: [fichier] });
      zone.innerHTML = `<div class="notice ok" style="margin:6px 0 4px">✅ Rapport prêt : ${donnees.rapports.length} rapport(s) de chantier, ${donnees.photos.length} photo(s).</div>
        <div class="rc-boutons">
          ${partage ? '<button type="button" class="btn primary" id="rc-partager">📤 Envoyer (WhatsApp…)</button>' : ''}
          <a class="btn ${partage ? '' : 'primary'}" href="${lienPDF}" download="${esc(nom)}">⬇️ Télécharger le PDF</a>
          <a class="btn ghost" href="${lienPDF}" target="_blank" rel="noopener">👁️ Voir</a>
        </div>`;
      zone.classList.remove('hidden');
      $('#rc-partager', zone)?.addEventListener('click', async () => {
        try {
          await navigator.share({ files: [fichier], title: nom, text: `Bonjour, voici le rapport d’avancement du chantier « ${projet.nom} ». Cordialement, ${S.entreprise?.nom || ''}` });
        } catch (err) { if (err?.name !== 'AbortError') toast('Le partage n’a pas fonctionné : téléchargez le PDF puis envoyez-le depuis WhatsApp.', 'warn', 6000); }
      });
      btn.textContent = '↻ Refaire le PDF';
      btn.classList.remove('primary');
    } catch (err) {
      console.error(err);
      toast(messageErreur(err), 'err', 6000);
      btn.textContent = etapeRelue ? '📄 Créer le PDF' : '👀 Préparer et relire';
    } finally {
      btn.disabled = false;
    }
  };
}

// ─────────────────────────────── Accès client (suivi en lecture seule) ───────────────────────────────
// Le client ouvre un lien secret (#/suivi/<jeton>) sans compte : avancement, planning,
// rapports validés et photos. Aucun montant, aucun incident interne, aucun nom d'ouvrier.

const lienSuivi = (jeton) => `${location.origin}${location.pathname}#/suivi/${jeton}`;

async function ecranSuiviClient(jeton) {
  document.title = 'Suivi de chantier — KOORDIN';
  const racine = $('#root');
  racine.innerHTML = `<div class="suivi"><div class="suivi-page">${loading()}</div></div>`;
  const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'koordin-suivi' },
  });
  let d = null, erreur = null;
  try {
    const { data, error } = await client.rpc('suivi_client', { p_jeton: jeton });
    if (error) throw error;
    d = data;
  } catch (e) { erreur = e; }
  const zone = $('.suivi-page', racine);
  if (!d) {
    zone.innerHTML = `<div class="suivi-entete"><div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div></div>
      <div class="card">${empty('🔒', erreur ? messageErreur(erreur) : 'Ce lien de suivi n’est plus valide. Demandez un nouveau lien à l’entreprise qui réalise votre chantier.')}</div>`;
    return;
  }
  const pr = d.projet;
  document.title = `${pr.nom} — Suivi de chantier`;
  const chemins = [pr.photo, ...d.rapports.flatMap((r) => r.photos || []), ...d.galerie.map((g) => g.chemin)].filter(Boolean);
  const urls = new Map();
  if (chemins.length) {
    const { data } = await client.storage.from('photos-chantier').createSignedUrls([...new Set(chemins)], 3600);
    (data || []).forEach((x) => { if (x.signedUrl) urls.set(x.path, x.signedUrl); });
  }
  const u = (c) => urls.get(c);
  const retard = num(pr.jours_de_retard);
  const ecart = pr.avancement_attendu != null ? pr.avancement_attendu - pr.avancement : 0;
  const etat = pr.statut === 'termine' ? ['muted', '🏁 Chantier terminé']
    : pr.statut === 'suspendu' ? ['warn', '⏸️ Chantier suspendu']
      : retard > 0 ? ['crit', `⏰ Fin prévue dépassée de ${retard} jour${retard > 1 ? 's' : ''}`]
        : ecart > 15 ? ['warn', '⚠️ En retard sur le planning'] : ecart > 5 ? ['warn', '⚠️ Léger retard'] : ['ok', '✅ Dans les temps'];
  const auj = todayISO();
  const encours = d.taches.filter((t) => t.avancement < 100 && t.date_debut <= auj);
  const avenir = d.taches.filter((t) => t.avancement < 100 && t.date_debut > auj).slice(0, 6);
  const finies = d.taches.filter((t) => t.avancement >= 100).length;
  const ligneTache = (t) => `<div class="suivi-tache"><div><b>${esc(t.nom)}</b><span>${esc([t.lot, `${fdate(t.date_debut)} → ${fdate(t.date_fin)}`].filter(Boolean).join(' · '))}</span></div>
    <div class="suivi-mini"><div class="suivi-barre"><i style="width:${num(t.avancement)}%"></i></div><b>${num(t.avancement)} %</b></div></div>`;

  if (d.couleur) appliquerMarque({ couleur_marque: d.couleur, nom: d.entreprise, logo: null });
  zone.innerHTML = `
    <div class="suivi-entete">
      <div class="brand">${d.logo ? `<img class="brand-logo" src="${esc(d.logo)}" alt="">` : '<div class="hex"></div>'}<div><div class="suivi-ent">${esc(d.entreprise)}</div><div class="suivi-sous">Suivi de votre chantier</div></div></div>
    </div>
    <section class="suivi-hero">
      ${pr.photo && u(pr.photo) ? `<img src="${esc(u(pr.photo))}" alt="">` : sceneChantier(empreinte(pr.nom))}
      <div class="cover-voile"></div>
      <div class="suivi-hero-txt">
        <span class="badge ${etat[0]}">${esc(etat[1])}</span>
        <h1>${esc(pr.nom)}</h1>
        <p>${esc([pr.client, pr.localisation].filter(Boolean).join(' · '))}</p>
      </div>
    </section>
    <div class="suivi-chiffres">
      <div class="kpi suivi-anneau">${anneau(pr.avancement, pr.avancement_attendu, 76)}<div><div class="kpi-label">Avancement réel</div><div class="kpi-foot">${pr.avancement_attendu != null ? `Prévu à ce jour : ${pr.avancement_attendu} %` : ''}</div></div></div>
      <div class="kpi"><div class="kpi-label">${pr.statut === 'termine' ? 'Terminé le' : 'Fin prévue'}</div><div class="kpi-value">${fdate(pr.statut === 'termine' ? pr.date_fin_reelle || pr.date_fin_prevue : pr.date_fin_prevue)}</div><div class="kpi-foot">Début : ${fdate(pr.date_debut)}</div></div>
    </div>
    ${d.lots.length ? `<section class="card"><div class="card-title">Avancement par lot</div>
      ${d.lots.map((l) => `<div class="suivi-lot"><span>${esc(l.nom)}</span><div class="suivi-barre"><i style="width:${num(l.avancement)}%"></i></div><b>${num(l.avancement)} %</b></div>`).join('')}</section>` : ''}
    ${encours.length || avenir.length ? `<section class="card"><div class="card-title">Planning <small>${finies} étape${finies > 1 ? 's' : ''} terminée${finies > 1 ? 's' : ''}</small></div>
      ${encours.length ? `<h4 class="suivi-h4">En cours</h4>${encours.map(ligneTache).join('')}` : ''}
      ${avenir.length ? `<h4 class="suivi-h4">À venir</h4>${avenir.map(ligneTache).join('')}` : ''}</section>` : ''}
    <section class="card"><div class="card-title">Journal du chantier</div>
      ${d.rapports.length ? d.rapports.slice(0, 15).map((r) => `<article class="suivi-rapport">
        <div class="suivi-rapport-tete">${esc(((j) => j.charAt(0).toUpperCase() + j.slice(1))(parseDay(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })))}${r.lot ? ` · ${esc(r.lot)}` : ''}${r.meteo ? ` · ${esc(r.meteo)}` : ''}</div>
        <p>${esc(r.travaux)}</p>
        ${(r.photos || []).filter(u).length ? `<div class="suivi-vignettes">${r.photos.filter(u).map((c) => `<button type="button" data-zoom="${esc(u(c))}"><img src="${esc(u(c))}" alt="Photo du ${fdate(r.date)}" loading="lazy"></button>`).join('')}</div>` : ''}
      </article>`).join('') : empty('📋', 'Les comptes rendus du chantier apparaîtront ici dès qu’ils auront été validés par l’entreprise.')}
    </section>
    ${d.galerie.filter((g) => u(g.chemin)).length ? `<section class="card"><div class="card-title">Photos</div><div class="suivi-galerie">
      ${d.galerie.filter((g) => u(g.chemin)).map((g) => `<button type="button" data-zoom="${esc(u(g.chemin))}"><img src="${esc(u(g.chemin))}" alt="${esc(g.legende || 'Photo du chantier')}" loading="lazy"></button>`).join('')}</div></section>` : ''}
    <footer class="suivi-pied">
      <p>Mis à jour le ${new Date(d.maj).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Ce lien est personnel : ne le partagez qu’avec les personnes concernées par ce chantier.</p>
      <p class="suivi-marque">Suivi de chantier propulsé par <b>KOORDIN</b></p>
    </footer>`;
  $$('[data-zoom]', zone).forEach((b) => (b.onclick = () => {
    const ov = document.createElement('div');
    ov.className = 'suivi-zoom';
    ov.innerHTML = `<img src="${esc(b.dataset.zoom)}" alt=""><button type="button" aria-label="Fermer">×</button>`;
    ov.onclick = () => ov.remove();
    document.body.appendChild(ov);
  }));
}

async function accesClient(projet) {
  const m = ouvrirModale({ titre: '👁️ Accès client', corps: `<div id="ac-zone">${loading()}</div>` });
  const zone = $('#ac-zone', m.el);
  const rendre = async () => {
    let liens;
    try {
      liens = await q(sb.from('liens_clients').select('*').eq('projet_id', projet.id).order('created_at', { ascending: false }));
    } catch (e) {
      zone.innerHTML = empty('👁️', /liens_clients/.test(String(e?.message)) ? 'Cette fonction nécessite la mise à jour 2.0 de la base de données : dans Supabase → SQL Editor, exécutez le fichier supabase/mise-a-jour-2.0.sql.' : messageErreur(e));
      return;
    }
    const lien = liens.find((l) => l.actif);
    if (!lien) {
      zone.innerHTML = `<p style="margin-bottom:12px">Donnez à votre client un lien pour suivre <b>${esc(projet.nom)}</b> depuis son téléphone, <b>sans compte et sans mot de passe</b>.</p>
        <ul class="ac-liste">
          <li>✅ Il voit : l’avancement, le planning, les comptes rendus <b>validés</b> et les photos.</li>
          <li>🔒 Il ne voit jamais : les montants, les commandes, les factures, les incidents internes ni les ouvriers.</li>
          <li>↩️ Vous pouvez couper le lien à tout moment.</li>
        </ul>
        ${liens.length ? '<p class="hint mt">L’ancien lien a été désactivé : il ne fonctionne plus.</p>' : ''}
        <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" id="ac-creer">🔗 Créer le lien client</button></div>`;
      $('#ac-creer', zone).onclick = async (e) => {
        e.target.disabled = true;
        try { await q(sb.from('liens_clients').insert({ projet_id: projet.id })); toast('Lien client créé ✅'); await rendre(); } catch (err) { toast(messageErreur(err), 'err'); e.target.disabled = false; }
      };
      return;
    }
    const url = lienSuivi(lien.jeton);
    const message = `Bonjour${projet.client ? ` ${projet.client}` : ''}, vous pouvez suivre l’avancement de votre chantier « ${projet.nom} » à tout moment (photos, planning, comptes rendus) sur ce lien : ${url}\n\n${S.entreprise?.nom || ''}`;
    zone.innerHTML = `<div class="notice ok">🔗 Le lien client est <b>actif</b>.${lien.visites ? ` Ouvert <b>${lien.visites} fois</b>, dernière visite ${ago(lien.derniere_visite)}.` : ' Pas encore ouvert par le client.'}</div>
      <label class="field full">Lien à envoyer<input class="input" id="ac-url" value="${esc(url)}" readonly></label>
      <div class="rc-boutons">
        <a class="btn primary" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">📲 Envoyer par WhatsApp</a>
        <button type="button" class="btn" id="ac-copier">📋 Copier le lien</button>
        <a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">👁️ Voir comme le client</a>
      </div>
      <p class="hint mt">Seuls les rapports <b>validés</b> sont visibles par le client : pensez à valider les rapports du terrain.</p>
      <div class="form-actions"><button type="button" class="btn danger" id="ac-couper">⛔ Couper ce lien</button><button type="button" class="btn ghost" data-close>Fermer</button></div>`;
    $('#ac-copier', zone).onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Lien copié ✅'); } catch { $('#ac-url', zone).select(); toast('Sélectionnez le lien puis copiez-le.', 'warn'); }
    };
    $('#ac-couper', zone).onclick = async () => {
      if (!(await confirmer('Couper ce lien ? Le client ne pourra plus voir le chantier. Vous pourrez créer un nouveau lien ensuite.', 'Couper le lien'))) return;
      try { await q(sb.from('liens_clients').update({ actif: false }).eq('id', lien.id)); toast('Lien coupé.'); await rendre(); } catch (err) { toast(messageErreur(err), 'err'); }
    };
  };
  await rendre();
}

// ─── Détail d'un projet ───

let ongletProjet = 'apercu';

PAGES.projet = async (id) => {
  const projet = await q(sb.from('v_projets').select('*').eq('id', id).maybeSingle());
  if (!projet) {
    page(`<div class="card">${empty('🔒', 'Projet introuvable ou non accessible.')}</div>`);
    return;
  }
  const tech = role() === 'technicien';
  const onglets = [
    ['apercu', 'Aperçu'], ['lots', tech ? 'Lots' : 'Lots et budget'], ['planning', 'Planning'],
    ...(can(...ROLES_RAPPORT) ? [['rapports', 'Rapports']] : []),
    ['equipe', 'Équipe'],
    ...(can('direction', 'coordinateur', 'achats', 'comptable', 'magasinier') ? [['achats', 'Achats et factures']] : []),
    ['galerie', '📷 Galerie'],
    ...(can('direction', 'coordinateur', 'technicien') && !DEMO ? [['controles', '✅ Contrôles'], ['reception', '🤝 Réception']] : []),
    ['communiques', 'Communiqués'],
  ];
  if (!onglets.some(([k]) => k === ongletProjet)) ongletProjet = 'apercu';
  const url = await urlsPhotos([couvertureDe(projet)]);
  const p = page(`
    <a class="back" href="#/projets">← ${tech ? 'Mes chantiers' : 'Projets'}</a>
    <section class="detail-cover">
      ${visuelProjet(projet, url(couvertureDe(projet)), { classe: 'dc-media' })}
      <div class="dc-contenu">
        <div class="pc-badges">${badge(SANTE[projet.sante])} ${badge(STATUT_PROJET[projet.statut])}</div>
        <h1 class="page-title">${esc(projet.nom)}</h1>
        <p>${esc([projet.reference, projet.client, projet.localisation].filter(Boolean).join(' · '))}</p>
      </div>
      <div class="dc-anneau">${anneau(projet.avancement, projet.avancement_attendu, 72)}</div>
      ${can('direction', 'coordinateur') ? `<label class="btn sm dc-photo">📷 ${projet.photo ? 'Changer la photo' : 'Ajouter une photo'}<input type="file" id="photo-p" accept="image/*" hidden></label>` : ''}
    </section>
    <div class="page-actions dc-actions">
      ${can(...ROLES_RAPPORT) && projet.statut !== 'termine' ? `<a class="btn" href="#/nouveau-rapport" data-projet-rapport="${projet.id}">➕ Rapport</a>` : ''}
      ${!DEMO ? '<button class="btn" id="film-p">🎬 Film du chantier</button><button class="btn" id="aa-p">↔️ Avant / Après</button><button class="btn" id="story-p">📱 Story de la semaine</button>' : ''}
      ${can('direction', 'coordinateur') ? '<button class="btn" id="rc-p">📄 Rapport client</button>' : ''}
      ${can('direction', 'coordinateur') && !DEMO ? '<button class="btn" id="ac-p">👁️ Accès client</button>' : ''}
      ${can('direction', 'coordinateur') ? '<button class="btn" id="edit-p">✏️ Modifier</button>' : ''}
      ${can('direction') ? '<button class="btn danger" id="del-p">Supprimer</button>' : ''}
    </div>
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletProjet ? 'active' : ''}" data-onglet="${k}">${l}</button>`).join('')}</div>
    <div id="onglet"></div>`);

  $('#edit-p', p)?.addEventListener('click', () => formulaireProjet(projet));
  $('#rc-p', p)?.addEventListener('click', () => rapportClient(projet));
  $('#film-p', p)?.addEventListener('click', () => filmChantier(projet));
  $('#aa-p', p)?.addEventListener('click', () => avantApres(projet));
  $('#story-p', p)?.addEventListener('click', () => storySemaine(projet.id));
  $('#ac-p', p)?.addEventListener('click', () => accesClient(projet));
  $('#photo-p', p)?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    toast('Envoi de la photo…', 'warn', 2500);
    try {
      const blob = await compresserImage(f, 1800, 0.82);
      const chemin = `${S.entreprise.id}/projets/${projet.id}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      await q(sb.from('projets').update({ photo: chemin }).eq('id', projet.id));
      await sb.from('projet_photos').insert({ projet_id: projet.id, chemin, legende: 'Photo de couverture' });
      toast('Photo du chantier enregistrée.');
      naviguer();
    } catch (err) {
      toast(/photo/.test(String(err?.message)) ? 'Cette fonction nécessite la mise à jour 1.5 de la base de données : dans Supabase → SQL Editor, exécutez le fichier supabase/mise-a-jour-1.5.sql.' : messageErreur(err), 'err', 7000);
    }
  });
  $('#del-p', p)?.addEventListener('click', async () => {
    if (!(await confirmer(`Supprimer définitivement « ${projet.nom} » et toutes ses données (lots, rapports, commandes, factures) ?`, 'Supprimer'))) return;
    try {
      await q(sb.from('projets').delete().eq('id', projet.id));
      toast('Projet supprimé.');
      allerA('#/projets');
    } catch (e) { toast(messageErreur(e), 'err'); }
  });
  $$('[data-onglet]', p).forEach((b) => (b.onclick = () => {
    ongletProjet = b.dataset.onglet;
    $$('[data-onglet]', p).forEach((x) => x.classList.toggle('active', x === b));
    rendreOngletProjet(projet);
  }));
  await rendreOngletProjet(projet);
};

async function rendreOngletProjet(projet) {
  const zone = $('#onglet');
  zone.innerHTML = loading();
  detruireGraphiques();
  const ONGLETS = { apercu: ongletApercu, lots: ongletLots, planning: ongletPlanning, rapports: ongletRapports, equipe: ongletEquipe, achats: ongletAchatsProjet, communiques: ongletCommuniques, galerie: ongletGalerie, reception: ongletReception, controles: ongletControles };
  try {
    await ONGLETS[ongletProjet](projet, zone);
  } catch (e) {
    console.error(e);
    zone.innerHTML = `<div class="card">${empty('⚠️', messageErreur(e))}</div>`;
  }
}

async function ongletApercu(projet, zone) {
  const tech = role() === 'technicien';
  const activites = await q(sb.from('activites').select('*').eq('projet_id', projet.id).order('created_at', { ascending: false }).limit(10));
  const consomme = Math.max(num(projet.engage), num(projet.facture));
  const ecart = projet.avancement_attendu != null ? projet.avancement - projet.avancement_attendu : null;
  zone.innerHTML = `
    <div class="grid k4">
      ${kpi('Avancement', `${projet.avancement} %`, ecart != null ? `Prévu : ${projet.avancement_attendu} % (${ecart >= 0 ? '+' : ''}${ecart} pts)` : '', ecart != null && ecart < -15 ? 'alert' : ecart != null && ecart < -5 ? 'warn' : '')}
      ${tech ? kpi('Début', fdate(projet.date_debut)) : kpi('Budget', moneyShort(projet.budget), `Engagé : ${moneyShort(projet.engage)}`)}
      ${tech ? kpi('Rapports à valider', projet.rapports_en_attente) : kpi('Consommé', `${pct(consomme, projet.budget)} %`, `Facturé : ${moneyShort(projet.facture)} · Payé : ${moneyShort(projet.paye)}`, pct(consomme, projet.budget) > 100 ? 'alert' : pct(consomme, projet.budget) > 90 ? 'warn' : '')}
      ${kpi('Fin prévue', fdate(projet.date_fin_prevue), projet.jours_de_retard > 0 ? `<span style="color:var(--crit)">⏱ ${projet.jours_de_retard} jours de retard</span>` : projet.date_fin_reelle ? `Terminé le ${fdate(projet.date_fin_reelle)}` : `Dernier rapport : ${fdate(projet.dernier_rapport)}`, projet.jours_de_retard > 0 ? 'alert' : '')}
    </div>
    <div class="grid c21 section">
      <div class="card"><div class="card-title">Fiche du projet</div>
        <div class="detail-grid">
          <div><span>Client</span><b>${esc(projet.client || '—')}</b></div>
          <div><span>Localisation</span><b>${esc(projet.localisation || '—')}</b></div>
          <div><span>Référence</span><b>${esc(projet.reference || '—')}</b></div>
          <div><span>Équipe affectée</span><b>${projet.equipe} personne(s)</b></div>
        </div>
        <div class="detail-block"><h4>Avancement (│ = prévu à date)</h4>${progressBar(projet.avancement, { attendu: projet.avancement_attendu })}</div>
        ${!tech ? `<div class="detail-block"><h4>Budget consommé</h4>${progressBar(pct(consomme, projet.budget), { cls: consoCls(consomme, projet.budget), label: pct(consomme, projet.budget) })}</div>` : ''}
        ${projet.description ? `<div class="detail-block"><h4>Spécificités</h4><p>${esc(projet.description)}</p></div>` : ''}
      </div>
      <div class="card"><div class="card-title">Activité du projet</div>${feedHTML(activites)}</div>
    </div>`;
}

async function ongletLots(projet, zone) {
  const tech = role() === 'technicien';
  const lots = await q(sb.from('v_budget_lots').select('*').eq('projet_id', projet.id).order('ordre'));
  const gerer = can('direction', 'coordinateur');
  const totalLots = lots.reduce((s, l) => s + num(l.budget), 0);
  zone.innerHTML = `<div class="card">
    <div class="card-title">Lots de travaux ${gerer ? '<button class="btn sm primary" id="add-lot">＋ Ajouter un lot</button>' : ''}</div>
    ${!tech && Math.round(totalLots) !== Math.round(num(projet.budget)) && lots.length ? `<div class="notice warn">La somme des budgets des lots (${money(totalLots)}) diffère du budget du projet (${money(projet.budget)}).</div>` : ''}
    ${lots.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Lot</th><th style="min-width:160px">Avancement</th>
      ${tech ? '' : '<th class="num">Budget</th><th class="num">Engagé</th><th class="num">Facturé</th><th class="num">Reste</th><th style="min-width:130px">Consommé</th>'}${gerer ? '<th></th>' : ''}</tr></thead><tbody>
      ${lots.map((l) => {
        const c = Math.max(num(l.engage), num(l.facture));
        const hors = num(l.budget) > 0 && c > num(l.budget);
        return `<tr class="${hors ? 'over' : ''}"><td><b>${esc(l.nom)}</b>${hors ? ' <span class="badge crit">🚨 Hors budget</span>' : ''}</td>
          <td>${progressBar(l.avancement)}</td>
          ${tech ? '' : `<td class="num">${money(l.budget)}</td><td class="num">${money(l.engage)}</td><td class="num">${money(l.facture)}</td>
          <td class="num" style="color:${hors ? 'var(--crit)' : 'inherit'}">${money(num(l.budget) - c)}</td>
          <td>${progressBar(pct(c, l.budget), { cls: consoCls(c, l.budget), label: pct(c, l.budget) })}</td>`}
          ${gerer ? `<td class="right"><button class="btn sm" data-edit-lot="${l.id}">Modifier</button></td>` : ''}</tr>`;
      }).join('')}
      ${tech ? '' : `<tr><td><b>Total</b></td><td></td><td class="num"><b>${money(totalLots)}</b></td><td class="num"><b>${money(lots.reduce((s, l) => s + num(l.engage), 0))}</b></td><td class="num"><b>${money(lots.reduce((s, l) => s + num(l.facture), 0))}</b></td><td></td><td></td>${gerer ? '<td></td>' : ''}</tr>`}
      </tbody></table></div>` : empty('🧱', 'Aucun lot. Ajoutez les lots de travaux (gros œuvre, électricité…) pour suivre l’avancement et le budget.')}
    <p class="muted mt" style="font-size:12px">L’avancement du projet est la moyenne des lots pondérée par leur budget. Il est mis à jour quand un rapport de chantier est validé.</p>
  </div>`;
  const form = (lot = null) => ouvrirModale({
    titre: lot ? `Modifier « ${lot.nom} »` : 'Nouveau lot',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom du lot', lot?.nom, { required: true, full: true })}
      ${F.text('budget', `Budget (${devise()})`, lot?.budget ?? 0, { type: 'number', min: 0, required: true })}
      ${F.text('avancement', 'Avancement (%)', lot?.avancement ?? 0, { type: 'number', min: 0, max: 100, required: true })}
      ${F.text('ordre', 'Ordre d’affichage', lot?.ordre ?? lots.length + 1, { type: 'number', min: 0 })}
    </div>${lot ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-lot">Supprimer ce lot</button></div>' : ''}`,
    onSubmit: async (d) => {
      const data = { nom: d.nom, budget: num(d.budget), avancement: Math.max(0, Math.min(100, Math.round(num(d.avancement)))), ordre: Math.round(num(d.ordre)) };
      if (lot) await q(sb.from('lots').update(data).eq('id', lot.id));
      else await q(sb.from('lots').insert({ ...data, projet_id: projet.id }));
      toast('Lot enregistré.');
      rendreOngletProjet(projet);
    },
    onOpen: (el) => $('#del-lot', el)?.addEventListener('click', async () => {
      if (!(await confirmer(`Supprimer le lot « ${lot.nom} » ? Les commandes et rapports liés seront conservés sans lot.`, 'Supprimer'))) return;
      try { await q(sb.from('lots').delete().eq('id', lot.id)); el.remove(); toast('Lot supprimé.'); rendreOngletProjet(projet); } catch (e) { toast(messageErreur(e), 'err'); }
    }),
  });
  $('#add-lot', zone)?.addEventListener('click', () => form());
  $$('[data-edit-lot]', zone).forEach((b) => (b.onclick = () => form(lots.find((l) => l.id === b.dataset.editLot))));
}

// ─── Planning (diagramme de Gantt) ───

function gantt(taches) {
  if (!taches.length) return empty('📅', 'Aucune tâche planifiée');
  const JOUR = 86400000;
  const auj = parseDay(todayISO()).getTime();
  const debuts = taches.map((t) => parseDay(t.date_debut).getTime());
  const fins = taches.map((t) => parseDay(t.date_fin).getTime());
  const debut = new Date(Math.min(...debuts, auj)); debut.setDate(1);
  const fin = new Date(Math.max(...fins, auj)); fin.setMonth(fin.getMonth() + 1, 0);
  const t0 = debut.getTime();
  const duree = (fin.getTime() - t0) / JOUR + 1;
  const pos = (ms) => (((ms - t0) / JOUR) / duree) * 100;
  const mois = [];
  for (const d = new Date(debut); d <= fin; d.setMonth(d.getMonth() + 1)) {
    const suiv = new Date(d); suiv.setMonth(suiv.getMonth() + 1);
    mois.push(`<div class="g-month" style="left:${pos(d.getTime())}%;width:${pos(suiv.getTime()) - pos(d.getTime())}%">${d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</div>`);
  }
  const ligneAuj = `<div class="g-today" style="left:${pos(auj)}%" title="Aujourd’hui"></div>`;
  const lignes = taches.map((t) => {
    const a = parseDay(t.date_debut).getTime();
    const b = parseDay(t.date_fin).getTime() + JOUR;
    const attendu = Math.max(0, Math.min(100, ((auj - a) / (b - a)) * 100));
    const etat = t.avancement >= 100 ? 'done' : b <= auj ? 'late' : attendu - t.avancement > 10 ? 'behind' : '';
    return `<div class="g-row">
      <div class="g-label"><b title="${esc(t.nom)}">${esc(t.nom)}</b><span>${esc(t.lots?.nom || '')}${t.profils?.nom ? ` · ${esc(t.profils.nom)}` : ''}</span></div>
      <div class="g-track">${ligneAuj}
        <div class="g-bar ${etat}" data-tache="${t.id}" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%" title="${esc(t.nom)} : ${fdate(t.date_debut)} → ${fdate(t.date_fin)} · ${t.avancement} %">
          <span style="width:${t.avancement}%"></span><em>${t.avancement} %</em></div></div></div>`;
  }).join('');
  return `<div class="gantt"><div class="gantt-inner">
      <div class="g-head"><div></div><div class="g-scale">${mois.join('')}</div></div>${lignes}</div></div>
    <div class="g-legend"><span><i style="background:var(--series-1)"></i>Dans les temps</span><span><i style="background:var(--warn)"></i>⚠️ En retard sur le prévu</span>
      <span><i style="background:var(--crit)"></i>🚨 Échéance dépassée</span><span><i style="background:var(--ok)"></i>✅ Terminé</span><span><i style="background:none;border-left:2px dashed var(--text);border-radius:0;width:2px"></i>Aujourd’hui</span></div>`;
}

async function ongletPlanning(projet, zone) {
  await chargerEquipe();
  const [taches, lots, affect] = await Promise.all([
    q(sb.from('taches').select('*, lots(nom), profils(nom)').eq('projet_id', projet.id).order('date_debut')),
    q(sb.from('lots').select('id, nom').eq('projet_id', projet.id).order('ordre')),
    q(sb.from('affectations').select('profil_id').eq('projet_id', projet.id)),
  ]);
  const gerer = can('direction', 'coordinateur');
  zone.innerHTML = `<div class="card"><div class="card-title">Planning des travaux ${gerer ? '<button class="btn sm primary" id="add-t">＋ Ajouter une tâche</button>' : ''}</div>
    ${gantt(taches)}${gerer && taches.length ? '<p class="muted mt" style="font-size:12px">Cliquez sur une barre pour la modifier.</p>' : ''}</div>`;
  const membres = S.equipe.filter((m) => affect.some((a) => a.profil_id === m.id) || ['direction', 'coordinateur'].includes(m.role));
  const form = (t = null) => ouvrirModale({
    titre: t ? 'Modifier la tâche' : 'Nouvelle tâche',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Tâche', t?.nom, { required: true, full: true, placeholder: 'Ex. Coulage dalle R+2' })}
      ${F.select('lot_id', 'Lot', lots.map((l) => [l.id, l.nom]), t?.lot_id, { vide: '— Aucun —' })}
      ${F.select('responsable_id', 'Responsable', membres.map((m) => [m.id, `${m.nom} (${ROLES[m.role].label})`]), t?.responsable_id, { vide: '— Aucun —' })}
      ${F.text('date_debut', 'Début', t?.date_debut || todayISO(), { type: 'date', required: true })}
      ${F.text('date_fin', 'Fin', t?.date_fin, { type: 'date', required: true })}
      ${F.text('avancement', 'Avancement (%)', t?.avancement ?? 0, { type: 'number', min: 0, max: 100 })}
    </div>${t ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-t">Supprimer la tâche</button></div>' : ''}`,
    onSubmit: async (d) => {
      if (d.date_fin < d.date_debut) throw new Error('La fin doit être après le début.');
      const data = { nom: d.nom, lot_id: d.lot_id, responsable_id: d.responsable_id, date_debut: d.date_debut, date_fin: d.date_fin, avancement: Math.max(0, Math.min(100, Math.round(num(d.avancement)))) };
      if (t) await q(sb.from('taches').update(data).eq('id', t.id));
      else await q(sb.from('taches').insert({ ...data, projet_id: projet.id }));
      toast('Planning mis à jour.');
      rendreOngletProjet(projet);
    },
    onOpen: (el) => $('#del-t', el)?.addEventListener('click', async () => {
      try { await q(sb.from('taches').delete().eq('id', t.id)); el.remove(); toast('Tâche supprimée.'); rendreOngletProjet(projet); } catch (e) { toast(messageErreur(e), 'err'); }
    }),
  });
  $('#add-t', zone)?.addEventListener('click', () => form());
  if (gerer) $$('[data-tache]', zone).forEach((b) => (b.onclick = () => form(taches.find((t) => t.id === b.dataset.tache))));
}

async function ongletRapports(projet, zone) {
  zone.innerHTML = '<div class="card" id="zone-rapports"></div>';
  await listeRapports($('#zone-rapports'), { projetId: projet.id });
}

async function ongletEquipe(projet, zone) {
  await chargerEquipe();
  const affect = await q(sb.from('affectations').select('profil_id, profils(nom, role, email, telephone)').eq('projet_id', projet.id));
  const gerer = can('direction', 'coordinateur');
  const dispo = S.equipe.filter((m) => m.actif && !affect.some((a) => a.profil_id === m.id));
  zone.innerHTML = `<div class="card"><div class="card-title">Équipe affectée au projet ${gerer && dispo.length ? '<button class="btn sm primary" id="add-a">＋ Affecter une personne</button>' : ''}</div>
    <div class="notice">Les techniciens ne voient que les chantiers auxquels ils sont affectés. Les autres rôles voient tous les projets.</div>
    ${affect.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Rôle</th><th>Contact</th>${gerer ? '<th></th>' : ''}</tr></thead><tbody>
      ${affect.map((a) => `<tr><td><b>${esc(a.profils?.nom)}</b></td><td>${ROLES[a.profils?.role]?.ico || ''} ${esc(ROLES[a.profils?.role]?.label || '')}</td>
        <td class="muted">${esc(afficherIdentifiant(a.profils?.email))}${a.profils?.telephone ? ` · ${esc(a.profils.telephone)}` : ''}</td>
        ${gerer ? `<td class="right"><button class="btn sm" data-retirer="${a.profil_id}">Retirer</button></td>` : ''}</tr>`).join('')}
    </tbody></table></div>` : empty('👥', 'Personne n’est encore affecté à ce projet')}</div>`;
  $('#add-a', zone)?.addEventListener('click', () => ouvrirModale({
    titre: 'Affecter au projet',
    corps: F.select('profil_id', 'Personne', dispo.map((m) => [m.id, `${m.nom} — ${ROLES[m.role].label}`]), '', { required: true, full: true }),
    boutonOk: 'Affecter',
    onSubmit: async (d) => {
      await q(sb.from('affectations').insert({ projet_id: projet.id, profil_id: d.profil_id }));
      toast('Personne affectée.');
      rendreOngletProjet(projet);
    },
  }));
  $$('[data-retirer]', zone).forEach((b) => (b.onclick = async () => {
    try {
      await q(sb.from('affectations').delete().eq('projet_id', projet.id).eq('profil_id', b.dataset.retirer));
      toast('Retiré du projet.');
      rendreOngletProjet(projet);
    } catch (e) { toast(messageErreur(e), 'err'); }
  }));
}

async function ongletAchatsProjet(projet, zone) {
  const voitFactures = can('direction', 'coordinateur', 'achats', 'comptable');
  const [commandes, factures] = await Promise.all([
    q(sb.from('commandes').select('*, projets(nom), fournisseurs(nom), lots(nom)').eq('projet_id', projet.id).order('date_commande', { ascending: false })),
    voitFactures ? q(sb.from('factures').select('*, projets(nom), fournisseurs(nom), lots(nom)').eq('projet_id', projet.id).order('date_facture', { ascending: false })) : [],
  ]);
  zone.innerHTML = `
    <div class="card"><div class="card-title">Commandes ${can('direction', 'achats') ? '<button class="btn sm primary" id="add-c">＋ Nouvelle commande</button>' : ''}</div>${tableauCommandes(commandes)}</div>
    ${voitFactures ? `<div class="card"><div class="card-title">Factures et dépenses ${can('direction', 'comptable') ? '<button class="btn sm primary" id="add-f">＋ Saisir une facture</button>' : ''}</div>${tableauFactures(factures)}</div>` : ''}`;
  const refresh = () => rendreOngletProjet(projet);
  brancherCommandes(zone, commandes, refresh);
  brancherFactures(zone, factures, refresh);
  $('#add-c', zone)?.addEventListener('click', () => formulaireCommande(null, refresh, projet.id));
  $('#add-f', zone)?.addEventListener('click', () => formulaireFacture(null, refresh, projet.id));
}

// ═══════════════════════════════ RAPPORTS ═══════════════════════════════

PAGES.rapports = async () => {
  const tech = role() === 'technicien';
  const projets = await listeProjets();
  const p = page(`
    ${entete(tech ? 'Mes rapports' : 'Rapports de chantier', tech ? 'Suivi de vos rapports envoyés' : 'Tous les rapports remontés du terrain', '<a class="btn primary" href="#/nouveau-rapport">➕ Nouveau rapport</a>')}
    <div class="card">
      <div class="toolbar">
        <select class="input" id="f-p"><option value="">Tous les projets</option>${projets.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select>
        <select class="input" id="f-s"><option value="">Tous les statuts</option>${can('direction') ? '<option value="attente" selected>📋 À valider (tout ce qui attend)</option>' : ''}${Object.entries(STATUT_RAPPORT).map(([k, [, l]]) => `<option value="${k}" ${!tech && !can('direction') && k === 'soumis' ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div id="zone-rapports"></div></div>`);
  const charger = () => listeRapports($('#zone-rapports', p), { projetId: $('#f-p', p).value || null, statut: $('#f-s', p).value || null, sansFiltre: true });
  $('#f-p', p).onchange = charger;
  $('#f-s', p).onchange = charger;
  await charger();
};

async function listeRapports(zone, { projetId = null, statut = null, sansFiltre = false } = {}) {
  zone.innerHTML = loading();
  let req = sb.from('rapports')
    .select('id, date_rapport, statut, travaux, incidents, effectif, meteo, avancement, created_at, projets(nom), lots(nom), auteur:profils!rapports_auteur_id_fkey(nom), rapport_photos(id)')
    .order('date_rapport', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (projetId) req = req.eq('projet_id', projetId);
  if (statut === 'attente') req = req.in('statut', ['soumis', 'pre_valide']);
  else if (statut) req = req.eq('statut', statut);
  const rapports = await q(req);
  try {
    const ids = rapports.map((r) => r.id);
    const vids = ids.length ? ((await sb.from('rapport_videos').select('rapport_id').in('rapport_id', ids)).data || []) : [];
    rapports.forEach((r) => { r.nb_videos = vids.filter((v) => v.rapport_id === r.id).length; });
  } catch { /* base pas encore mise à jour (3.11) */ }
  zone.innerHTML = (!sansFiltre ? `<div class="card-title">Rapports du projet <a class="btn sm primary" href="#/nouveau-rapport">➕ Nouveau rapport</a></div>` : '')
    + (rapports.length ? rapports.map((r) => `
    <div class="report card" data-rapport="${r.id}">
      <div class="avatar">${esc(initiales(r.auteur?.nom))}</div>
      <div class="r-body">
        <div class="r-title">${esc(r.projets?.nom)}${r.lots?.nom ? ` · ${esc(r.lots.nom)}` : ''} ${badge(STATUT_RAPPORT[r.statut])} ${r.incidents ? badge(['crit', '⚠️ Incident']) : ''}</div>
        <div class="r-meta">${fdate(r.date_rapport)} · ${esc(r.auteur?.nom)} · ${r.effectif ?? '—'} pers. · ${esc(r.meteo || '')}${r.avancement != null ? ` · ${r.avancement} %` : ''}${r.rapport_photos?.length ? ` · 📷 ${r.rapport_photos.length}` : ''}${r.nb_videos ? ` · 🎥 ${r.nb_videos}` : ''}</div>
        <div class="r-text">${esc(r.travaux)}</div>
      </div>
    </div>`).join('') : empty('📋', 'Aucun rapport pour ces critères'));
}

async function detailRapport(id) {
  const m = ouvrirModale({ titre: 'Rapport de chantier', large: true, corps: loading() });
  try {
    const champs = '*, projets(nom), lots(nom, avancement), auteur:profils!rapports_auteur_id_fkey(nom, email, telephone), validateur:profils!rapports_valide_par_fkey(nom), rapport_photos(chemin)';
    let r;
    try { r = await q(sb.from('rapports').select(`${champs}, verificateur:profils!rapports_pre_valide_par_fkey(nom)`).eq('id', id).single()); }
    catch { r = await q(sb.from('rapports').select(champs).eq('id', id).single()); } // base pas encore mise à jour (3.10)
    let urls = [], urlsVideos = [];
    if (r.rapport_photos?.length) {
      const { data } = await sb.storage.from('photos-chantier').createSignedUrls(r.rapport_photos.map((x) => x.chemin), 3600);
      urls = (data || []).map((x) => x.signedUrl).filter(Boolean);
    }
    try {
      const vids = (await sb.from('rapport_videos').select('chemin, duree').eq('rapport_id', r.id).order('created_at')).data || [];
      if (vids.length) {
        const { data } = await sb.storage.from('photos-chantier').createSignedUrls(vids.map((x) => x.chemin), 3600 * 3);
        urlsVideos = (data || []).map((x, i) => ({ url: x.signedUrl, duree: vids[i].duree })).filter((x) => x.url);
      }
    } catch { /* base pas encore mise à jour (3.11) */ }
    const dir = can('direction');
    const valider = (dir && ['soumis', 'pre_valide'].includes(r.statut)) || (can('coordinateur') && r.statut === 'soumis');
    $('.modal-body', m.el).innerHTML = `
      <div class="split" style="margin-bottom:14px;flex-wrap:wrap"><div><b style="font-size:16px">${esc(r.projets?.nom)}</b>${r.lots?.nom ? ` · ${esc(r.lots.nom)}` : ''}
        <div class="muted" style="font-size:12px">Par ${esc(r.auteur?.nom)} · envoyé ${ago(r.created_at)}</div></div>${badge(STATUT_RAPPORT[r.statut])}</div>
      <div class="detail-grid">
        <div><span>Date</span><b>${fdate(r.date_rapport)}</b></div>
        <div><span>Météo</span><b>${esc(r.meteo || '—')}</b></div>
        <div><span>Effectif</span><b>${r.effectif ?? '—'} pers.</b></div>
        <div><span>Avancement déclaré</span><b>${r.avancement != null ? `${r.avancement} %` : '—'}</b></div>
      </div>
      <div class="detail-block"><h4>Travaux réalisés</h4><p>${esc(r.travaux)}</p></div>
      ${r.incidents ? `<div class="detail-block"><h4>⚠️ Incidents / problèmes</h4><p style="color:var(--crit)">${esc(r.incidents)}</p></div>` : ''}
      ${r.besoins ? `<div class="detail-block"><h4>Besoins (matériaux, matériel, personnel)</h4><p>${esc(r.besoins)}</p></div>` : ''}
      ${urls.length ? `<div class="detail-block"><h4>Photos (${urls.length})</h4><div class="photos">${urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Photo de chantier" loading="lazy"></a>`).join('')}</div></div>` : ''}
      ${r.auteur_id === S.profil.id || can('direction', 'coordinateur') ? `<div class="detail-block"><label class="btn sm">📷 Ajouter des photos à ce rapport<input type="file" id="ajout-photos-rapport" accept="image/*" multiple hidden></label> <span class="hint" id="ajout-photos-etat"></span></div>` : ''}
      ${urlsVideos.length ? `<div class="detail-block"><h4>Vidéos (${urlsVideos.length})</h4><div class="medias-videos">${urlsVideos.map((v, i) => `<div class="video-pick lecture"><video src="${esc(v.url)}" controls playsinline preload="metadata"></video><div class="video-info"><b>🎥 Vidéo ${i + 1}</b><span>${v.duree ? dureeLisible(num(v.duree)) : ''}</span></div><a class="btn sm ghost" href="${esc(v.url)}" target="_blank" rel="noopener">⬇️ Ouvrir</a></div>`).join('')}</div></div>` : ''}
      ${r.corrige_le ? `<details class="texte-origine"><summary>✏️ Texte corrigé par ${esc(nomMembre(r.corrige_par))} ${ago(r.corrige_le)} · voir le texte d’origine</summary>${['travaux', 'incidents', 'besoins'].filter((k) => r.texte_original?.[k]).map((k) => `<p><b>${{ travaux: 'Travaux', incidents: 'Incidents', besoins: 'Besoins' }[k]} :</b> ${esc(r.texte_original[k])}</p>`).join('')}</details>` : ''}
      ${can('direction', 'coordinateur') ? '<div class="rc-boutons" style="margin-bottom:12px"><button type="button" class="btn sm" id="corriger-rapport">✏️ Corriger le texte</button></div>' : ''}
      ${circuitValidation(r)}
      ${valider ? `<div class="card" style="background:var(--surface-2)">
        ${dir ? '' : '<p class="muted" style="font-size:13px;margin-bottom:10px">Après votre vérification, le rapport part à la <b>Direction</b> pour la validation finale.</p>'}
        <label class="field">Commentaire (facultatif, obligatoire pour un rejet)<textarea id="com-val" placeholder="Ex. Merci, bon travail / Préciser les quantités…"></textarea></label>
        ${dir && r.lot_id && r.avancement != null ? `<p class="muted mt" style="font-size:12px">En validant, l’avancement du lot « ${esc(r.lots?.nom)} » passera de ${r.lots?.avancement} % à <b>${r.avancement} %</b>.</p>` : ''}
        <div class="form-actions"><button class="btn danger" id="rej">↩️ Rejeter</button><button class="btn primary" id="val">${dir ? '✅ Validation finale' : '🔎 Vérifié : envoyer à la Direction'}</button></div></div>` : ''}`;
    const decider = async (statut) => {
      const com = $('#com-val', m.el).value.trim();
      if (statut === 'rejete' && !com) return toast('Indiquez le motif du rejet.', 'warn');
      try {
        const maj = await q(sb.from('rapports').update({ statut, commentaire_validation: com || null }).eq('id', r.id).select('statut').single());
        m.fermer();
        naviguer();
        if (maj?.statut === 'pre_valide') toast('🔎 Rapport vérifié. La Direction est prévenue pour la validation finale.');
        else if (r.auteur_id !== S.profil.id) proposerWhatsAppRapport(r, statut, com);
        else toast(statut === 'valide' ? 'Rapport validé.' : 'Rapport rejeté.');
      } catch (e) {
        toast(/RAPPORT_FINAL/.test(String(e?.message)) ? 'Ce rapport a déjà reçu la validation finale de la Direction.' : /rapports_statut_check|pre_valide/.test(String(e?.message)) ? 'La validation en deux temps nécessite la mise à jour 3.10 de la base de données (kit d’installation).' : messageErreur(e), 'err', 7000);
      }
    };
    $('#val', m.el)?.addEventListener('click', () => decider(dir ? 'valide' : 'pre_valide'));
    $('#corriger-rapport', m.el)?.addEventListener('click', () => corrigerRapport(r, () => { m.fermer(); detailRapport(r.id); }));
    $('#ajout-photos-rapport', m.el)?.addEventListener('change', async (e) => {
      const fichiers = [...e.target.files]; e.target.value = '';
      if (!fichiers.length) return;
      const etat = $('#ajout-photos-etat', m.el);
      const blobs = [];
      for (let i = 0; i < fichiers.length; i++) { etat.textContent = `Préparation ${i + 1}/${fichiers.length}…`; blobs.push(await compresserImage(fichiers[i])); }
      try {
        const { echecs, raison } = await envoyerPhotosRapport(r.id, blobs, (i, n) => { etat.textContent = `Envoi ${i}/${n}…`; }, `ajout-${Date.now().toString(36)}`);
        toast(echecs ? `${blobs.length - echecs} photo(s) ajoutée(s), ${echecs} refusée(s) : ${raison}.` : `📷 ${blobs.length} photo${blobs.length > 1 ? 's' : ''} ajoutée${blobs.length > 1 ? 's' : ''} au rapport ✅`, echecs ? 'warn' : 'ok', 8000);
        m.fermer(); detailRapport(r.id);
      } catch (err) { etat.textContent = ''; toast(messageErreur(err), 'err', 7000); }
    });
    $('#rej', m.el)?.addEventListener('click', () => decider('rejete'));
  } catch (e) {
    $('.modal-body', m.el).innerHTML = empty('⚠️', messageErreur(e));
  }
}

// Circuit du rapport : Envoyé → Vérifié (chef de projet) → Validé (Direction)
function circuitValidation(r) {
  const fait = (x) => (x ? 'fait' : '');
  const rejete = r.statut === 'rejete';
  const verifie = r.pre_valide_at || r.statut === 'pre_valide' || (r.statut === 'valide' && r.pre_valide_at);
  const etapes = [
    ['📤', 'Envoyé', `${esc(r.auteur?.nom || '')} · ${ago(r.created_at)}`, 'fait'],
    ['🔎', 'Vérifié', r.pre_valide_at ? `${esc(r.verificateur?.nom || '—')} · ${ago(r.pre_valide_at)}${r.commentaire_pre_validation ? `<br>« ${esc(r.commentaire_pre_validation)} »` : ''}` : r.statut === 'valide' ? 'Validé directement par la Direction' : 'Chef de projet', r.statut === 'valide' ? 'fait' : fait(verifie)],
    rejete ? ['↩️', 'Rejeté', `${esc(r.validateur?.nom || '—')} ${r.valide_at ? `· ${ago(r.valide_at)}` : ''}${r.commentaire_validation ? `<br>« ${esc(r.commentaire_validation)} »` : ''}`, 'rejete']
      : ['✅', 'Validé', r.statut === 'valide' ? `${esc(r.validateur?.nom || '—')} · ${ago(r.valide_at)}${r.commentaire_validation ? `<br>« ${esc(r.commentaire_validation)} »` : ''}` : 'Direction (validation finale)', fait(r.statut === 'valide')],
  ];
  const enCours = r.statut === 'soumis' ? 1 : r.statut === 'pre_valide' ? 2 : -1;
  return `<div class="circuit">${etapes.map(([ic, t, s, cl], i) => `<div class="circuit-etape ${cl} ${i === enCours ? 'en-cours' : ''}"><span class="circuit-ic">${ic}</span><b>${t}</b><small>${s}</small></div>`).join('')}</div>`;
}

// Après une validation : prévenir l'auteur par WhatsApp en un geste
function numeroAuteur(profil) {
  const brut = profil?.telephone || (/^(\d{8,15})@tel\.koordin\.app$/.exec(profil?.email || '') || [])[1] || '';
  let n = String(brut).replace(/\D/g, '');
  if (n.length === 10 && n.startsWith('0')) n = `225${n}`; // numéro ivoirien saisi sans indicatif
  return n.length >= 8 ? n : '';
}
function proposerWhatsAppRapport(r, statut, commentaire) {
  const prenom = String(r.auteur?.nom || '').split(' ')[0];
  const quand = parseDay(r.date_rapport).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const message = statut === 'valide'
    ? `Bonjour ${prenom}, votre rapport du ${quand} sur « ${r.projets?.nom} » est définitivement validé ✅.${commentaire ? ` Commentaire : ${commentaire}` : ''}\n${S.profil.nom} (KOORDIN)`
    : `Bonjour ${prenom}, votre rapport du ${quand} sur « ${r.projets?.nom} » a été rejeté ↩️. Motif : ${commentaire}\nMerci de le corriger et d’envoyer un nouveau rapport dans KOORDIN.\n${S.profil.nom}`;
  const numero = numeroAuteur(r.auteur);
  const m = ouvrirModale({
    titre: statut === 'valide' ? '✅ Rapport validé' : '↩️ Rapport rejeté',
    corps: `<p style="margin-bottom:10px"><b>${esc(r.auteur?.nom || '')}</b> a reçu une alerte dans KOORDIN.</p>
      <p class="muted" style="font-size:13px;margin-bottom:12px">Voulez-vous aussi le prévenir sur WhatsApp ? Le message est déjà écrit${numero ? '' : ' (choisissez le contact dans WhatsApp : son numéro n’est pas connu)'}.</p>
      <div class="wa-apercu">${esc(message).replace(/\n/g, '<br>')}</div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Pas maintenant</button>
        <a class="btn primary" id="wa-envoyer" href="https://wa.me/${numero}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">📲 Prévenir par WhatsApp</a></div>`,
  });
  $('#wa-envoyer', m.el).addEventListener('click', () => setTimeout(() => m.fermer(), 300));
}

// ─── Nouveau rapport (pensé pour le téléphone) ───

async function compresserImage(fichier, max = 1600, qualite = 0.8) {
  const versJpeg = async (source, l, h) => {
    const k = Math.min(1, max / Math.max(l, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(l * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    const b = await new Promise((res) => c.toBlob(res, 'image/jpeg', qualite));
    c.width = c.height = 0; // libère la mémoire tout de suite
    return b;
  };
  try {
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const b = await versJpeg(bmp, bmp.width, bmp.height);
    bmp.close?.();
    if (b) return b;
  } catch { /* on essaie autrement */ }
  try {
    const u = URL.createObjectURL(fichier);
    const img = new Image(); img.src = u;
    await img.decode();
    const b = await versJpeg(img, img.naturalWidth, img.naturalHeight);
    URL.revokeObjectURL(u);
    if (b) return b;
  } catch { /* format illisible par le téléphone */ }
  return fichier;
}

// ═══════════════════════════════ 3.18 : CORRECTEUR DES RAPPORTS ═══════════════════════════════
// Correcteur gratuit, sans internet : accents oubliés des mots du chantier, abréviations SMS,
// ponctuation et majuscules à la française. Seuls des mots sans ambiguïté sont corrigés.
const CORRECTIONS_MOTS = {
  beton: 'béton', betons: 'bétons', betonnage: 'bétonnage', betonner: 'bétonner', betonne: 'bétonné', betonniere: 'bétonnière',
  feraillage: 'ferraillage', ferailleur: 'ferrailleur', ferailleurs: 'ferrailleurs', cofrage: 'coffrage', decoffrage: 'décoffrage', decoffre: 'décoffré',
  maconnerie: 'maçonnerie', macon: 'maçon', macons: 'maçons', elevation: 'élévation', elevations: 'élévations',
  chainage: 'chaînage', chainages: 'chaînages', etancheite: 'étanchéité', electricite: 'électricité', electricien: 'électricien', electriciens: 'électriciens',
  echafaudage: 'échafaudage', echafaudages: 'échafaudages', materiel: 'matériel', materiels: 'matériels', materiaux: 'matériaux',
  tole: 'tôle', toles: 'tôles', fenetre: 'fenêtre', fenetres: 'fenêtres', etage: 'étage', etages: 'étages', deblai: 'déblai', deblais: 'déblais',
  equipe: 'équipe', equipes: 'équipes', journee: 'journée', journees: 'journées', degats: 'dégâts', reparation: 'réparation', reparations: 'réparations',
  controle: 'contrôle', controles: 'contrôles', verification: 'vérification', verifications: 'vérifications', deja: 'déjà', tres: 'très', apres: 'après',
  premiere: 'première', deuxieme: 'deuxième', troisieme: 'troisième', quatrieme: 'quatrième', cinquieme: 'cinquième', etude: 'étude', securite: 'sécurité',
  probleme: 'problème', problemes: 'problèmes', pluviometrie: 'pluviométrie', meteo: 'météo', retard: 'retard', reception: 'réception',
  facade: 'façade', facades: 'façades', canalisation: 'canalisation', regard: 'regard', semelle: 'semelle', hourdis: 'hourdis', plafond: 'plafond',
  carrelage: 'carrelage', carlage: 'carrelage', peinture: 'peinture', menuiserie: 'menuiserie', serrurerie: 'serrurerie', plomberie: 'plomberie',
  evacuation: 'évacuation', evacuations: 'évacuations', ecoulement: 'écoulement', electrique: 'électrique', electriques: 'électriques',
  generateur: 'générateur', cable: 'câble', cables: 'câbles', gaine: 'gaine', gaines: 'gaines', debut: 'début', fondation: 'fondation',
  arretes: 'arrêtés', arret: 'arrêt', arrets: 'arrêts', realise: 'réalisé', realises: 'réalisés', realisee: 'réalisée', realisees: 'réalisées', termines: 'terminés', terminee: 'terminée', terminees: 'terminées', acheve: 'achevé', acheves: 'achevés', ouvrage: 'ouvrage', reservation: 'réservation', reservations: 'réservations', compacte: 'compacté', nivele: 'nivelé',
  // Abréviations SMS (le client doit lire un texte complet)
  rdc: 'RDC', pr: 'pour', pb: 'problème', pbs: 'problèmes', bcp: 'beaucoup', tjrs: 'toujours', tjs: 'toujours', ds: 'dans', qd: 'quand', ms: 'mais', pdt: 'pendant',
  tt: 'tout', ts: 'tous', qq: 'quelques', qqs: 'quelques', rdv: 'rendez-vous', mvt: 'mouvement', nbr: 'nombre', nb: 'nombre', qte: 'quantité', qtes: 'quantités',
};
const CORRECTIONS_EXPRESSIONS = [
  [/\brez de chauss[eé]e\b/gi, 'rez-de-chaussée'], [/\bb[eé]ton arm[eé]\b/gi, 'béton armé'], [/\bras\b(?=\s*[.!]?\s*$)/gi, 'rien à signaler'],
  [/\b[rR]\s*\+\s*(\d)\b/g, 'R+$1'], [/(\d\s*h(?:\d\d)?)\s+a\s+(\d)/gi, '$1 à $2'], [/\bdos[eé] a (\d)/gi, 'dosé à $1'], [/\bpr[eé] ?dalle\b/gi, 'prédalle'], [/\bpoteaux? b[eé]ton\b/gi, (m) => m.replace(/b[eé]ton/i, 'béton')],
];
const garderCasse = (modele, mot) => (modele === modele.toUpperCase() && modele.length > 1 ? mot.toUpperCase() : modele[0] === modele[0].toUpperCase() ? mot[0].toUpperCase() + mot.slice(1) : mot);
function corrigerTexte(texte) {
  if (!texte || !String(texte).trim()) return { texte: texte || '', n: 0 };
  let n = 0;
  let t = String(texte).replace(/\r/g, '');
  const compter = (avant, apres) => { if (avant !== apres) n++; return apres; };
  // Mots du chantier sans accents et abréviations
  t = t.replace(/[A-Za-zÀ-ÿ]+/g, (m) => {
    const bon = CORRECTIONS_MOTS[m.toLowerCase()];
    return bon && bon !== m.toLowerCase() ? compter(m, garderCasse(m, bon)) : m;
  });
  CORRECTIONS_EXPRESSIONS.forEach(([re, par]) => { t = t.replace(re, (...a) => compter(a[0], typeof par === 'function' ? par(a[0]) : a[0].replace(re, par))); });
  // Ponctuation à la française, espaces, majuscules
  const lignes = t.split('\n').map((l) => {
    let x = l.replace(/[ \t]+/g, ' ').trim();
    if (!x) return x;
    const avant = x;
    x = x.replace(/\s+([,.])/g, '$1')                    // pas d'espace avant , et .
      .replace(/([,.])(?=[A-Za-zÀ-ÿ])/g, '$1 ') // espace après , et . (2,5 reste intact)
      .replace(/\s*([;:!?])\s*/g, ' $1 ').replace(/\s+$/, '')   // espace avant ; : ! ?
      .replace(/([!?.])\1+/g, '$1').replace(/ {2,}/g, ' ')
      .replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase())
      .replace(/^[-–•]\s*([a-zà-ÿ])/, (m, b) => `- ${b.toUpperCase()}`);
    if (!/[.!?:)]$/.test(x) && x.length > 3 && !/^[-–•]/.test(x)) x += '.';
    if (x !== avant) n++;
    return x;
  });
  return { texte: lignes.join('\n').replace(/\n{3,}/g, '\n\n'), n };
}
// Corrige directement des champs de formulaire ; renvoie le nombre de corrections
function corrigerChamps(champs) {
  let total = 0;
  champs.forEach((c) => { if (!c) return; const r = corrigerTexte(c.value); if (r.n) { c.value = r.texte; total += r.n; c.dispatchEvent(new Event('input', { bubbles: true })); } });
  return total;
}
const activerCorrecteurNavigateur = (zone) => $$('textarea, input[type="text"]', zone).forEach((c) => { c.spellcheck = true; c.lang = 'fr'; c.autocapitalize = 'sentences'; });

// Direction / Coordination : relire et corriger un rapport (le texte d'origine est gardé)
function corrigerRapport(r, apres) {
  ouvrirModale({
    titre: '✏️ Corriger le rapport',
    large: true,
    boutonOk: 'Enregistrer la correction',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">Rapport de <b>${esc(r.auteur?.nom || '')}</b> du ${fdate(r.date_rapport)}. Le texte d’origine reste consultable, et ${esc(String(r.auteur?.nom || 'l’auteur').split(' ')[0])} est prévenu(e).</p>
      <button type="button" class="btn sm" id="cr-auto">✨ Correction automatique</button> <span class="hint" id="cr-etat"></span>
      <div class="form-grid" style="margin-top:10px">
        ${F.area('travaux', 'Travaux réalisés', r.travaux || '', { required: true })}
        ${F.area('incidents', 'Incidents, retards ou problèmes', r.incidents || '')}
        ${F.area('besoins', 'Besoins', r.besoins || '')}
      </div>`,
    onOpen: (ov) => {
      activerCorrecteurNavigateur(ov);
      $('#cr-auto', ov).onclick = () => { const n = corrigerChamps($$('textarea', ov)); $('#cr-etat', ov).textContent = n ? `✨ ${n} correction${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''} : relisez avant d’enregistrer.` : '✅ Rien à corriger automatiquement.'; };
    },
    onSubmit: async (d) => {
      try { await q(sb.from('rapports').update({ travaux: d.travaux, incidents: d.incidents || null, besoins: d.besoins || null }).eq('id', r.id)); }
      catch (e) { throw new Error(/texte_original|corrige_par/.test(String(e?.message)) ? 'La correction nécessite la mise à jour 3.18 de la base de données (kit d’installation).' : messageErreur(e)); }
      toast('✏️ Rapport corrigé. Le texte d’origine est gardé.');
      apres?.();
    },
  });
}

PAGES['nouveau-rapport'] = async () => {
  const projets = await avecCache('projets-actifs', () => q(sb.from('projets').select('id, nom, statut').neq('statut', 'termine').order('nom')));
  const cle = `koordin-brouillon-${S.profil.id}`;
  let brouillon = {};
  try { brouillon = JSON.parse(localStorage.getItem(cle) || '{}'); } catch { /* rien */ }
  const projetPrefere = memo.get('koordin-projet-rapport');
  memo.del('koordin-projet-rapport');
  const projetInitial = projetPrefere || brouillon.projet_id || (projets.length === 1 ? projets[0].id : '');
  const photos = [];
  const videos = [];

  if (!projets.length) {
    page(`${entete('Nouveau rapport')}<div class="card">${empty('🏗️', 'Vous n’êtes affecté à aucun chantier en cours. Demandez à votre coordinateur de vous ajouter à un projet.')}</div>`);
    return;
  }
  const p = page(`
    ${entete('Rapport de chantier', 'Remplissez-le sur place : il remonte immédiatement à la coordination et à la direction.')}
    ${navigator.onLine ? '' : '<div class="notice warn">📶 Hors ligne : remplissez votre rapport normalement, il sera gardé sur le téléphone puis envoyé tout seul au retour du réseau.</div>'}
    ${brouillon.travaux ? '<div class="notice">📝 Brouillon restauré : vos dernières saisies non envoyées ont été récupérées.</div>' : ''}
    <form class="card" id="f-rap" novalidate>
      <div class="form-grid">
        ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), projetInitial, { required: true, vide: '— Choisir —' })}
        <label class="field">Lot concerné<select name="lot_id" id="sel-lot"><option value="">— Général —</option></select></label>
        ${F.text('date_rapport', 'Date', brouillon.date_rapport || todayISO(), { type: 'date', required: true, max: todayISO() })}
        ${F.select('meteo', 'Météo', METEO.map((m) => [m, m]), brouillon.meteo || 'Ensoleillé')}
        ${F.text('effectif', 'Effectif présent (personnes)', brouillon.effectif, { type: 'number', min: 0, inputmode: 'numeric' })}
        <label class="field" id="bloc-av">Avancement du lot après cette journée : <b id="av-val">—</b>
          <input type="range" name="avancement" id="av" min="0" max="100" step="5" value="${esc(brouillon.avancement ?? 0)}" disabled>
          <span class="hint" id="av-hint">Choisissez un lot pour déclarer son avancement.</span></label>
        ${F.area('travaux', 'Travaux réalisés aujourd’hui', brouillon.travaux, { required: true, placeholder: 'Ex. Coulage des poteaux R+3 côté nord, pose des réservations électriques…' })}
        ${F.area('incidents', 'Incidents, retards ou problèmes (laisser vide si aucun)', brouillon.incidents, { placeholder: 'Ex. Pluie de 10 h à 13 h, panne bétonnière, absence de 3 ouvriers…' })}
        ${F.area('besoins', 'Besoins (matériaux, matériel, main-d’œuvre)', brouillon.besoins, { placeholder: 'Ex. 50 sacs de ciment pour jeudi, 2 ferrailleurs supplémentaires…' })}
        <div class="field full">Photos et vidéos du chantier <span class="medias-compte" id="medias-compte"></span>
          <div class="medias-boutons"><label class="btn">📷 Prendre une photo<input type="file" class="choix-photos" accept="image/*" capture="environment" hidden></label>
            <label class="btn">🖼️ Photos de la galerie<input type="file" class="choix-photos" accept="image/*" multiple hidden></label>
            <button type="button" class="btn" id="filmer">🎥 Filmer</button>
            <label class="btn">🎞️ Vidéo de la galerie<input type="file" id="choix-videos" accept="video/*" multiple hidden></label></div>
          <span class="hint">Autant de photos que vous voulez, compressées automatiquement. Vidéos : 3 minutes au plus quand vous filmez ici, 48 Mo au plus depuis la galerie (sinon KOORDIN la réduit).</span>
          <div class="photos mt" id="apercu-photos"></div><div class="medias-videos" id="apercu-videos"></div></div>
      </div>
      <div class="correcteur-barre"><button type="button" class="btn sm" id="corriger-texte">✨ Corriger mon texte</button><span class="hint" id="corriger-etat">Accents, ponctuation, abréviations : le texte est aussi corrigé à l’envoi.</span></div>
      <div class="form-actions"><button type="button" class="btn ghost" id="effacer">Effacer le brouillon</button><button class="btn primary" type="submit" id="envoyer">📤 Envoyer le rapport</button></div>
    </form>`);
  const form = $('#f-rap', p);
  activerCorrecteurNavigateur(form);
  $('#corriger-texte', p).onclick = () => {
    const n = corrigerChamps(['travaux', 'incidents', 'besoins'].map((k) => $(`[name="${k}"]`, form)));
    $('#corriger-etat', p).textContent = n ? `✨ ${n} correction${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''}. Relisez votre texte.` : '✅ Rien à corriger.';
  };
  const selProjet = $('[name="projet_id"]', form);
  const selLot = $('#sel-lot', p);
  const av = $('#av', p);
  let lots = [];

  const majAvancement = () => {
    const lot = lots.find((l) => l.id === selLot.value);
    av.disabled = !lot;
    $('#av-val', p).textContent = lot ? `${av.value} %` : '—';
    $('#av-hint', p).textContent = lot ? `Avancement actuel enregistré : ${lot.avancement} %` : 'Choisissez un lot pour déclarer son avancement.';
  };
  const chargerLots = async (garder) => {
    lots = selProjet.value ? await avecCache(`lots-${selProjet.value}`, () => q(sb.from('lots').select('id, nom, avancement').eq('projet_id', selProjet.value).order('ordre')), { defaut: [] }) : [];
    selLot.innerHTML = '<option value="">— Général —</option>' + lots.map((l) => `<option value="${l.id}" ${l.id === garder ? 'selected' : ''}>${esc(l.nom)} (${l.avancement} %)</option>`).join('');
    const lot = lots.find((l) => l.id === selLot.value);
    if (lot && !garder) av.value = lot.avancement;
    majAvancement();
  };
  const sauver = () => {
    const d = lireFormulaire(form);
    try { localStorage.setItem(cle, JSON.stringify(d)); } catch { /* rien */ }
  };
  selProjet.onchange = () => { chargerLots(null); sauver(); };
  selLot.onchange = () => { const lot = lots.find((l) => l.id === selLot.value); if (lot) av.value = lot.avancement; majAvancement(); sauver(); };
  av.oninput = () => { majAvancement(); sauver(); };
  form.addEventListener('input', sauver);
  await chargerLots(brouillon.lot_id);

  const compter = () => {
    const t = [photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : '', videos.length ? `${videos.length} vidéo${videos.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    $('#medias-compte', p).textContent = t ? `(${t})` : '';
  };
  const rendrePhotos = () => {
    $('#apercu-photos', p).innerHTML = photos.map((ph, i) => `<div class="photo-pick"><img src="${ph.url}" alt="Photo ${i + 1}"><button type="button" data-suppr="${i}" aria-label="Retirer">×</button></div>`).join('');
    $$('[data-suppr]', p).forEach((b) => (b.onclick = () => { URL.revokeObjectURL(photos[b.dataset.suppr].url); photos.splice(Number(b.dataset.suppr), 1); rendrePhotos(); }));
    compter();
  };
  const rendreVideos = () => {
    $('#apercu-videos', p).innerHTML = videos.map((v, i) => `<div class="video-pick"><video src="${v.url}" controls playsinline preload="metadata"></video>
      <div class="video-info"><b>🎥 Vidéo ${i + 1}</b><span>${v.duree ? dureeLisible(v.duree) + ' · ' : ''}${tailleLisible(v.blob.size)}</span></div><button type="button" class="btn sm ghost" data-suppr-video="${i}">Retirer</button></div>`).join('');
    $$('[data-suppr-video]', p).forEach((b) => (b.onclick = () => { URL.revokeObjectURL(videos[b.dataset.supprVideo].url); videos.splice(Number(b.dataset.supprVideo), 1); rendreVideos(); }));
    compter();
  };
  const ajouterPhotos = async (e) => {
    const fichiers = [...e.target.files];
    e.target.value = '';
    for (let i = 0; i < fichiers.length; i++) {
      if (fichiers.length > 3) $('#medias-compte', p).textContent = `(préparation ${i + 1}/${fichiers.length}…)`;
      const blob = await compresserImage(fichiers[i]);
      photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    rendrePhotos();
  };
  $$('.choix-photos', p).forEach((inp) => (inp.onchange = ajouterPhotos));
  const ajouterVideo = (v) => { if (!v?.blob) return; videos.push({ ...v, url: URL.createObjectURL(v.blob) }); rendreVideos(); };
  $('#filmer', p).onclick = async () => ajouterVideo(await filmerVideo());
  $('#choix-videos', p).onchange = async (e) => {
    const fichiers = [...e.target.files];
    e.target.value = '';
    for (const f of fichiers) {
      const lourde = f.size > VIDEO_MAX_OCTETS;
      let t = null;
      if (lourde) t = toast(`⏳ Vidéo de ${tailleLisible(f.size)} : réduction en cours, gardez l’écran allumé…`, 'warn', 600000);
      try { ajouterVideo(await preparerVideoGalerie(f, (x) => { $('#medias-compte', p).textContent = `(réduction de la vidéo ${Math.round(x * 100)} %…)`; })); }
      catch (err) { toast(err.message || 'Vidéo illisible.', 'err', 8000); }
      finally { t?.remove?.(); compter(); }
    }
  };
  $('#effacer', p).onclick = () => { try { localStorage.removeItem(cle); } catch { /* rien */ } naviguer(); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = lireFormulaire(form);
    const btn = $('#envoyer', p);
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    const rapport = {
      id: crypto.randomUUID(), projet_id: d.projet_id, lot_id: d.lot_id, date_rapport: d.date_rapport, meteo: d.meteo,
      effectif: d.effectif != null ? Math.round(num(d.effectif)) : null,
      travaux: corrigerTexte(d.travaux).texte, incidents: d.incidents ? corrigerTexte(d.incidents).texte : d.incidents, besoins: d.besoins ? corrigerTexte(d.besoins).texte : d.besoins,
      avancement: d.lot_id ? Math.round(num(av.value)) : null,
    };
    const blobs = photos.map((ph) => ph.blob);
    const vids = videos.map((v) => ({ blob: v.blob, duree: v.duree || null }));
    const garderSurTelephone = async () => {
      await ajouterEnvoi({ type: 'rapport', rapport, photos: blobs, videos: vids, libelle: projets.find((x) => x.id === d.projet_id)?.nom || '' });
      try { localStorage.removeItem(cle); } catch { /* rien */ }
      toast('📶 Pas de réseau : rapport enregistré sur le téléphone. Il partira tout seul dès que le réseau revient ✅', 'warn', 7000);
      majIndicateurReseau();
      allerA('#/rapports');
    };
    try {
      if (!navigator.onLine) { await garderSurTelephone(); return; }
      const { echecs, raison } = await envoyerRapport(rapport, blobs, (i, n) => { btn.textContent = `Envoi des photos ${i}/${n}…`; }, vids, (i, n) => { btn.textContent = `Envoi de la vidéo ${i}/${n}… (patientez)`; });
      try { localStorage.removeItem(cle); } catch { /* rien */ }
      if (echecs) {
        try { await ajouterEnvoi({ type: 'rapport', rapport, photos: blobs, videos: vids, libelle: projets.find((x) => x.id === d.projet_id)?.nom || '', erreur: raison }); } catch { /* stockage indisponible */ }
        majIndicateurReseau();
        toast(`Rapport envoyé, mais ${echecs} photo(s) ou vidéo(s) n’ont pas pu partir (${raison}). Elles sont gardées sur le téléphone et seront renvoyées automatiquement.`, 'warn', 10000);
      } else toast(`Rapport envoyé ✅ ${blobs.length ? `${blobs.length} photo${blobs.length > 1 ? 's' : ''}${vids.length ? ` et ${vids.length} vidéo${vids.length > 1 ? 's' : ''}` : ''}. ` : ''}La coordination est prévenue.`);
      allerA('#/rapports');
    } catch (err) {
      if (estErreurReseau(err)) {
        try { await garderSurTelephone(); return; } catch { /* stockage indisponible : on garde le brouillon */ }
      }
      toast(`${messageErreur(err)} Votre saisie est conservée en brouillon.`, 'err', 7000);
      btn.disabled = false;
      btn.textContent = '📤 Envoyer le rapport';
    }
  });
};

// ═══════════════════════════════ COMMUNIQUÉS ═══════════════════════════════
// Messages de la Direction ou de la Coordination à l'équipe, pour toute l'entreprise ou un chantier.
// Images rangées dans photos-chantier : <entreprise>/communiques/…

const SELECT_COMMUNIQUE = 'id, titre, contenu, important, photo, projet_id, created_at, projets(nom), profils(nom)';

function carteCommunique(c, url, gerer = false) {
  const img = url(c.photo);
  return `<article class="communique ${c.important ? 'important' : ''}">
    ${img ? `<a class="communique-photo" href="${esc(img)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Image du communiqué ${esc(c.titre)}" loading="lazy"></a>` : ''}
    <div class="communique-corps">
      <div class="communique-tete">${c.important ? '<span class="badge crit">📌 Important</span>' : ''}${badge(['muted', c.projet_id ? `🏗️ ${c.projets?.nom || 'Chantier'}` : '🏢 Toute l’entreprise'])}</div>
      <h3>${esc(c.titre)}</h3>
      ${c.contenu ? `<p>${esc(c.contenu).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="communique-pied">${esc(c.profils?.nom || '—')} · ${ago(c.created_at)}${gerer ? ` <button class="btn sm ghost" type="button" data-suppr-communique="${c.id}">Supprimer</button>` : ''}</div>
    </div>
  </article>`;
}

async function listeCommuniques(zone, { projetId = null } = {}) {
  const gerer = can('direction', 'coordinateur');
  let req = sb.from('communiques').select(SELECT_COMMUNIQUE).order('created_at', { ascending: false }).limit(60);
  if (projetId) req = req.eq('projet_id', projetId);
  const { data, error } = await req;
  if (error) { zone.innerHTML = `<div class="card">${empty('📢', messageErreur(error))}</div>`; return; }
  const liste = [...data].sort((a, b) => Number(b.important) - Number(a.important));
  const url = await urlsPhotos(liste.map((c) => c.photo));
  zone.innerHTML = `${gerer ? '<div class="right" style="margin-bottom:12px"><button class="btn primary" id="ncom" type="button">📢 Nouveau communiqué</button></div>' : ''}
    ${liste.length ? `<div class="communiques">${liste.map((c) => carteCommunique(c, url, gerer)).join('')}</div>`
      : `<div class="card">${empty('📢', projetId ? 'Aucun communiqué pour ce chantier.' : 'Aucun communiqué pour le moment.')}</div>`}`;
  const refresh = () => listeCommuniques(zone, { projetId });
  $('#ncom', zone)?.addEventListener('click', () => formulaireCommunique({ projetId, refresh }));
  $$('[data-suppr-communique]', zone).forEach((b) => (b.onclick = async () => {
    const c = liste.find((x) => x.id === b.dataset.supprCommunique);
    if (!(await confirmer(`Supprimer le communiqué « ${c.titre} » ?`, 'Supprimer'))) return;
    try {
      await q(sb.from('communiques').delete().eq('id', c.id));
      if (c.photo) sb.storage.from('photos-chantier').remove([c.photo]);
      toast('Communiqué supprimé.');
      refresh();
    } catch (e) { toast(messageErreur(e), 'err'); }
  }));
}

async function formulaireCommunique({ projetId = null, refresh }) {
  const projets = projetId ? [] : (await listeProjets()).filter((x) => x.statut !== 'termine');
  let image = null;
  ouvrirModale({
    titre: 'Nouveau communiqué',
    large: true,
    boutonOk: 'Publier',
    corps: `<div class="form-grid">
      ${F.text('titre', 'Titre', '', { required: true, full: true, placeholder: 'Ex. Réunion de chantier vendredi à 8 h' })}
      ${F.area('contenu', 'Message', '', { placeholder: 'Détails, consignes, informations pour l’équipe…' })}
      ${projetId ? '' : F.select('projet_id', 'Pour qui ?', [['', '🏢 Toute l’entreprise'], ...projets.map((x) => [x.id, `🏗️ ${x.nom}`])], '', { full: true })}
      <label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="important" style="width:auto"> 📌 Communiqué important (affiché en premier)</label>
      <div class="field full">Image ou affiche (facultatif)
        <label class="btn" style="width:max-content">📷 Ajouter une image<input type="file" id="c-image" accept="image/*" hidden></label>
        <div class="photos mt" id="c-apercu"></div></div>
    </div>`,
    onOpen: (ov) => {
      $('#c-image', ov).onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        image = await compresserImage(f, 1920, 0.82);
        $('#c-apercu', ov).innerHTML = `<div class="photo-pick"><img src="${URL.createObjectURL(image)}" alt="Aperçu de l’image"><button type="button" id="c-retirer" aria-label="Retirer">×</button></div>`;
        $('#c-retirer', ov).onclick = () => { image = null; $('#c-apercu', ov).innerHTML = ''; };
      };
    },
    onSubmit: async (d) => {
      let photo = null;
      if (image) {
        photo = `${S.entreprise.id}/communiques/${Date.now()}.jpg`;
        const { error } = await sb.storage.from('photos-chantier').upload(photo, image, { contentType: 'image/jpeg' });
        if (error) throw error;
      }
      await q(sb.from('communiques').insert({ titre: d.titre, contenu: d.contenu, projet_id: projetId || d.projet_id || null, important: !!d.important, photo }));
      toast('Communiqué publié 📢');
      refresh?.();
    },
  });
}

PAGES.communiques = async () => {
  const p = page(`${entete('Communiqués', 'Informations et consignes pour toute l’équipe')}<div id="zone-communiques"></div>`);
  await listeCommuniques($('#zone-communiques', p));
};

async function ongletCommuniques(projet, zone) {
  await listeCommuniques(zone, { projetId: projet.id });
}

// ─── Galerie photo du projet ───
// Photos ajoutées directement + photos des rapports du terrain, rangées par mois.

async function ongletGalerie(projet, zone) {
  const ajouter = can('direction', 'coordinateur', 'technicien') && !DEMO;
  const gerer = can('direction', 'coordinateur');
  const { data, error } = await sb.rpc('galerie_projet', { p_projet: projet.id });
  if (error) { zone.innerHTML = `<div class="card">${empty('📷', messageErreur(error))}</div>`; return; }
  const photos = data || [];
  const url = await urlsPhotos(photos.map((x) => x.chemin));
  const visibles = photos.filter((x) => url(x.chemin));
  let filtre = 'toutes';

  const rendre = () => {
    const liste = visibles.filter((x) => filtre === 'toutes' || x.source === filtre);
    const mois = new Map();
    liste.forEach((x, i) => {
      const cle = new Date(x.date_photo).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!mois.has(cle)) mois.set(cle, []);
      mois.get(cle).push(i);
    });
    const nb = (src) => visibles.filter((x) => src === 'toutes' || x.source === src).length;
    zone.innerHTML = `<div class="galerie-barre">
        <div class="galerie-filtres">${[['toutes', 'Toutes'], ['galerie', 'Ajoutées'], ['rapport', 'Des rapports']].map(([k, l]) => `<button type="button" class="chip-filtre ${k === filtre ? 'actif' : ''}" data-filtre="${k}">${l} <b>${nb(k)}</b></button>`).join('')}</div>
        <span class="galerie-actions">${visibles.length > 1 && !DEMO ? '<button type="button" class="btn" id="g-film">🎬 Film</button><button type="button" class="btn" id="g-aa">↔️ Avant / Après</button>' : ''}
        ${ajouter ? '<label class="btn primary">📷 Ajouter des photos<input type="file" id="g-ajout" accept="image/*" multiple hidden></label>' : ''}</span>
      </div>
      ${liste.length ? [...mois].map(([m, idx]) => `<section class="galerie-mois"><h4>${esc(m.charAt(0).toUpperCase() + m.slice(1))} <span class="muted">· ${idx.length} photo${idx.length > 1 ? 's' : ''}</span></h4>
        <div class="galerie">${idx.map((i) => `<button type="button" class="galerie-vignette" data-i="${i}" aria-label="Agrandir la photo du ${fdate(liste[i].date_photo)}">
          <img src="${esc(url(liste[i].chemin))}" alt="" loading="lazy">${liste[i].source === 'rapport' ? '<span class="galerie-tag">📋</span>' : ''}</button>`).join('')}</div></section>`).join('')
      : `<div class="card">${empty('📷', photos.length ? 'Aucune photo dans ce filtre.' : 'Aucune photo pour ce chantier. Les photos ajoutées ici et celles des rapports du terrain s’afficheront dans la galerie.')}</div>`}`;
    $$('[data-filtre]', zone).forEach((b) => (b.onclick = () => { filtre = b.dataset.filtre; rendre(); }));
    $$('[data-i]', zone).forEach((b) => (b.onclick = () => visionneuse(liste, Number(b.dataset.i))));
    $('#g-ajout', zone)?.addEventListener('change', (e) => envoyerGalerie([...e.target.files]));
    $('#g-film', zone)?.addEventListener('click', () => filmChantier(projet));
    $('#g-aa', zone)?.addEventListener('click', () => avantApres(projet));
  };

  const envoyerGalerie = (fichiers) => {
    if (!fichiers.length) return;
    ouvrirModale({
      titre: `Ajouter ${fichiers.length} photo${fichiers.length > 1 ? 's' : ''} à la galerie`,
      boutonOk: 'Envoyer',
      corps: `<div class="form-grid">${F.text('legende', 'Légende (facultatif)', '', { full: true, placeholder: 'Ex. Coulage de la dalle du R+2' })}
        <p class="hint full">Les photos sont compressées automatiquement pour économiser vos données mobiles.</p></div>`,
      onSubmit: async (d, form) => {
        const btn = $('button[type="submit"]', form);
        let echecs = 0;
        for (let i = 0; i < fichiers.length; i++) {
          btn.textContent = `Envoi ${i + 1}/${fichiers.length}…`;
          try {
            const blob = await compresserImage(fichiers[i], 1920, 0.82);
            const chemin = `${S.entreprise.id}/galerie/${projet.id}/${Date.now()}-${i + 1}.jpg`;
            const { error: e1 } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: 'image/jpeg' });
            if (e1) throw e1;
            await q(sb.from('projet_photos').insert({ projet_id: projet.id, chemin, legende: d.legende }));
          } catch (err) {
            echecs++;
            if (echecs === fichiers.length) { btn.textContent = 'Envoyer'; throw err; }
          }
        }
        toast(echecs ? `${fichiers.length - echecs} photo(s) ajoutée(s), ${echecs} en échec.` : 'Photos ajoutées à la galerie 📷', echecs ? 'warn' : 'ok');
        ongletGalerie(projet, zone);
      },
    });
  };

  const visionneuse = (liste, depart) => {
    let i = depart;
    const ov = document.createElement('div');
    ov.className = 'visionneuse';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    const fermer = () => { ov.remove(); document.removeEventListener('keydown', clavier); };
    const aller = (d) => { i = (i + d + liste.length) % liste.length; afficher(); };
    const clavier = (e) => { if (e.key === 'Escape') fermer(); else if (e.key === 'ArrowLeft') aller(-1); else if (e.key === 'ArrowRight') aller(1); };
    const afficher = () => {
      const x = liste[i];
      const lien = url(x.chemin);
      const supprimable = x.source === 'galerie' && (gerer || x.auteur_id === S.profil.id) && !DEMO;
      ov.innerHTML = `<div class="vis-haut"><span>${i + 1} / ${liste.length}</span><button type="button" class="vis-fermer" aria-label="Fermer">×</button></div>
        <div class="vis-image">${liste.length > 1 ? '<button type="button" class="vis-nav vis-prec" aria-label="Photo précédente">‹</button>' : ''}
          <img src="${esc(lien)}" alt="${esc(x.legende || 'Photo du chantier')}">
          ${liste.length > 1 ? '<button type="button" class="vis-nav vis-suiv" aria-label="Photo suivante">›</button>' : ''}</div>
        <div class="vis-bas">
          <div class="vis-infos">${x.legende ? `<b>${esc(x.legende)}</b>` : ''}
            <span>${x.source === 'rapport' ? '📋 Rapport du ' : '📷 Ajoutée le '}${fdate(x.date_photo)} · ${esc(x.auteur || '—')}</span></div>
          <div class="vis-actions">
            <a class="btn sm" href="${esc(lien)}" target="_blank" rel="noopener" download>⬇️ Télécharger</a>
            ${x.source === 'rapport' && (can('direction', 'coordinateur') || x.auteur_id === S.profil.id) ? '<button type="button" class="btn sm" id="vis-rapport">📋 Voir le rapport</button>' : ''}
            ${gerer && !DEMO ? '<button type="button" class="btn sm" id="vis-couv">🖼️ Mettre en couverture</button>' : ''}
            ${supprimable ? '<button type="button" class="btn sm danger" id="vis-suppr">Supprimer</button>' : ''}
          </div></div>`;
      $('.vis-fermer', ov).onclick = fermer;
      $('.vis-prec', ov)?.addEventListener('click', () => aller(-1));
      $('.vis-suiv', ov)?.addEventListener('click', () => aller(1));
      $('#vis-rapport', ov)?.addEventListener('click', () => { fermer(); detailRapport(x.rapport_id); });
      $('#vis-couv', ov)?.addEventListener('click', async () => {
        try {
          await q(sb.from('projets').update({ photo: x.chemin }).eq('id', projet.id));
          toast('Photo de couverture mise à jour.');
          fermer();
          naviguer();
        } catch (e) { toast(messageErreur(e), 'err'); }
      });
      $('#vis-suppr', ov)?.addEventListener('click', async () => {
        if (!(await confirmer('Supprimer cette photo de la galerie ?', 'Supprimer'))) return;
        try {
          await q(sb.from('projet_photos').delete().eq('id', x.id));
          if (projet.photo !== x.chemin) sb.storage.from('photos-chantier').remove([x.chemin]);
          toast('Photo supprimée.');
          fermer();
          ongletGalerie(projet, zone);
        } catch (e) { toast(messageErreur(e), 'err'); }
      });
    };
    // Glisser le doigt pour passer d'une photo à l'autre
    let x0 = null;
    ov.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) aller(dx < 0 ? 1 : -1); x0 = null; });
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.classList.contains('vis-image')) fermer(); });
    document.addEventListener('keydown', clavier);
    afficher();
    document.body.appendChild(ov);
  };

  rendre();
}

// Encart « Communiqués récents » en haut du tableau de bord (30 derniers jours)
async function encartCommuniques() {
  const pg = $('#main .page');
  const depuis = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await sb.from('communiques').select(SELECT_COMMUNIQUE).gte('created_at', depuis).order('created_at', { ascending: false }).limit(3);
  if (error || !data?.length || !pg?.isConnected) return;
  const url = await urlsPhotos(data.map((c) => c.photo));
  const bloc = document.createElement('div');
  bloc.className = 'card section';
  bloc.innerHTML = `<div class="card-title">📢 Communiqués récents <small><a href="#/communiques">Tout voir</a></small></div>
    <div class="communiques compact">${data.map((c) => carteCommunique(c, url)).join('')}</div>`;
  const ancre = $('.hero, .page-head', pg);
  if (ancre) ancre.after(bloc); else pg.prepend(bloc);
}

// ═══════════════════════════════ ACHATS ═══════════════════════════════

let ongletAchats = 'commandes';

function tableauCommandes(commandes, { compact = false } = {}) {
  if (!commandes.length) return empty('🛒', 'Aucune commande');
  const gerer = can('direction', 'achats');
  const reception = can('direction', 'achats', 'magasinier');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Désignation</th>${compact ? '' : '<th>Projet / lot</th><th>Fournisseur</th>'}<th class="num">Montant</th><th>Statut</th><th></th></tr></thead><tbody>
    ${commandes.map((c) => `<tr><td class="nowrap">${fdate(c.date_commande)}</td>
      <td><b>${esc(c.designation)}</b><div class="muted" style="font-size:12px">${esc([c.reference, compact ? c.projets?.nom : null].filter(Boolean).join(' · '))}</div></td>
      ${compact ? '' : `<td>${esc(c.projets?.nom || '')}<div class="muted" style="font-size:12px">${esc(c.lots?.nom || '')}</div></td><td>${esc(c.fournisseurs?.nom || '—')}</td>`}
      <td class="num">${money(c.montant)}</td><td>${badge(STATUT_COMMANDE[c.statut])}</td>
      <td class="right nowrap">${reception && c.statut === 'commandee' ? `<button class="btn sm" data-recevoir="${c.id}">📥 Réceptionner</button>` : ''}
        ${gerer ? `<button class="btn sm" data-edit-cmd="${c.id}">Modifier</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function brancherCommandes(zone, commandes, refresh) {
  $$('[data-recevoir]', zone).forEach((b) => (b.onclick = async () => {
    try {
      await q(sb.rpc('receptionner_commande', { p_commande: b.dataset.recevoir }));
      toast('Commande réceptionnée. Pensez à enregistrer l’entrée en stock si besoin.');
      refresh();
    } catch (e) { toast(messageErreur(e), 'err'); }
  }));
  $$('[data-edit-cmd]', zone).forEach((b) => (b.onclick = () => formulaireCommande(commandes.find((c) => c.id === b.dataset.editCmd), refresh)));
}

async function formulaireCommande(cmd, refresh, projetId = null) {
  const [projets, fournisseurs] = await Promise.all([listeProjets(), listeFournisseurs()]);
  const v = cmd || { projet_id: projetId, statut: 'commandee', date_commande: todayISO() };
  let lots = [];
  ouvrirModale({
    titre: cmd ? 'Modifier la commande' : 'Nouvelle commande',
    large: true,
    corps: `<div class="form-grid">
      ${F.select('projet_id', 'Projet', projets.filter((x) => x.statut !== 'termine' || x.id === v.projet_id).map((x) => [x.id, x.nom]), v.projet_id, { required: true, vide: '— Choisir —' })}
      <label class="field">Lot<select name="lot_id" id="c-lot"><option value="">— Sans lot —</option></select><span class="hint" id="c-reste"></span></label>
      ${F.text('designation', 'Désignation', v.designation, { required: true, full: true, placeholder: 'Ex. Ciment CPJ 42.5 — 500 sacs' })}
      ${F.select('fournisseur_id', 'Fournisseur', fournisseurs.map((f) => [f.id, f.nom]), v.fournisseur_id, { vide: '— Aucun —' })}
      ${F.text('reference', 'N° de bon de commande', v.reference)}
      ${F.text('montant', `Montant (${devise()})`, v.montant, { type: 'number', min: 0, required: true, inputmode: 'numeric' })}
      ${F.text('date_commande', 'Date', v.date_commande, { type: 'date', required: true })}
      ${F.select('statut', 'Statut', Object.entries(STATUT_COMMANDE).map(([k, [, l]]) => [k, l]), v.statut)}
    </div>
    <div id="c-alerte"></div>
    ${cmd ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-c">Supprimer la commande</button></div>' : ''}`,
    onSubmit: async (d) => {
      const data = { projet_id: d.projet_id, lot_id: d.lot_id, designation: d.designation, fournisseur_id: d.fournisseur_id, reference: d.reference, montant: num(d.montant), date_commande: d.date_commande, statut: d.statut };
      if (cmd) await q(sb.from('commandes').update(data).eq('id', cmd.id));
      else await q(sb.from('commandes').insert(data));
      toast('Commande enregistrée. Le budget du projet est mis à jour.');
      refresh();
    },
    onOpen: (el) => {
      const sp = $('[name="projet_id"]', el), sl = $('#c-lot', el), mt = $('[name="montant"]', el);
      const verifier = () => {
        const lot = lots.find((l) => l.id === sl.value);
        if (!lot) { $('#c-reste', el).textContent = ''; $('#c-alerte', el).innerHTML = ''; return; }
        const deja = Math.max(num(lot.engage) - (cmd && cmd.lot_id === lot.id && cmd.statut !== 'annulee' ? num(cmd.montant) : 0), num(lot.facture));
        const reste = num(lot.budget) - deja;
        $('#c-reste', el).textContent = `Reste disponible sur ce lot : ${money(reste)}`;
        $('#c-alerte', el).innerHTML = num(mt.value) > reste ? `<div class="notice warn mt">⚠️ Cette commande dépasse le budget restant du lot de ${money(num(mt.value) - reste)}. Une alerte sera envoyée à la direction.</div>` : '';
      };
      const charger = async () => {
        lots = sp.value ? await q(sb.from('v_budget_lots').select('*').eq('projet_id', sp.value).order('ordre')) : [];
        sl.innerHTML = '<option value="">— Sans lot —</option>' + lots.map((l) => `<option value="${l.id}" ${l.id === v.lot_id ? 'selected' : ''}>${esc(l.nom)}</option>`).join('');
        verifier();
      };
      sp.onchange = () => { v.lot_id = null; charger(); };
      sl.onchange = verifier;
      mt.oninput = verifier;
      charger();
      $('#del-c', el)?.addEventListener('click', async () => {
        if (!(await confirmer('Supprimer cette commande ?', 'Supprimer'))) return;
        try { await q(sb.from('commandes').delete().eq('id', cmd.id)); el.remove(); toast('Commande supprimée.'); refresh(); } catch (e) { toast(messageErreur(e), 'err'); }
      });
    },
  });
}

PAGES.achats = async () => {
  const onglets = [['commandes', 'Commandes'], ['budget', 'Budget par lot'], ['fournisseurs', 'Fournisseurs']]
    .filter(([k]) => k !== 'fournisseurs' || can('direction', 'achats', 'comptable', 'coordinateur', 'magasinier'));
  const p = page(`
    ${entete('Achats', 'Commandes, suivi budgétaire et fournisseurs', can('direction', 'achats') ? '<button class="btn primary" id="nc">＋ Nouvelle commande</button>' : '')}
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletAchats ? 'active' : ''}" data-o="${k}">${l}</button>`).join('')}</div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  const rendre = async () => {
    zone.innerHTML = loading();
    if (ongletAchats === 'commandes') await achatsCommandes(zone);
    else if (ongletAchats === 'budget') await achatsBudget(zone);
    else await achatsFournisseurs(zone);
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletAchats = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  $('#nc', p)?.addEventListener('click', () => formulaireCommande(null, rendre));
  await rendre();
  if (memo.get('koordin-ouvrir') === 'commande') { memo.del('koordin-ouvrir'); formulaireCommande(null, rendre); }
};

async function achatsCommandes(zone) {
  const [commandes, projets] = await Promise.all([
    q(sb.from('commandes').select('*, projets(nom), fournisseurs(nom), lots(nom)').order('date_commande', { ascending: false }).limit(500)),
    listeProjets(),
  ]);
  let fp = '', fs = '';
  zone.innerHTML = `<div class="card"><div class="toolbar">
      <select class="input" id="fp"><option value="">Tous les projets</option>${projets.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select>
      <select class="input" id="fs"><option value="">Tous les statuts</option>${Object.entries(STATUT_COMMANDE).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <span class="muted" id="total" style="margin-left:auto;font-size:13px"></span></div><div id="tc"></div></div>`;
  const rendre = () => {
    const l = commandes.filter((c) => (!fp || c.projet_id === fp) && (!fs || c.statut === fs));
    $('#tc', zone).innerHTML = tableauCommandes(l);
    $('#total', zone).textContent = `${l.length} commande(s) · ${money(l.filter((c) => c.statut !== 'annulee').reduce((s, c) => s + num(c.montant), 0))}`;
    brancherCommandes(zone, l, () => naviguer());
  };
  $('#fp', zone).onchange = (e) => { fp = e.target.value; rendre(); };
  $('#fs', zone).onchange = (e) => { fs = e.target.value; rendre(); };
  rendre();
}

async function achatsBudget(zone) {
  const [projets, lots] = await Promise.all([
    q(sb.from('v_projets').select('id, nom, budget, engage, facture, statut').order('nom')),
    q(sb.from('v_budget_lots').select('*').order('ordre')),
  ]);
  zone.innerHTML = `<div class="card"><div class="card-title">Synthèse par projet</div>${tableauBudgetProjets(projets.filter((x) => x.statut !== 'termine'))}</div>
    ${projets.filter((x) => x.statut !== 'termine').map((pr) => {
      const ls = lots.filter((l) => l.projet_id === pr.id);
      if (!ls.length) return '';
      return `<div class="card"><div class="card-title">${esc(pr.nom)} <small>${moneyShort(pr.budget)}</small></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Lot</th><th class="num">Budget</th><th class="num">Engagé</th><th class="num">Facturé</th><th class="num">Reste</th><th style="min-width:140px">Consommé</th></tr></thead><tbody>
        ${ls.map((l) => {
          const c = Math.max(num(l.engage), num(l.facture));
          const hors = num(l.budget) > 0 && c > num(l.budget);
          return `<tr class="${hors ? 'over' : ''}"><td><b>${esc(l.nom)}</b>${hors ? ' <span class="badge crit">🚨 Dépassé</span>' : ''}</td><td class="num">${money(l.budget)}</td><td class="num">${money(l.engage)}</td>
            <td class="num">${money(l.facture)}</td><td class="num">${money(num(l.budget) - c)}</td><td>${progressBar(pct(c, l.budget), { cls: consoCls(c, l.budget), label: pct(c, l.budget) })}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }).join('')}`;
}

async function achatsFournisseurs(zone) {
  const fournisseurs = await q(sb.from('fournisseurs').select('*').order('nom'));
  const gerer = can('direction', 'achats', 'comptable');
  zone.innerHTML = `<div class="card"><div class="card-title">Fournisseurs ${gerer ? '<button class="btn sm primary" id="nf">＋ Ajouter</button>' : ''}</div>
    ${fournisseurs.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Contact</th><th>Téléphone</th><th>Email</th>${gerer ? '<th></th>' : ''}</tr></thead><tbody>
    ${fournisseurs.map((f) => `<tr><td><b>${esc(f.nom)}</b></td><td>${esc(f.contact || '—')}</td>
      <td>${f.telephone ? `<a href="tel:${esc(f.telephone.replace(/\s/g, ''))}">${esc(f.telephone)}</a>` : '—'}</td>
      <td>${f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : '—'}</td>
      ${gerer ? `<td class="right"><button class="btn sm" data-ef="${f.id}">Modifier</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : empty('🏭', 'Aucun fournisseur enregistré')}</div>`;
  const form = (f = null) => ouvrirModale({
    titre: f ? 'Modifier le fournisseur' : 'Nouveau fournisseur',
    corps: `<div class="form-grid">${F.text('nom', 'Nom', f?.nom, { required: true, full: true })}${F.text('contact', 'Personne à contacter', f?.contact)}
      ${F.text('telephone', 'Téléphone', f?.telephone, { type: 'tel' })}${F.text('email', 'Email', f?.email, { type: 'email', full: true })}</div>`,
    onSubmit: async (d) => {
      if (f) await q(sb.from('fournisseurs').update(d).eq('id', f.id));
      else await q(sb.from('fournisseurs').insert(d));
      toast('Fournisseur enregistré.');
      achatsFournisseurs(zone);
    },
  });
  $('#nf', zone)?.addEventListener('click', () => form());
  $$('[data-ef]', zone).forEach((b) => (b.onclick = () => form(fournisseurs.find((f) => f.id === b.dataset.ef))));
}

// ═══════════════════════════════ COMPTABILITÉ ═══════════════════════════════

function tableauFactures(factures, { compact = false } = {}) {
  if (!factures.length) return empty('🧾', 'Aucune facture');
  const gerer = can('direction', 'comptable');
  const auj = todayISO();
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Libellé</th>${compact ? '' : '<th>Projet / lot</th><th>Fournisseur</th>'}<th class="num">Montant</th><th>Échéance</th><th>Statut</th>${gerer ? '<th></th>' : ''}</tr></thead><tbody>
    ${factures.map((f) => {
      const echue = f.statut === 'a_payer' && f.date_echeance && f.date_echeance < auj;
      return `<tr><td class="nowrap">${fdate(f.date_facture)}</td>
        <td><b>${esc(f.libelle)}</b>${f.justificatif ? ` <button type="button" class="btn-justif" data-justif="${esc(f.justificatif)}" title="Voir le justificatif" aria-label="Voir le justificatif">📎</button>` : ''}<div class="muted" style="font-size:12px">${esc([f.numero, CATEGORIES[f.categorie], compact ? f.projets?.nom : null].filter(Boolean).join(' · '))}</div></td>
        ${compact ? '' : `<td>${esc(f.projets?.nom || '')}<div class="muted" style="font-size:12px">${esc(f.lots?.nom || '')}</div></td><td>${esc(f.fournisseurs?.nom || f.fournisseur_libre || '—')}</td>`}
        <td class="num">${money(f.montant)}</td>
        <td class="nowrap">${f.date_echeance ? `${fdate(f.date_echeance)}${echue ? ' <span class="badge crit">⏰ Échue</span>' : ''}` : '—'}</td>
        <td>${f.validation === 'a_verifier' ? `${badge(['warn', '🔎 À vérifier'])}<div class="muted" style="font-size:11px">par ${esc(nomMembre(f.created_by))}</div>` : badge(STATUT_FACTURE[f.statut])}</td>
        ${gerer ? `<td class="right nowrap">${f.validation === 'a_verifier' ? `<button class="btn sm primary" data-accepter="${f.id}">✅ Accepter</button><button class="btn sm danger" data-refuser="${f.id}">↩️ Refuser</button>` : f.statut === 'a_payer' ? `<button class="btn sm" data-payer="${f.id}">💳 Payée</button>` : ''}<button class="btn sm" data-edit-fac="${f.id}">Modifier</button></td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>`;
}

function brancherFactures(zone, factures, refresh) {
  $$('[data-justif]', zone).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); ouvrirJustificatif(b.dataset.justif); }));
  $$('[data-payer]', zone).forEach((b) => (b.onclick = async () => {
    try {
      await q(sb.from('factures').update({ statut: 'payee', date_paiement: todayISO() }).eq('id', b.dataset.payer));
      toast('Facture marquée comme payée.');
      refresh();
    } catch (e) { toast(messageErreur(e), 'err'); }
  }));
  $$('[data-edit-fac]', zone).forEach((b) => (b.onclick = () => formulaireFacture(factures.find((f) => f.id === b.dataset.editFac), refresh)));
  $$('[data-accepter]', zone).forEach((b) => (b.onclick = () => verifierFactureEquipe(factures.find((f) => f.id === b.dataset.accepter), true, refresh)));
  $$('[data-refuser]', zone).forEach((b) => (b.onclick = () => verifierFactureEquipe(factures.find((f) => f.id === b.dataset.refuser), false, refresh)));
}

// ─── Justificatifs (photos / PDF des factures) ───
const extJustif = (chemin) => (/\.pdf$/i.test(chemin || '') ? 'pdf' : 'image');
async function ouvrirJustificatif(chemin) {
  const fenetre = window.open('', '_blank');
  const { data, error } = await sb.storage.from('justificatifs').createSignedUrl(chemin, 600);
  if (error || !data?.signedUrl) { fenetre?.close(); toast('Justificatif introuvable.', 'err'); return; }
  if (fenetre) fenetre.location = data.signedUrl; else location.href = data.signedUrl;
}
async function envoyerJustificatif(fichier) {
  const pdf = fichier.type === 'application/pdf';
  if (!pdf && !/^image\//.test(fichier.type)) throw new Error('Choisissez une photo ou un PDF.');
  const blob = pdf ? fichier : await compresserImage(fichier, 2200, 0.85);
  if (blob.size > 10 * 1024 * 1024) throw new Error('Fichier trop lourd (10 Mo maximum).');
  const chemin = `${S.entreprise.id}/${todayISO().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${pdf ? 'pdf' : 'jpg'}`;
  const { error } = await sb.storage.from('justificatifs').upload(chemin, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg' });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'Le rangement des justificatifs nécessite la mise à jour 2.2 de la base de données (kit d’installation).' : error.message);
  return { chemin, blob, type: pdf ? 'application/pdf' : 'image/jpeg' };
}
const versBase64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
const normNom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(sarl|sa|sas|ci|ltd|ets|etablissements?)\b/g, '').replace(/[^a-z0-9]/g, '');

async function lireFactureIA(justif, fournisseurs) {
  try {
    const data = await versBase64(justif.blob);
    const { data: rep, error } = await sb.functions.invoke('koordin-ia', { body: { facture: { data, media_type: justif.type, fournisseurs: fournisseurs.map((f) => f.nom) } } });
    if (error) {
      let msg = '';
      try { msg = (await error.context?.json())?.erreur || ''; } catch { /* rien */ }
      return { erreur: msg || 'Lecture automatique indisponible : l’assistant IA n’est pas encore activé.' };
    }
    if (rep?.erreur) return { erreur: rep.erreur };
    return { lu: rep?.facture || null };
  } catch {
    return { erreur: 'Lecture automatique indisponible pour le moment.' };
  }
}

const attendreFermeture = (el) => new Promise((ok) => {
  const obs = new MutationObserver(() => { if (!el.isConnected) { obs.disconnect(); ok(); } });
  obs.observe(document.body, { childList: true });
});

let dernierProjetFacture = null;
async function scannerFactures(fichiers, refresh) {
  fichiers = [...fichiers].slice(0, 20);
  if (!fichiers.length) return;
  const fournisseurs = await listeFournisseurs();
  let enregistrees = 0;
  for (let i = 0; i < fichiers.length; i++) {
    const etape = fichiers.length > 1 ? ` (${i + 1}/${fichiers.length})` : '';
    const attente = ouvrirModale({ titre: `📷 Lecture de la facture${etape}`, corps: `<div class="scan-attente"><div class="spinner"></div><p id="scan-txt">Envoi du document…</p></div>` });
    let justif = null, resultat = { erreur: null, lu: null };
    try {
      justif = await envoyerJustificatif(fichiers[i]);
      $('#scan-txt', attente.el).textContent = 'KOORDIN lit la facture… (quelques secondes)';
      resultat = await lireFactureIA(justif, fournisseurs);
    } catch (e) {
      attente.fermer();
      toast(messageErreur(e), 'err', 7000);
      continue;
    }
    attente.fermer();
    const r = await formulaireFacture(null, () => {}, dernierProjetFacture, { justificatif: justif.chemin, lecture: resultat, fournisseurs, etape });
    if (r?.enregistree) enregistrees++;
    else await sb.storage.from('justificatifs').remove([justif.chemin]);
  }
  if (enregistrees) { toast(`${enregistrees} facture${enregistrees > 1 ? 's' : ''} enregistrée${enregistrees > 1 ? 's' : ''} ✅`); refresh(); }
}

async function formulaireFacture(fac, refresh, projetId = null, opts = {}) {
  const [projets, fournisseurs] = await Promise.all([listeProjets(), opts.fournisseurs ? opts.fournisseurs : listeFournisseurs()]);
  const v = fac ? { ...fac } : { projet_id: projetId, categorie: 'materiaux', statut: 'a_payer', date_facture: todayISO() };
  let justificatif = fac?.justificatif || opts.justificatif || null;
  const lu = opts.lecture?.lu;
  let nouveauFournisseur = '';
  let notice = '';
  if (lu) {
    const dateOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
    if (lu.libelle) v.libelle = lu.libelle;
    if (lu.numero) v.numero = lu.numero;
    if (num(lu.montant_ttc) > 0) v.montant = Math.round(num(lu.montant_ttc));
    if (num(lu.montant_ht) > 0) v.montant_ht = Math.round(num(lu.montant_ht));
    if (num(lu.tva) > 0) v.tva = Math.round(num(lu.tva));
    if (dateOk(lu.date_facture)) v.date_facture = lu.date_facture;
    if (dateOk(lu.date_echeance)) v.date_echeance = lu.date_echeance;
    if (CATEGORIES[lu.categorie]) v.categorie = lu.categorie;
    if (lu.deja_payee) { v.statut = 'payee'; v.date_paiement = v.date_facture; }
    if (lu.fournisseur) {
      const n = normNom(lu.fournisseur);
      const trouve = fournisseurs.find((f) => normNom(f.nom) === n) || (n.length >= 4 ? fournisseurs.find((f) => { const m = normNom(f.nom); return m.length >= 4 && (m.includes(n) || n.includes(m)); }) : null);
      if (trouve) v.fournisseur_id = trouve.id; else { nouveauFournisseur = lu.fournisseur.trim().slice(0, 80); v.fournisseur_id = '__nouveau__'; }
    }
    const avert = [];
    if (lu.est_une_facture === false) avert.push('Ce document ne ressemble pas à une facture.');
    if (lu.devise && !normNom(lu.devise).includes(normNom(devise())) && !(normNom(devise()) === 'fcfa' && /xof|cfa/i.test(lu.devise))) avert.push(`Montant en ${lu.devise} : vérifiez la conversion.`);
    if (lu.remarque) avert.push(lu.remarque);
    notice = `<div class="notice ok">✨ Facture lue automatiquement : <b>vérifiez chaque champ</b> avant d’enregistrer, puis choisissez le chantier.</div>${avert.length ? `<div class="notice warn">⚠️ ${avert.map(esc).join('<br>')}</div>` : ''}`;
  } else if (opts.lecture?.erreur) {
    const err = /Aucune question/i.test(opts.lecture.erreur) ? 'La lecture automatique demande de mettre à jour l’assistant IA (kit d’installation).'
      : /ANTHROPIC_API_KEY|koordin-ia|non activé|pas encore activé/i.test(opts.lecture.erreur) ? 'La lecture automatique n’est pas encore activée (assistant IA).'
        : opts.lecture.erreur.replace(/\s*$/, '').replace(/([^.!?])$/, '$1.');
    notice = `<div class="notice warn">📎 Justificatif joint. ${esc(err)} Remplissez les champs en regardant le document.</div>`;
  }
  const optionsFournisseurs = [...(nouveauFournisseur ? [['__nouveau__', `➕ Nouveau : ${nouveauFournisseur}`]] : []), ...fournisseurs.map((f) => [f.id, f.nom])];
  const blocJustif = () => justificatif
    ? `<button type="button" class="btn sm" id="voir-justif">${extJustif(justificatif) === 'pdf' ? '📄' : '🖼️'} Voir le justificatif</button>`
    : '<span class="muted" style="font-size:12px">Aucun justificatif</span>';
  let resoudre;
  const fin = new Promise((ok) => { resoudre = ok; });
  let enregistree = false;
  const m = ouvrirModale({
    titre: fac ? 'Modifier la facture' : `${opts.lecture ? '📷 Facture scannée' : 'Saisir une facture ou une dépense'}${opts.etape || ''}`,
    large: true,
    boutonOk: opts.etape && !fac ? 'Enregistrer' : 'Enregistrer',
    corps: `${notice}<div class="form-grid">
      ${F.select('projet_id', 'Projet', projets.map((x) => [x.id, x.nom]), v.projet_id, { required: true, vide: '— Choisir —' })}
      <label class="field">Lot<select name="lot_id" id="f-lot"><option value="">— Sans lot —</option></select></label>
      ${F.text('libelle', 'Libellé', v.libelle, { required: true, full: true, placeholder: 'Ex. Facture acier HA 12 — livraison du 12/03' })}
      ${F.select('categorie', 'Catégorie', Object.entries(CATEGORIES), v.categorie)}
      ${F.select('fournisseur_id', 'Fournisseur', optionsFournisseurs, v.fournisseur_id, { vide: '— Aucun —' })}
      <label class="field">Commande liée<select name="commande_id" id="f-cmd"><option value="">— Aucune —</option></select></label>
      ${F.text('numero', 'N° de facture', v.numero, { hint: 'Contrôle automatique des doublons' })}
      ${F.text('montant_ht', `Montant HT (${devise()})`, v.montant_ht, { type: 'number', min: 0, inputmode: 'numeric', hint: 'Facultatif' })}
      ${F.text('tva', `TVA (${devise()})`, v.tva, { type: 'number', min: 0, inputmode: 'numeric', hint: 'Facultatif' })}
      ${F.text('montant', `Montant TTC (${devise()})`, v.montant, { type: 'number', min: 0, required: true, inputmode: 'numeric' })}
      ${F.text('date_facture', 'Date de facture', v.date_facture, { type: 'date', required: true })}
      ${F.text('date_echeance', 'Date d’échéance', v.date_echeance, { type: 'date' })}
      ${F.select('statut', 'Statut', Object.entries(STATUT_FACTURE).map(([k, [, l]]) => [k, l]), v.statut)}
      ${F.text('date_paiement', 'Date de paiement', v.date_paiement, { type: 'date' })}
      <div class="field full">Justificatif (photo ou PDF de la facture)
        <div class="justif-ligne"><span id="justif-zone">${blocJustif()}</span>
          <label class="btn sm">📎 ${justificatif ? 'Remplacer' : 'Joindre'}<input type="file" id="justif-fichier" accept="image/*,application/pdf" hidden></label></div></div>
    </div>
    ${fac ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-f">Supprimer</button></div>' : ''}`,
    onSubmit: async (d) => {
      let fournisseurId = d.fournisseur_id;
      if (fournisseurId === '__nouveau__') {
        const cree = await q(sb.from('fournisseurs').insert({ nom: nouveauFournisseur }).select('id').single());
        fournisseurId = cree.id;
      }
      const data = {
        projet_id: d.projet_id, lot_id: d.lot_id, libelle: d.libelle, categorie: d.categorie, fournisseur_id: fournisseurId,
        commande_id: d.commande_id, numero: d.numero, montant: num(d.montant), date_facture: d.date_facture,
        montant_ht: d.montant_ht ? num(d.montant_ht) : null, tva: d.tva ? num(d.tva) : null, justificatif,
        date_echeance: d.date_echeance, statut: d.statut, date_paiement: d.statut === 'payee' ? (d.date_paiement || todayISO()) : null,
      };
      if (!justificatif) delete data.justificatif;
      if (!data.montant_ht && !data.tva && !fac?.montant_ht && !fac?.tva) { delete data.montant_ht; delete data.tva; }
      if (fac) await q(sb.from('factures').update(data).eq('id', fac.id));
      else await q(sb.from('factures').insert(data));
      dernierProjetFacture = d.projet_id;
      enregistree = true;
      if (!opts.lecture) toast('Facture enregistrée.');
      refresh();
    },
    onOpen: (el) => {
      const sp = $('[name="projet_id"]', el);
      const charger = async () => {
        const [lots, cmds] = sp.value
          ? await Promise.all([
            q(sb.from('lots').select('id, nom').eq('projet_id', sp.value).order('ordre')),
            q(sb.from('commandes').select('id, designation, reference, montant').eq('projet_id', sp.value).neq('statut', 'annulee').order('date_commande', { ascending: false })),
          ])
          : [[], []];
        $('#f-lot', el).innerHTML = '<option value="">— Sans lot —</option>' + lots.map((l) => `<option value="${l.id}" ${l.id === v.lot_id ? 'selected' : ''}>${esc(l.nom)}</option>`).join('');
        $('#f-cmd', el).innerHTML = '<option value="">— Aucune —</option>' + cmds.map((c) => `<option value="${c.id}" ${c.id === v.commande_id ? 'selected' : ''}>${esc([c.reference, c.designation].filter(Boolean).join(' — '))} (${moneyShort(c.montant)})</option>`).join('');
      };
      sp.onchange = () => { v.lot_id = null; v.commande_id = null; charger(); };
      charger();
      const brancherVoir = () => $('#voir-justif', el)?.addEventListener('click', () => ouvrirJustificatif(justificatif));
      brancherVoir();
      $('#justif-fichier', el).addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          toast('Envoi du justificatif…', 'warn', 2500);
          const j = await envoyerJustificatif(f);
          justificatif = j.chemin;
          $('#justif-zone', el).innerHTML = blocJustif();
          brancherVoir();
          toast('Justificatif joint ✅ Il sera gardé à l’enregistrement.');
        } catch (err) { toast(messageErreur(err), 'err', 6000); }
      });
      $('#del-f', el)?.addEventListener('click', async () => {
        if (!(await confirmer('Supprimer cette facture ?', 'Supprimer'))) return;
        try {
          await q(sb.from('factures').delete().eq('id', fac.id));
          if (fac.justificatif) await sb.storage.from('justificatifs').remove([fac.justificatif]);
          el.remove(); toast('Facture supprimée.'); refresh();
        } catch (e) { toast(messageErreur(e), 'err'); }
      });
    },
  });
  attendreFermeture(m.el).then(() => resoudre({ enregistree }));
  return fin;
}

// ─── Export Excel (.xlsx) pour le comptable ───
let excelCharge = null;
function chargerExcel() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  excelCharge ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'exceljs.min.js';
    s.onload = () => ok(window.ExcelJS);
    s.onerror = () => { excelCharge = null; ko(new Error('Impossible de charger l’outil Excel. Vérifiez votre connexion internet.')); };
    document.head.appendChild(s);
  });
  return excelCharge;
}

async function exporterExcelCompta(factures, projets) {
  const ExcelJS = await chargerExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KOORDIN';
  wb.created = new Date();
  const OR = 'FFE8A020', NUIT = 'FF111521', GRIS = 'FFF4F5F9', ROUGE = 'FFFDE2E2', VERT = 'FFDCF5E8';
  const fmtMontant = `#,##0 "${devise().replace(/"/g, '')}";-#,##0 "${devise().replace(/"/g, '')}";"-"`;
  const jour = (iso) => (iso ? parseDay(iso) : null);
  const auj = todayISO();
  const entete = (ws) => {
    const r = ws.getRow(1);
    r.height = 22;
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NUIT } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = { bottom: { style: 'medium', color: { argb: OR } } };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };
  const ligneTotal = (ws, ligne) => {
    const r = ws.getRow(ligne);
    r.eachCell({ includeEmpty: true }, (c) => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }; c.border = { top: { style: 'thin' } }; });
  };
  const somme = (l, k) => l.reduce((s, x) => s + num(x[k]), 0);

  // 1. Factures
  const ws = wb.addWorksheet('Factures', { properties: { tabColor: { argb: OR } } });
  ws.columns = [
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'N° facture', key: 'numero', width: 16 },
    { header: 'Fournisseur', key: 'fournisseur', width: 24 },
    { header: 'Chantier', key: 'chantier', width: 28 },
    { header: 'Lot', key: 'lot', width: 16 },
    { header: 'Catégorie', key: 'categorie', width: 17 },
    { header: 'Libellé', key: 'libelle', width: 40 },
    { header: 'Montant HT', key: 'ht', width: 16, style: { numFmt: fmtMontant } },
    { header: 'TVA', key: 'tva', width: 14, style: { numFmt: fmtMontant } },
    { header: 'Montant TTC', key: 'ttc', width: 17, style: { numFmt: fmtMontant } },
    { header: 'Échéance', key: 'echeance', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Statut', key: 'statut', width: 11 },
    { header: 'Payée le', key: 'paye_le', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Jours de retard', key: 'retard', width: 10, style: { numFmt: '0' } },
    { header: 'Justificatif', key: 'justif', width: 11 },
  ];
  const tri = [...factures].sort((a, b) => String(a.date_facture).localeCompare(String(b.date_facture)));
  tri.forEach((f, i) => {
    const n = i + 2;
    const echue = f.statut === 'a_payer' && f.date_echeance && f.date_echeance < auj;
    const row = ws.addRow({
      date: jour(f.date_facture), numero: f.numero || '', fournisseur: f.fournisseurs?.nom || '', chantier: f.projets?.nom || '', lot: f.lots?.nom || '',
      categorie: CATEGORIES[f.categorie] || f.categorie, libelle: f.libelle, ht: f.montant_ht == null ? null : num(f.montant_ht), tva: f.tva == null ? null : num(f.tva),
      ttc: num(f.montant), echeance: jour(f.date_echeance), statut: f.statut === 'payee' ? 'Payée' : 'À payer', paye_le: jour(f.date_paiement),
      retard: { formula: `IF(AND(L${n}="À payer",K${n}<>"",K${n}<TODAY()),TODAY()-K${n},"")`, result: echue ? Math.round((parseDay(auj) - parseDay(f.date_echeance)) / 864e5) : '' },
      justif: f.justificatif ? 'Oui' : 'Non',
    });
    const st = row.getCell('statut');
    st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f.statut === 'payee' ? VERT : echue ? ROUGE : 'FFFFF4DB' } };
    st.alignment = { horizontal: 'center' };
    if (echue) row.getCell('retard').font = { bold: true, color: { argb: 'FFC62828' } };
    row.getCell('libelle').alignment = { wrapText: true, vertical: 'top' };
  });
  const derniere = tri.length + 1;
  entete(ws);
  ws.autoFilter = { from: 'A1', to: `O${Math.max(derniere, 1)}` };
  const tot = ws.addRow({ libelle: 'TOTAL (s’adapte aux filtres)' });
  ['H', 'I', 'J'].forEach((col) => { tot.getCell(col).value = { formula: `SUBTOTAL(109,${col}2:${col}${Math.max(derniere, 2)})`, result: somme(tri, { H: 'montant_ht', I: 'tva', J: 'montant' }[col]) }; tot.getCell(col).numFmt = fmtMontant; });
  ligneTotal(ws, tot.number);

  const plage = (col) => `Factures!$${col}$2:$${col}$${Math.max(derniere, 2)}`;
  // 2. Par chantier
  const wc = wb.addWorksheet('Par chantier');
  wc.columns = [
    { header: 'Chantier', key: 'nom', width: 32 },
    { header: 'Budget', key: 'budget', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Facturé TTC', key: 'facture', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Payé', key: 'paye', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Reste à payer', key: 'reste', width: 18, style: { numFmt: fmtMontant } },
    { header: '% du budget facturé', key: 'pct', width: 14, style: { numFmt: '0%' } },
  ];
  const chantiers = projets.filter((x) => factures.some((f) => f.projet_id === x.id) || x.statut !== 'termine');
  chantiers.forEach((x, i) => {
    const n = i + 2;
    const fx = factures.filter((f) => f.projet_id === x.id);
    const fac = somme(fx, 'montant'), pay = somme(fx.filter((f) => f.statut === 'payee'), 'montant');
    wc.addRow({
      nom: x.nom, budget: num(x.budget),
      facture: { formula: `SUMIFS(${plage('J')},${plage('D')},A${n})`, result: fac },
      paye: { formula: `SUMIFS(${plage('J')},${plage('D')},A${n},${plage('L')},"Payée")`, result: pay },
      reste: { formula: `C${n}-D${n}`, result: fac - pay },
      pct: { formula: `IF(B${n}>0,C${n}/B${n},0)`, result: num(x.budget) > 0 ? fac / num(x.budget) : 0 },
    });
  });
  entete(wc);
  const nc = chantiers.length + 1;
  const tc = wc.addRow({ nom: 'TOTAL' });
  ['B', 'C', 'D', 'E'].forEach((col) => { tc.getCell(col).value = { formula: `SUM(${col}2:${col}${Math.max(nc, 2)})` }; tc.getCell(col).numFmt = fmtMontant; });
  ligneTotal(wc, tc.number);

  // 3. Par fournisseur
  const wf = wb.addWorksheet('Par fournisseur');
  wf.columns = [
    { header: 'Fournisseur', key: 'nom', width: 30 },
    { header: 'Nb de factures', key: 'nb', width: 12 },
    { header: 'Facturé TTC', key: 'facture', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Payé', key: 'paye', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Reste à payer', key: 'reste', width: 18, style: { numFmt: fmtMontant } },
  ];
  const noms = [...new Set(factures.map((f) => f.fournisseurs?.nom).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  noms.forEach((nom, i) => {
    const n = i + 2;
    const fx = factures.filter((f) => f.fournisseurs?.nom === nom);
    const fac = somme(fx, 'montant'), pay = somme(fx.filter((f) => f.statut === 'payee'), 'montant');
    wf.addRow({
      nom, nb: { formula: `COUNTIFS(${plage('C')},A${n})`, result: fx.length },
      facture: { formula: `SUMIFS(${plage('J')},${plage('C')},A${n})`, result: fac },
      paye: { formula: `SUMIFS(${plage('J')},${plage('C')},A${n},${plage('L')},"Payée")`, result: pay },
      reste: { formula: `C${n}-D${n}`, result: fac - pay },
    });
  });
  entete(wf);
  const tf = wf.addRow({ nom: 'TOTAL' });
  ['B', 'C', 'D', 'E'].forEach((col) => { tf.getCell(col).value = { formula: `SUM(${col}2:${col}${Math.max(noms.length + 1, 2)})` }; if (col !== 'B') tf.getCell(col).numFmt = fmtMontant; });
  ligneTotal(wf, tf.number);

  // 4. Échéancier (factures à payer)
  const we = wb.addWorksheet('Échéancier', { properties: { tabColor: { argb: 'FFC62828' } } });
  we.columns = [
    { header: 'Échéance', key: 'echeance', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Fournisseur', key: 'fournisseur', width: 26 },
    { header: 'N° facture', key: 'numero', width: 16 },
    { header: 'Chantier', key: 'chantier', width: 28 },
    { header: 'Montant TTC', key: 'ttc', width: 17, style: { numFmt: fmtMontant } },
    { header: 'Jours de retard', key: 'retard', width: 11, style: { numFmt: '0' } },
  ];
  const apayer = factures.filter((f) => f.statut === 'a_payer').sort((a, b) => String(a.date_echeance || '9999').localeCompare(String(b.date_echeance || '9999')));
  apayer.forEach((f, i) => {
    const n = i + 2;
    const echue = f.date_echeance && f.date_echeance < auj;
    const row = we.addRow({
      echeance: jour(f.date_echeance), fournisseur: f.fournisseurs?.nom || '', numero: f.numero || '', chantier: f.projets?.nom || '', ttc: num(f.montant),
      retard: { formula: `IF(AND(A${n}<>"",A${n}<TODAY()),TODAY()-A${n},"")`, result: echue ? Math.round((parseDay(auj) - parseDay(f.date_echeance)) / 864e5) : '' },
    });
    if (echue) row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROUGE } }; });
  });
  entete(we);
  const te = we.addRow({ chantier: 'TOTAL À PAYER' });
  te.getCell('E').value = { formula: `SUM(E2:E${Math.max(apayer.length + 1, 2)})`, result: somme(apayer, 'montant') };
  te.getCell('E').numFmt = fmtMontant;
  ligneTotal(we, te.number);

  // 5. Par mois
  const wm = wb.addWorksheet('Par mois');
  wm.columns = [
    { header: 'Mois', key: 'mois', width: 18 },
    { header: 'Nb de factures', key: 'nb', width: 12 },
    { header: 'Facturé TTC', key: 'facture', width: 18, style: { numFmt: fmtMontant } },
    { header: 'Payé', key: 'paye', width: 18, style: { numFmt: fmtMontant } },
  ];
  const mois = [...new Set(factures.map((f) => String(f.date_facture).slice(0, 7)))].sort();
  mois.forEach((mo) => {
    const fx = factures.filter((f) => String(f.date_facture).startsWith(mo));
    const lib = parseDay(`${mo}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    wm.addRow({ mois: lib.charAt(0).toUpperCase() + lib.slice(1), nb: fx.length, facture: somme(fx, 'montant'), paye: somme(fx.filter((f) => f.statut === 'payee'), 'montant') });
  });
  entete(wm);

  [ws, wc, wf, we, wm].forEach((w) => { w.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
  const tampon = await wb.xlsx.writeBuffer();
  const blob = new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const nom = `KOORDIN-comptabilite-${(S.entreprise?.nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-')}-${todayISO()}.xlsx`;
  const fichier = new File([blob], nom, { type: blob.type });
  return { blob, nom, fichier };
}

async function boutonExcel(factures, projets) {
  if (DEMO) { toast('L’export Excel fonctionne dans la version installée de KOORDIN.', 'warn'); return; }
  toast('Préparation du fichier Excel…', 'warn', 2500);
  try {
    const { blob, nom, fichier } = await exporterExcelCompta(factures, projets);
    const url = URL.createObjectURL(blob);
    const partage = navigator.canShare?.({ files: [fichier] });
    const m = ouvrirModale({
      titre: '📊 Fichier Excel prêt',
      corps: `<p style="margin-bottom:10px"><b>${factures.length}</b> facture(s) · 5 onglets : <b>Factures</b> (avec filtres et totaux), <b>Par chantier</b>, <b>Par fournisseur</b>, <b>Échéancier</b> et <b>Par mois</b>.</p>
        <div class="rc-boutons"><a class="btn primary" href="${url}" download="${esc(nom)}">⬇️ Télécharger</a>${partage ? '<button type="button" class="btn" id="xl-partager">📤 Envoyer (WhatsApp, e-mail…)</button>' : ''}</div>
        <p class="hint mt">Le fichier s’ouvre dans Excel, Google Sheets ou WPS Office. Les totaux se recalculent si vous filtrez.</p>
        <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button></div>`,
    });
    $('#xl-partager', m.el)?.addEventListener('click', async () => {
      try { await navigator.share({ files: [fichier], title: nom }); } catch (e) { if (e?.name !== 'AbortError') toast('Le partage n’a pas fonctionné : téléchargez le fichier.', 'warn'); }
    });
    attendreFermeture(m.el).then(() => setTimeout(() => URL.revokeObjectURL(url), 60000));
  } catch (e) {
    console.error(e);
    toast(messageErreur(e), 'err', 6000);
  }
}

let ongletCompta = 'factures';

// ═══════════════════════════════ 3.15 : LES ÉQUIPES AJOUTENT LEURS FACTURES ═══════════════════════════════
// Techniciens, Coordination, Achats et Magasin prennent la facture en photo ; la Comptabilité ou la Direction vérifie.
const ROLES_FACTURE_EQUIPE = ['technicien', 'coordinateur', 'achats', 'magasinier'];
const erreurFactureEquipe = (e) => {
  const m = String(e?.message || '');
  if (/^FACTURE_/.test(m) && e?.hint) return e.hint;
  if (/verifier_facture|fournisseur_libre|validation/.test(m) && /does not exist|schema cache|could not find|column/i.test(m)) return 'Cette fonction nécessite la mise à jour 3.15 de la base de données (kit d’installation).';
  if (/row-level security|policy/i.test(m)) return 'Vous ne pouvez ajouter une facture que pour un chantier qui vous est affecté.';
  return messageErreur(e);
};

// ═══════════════════════════════ 3.16 : CAISSE DE CHANTIER ═══════════════════════════════
// Le terrain note l'argent reçu et les dépenses du jour ; la Direction et la Comptabilité voient, remettent des fonds et vérifient.
const CATS_CAISSE = { transport: ['🛺', 'Transport'], carburant: ['⛽', 'Carburant'], repas: ['🍛', 'Repas, eau'], petit_materiel: ['🔨', 'Petit matériel'], main_oeuvre: ['👷', 'Journaliers'], reparation: ['🔧', 'Réparation'], autre: ['📦', 'Autre'], fonds: ['💰', 'Argent reçu'] };
const STATUT_CAISSE = { a_verifier: ['warn', '🔎 À vérifier'], validee: ['ok', '✅ Accepté'], refusee: ['crit', '↩️ Refusé'] };
const erreurCaisse = (e) => {
  const m = String(e?.message || '');
  if (/^CAISSE_/.test(m) && e?.hint) return e.hint;
  if (/caisse_mouvements|verifier_caisse/.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Cette fonction nécessite la mise à jour 3.16 de la base de données (kit d’installation).';
  if (/row-level security|policy/i.test(m)) return 'Choisissez un chantier qui vous est affecté.';
  return messageErreur(e);
};
// Reçu − dépensé (les dépenses refusées restent sorties de la caisse : l'argent a bien été dépensé)
function soldeCaisse(mvts) {
  const recu = mvts.filter((m) => m.type === 'recu' && m.statut !== 'refusee').reduce((s, m) => s + num(m.montant), 0);
  const depense = mvts.filter((m) => m.type === 'depense').reduce((s, m) => s + num(m.montant), 0);
  return { recu, depense, solde: recu - depense, attente: mvts.filter((m) => m.statut === 'a_verifier') };
}
function ligneCaisse(m, { gerer = false, nom = false } = {}) {
  const [ic, cat] = CATS_CAISSE[m.categorie] || CATS_CAISSE.autre;
  const rec = m.type === 'recu';
  return `<div class="cs-ligne ${rec ? 'recu' : 'depense'} ${m.statut}" data-cs="${m.id}">
    <span class="cs-ic">${ic}</span>
    <div class="cs-txt"><b>${esc(m.libelle)}</b><small>${esc([nom ? nomMembre(m.profil_id) : null, cat, m.projets?.nom].filter(Boolean).join(' · '))}${m.statut === 'refusee' && m.motif_refus ? ` · Motif : « ${esc(m.motif_refus)} »` : ''}</small></div>
    <div class="cs-droite"><b class="cs-montant">${rec ? '+' : '−'}${money(m.montant)}</b>${badge(STATUT_CAISSE[m.statut])}
      <span class="cs-btns">${m.justificatif ? `<button type="button" class="btn sm ghost" data-justif="${esc(m.justificatif)}" aria-label="Voir le reçu">📎</button>` : ''}${gerer && m.statut === 'a_verifier' ? `<button type="button" class="btn sm primary" data-cs-ok="${m.id}" aria-label="Accepter">✅</button><button type="button" class="btn sm danger" data-cs-non="${m.id}" aria-label="Refuser">↩️</button>` : ''}${!gerer && m.statut === 'a_verifier' ? `<button type="button" class="btn sm ghost" data-cs-suppr="${m.id}" aria-label="Retirer">🗑️</button>` : ''}</span></div></div>`;
}
function journalCaisse(mvts, o = {}) {
  if (!mvts.length) return empty('👛', 'Aucun mouvement pour le moment.');
  let jour = '';
  return mvts.map((m) => {
    const j = jourLisible(`${m.date_mvt}T12:00:00`);
    let tete = '';
    if (j !== jour) { const tot = mvts.filter((x) => x.date_mvt === m.date_mvt && x.type === 'depense').reduce((s, x) => s + num(x.montant), 0); tete = `<div class="sk-jour">${esc(j)}${tot ? ` · dépensé ${money(tot)}` : ''}</div>`; jour = j; }
    return tete + ligneCaisse(m, o);
  }).join('');
}

PAGES.caisse = async () => {
  if (can('direction', 'comptable')) return pageCaissesGestion();
  const p = page(`
    ${entete('Caisse et dépenses', 'L’argent reçu pour le chantier et ce que vous dépensez chaque jour')}
    <div id="cs-solde"></div>
    <div class="sk-actions n2"><button type="button" class="sk-gros-btn prendre" id="cs-dep"><span>➖</span><b>J’ai dépensé</b><small>transport, carburant, petit matériel…</small></button><button type="button" class="sk-gros-btn rendre" id="cs-recu"><span>➕</span><b>J’ai reçu</b><small>de l’argent pour le chantier</small></button></div>
    <div class="card"><div class="card-title">Mon journal de caisse</div><div id="cs-journal">${loading()}</div></div>`);
  const rendre = async () => {
    let mvts = [];
    try { mvts = await q(sb.from('caisse_mouvements').select('*, projets(nom)').eq('profil_id', S.profil.id).order('date_mvt', { ascending: false }).order('created_at', { ascending: false }).limit(400)); }
    catch (e) { $('#cs-journal', p).innerHTML = empty('👛', erreurCaisse(e)); return; }
    const s = soldeCaisse(mvts);
    $('#cs-solde', p).innerHTML = `<div class="cs-solde ${s.solde < 0 ? 'negatif' : ''}"><small>Reste dans ma caisse</small><b>${money(s.solde)}</b>
      <div class="cs-solde-detail"><span>Reçu <b>${money(s.recu)}</b></span><span>Dépensé <b>${money(s.depense)}</b></span>${s.attente.length ? `<span>🔎 ${s.attente.length} à vérifier</span>` : ''}</div>
      ${s.solde < 0 ? '<p>Vous avez avancé de votre poche : la comptabilité vous le rembourse après vérification.</p>' : ''}</div>`;
    $('#cs-journal', p).innerHTML = journalCaisse(mvts);
    $$('[data-justif]', p).forEach((b) => (b.onclick = () => ouvrirJustificatif(b.dataset.justif)));
    $$('[data-cs-suppr]', p).forEach((b) => (b.onclick = async () => {
      const m = mvts.find((x) => x.id === b.dataset.csSuppr);
      if (!(await confirmer(`Retirer « ${m.libelle} » (${money(m.montant)}) ?`, 'Retirer'))) return;
      try { await q(sb.from('caisse_mouvements').delete().eq('id', m.id)); if (m.justificatif) sb.storage.from('justificatifs').remove([m.justificatif]); toast('Retiré.'); rendre(); } catch (e) { toast(erreurCaisse(e), 'err'); }
    }));
  };
  $('#cs-dep', p).onclick = () => formulaireCaisse('depense', rendre);
  $('#cs-recu', p).onclick = () => formulaireCaisse('recu', rendre);
  await rendre();
  if (memo.get('koordin-ouvrir') === 'depense') { memo.del('koordin-ouvrir'); formulaireCaisse('depense', rendre); }
};

async function formulaireCaisse(type, apres, { pour = null } = {}) {
  const projets = (await listeProjets()).filter((x) => x.statut !== 'termine');
  const dep = type === 'depense';
  if (dep && !projets.length) return toast('Vous n’êtes affecté à aucun chantier en cours.', 'warn');
  let justif = null, categorie = 'transport';
  const membres = pour ? (S.equipe || []).filter((x) => x.actif !== false && x.id !== S.profil.id) : [];
  ouvrirModale({
    titre: dep ? '➖ Nouvelle dépense' : pour ? '💰 Remettre de l’argent' : '➕ Argent reçu',
    boutonOk: dep ? 'Enregistrer la dépense' : 'Enregistrer',
    corps: `<div class="form-grid">
      ${pour ? F.select('profil_id', 'À qui ?', membres.map((x) => [x.id, `${x.nom} — ${ROLES[x.role]?.label || x.role}`]), pour === true ? '' : pour, { required: true, vide: '— Choisir —', full: true }) : ''}
      ${F.text('montant', `Montant (${devise()})`, '', { type: 'number', min: 1, required: true, inputmode: 'numeric', placeholder: dep ? 'Ex. 3000' : 'Ex. 100000' })}
      ${F.text('date_mvt', 'Date', todayISO(), { type: 'date', required: true, max: todayISO() })}
      ${dep ? `<div class="field full">Pour quoi ?<div class="cs-cats">${Object.entries(CATS_CAISSE).filter(([k]) => k !== 'fonds').map(([k, [ic, l]]) => `<button type="button" class="sk-chip ${k === categorie ? 'actif' : ''}" data-cat="${k}">${ic} ${l}</button>`).join('')}</div></div>` : ''}
      ${F.text('libelle', dep ? 'Détail' : 'De qui / pourquoi ?', '', { required: true, full: true, placeholder: dep ? 'Ex. Taxi aller-retour quincaillerie' : 'Ex. Fonds de caisse de la semaine remis par la Direction' })}
      ${F.select('projet_id', dep ? 'Chantier' : 'Chantier (facultatif)', projets.map((x) => [x.id, x.nom]), projets.length === 1 ? projets[0].id : '', { required: dep, vide: dep ? '— Choisir —' : '— Aucun —', full: true })}
    </div>
    ${dep ? `<div class="field full" style="margin-top:10px">Reçu ou ticket (facultatif, mais conseillé)
      <div class="fe-photo-btns"><label class="btn">📷 Photo du reçu<input type="file" class="cs-fichier" accept="image/*" capture="environment" hidden></label><label class="btn ghost">🖼️ Galerie<input type="file" class="cs-fichier" accept="image/*,application/pdf" hidden></label><span class="hint" id="cs-photo-etat"></span></div></div>
      <label class="reunion-membre" style="margin-top:10px"><input type="checkbox" name="encore"><span><b>J’ai d’autres dépenses à noter</b><small>Le formulaire se rouvre tout de suite</small></span></label>` : ''}`,
    onOpen: (ov) => {
      $$('[data-cat]', ov).forEach((b) => (b.onclick = () => { categorie = b.dataset.cat; $$('[data-cat]', ov).forEach((x) => x.classList.toggle('actif', x === b)); }));
      $$('.cs-fichier', ov).forEach((inp) => (inp.onchange = async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        const etat = $('#cs-photo-etat', ov); etat.textContent = '⏳ Envoi…';
        try { justif = await envoyerJustificatif(f); etat.textContent = '✅ Reçu joint'; } catch (err) { justif = null; etat.textContent = ''; toast(err.message, 'err'); }
      }));
    },
    onSubmit: async (d) => {
      if (num(d.montant) <= 0) throw new Error('Indiquez le montant.');
      const ligne = { type, montant: num(d.montant), date_mvt: d.date_mvt, libelle: d.libelle.trim(), projet_id: d.projet_id || null, categorie: dep ? categorie : 'fonds', justificatif: justif?.chemin || null, ...(pour ? { profil_id: d.profil_id } : {}) };
      try { await q(sb.from('caisse_mouvements').insert(ligne)); } catch (e) { throw new Error(erreurCaisse(e)); }
      toast(dep ? `Dépense de ${money(ligne.montant)} notée ✅` : pour ? `${money(ligne.montant)} remis à ${nomMembre(d.profil_id)} ✅ Il est prévenu.` : `Argent reçu noté ✅ (la comptabilité confirmera).`);
      apres?.();
      if (d.encore) setTimeout(() => formulaireCaisse(type, apres), 300);
    },
  });
}

// ─── Direction et Comptabilité : toutes les caisses ───
async function pageCaissesGestion() {
  await chargerEquipe();
  const p = page(`
    ${entete('Caisses des équipes', 'L’argent remis au terrain, les dépenses du jour, et ce qu’il reste à chacun', '<button type="button" class="btn primary" id="cs-remettre">💰 Remettre de l’argent</button>')}
    <div id="cs-zone">${loading()}</div>`);
  const zone = $('#cs-zone', p);
  let choisi = null;
  const rendre = async () => {
    let mvts = [];
    try { mvts = await q(sb.from('caisse_mouvements').select('*, projets(nom)').order('date_mvt', { ascending: false }).order('created_at', { ascending: false }).limit(2000)); }
    catch (e) { zone.innerHTML = empty('👛', erreurCaisse(e)); return; }
    const parPersonne = new Map();
    mvts.forEach((m) => { if (!parPersonne.has(m.profil_id)) parPersonne.set(m.profil_id, []); parPersonne.get(m.profil_id).push(m); });
    const tous = soldeCaisse(mvts);
    const aujourd = mvts.filter((m) => m.type === 'depense' && m.date_mvt === todayISO()).reduce((s, m) => s + num(m.montant), 0);
    if (choisi && parPersonne.has(choisi)) {
      const l = parPersonne.get(choisi), s = soldeCaisse(l);
      zone.innerHTML = `<button type="button" class="btn ghost sm" id="cs-retour">← Toutes les caisses</button>
        <div class="cs-solde ${s.solde < 0 ? 'negatif' : ''}" style="margin-top:10px"><small>Caisse de ${esc(nomMembre(choisi))}</small><b>${money(s.solde)}</b>
          <div class="cs-solde-detail"><span>Reçu <b>${money(s.recu)}</b></span><span>Dépensé <b>${money(s.depense)}</b></span></div>
          ${s.solde < 0 ? `<p>${esc(nomMembre(choisi))} a avancé ${money(-s.solde)} de sa poche.</p>` : ''}</div>
        <div class="rc-boutons" style="margin:12px 0">${s.attente.length ? `<button type="button" class="btn primary" id="cs-tout">✅ Tout accepter (${s.attente.length} · ${money(s.attente.reduce((x, m) => x + num(m.montant), 0))})</button>` : ''}<button type="button" class="btn" id="cs-donner">💰 Lui remettre de l’argent</button></div>
        <div class="card">${journalCaisse(l, { gerer: true })}</div>`;
      $('#cs-retour', zone).onclick = () => { choisi = null; rendre(); };
      $('#cs-donner', zone).onclick = () => formulaireCaisse('recu', rendre, { pour: choisi });
      $('#cs-tout', zone)?.addEventListener('click', () => decider(s.attente.map((m) => m.id), true));
    } else {
      const lignes = [...parPersonne.entries()].map(([id, l]) => ({ id, ...soldeCaisse(l) })).sort((a, b) => b.attente.length - a.attente.length || a.solde - b.solde);
      zone.innerHTML = `<div class="grid k4">
          ${kpi('Remis au terrain', moneyShort(tous.recu))}
          ${kpi('Dépensé', moneyShort(tous.depense), aujourd ? `Aujourd’hui : ${moneyShort(aujourd)}` : '')}
          ${kpi('Reste dans les caisses', moneyShort(tous.solde), '', tous.solde < 0 ? 'warn' : '')}
          ${kpi('À vérifier', tous.attente.length, tous.attente.length ? moneyShort(tous.attente.reduce((s, m) => s + num(m.montant), 0)) : '✅ Rien en attente', tous.attente.length ? 'warn' : '')}
        </div>
        <div class="card section"><div class="card-title">Caisse de chaque personne <small>touchez pour voir le détail et vérifier</small></div>
          ${lignes.length ? `<div class="paie-liste">${lignes.map((x) => `<button type="button" class="paie-ligne vente-ligne" data-pers="${x.id}"><div class="paie-nom"><b>${esc(nomMembre(x.id))}</b><span>Reçu ${money(x.recu)} · dépensé ${money(x.depense)}</span></div>
            <div class="paie-montant"><b class="${x.solde < 0 ? 'cs-neg' : ''}">${money(x.solde)}</b>${x.attente.length ? badge(['warn', `🔎 ${x.attente.length} à vérifier`]) : badge(['ok', '✅ À jour'])}</div></button>`).join('')}</div>`
            : empty('👛', 'Aucune caisse pour le moment. Remettez de l’argent à un technicien, ou attendez qu’il note ses premières dépenses.')}</div>
        ${tous.attente.length ? `<div class="card section"><div class="card-title">🔎 Dernières dépenses à vérifier</div>${tous.attente.slice(0, 15).map((m) => ligneCaisse(m, { gerer: true, nom: true })).join('')}</div>` : ''}`;
      $$('[data-pers]', zone).forEach((b) => (b.onclick = () => { choisi = b.dataset.pers; rendre(); }));
    }
    $$('[data-justif]', zone).forEach((b) => (b.onclick = () => ouvrirJustificatif(b.dataset.justif)));
    $$('[data-cs-ok]', zone).forEach((b) => (b.onclick = () => decider([b.dataset.csOk], true)));
    $$('[data-cs-non]', zone).forEach((b) => (b.onclick = () => decider([b.dataset.csNon], false)));
  };
  const decider = (ids, accepter) => {
    const envoyer = async (motif) => {
      const n = await q(sb.rpc('verifier_caisse', { p_mouvements: ids, p_accepter: accepter, p_motif: motif || null }));
      toast(accepter ? `✅ ${n} mouvement${n > 1 ? 's' : ''} accepté${n > 1 ? 's' : ''} : les dépenses sont passées en comptabilité.` : 'Refusé : la personne est prévenue avec le motif.');
      rendre();
    };
    if (accepter) return envoyer().catch((e) => toast(erreurCaisse(e), 'err'));
    ouvrirModale({
      titre: '↩️ Refuser', boutonOk: 'Refuser',
      corps: F.area('motif', 'Pourquoi ? (envoyé à la personne)', '', { required: true, placeholder: 'Ex. Pas de reçu, montant trop élevé, dépense personnelle…' }),
      onSubmit: async (d) => { try { await envoyer(d.motif); } catch (e) { throw new Error(erreurCaisse(e)); } },
    });
  };
  $('#cs-remettre', p).onclick = () => formulaireCaisse('recu', rendre, { pour: true });
  await rendre();
}

PAGES['mes-factures'] = async () => {
  const p = page(`
    ${entete('Mes factures', 'Vos achats pour les chantiers : prenez la facture en photo, la comptabilité la vérifie')}
    <button type="button" class="fe-gros" id="fe-nouvelle"><span>📷</span><b>Ajouter une facture</b><small>Photo du ticket ou de la facture, montant, chantier</small></button>
    <div class="card"><div class="card-title">Factures que j’ai ajoutées</div><div id="fe-liste">${loading()}</div></div>`);
  const zone = $('#fe-liste', p);
  const rendre = async () => {
    let l = [];
    try {
      l = await q(sb.from('factures').select('id, libelle, montant, date_facture, statut, validation, justificatif, fournisseur_libre, categorie, created_at, projets(nom)').eq('created_by', S.profil.id).order('created_at', { ascending: false }).limit(200));
    } catch (e) { zone.innerHTML = empty('🧾', erreurFactureEquipe(e)); return; }
    const attente = l.filter((f) => f.validation === 'a_verifier');
    zone.innerHTML = l.length ? `${attente.length ? `<p class="muted" style="font-size:13px;margin-bottom:8px">🔎 ${attente.length} en attente de vérification par la comptabilité.</p>` : ''}
      <div class="paie-liste">${l.map((f) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(f.libelle)}</b><span>${esc([f.projets?.nom, f.fournisseur_libre, fdate(f.date_facture)].filter(Boolean).join(' · '))}</span></div>
        <div class="paie-montant"><b>${money(f.montant)}</b>${f.validation === 'a_verifier' ? badge(['warn', '🔎 À vérifier']) : f.statut === 'payee' ? badge(['ok', '✅ Acceptée · payée']) : badge(['ok', '✅ Acceptée'])}
          <span class="fe-actions">${f.justificatif ? `<button type="button" class="btn sm ghost" data-justif="${esc(f.justificatif)}" aria-label="Voir la photo">📎</button>` : ''}${f.validation === 'a_verifier' ? `<button type="button" class="btn sm ghost" data-retirer="${f.id}" aria-label="Retirer">🗑️</button>` : ''}</span></div></div>`).join('')}</div>`
      : empty('🧾', 'Aucune facture pour le moment. Après un achat pour le chantier, touchez « Ajouter une facture ».');
    $$('[data-justif]', zone).forEach((b) => (b.onclick = () => ouvrirJustificatif(b.dataset.justif)));
    $$('[data-retirer]', zone).forEach((b) => (b.onclick = async () => {
      const f = l.find((x) => x.id === b.dataset.retirer);
      if (!(await confirmer(`Retirer la facture « ${f.libelle} » ?`, 'Retirer'))) return;
      try {
        const r = await q(sb.from('factures').delete().eq('id', f.id).select('id'));
        if (!r?.length) throw new Error('Cette facture a déjà été vérifiée : demandez à la comptabilité.');
        if (f.justificatif) sb.storage.from('justificatifs').remove([f.justificatif]);
        toast('Facture retirée.'); rendre();
      } catch (e) { toast(erreurFactureEquipe(e), 'err'); }
    }));
  };
  $('#fe-nouvelle', p).onclick = () => formulaireFactureEquipe(rendre);
  await rendre();
  if (memo.get('koordin-ouvrir') === 'facture') { memo.del('koordin-ouvrir'); formulaireFactureEquipe(rendre); }
};

async function formulaireFactureEquipe(apres) {
  const projets = (await listeProjets()).filter((x) => x.statut !== 'termine');
  if (!projets.length) return toast('Vous n’êtes affecté à aucun chantier en cours.', 'warn');
  let justif = null;
  ouvrirModale({
    titre: '🧾 Ajouter une facture',
    boutonOk: '📤 Envoyer à la comptabilité',
    corps: `<div class="fe-photo" id="fe-photo"><div class="fe-photo-vide"><span>📷</span><b>1. La photo de la facture</b><small>Obligatoire : la comptabilité en a besoin</small></div></div>
      <div class="fe-photo-btns"><label class="btn">📷 Prendre en photo<input type="file" class="fe-fichier" accept="image/*" capture="environment" hidden></label><label class="btn">🖼️ Galerie ou PDF<input type="file" class="fe-fichier" accept="image/*,application/pdf" hidden></label></div>
      <div class="form-grid" style="margin-top:12px">
        ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), projets.length === 1 ? projets[0].id : '', { required: true, vide: '— Choisir —' })}
        ${F.text('montant', `Montant payé (${devise()})`, '', { type: 'number', min: 1, required: true, inputmode: 'numeric', placeholder: 'Ex. 45000' })}
        ${F.text('libelle', 'Ce que vous avez acheté', '', { required: true, full: true, placeholder: 'Ex. 10 sacs de ciment, location bétonnière…' })}
        ${F.text('fournisseur_libre', 'Chez qui ?', '', { placeholder: 'Ex. Quincaillerie du Plateau' })}
        ${F.select('categorie', 'Type de dépense', Object.entries(CATEGORIES), 'materiaux')}
        ${F.text('date_facture', 'Date', todayISO(), { type: 'date', required: true, max: todayISO() })}
        ${F.text('numero', 'N° de facture (facultatif)', '')}
      </div>`,
    onOpen: (ov) => {
      $$('.fe-fichier', ov).forEach((inp) => (inp.onchange = async (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        const z = $('#fe-photo', ov);
        z.innerHTML = '<div class="fe-photo-vide"><span>⏳</span><b>Envoi de la photo…</b></div>';
        try {
          justif = await envoyerJustificatif(f);
          z.innerHTML = justif.type === 'application/pdf' ? '<div class="fe-photo-vide ok"><span>📄</span><b>PDF joint ✅</b></div>' : `<img src="${URL.createObjectURL(justif.blob)}" alt="Facture"><span class="fe-ok">✅ Photo jointe</span>`;
        } catch (err) { justif = null; z.innerHTML = '<div class="fe-photo-vide"><span>📷</span><b>1. La photo de la facture</b></div>'; toast(err.message || 'Photo illisible.', 'err', 7000); }
      }));
    },
    onSubmit: async (d) => {
      if (!justif) throw new Error('Prenez d’abord la facture en photo (étape 1).');
      if (num(d.montant) <= 0) throw new Error('Indiquez le montant payé.');
      try {
        await q(sb.from('factures').insert({ projet_id: d.projet_id, montant: num(d.montant), libelle: d.libelle.trim(), fournisseur_libre: d.fournisseur_libre || null, categorie: d.categorie, date_facture: d.date_facture, numero: d.numero || null, justificatif: justif.chemin }));
      } catch (e) { throw new Error(erreurFactureEquipe(e)); }
      toast('🧾 Facture envoyée ✅ La comptabilité est prévenue.');
      apres?.();
    },
  });
}

// Côté Comptabilité / Direction : accepter ou refuser
async function verifierFactureEquipe(f, accepter, refresh) {
  try {
    if (accepter) {
      await q(sb.rpc('verifier_facture', { p_facture: f.id, p_accepter: true }));
      toast(`Facture acceptée ✅ ${nomMembre(f.created_by)} est prévenu(e).`);
      refresh();
      return;
    }
    ouvrirModale({
      titre: '↩️ Refuser la facture',
      boutonOk: 'Refuser',
      corps: `<p style="margin-bottom:10px">« ${esc(f.libelle)} » · ${money(f.montant)}, ajoutée par <b>${esc(nomMembre(f.created_by))}</b>.</p>
        ${F.area('motif', 'Pourquoi ? (envoyé à la personne)', '', { required: true, placeholder: 'Ex. Photo illisible, facture d’un autre chantier, montant différent du ticket…' })}`,
      onSubmit: async (d) => {
        try { await q(sb.rpc('verifier_facture', { p_facture: f.id, p_accepter: false, p_motif: d.motif })); } catch (e) { throw new Error(erreurFactureEquipe(e)); }
        if (f.justificatif) sb.storage.from('justificatifs').remove([f.justificatif]);
        toast('Facture refusée : la personne est prévenue avec le motif.');
        refresh();
      },
    });
  } catch (e) { toast(erreurFactureEquipe(e), 'err'); }
}

PAGES.compta = async () => {
  const [factures, projets] = await Promise.all([
    q(sb.from('factures').select('*, projets(nom), fournisseurs(nom), lots(nom)').order('date_facture', { ascending: false }).limit(1000)),
    q(sb.from('v_projets').select('id, nom, budget, engage, facture, paye, statut').order('nom')),
  ]);
  const total = factures.reduce((s, f) => s + num(f.montant), 0);
  const paye = factures.filter((f) => f.statut === 'payee').reduce((s, f) => s + num(f.montant), 0);
  const echues = factures.filter((f) => f.statut === 'a_payer' && f.date_echeance && f.date_echeance < todayISO());
  const aVerifier = factures.filter((f) => f.validation === 'a_verifier');
  const p = page(`
    ${entete('Comptabilité', 'Factures, dépenses et situation financière', `<button class="btn" id="csv">📊 Export Excel</button>${can('direction', 'comptable') ? `${DEMO ? '' : '<label class="btn">📷 Scanner des factures<input type="file" id="scan-f" accept="image/*,application/pdf" multiple hidden></label>'}<button class="btn primary" id="nfa">＋ Saisir une facture</button>` : ''}`)}
    <div class="grid k4">
      ${kpi('Total facturé', moneyShort(total))}
      ${kpi('Payé', moneyShort(paye), `${pct(paye, total)} %`)}
      ${kpi('Reste à payer', moneyShort(total - paye), '', total - paye > 0 ? 'warn' : '')}
      ${kpi('Échéances dépassées', echues.length, echues.length ? moneyShort(echues.reduce((s, f) => s + num(f.montant), 0)) : '✅ Aucune', echues.length ? 'alert' : '')}
    </div>
    ${aVerifier.length ? `<div class="notice warn section fe-alerte">🧾 <b>${aVerifier.length} facture${aVerifier.length > 1 ? 's' : ''} ajoutée${aVerifier.length > 1 ? 's' : ''} par les équipes</b> attend${aVerifier.length > 1 ? 'ent' : ''} votre vérification (${moneyShort(aVerifier.reduce((s, f) => s + num(f.montant), 0))}). <button type="button" class="btn sm primary" id="voir-verif">Les vérifier</button></div>` : ''}
    <div class="tabs section"><button class="tab ${ongletCompta === 'factures' ? 'active' : ''}" data-o="factures">Factures et dépenses</button><button class="tab ${ongletCompta === 'budget' ? 'active' : ''}" data-o="budget">Budget et réalisé</button></div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  let fp = '', fs = '', fc = '';
  const filtrees = () => factures.filter((f) => (!fp || f.projet_id === fp) && (!fs || f.statut === fs || (fs === 'echue' && echues.includes(f)) || (fs === 'a_verifier' && f.validation === 'a_verifier')) && (!fc || f.categorie === fc));
  const rendre = () => {
    if (ongletCompta === 'budget') {
      const actifs = projets.filter((x) => x.statut !== 'termine');
      zone.innerHTML = `<div class="card"><div class="card-title">Budget et réalisé par projet</div>
        ${actifs.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Projet</th><th class="num">Budget</th><th class="num">Engagé</th><th class="num">Facturé</th><th class="num">Payé</th><th class="num">Reste à payer</th><th style="min-width:140px">Facturé / budget</th></tr></thead><tbody>
        ${actifs.map((x) => `<tr class="click" data-go="#/projet/${x.id}"><td><b>${esc(x.nom)}</b></td><td class="num">${money(x.budget)}</td><td class="num">${money(x.engage)}</td>
          <td class="num">${money(x.facture)}</td><td class="num">${money(x.paye)}</td><td class="num">${money(num(x.facture) - num(x.paye))}</td>
          <td>${progressBar(pct(x.facture, x.budget), { cls: consoCls(x.facture, x.budget), label: pct(x.facture, x.budget) })}</td></tr>`).join('')}</tbody></table></div>` : empty('💰', 'Aucun projet actif')}</div>`;
      return;
    }
    zone.innerHTML = `<div class="card"><div class="toolbar">
        <select class="input" id="fp"><option value="">Tous les projets</option>${projets.map((x) => `<option value="${x.id}" ${fp === x.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select>
        <select class="input" id="fs"><option value="">Tous les statuts</option><option value="a_payer" ${fs === 'a_payer' ? 'selected' : ''}>⏳ À payer</option><option value="echue" ${fs === 'echue' ? 'selected' : ''}>⏰ Échues</option><option value="payee" ${fs === 'payee' ? 'selected' : ''}>✅ Payées</option><option value="a_verifier" ${fs === 'a_verifier' ? 'selected' : ''}>🔎 À vérifier (équipes)</option></select>
        <select class="input" id="fc"><option value="">Toutes catégories</option>${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}" ${fc === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="muted" id="total" style="margin-left:auto;font-size:13px"></span></div><div id="tf"></div></div>`;
    const l = filtrees();
    $('#tf', zone).innerHTML = tableauFactures(l);
    $('#total', zone).textContent = `${l.length} pièce(s) · ${money(l.reduce((s, f) => s + num(f.montant), 0))}`;
    $('#fp', zone).onchange = (e) => { fp = e.target.value; rendre(); };
    $('#fs', zone).onchange = (e) => { fs = e.target.value; rendre(); };
    $('#fc', zone).onchange = (e) => { fc = e.target.value; rendre(); };
    brancherFactures(zone, l, () => naviguer());
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletCompta = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  $('#nfa', p)?.addEventListener('click', () => formulaireFacture(null, () => naviguer()));
  $('#voir-verif', p)?.addEventListener('click', () => { ongletCompta = 'factures'; fs = 'a_verifier'; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x.dataset.o === 'factures')); rendre(); $('#tf', p)?.scrollIntoView({ behavior: 'smooth' }); });
  $('#csv', p).onclick = () => boutonExcel(filtrees(), projets);
  $('#scan-f', p)?.addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; scannerFactures(f, () => naviguer()); });
  rendre();
  if (memo.get('koordin-ouvrir') === 'facture') { memo.del('koordin-ouvrir'); formulaireFacture(null, () => naviguer()); }
};

function exporterCSV(nom, entetes, lignes) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenu = '﻿' + [entetes, ...lignes].map((l) => l.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ═══════════════════════════════ FACTURATION CLIENT (2.3) ═══════════════════════════════
// Devis poste par poste, situations de travaux (montants figés par la base à l'émission),
// encaissements du client et trésorerie.

let ongletVentes = 'devis';
const STATUT_DEVIS = {
  brouillon: ['muted', '📝 Brouillon'],
  envoye: ['info', '📤 Envoyé'],
  accepte: ['ok', '✅ Accepté'],
  refuse: ['crit', '✖️ Refusé'],
};
const MOYENS_ENCAISSEMENT = ['Virement', 'Wave', 'Orange Money', 'MTN MoMo', 'Moov Money', 'Chèque', 'Espèces'];
const montantLigne = (l, pct = 100) => Math.round(num(l.quantite) * num(l.prix_unitaire) * num(pct) / 100);
const totalDevis = (lignes) => lignes.reduce((s, l) => s + montantLigne(l), 0);
const erreurVentes = (e) => {
  const m = String(e?.message || '');
  if (/^(DEVIS_|SITUATION_)/.test(m) && e?.hint) return e.hint;
  if (/relation .*(devis|situations|encaissements)|emettre_situation/i.test(m) && /does not exist|schema cache|could not find/i.test(m))
    return 'La facturation client nécessite la mise à jour 2.3 de la base de données (kit d’installation).';
  return messageErreur(e);
};

PAGES.ventes = async () => {
  const onglets = [['devis', '📄 Devis'], ['situations', '📊 Situations'], ['encaissements', '💵 Encaissements'], ['tresorerie', '🏦 Trésorerie']];
  const p = page(`
    ${entete('Facturation client', 'Devis, situations de travaux, paiements du client et trésorerie')}
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletVentes ? 'active' : ''}" data-o="${k}">${l}</button>`).join('')}</div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('💼', 'La facturation client fonctionne dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try {
      if (ongletVentes === 'devis') await ongletDevis(zone, rendre);
      else if (ongletVentes === 'situations') await ongletSituations(zone, rendre);
      else if (ongletVentes === 'encaissements') await ongletEncaissements(zone, rendre);
      else await ongletTresorerie(zone);
    } catch (e) { console.error(e); zone.innerHTML = `<div class="card">${empty('💼', erreurVentes(e))}</div>`; }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletVentes = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  await rendre();
};

async function chargerVentes() {
  const [devis, lignes, situations, encaissements] = await Promise.all([
    q(sb.from('devis').select('*, projets(nom, client, localisation)').order('date_devis', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('devis_lignes').select('devis_id, quantite, prix_unitaire')),
    q(sb.from('situations').select('*, devis(numero, objet), projets(nom)').order('created_at', { ascending: false })),
    q(sb.from('encaissements').select('*, projets(nom), situations(numero, devis(numero))').order('date_encaissement', { ascending: false })),
  ]);
  devis.forEach((d) => {
    d.total_ht = totalDevis(lignes.filter((l) => l.devis_id === d.id));
    const emises = situations.filter((s) => s.devis_id === d.id && s.statut === 'emise');
    d.facture_ht = emises.length ? Math.max(...emises.map((s) => num(s.cumul_ht))) : 0;
  });
  situations.forEach((s) => { s.encaisse = encaissements.filter((e) => e.situation_id === s.id).reduce((t, e) => t + num(e.montant), 0); });
  return { devis, situations, encaissements };
}

// ─── Devis ───

async function ongletDevis(zone, rendre) {
  const { devis } = await chargerVentes();
  zone.innerHTML = `<div class="card"><div class="card-title">${devis.length} devis <button type="button" class="btn sm primary" id="nd">＋ Nouveau devis</button></div>
    ${devis.length ? `<div class="paie-liste">${devis.map((d) => `<button type="button" class="paie-ligne vente-ligne" data-devis="${d.id}">
      <div class="paie-nom"><b>${esc(d.numero)} · ${esc(d.objet)}</b><span>${esc([d.projets?.nom, d.client].filter(Boolean).join(' · '))}</span>
        ${d.facture_ht ? `<span class="vente-barre"><i style="width:${Math.min(100, pct(d.facture_ht, d.total_ht))}%"></i></span><span>Facturé : ${pct(d.facture_ht, d.total_ht)} %</span>` : ''}</div>
      <div class="paie-montant"><b>${money(d.total_ht)}</b><span>HT</span>${badge(STATUT_DEVIS[d.statut])}</div></button>`).join('')}</div>`
      : empty('📄', 'Aucun devis. Créez votre premier devis : vous pouvez reprendre les lots et budgets du chantier en un geste, puis ajuster les postes.')}
  </div>`;
  $('#nd', zone).onclick = () => nouveauDevis(rendre);
  $$('[data-devis]', zone).forEach((b) => (b.onclick = () => editeurDevis(b.dataset.devis, rendre)));
}

async function nouveauDevis(rendre) {
  const projets = await q(sb.from('projets').select('id, nom, client').neq('statut', 'termine').order('nom'));
  ouvrirModale({
    titre: 'Nouveau devis',
    boutonOk: 'Créer et ajouter les postes',
    corps: `<div class="form-grid">
      ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), '', { required: true, vide: '— Choisir —', full: true })}
      ${F.text('objet', 'Objet du devis', '', { required: true, full: true, placeholder: 'Ex. Construction d’une villa duplex R+1' })}
      ${F.text('client', 'Client', '', { placeholder: 'Nom du client ou maître d’ouvrage' })}
      ${F.text('date_devis', 'Date', todayISO(), { type: 'date', required: true })}
      ${F.text('tva_pct', 'TVA (%)', 18, { type: 'number', min: 0, max: 100, step: 'any', required: true })}
      ${F.text('retenue_pct', 'Retenue de garantie (%)', 5, { type: 'number', min: 0, max: 100, step: 'any', required: true })}
      <label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="lots" checked style="width:auto"> Reprendre les lots du chantier comme postes (avec leur budget)</label>
    </div>`,
    onOpen: (el) => { $('[name="projet_id"]', el).onchange = (e) => { const pr = projets.find((x) => x.id === e.target.value); if (pr?.client && !$('[name="client"]', el).value) $('[name="client"]', el).value = pr.client; }; },
    onSubmit: async (d) => {
      const cree = await q(sb.from('devis').insert({ projet_id: d.projet_id, objet: d.objet, client: d.client || null, date_devis: d.date_devis, tva_pct: num(d.tva_pct), retenue_pct: num(d.retenue_pct) }).select('id').single());
      if (d.lots) {
        const lots = await q(sb.from('lots').select('id, nom, budget, ordre').eq('projet_id', d.projet_id).order('ordre'));
        if (lots.length) await q(sb.from('devis_lignes').insert(lots.map((l, i) => ({ devis_id: cree.id, ordre: i + 1, section: l.nom, designation: l.nom, unite: 'ens', quantite: 1, prix_unitaire: num(l.budget), lot_id: l.id }))));
      }
      setTimeout(() => editeurDevis(cree.id, rendre), 50);
    },
  });
}

async function editeurDevis(id, rendre) {
  const [d, lignesInit, situations] = await Promise.all([
    q(sb.from('devis').select('*, projets(nom, localisation)').eq('id', id).single()),
    q(sb.from('devis_lignes').select('*').eq('devis_id', id).order('ordre')),
    q(sb.from('situations').select('id, statut').eq('devis_id', id)),
  ]);
  const verrou = situations.some((s) => s.statut === 'emise');
  let lignes = lignesInit.map((l) => ({ ...l }));
  const supprimees = [];
  const m = ouvrirModale({ titre: `${d.numero} · ${d.objet}`, large: true, corps: '<div id="dv"></div>' });
  const zone = $('#dv', m.el);
  const dessiner = () => {
    const ht = totalDevis(lignes);
    const tva = Math.round(ht * num(d.tva_pct) / 100);
    zone.innerHTML = `
      <p class="muted" style="font-size:13px;margin-bottom:10px">${esc([d.projets?.nom, d.client, `Devis du ${fdate(d.date_devis)}`].filter(Boolean).join(' · '))} · TVA ${num(d.tva_pct)} % · Retenue ${num(d.retenue_pct)} %</p>
      ${verrou ? '<div class="notice">🔒 Une situation a été émise sur ce devis : ses postes sont figés. Pour des travaux en plus, créez un devis complémentaire (avenant).</div>' : ''}
      <div class="dv-lignes">${lignes.map((l, i) => `<div class="dv-ligne">
        <div class="dv-haut">
          <input class="input" data-i="${i}" data-k="designation" value="${esc(l.designation)}" placeholder="Désignation du poste" ${verrou ? 'disabled' : ''}>
          ${verrou ? '' : `<button type="button" class="btn sm ghost" data-suppr="${i}" aria-label="Supprimer le poste">✕</button>`}
        </div>
        <div class="dv-bas">
          <label>Unité<input class="input" data-i="${i}" data-k="unite" value="${esc(l.unite)}" ${verrou ? 'disabled' : ''}></label>
          <label>Quantité<input class="input" type="number" min="0" step="any" inputmode="decimal" data-i="${i}" data-k="quantite" value="${esc(l.quantite)}" ${verrou ? 'disabled' : ''}></label>
          <label>Prix unitaire<input class="input" type="number" min="0" step="any" inputmode="numeric" data-i="${i}" data-k="prix_unitaire" value="${esc(l.prix_unitaire)}" ${verrou ? 'disabled' : ''}></label>
          <div class="dv-total"><span>Total</span><b data-total="${i}">${money(montantLigne(l))}</b></div>
        </div></div>`).join('') || empty('📄', 'Aucun poste. Ajoutez le premier poste ci-dessous.')}</div>
      ${verrou ? '' : '<button type="button" class="btn block" id="dv-ajout">＋ Ajouter un poste</button>'}
      <div class="dv-totaux">
        <div><span>Total HT</span><b id="dv-ht">${money(ht)}</b></div>
        <div><span>TVA ${num(d.tva_pct)} %</span><b id="dv-tva">${money(tva)}</b></div>
        <div class="fort"><span>Total TTC</span><b id="dv-ttc">${money(ht + tva)}</b></div>
      </div>
      <div class="form-grid mt">${F.select('statut', 'Statut du devis', Object.entries(STATUT_DEVIS).map(([k, [, l]]) => [k, l]), d.statut)}</div>
      <div class="rc-boutons mt">
        <button type="button" class="btn primary" id="dv-ok">💾 Enregistrer</button>
        <button type="button" class="btn" id="dv-pdf">📄 Devis en PDF</button>
        ${situations.length ? '' : '<button type="button" class="btn danger" id="dv-suppr">Supprimer le devis</button>'}
      </div>`;
    $$('[data-k]', zone).forEach((inp) => (inp.oninput = () => {
      const l = lignes[inp.dataset.i];
      l[inp.dataset.k] = inp.type === 'number' ? inp.value : inp.value;
      $(`[data-total="${inp.dataset.i}"]`, zone).textContent = money(montantLigne(l));
      const h = totalDevis(lignes), t = Math.round(h * num(d.tva_pct) / 100);
      $('#dv-ht', zone).textContent = money(h); $('#dv-tva', zone).textContent = money(t); $('#dv-ttc', zone).textContent = money(h + t);
    }));
    $$('[data-suppr]', zone).forEach((b) => (b.onclick = () => { const [x] = lignes.splice(Number(b.dataset.suppr), 1); if (x.id) supprimees.push(x.id); dessiner(); }));
    $('#dv-ajout', zone)?.addEventListener('click', () => { lignes.push({ designation: '', unite: 'u', quantite: 1, prix_unitaire: 0 }); dessiner(); $$('[data-k="designation"]', zone).at(-1)?.focus(); });
    $('#dv-ok', zone).onclick = enregistrer;
    $('#dv-pdf', zone).onclick = async () => { if (await enregistrer(false)) pdfDevis(id); };
    $('#dv-suppr', zone)?.addEventListener('click', async () => {
      if (!(await confirmer(`Supprimer le devis ${d.numero} et tous ses postes ?`, 'Supprimer'))) return;
      try { await q(sb.from('devis').delete().eq('id', id)); toast('Devis supprimé.'); m.fermer(); rendre(); } catch (e) { toast(erreurVentes(e), 'err', 6000); }
    });
  };
  const enregistrer = async (fermer = true) => {
    try {
      const statut = $('[name="statut"]', zone).value;
      if (statut !== d.statut) { await q(sb.from('devis').update({ statut }).eq('id', id)); d.statut = statut; }
      if (!verrou) {
        const vides = lignes.filter((l) => !String(l.designation || '').trim());
        if (vides.length) { toast('Chaque poste doit avoir une désignation.', 'warn'); return false; }
        if (supprimees.length) await q(sb.from('devis_lignes').delete().in('id', supprimees.splice(0)));
        const donnees = lignes.map((l, i) => ({ ...(l.id ? { id: l.id } : {}), devis_id: id, ordre: i + 1, section: l.section || null, designation: String(l.designation).trim(), unite: String(l.unite || 'u').trim() || 'u', quantite: num(l.quantite), prix_unitaire: num(l.prix_unitaire), lot_id: l.lot_id || null }));
        const anciens = donnees.filter((x) => x.id), nouveaux = donnees.filter((x) => !x.id);
        if (anciens.length) await q(sb.from('devis_lignes').upsert(anciens));
        if (nouveaux.length) {
          const crees = await q(sb.from('devis_lignes').insert(nouveaux).select('id, ordre'));
          crees.forEach((c) => { lignes[c.ordre - 1].id = c.id; });
        }
      }
      toast('Devis enregistré ✅');
      if (fermer) { m.fermer(); rendre(); }
      return true;
    } catch (e) { toast(erreurVentes(e), 'err', 6000); return false; }
  };
  dessiner();
}

// ─── Situations ───

async function ongletSituations(zone, rendre) {
  const { devis, situations } = await chargerVentes();
  const ouverts = devis.filter((d) => d.statut !== 'refuse');
  zone.innerHTML = `<div class="card"><div class="card-title">Situations de travaux ${ouverts.length ? '<button type="button" class="btn sm primary" id="ns">＋ Nouvelle situation</button>' : ''}</div>
    <p class="hint" style="margin:-6px 0 12px">Chaque mois, indiquez le % réalisé de chaque poste : KOORDIN calcule les travaux du mois, la TVA, la retenue de garantie et le net à payer.</p>
    ${situations.length ? `<div class="paie-liste">${situations.map((s) => `<button type="button" class="paie-ligne vente-ligne" data-sit="${s.id}">
      <div class="paie-nom"><b>Situation n° ${s.numero} · ${esc(s.devis?.numero || '')}</b><span>${esc([s.projets?.nom, fdate(s.date_situation)].filter(Boolean).join(' · '))}</span></div>
      <div class="paie-montant">${s.statut === 'emise' ? `<b>${money(s.net_a_payer)}</b><span>net à payer</span>${badge(s.encaisse >= num(s.net_a_payer) ? ['ok', '✅ Payée'] : s.encaisse > 0 ? ['warn', `⏳ Reste ${moneyShort(num(s.net_a_payer) - s.encaisse)}`] : ['info', '📤 Émise'])}` : badge(['muted', '📝 En préparation'])}</div></button>`).join('')}</div>`
      : empty('📊', ouverts.length ? 'Aucune situation. Créez la première quand des travaux ont été réalisés.' : 'Créez d’abord un devis dans l’onglet « Devis ».')}
  </div>`;
  $('#ns', zone)?.addEventListener('click', () => ouvrirModale({
    titre: 'Nouvelle situation de travaux',
    boutonOk: 'Préparer la situation',
    corps: `<div class="form-grid">${F.select('devis_id', 'Devis', ouverts.map((d) => [d.id, `${d.numero} · ${d.objet} (${d.projets?.nom || ''})`]), ouverts[0]?.id, { required: true, full: true })}
      ${F.text('date_situation', 'Date de la situation', todayISO(), { type: 'date', required: true })}</div>`,
    onSubmit: async (v) => {
      try {
        const s = await q(sb.from('situations').insert({ devis_id: v.devis_id, projet_id: devis.find((d) => d.id === v.devis_id).projet_id, date_situation: v.date_situation }).select('id').single());
        setTimeout(() => editeurSituation(s.id, rendre), 50);
      } catch (e) { throw new Error(erreurVentes(e)); }
    },
  }));
  $$('[data-sit]', zone).forEach((b) => (b.onclick = () => editeurSituation(b.dataset.sit, rendre)));
}

async function editeurSituation(id, rendre) {
  const s = await q(sb.from('situations').select('*, devis(*), projets(nom)').eq('id', id).single());
  const [lignes, mesLignes, precedentes, lots] = await Promise.all([
    q(sb.from('devis_lignes').select('*').eq('devis_id', s.devis_id).order('ordre')),
    q(sb.from('situation_lignes').select('*').eq('situation_id', id)),
    q(sb.from('situations').select('id, numero, cumul_ht').eq('devis_id', s.devis_id).eq('statut', 'emise').lt('numero', s.numero).order('numero', { ascending: false }).limit(1)),
    q(sb.from('lots').select('id, avancement').eq('projet_id', s.projet_id)),
  ]);
  const prec = precedentes[0];
  const precLignes = prec ? await q(sb.from('situation_lignes').select('*').eq('situation_id', prec.id)) : [];
  const pctPrec = (l) => num(precLignes.find((x) => x.devis_ligne_id === l.id)?.pourcentage);
  const pct0 = new Map(lignes.map((l) => [l.id, mesLignes.find((x) => x.devis_ligne_id === l.id)?.pourcentage ?? pctPrec(l)]));
  const emise = s.statut === 'emise';
  const d = s.devis;
  const payeur = can('direction', 'comptable');
  const m = ouvrirModale({ titre: `Situation n° ${s.numero} · ${d.numero}`, large: true, corps: '<div id="st"></div>' });
  const zone = $('#st', m.el);
  const calcul = () => {
    const cumul = lignes.reduce((t, l) => t + montantLigne(l, pct0.get(l.id)), 0);
    const precedent = num(prec?.cumul_ht);
    const mois = cumul - precedent;
    const tva = Math.round(mois * num(d.tva_pct) / 100);
    const ttc = mois + tva;
    const retenue = Math.round(ttc * num(d.retenue_pct) / 100);
    return emise
      ? { cumul: num(s.cumul_ht), precedent: num(s.precedent_ht), mois: num(s.travaux_ht), tva: num(s.tva), ttc: num(s.ttc), retenue: num(s.retenue), net: num(s.net_a_payer) }
      : { cumul, precedent, mois, tva, ttc, retenue, net: ttc - retenue };
  };
  const totaux = () => {
    const c = calcul();
    return `<div><span>Cumul des travaux réalisés HT</span><b>${money(c.cumul)}</b></div>
      <div><span>Moins situations précédentes</span><b>− ${money(c.precedent)}</b></div>
      <div><span>Travaux de la période HT</span><b>${money(c.mois)}</b></div>
      <div><span>TVA ${num(d.tva_pct)} %</span><b>${money(c.tva)}</b></div>
      <div><span>Montant TTC</span><b>${money(c.ttc)}</b></div>
      <div><span>Retenue de garantie ${num(d.retenue_pct)} %</span><b>− ${money(c.retenue)}</b></div>
      <div class="fort"><span>Net à payer</span><b>${money(c.net)}</b></div>`;
  };
  zone.innerHTML = `
    <p class="muted" style="font-size:13px;margin-bottom:10px">${esc([s.projets?.nom, d.objet, fdate(s.date_situation)].filter(Boolean).join(' · '))}</p>
    ${emise ? `<div class="notice ok">✅ Situation émise le ${new Date(s.emise_le).toLocaleDateString('fr-FR')} : les montants sont figés.</div>` : `<div class="notice">Indiquez pour chaque poste le <b>% réalisé depuis le début</b> (cumulé). ${lots.length ? 'Le bouton ci-dessous reprend l’avancement des lots déclaré par le terrain.' : ''}</div>`}
    ${!emise && lignes.some((l) => l.lot_id) ? '<button type="button" class="btn sm" id="st-lots">↻ Reprendre l’avancement des lots</button>' : ''}
    <div class="dv-lignes">${lignes.map((l) => `<div class="dv-ligne">
      <div class="dv-haut"><b>${esc(l.designation)}</b><span class="muted" style="font-size:12px;white-space:nowrap">${money(montantLigne(l))}</span></div>
      <div class="st-bas">
        <span class="muted" style="font-size:12px">Précédent : ${pctPrec(l)} %</span>
        <label class="st-pct"><input class="input" type="number" min="${pctPrec(l)}" max="100" step="any" inputmode="decimal" data-l="${l.id}" value="${num(pct0.get(l.id))}" ${emise ? 'disabled' : ''}> %</label>
        <b data-mt="${l.id}">${money(montantLigne(l, pct0.get(l.id)))}</b>
      </div></div>`).join('')}</div>
    <div class="dv-totaux" id="st-tot">${totaux()}</div>
    <div class="rc-boutons mt">
      ${emise ? '' : '<button type="button" class="btn" id="st-ok">💾 Enregistrer le brouillon</button>'}
      ${!emise && payeur ? '<button type="button" class="btn primary" id="st-emettre">✅ Émettre la situation</button>' : ''}
      ${emise ? '<button type="button" class="btn primary" id="st-pdf">📄 Situation en PDF</button>' : ''}
      ${emise && payeur ? '<button type="button" class="btn" id="st-enc">💵 Enregistrer un paiement</button>' : ''}
      ${!emise ? '<button type="button" class="btn danger" id="st-suppr">Supprimer</button>' : ''}
    </div>
    ${!emise && !payeur ? '<p class="hint mt">L’émission est faite par la Direction ou la Comptabilité.</p>' : ''}`;
  const maj = () => $('#st-tot', zone).innerHTML = totaux();
  $$('[data-l]', zone).forEach((inp) => (inp.oninput = () => {
    const v = Math.max(0, Math.min(100, num(inp.value)));
    pct0.set(inp.dataset.l, v);
    $(`[data-mt="${inp.dataset.l}"]`, zone).textContent = money(montantLigne(lignes.find((x) => x.id === inp.dataset.l), v));
    maj();
  }));
  $('#st-lots', zone)?.addEventListener('click', () => {
    lignes.forEach((l) => {
      const lot = lots.find((x) => x.id === l.lot_id);
      if (lot && num(lot.avancement) > num(pct0.get(l.id))) { pct0.set(l.id, num(lot.avancement)); const inp = $(`[data-l="${l.id}"]`, zone); inp.value = num(lot.avancement); inp.dispatchEvent(new Event('input')); }
    });
    toast('Avancement des lots repris ✅ Vérifiez avant d’émettre.');
  });
  const enregistrer = async () => {
    const recul = lignes.find((l) => num(pct0.get(l.id)) < pctPrec(l));
    if (recul) { toast(`« ${recul.designation} » ne peut pas descendre sous ${pctPrec(recul)} %.`, 'warn', 6000); return false; }
    await q(sb.from('situation_lignes').upsert(lignes.map((l) => ({ situation_id: id, devis_ligne_id: l.id, pourcentage: num(pct0.get(l.id)) }))));
    return true;
  };
  $('#st-ok', zone)?.addEventListener('click', async () => { try { if (await enregistrer()) { toast('Brouillon enregistré ✅'); m.fermer(); rendre(); } } catch (e) { toast(erreurVentes(e), 'err', 6000); } });
  $('#st-emettre', zone)?.addEventListener('click', async () => {
    const c = calcul();
    if (c.mois <= 0) { toast('Aucun travail nouveau depuis la situation précédente.', 'warn'); return; }
    if (!(await confirmer(`Émettre la situation n° ${s.numero} ? Net à payer : ${money(c.net)}. Les montants seront figés.`, 'Émettre'))) return;
    try {
      if (!(await enregistrer())) return;
      const { error } = await sb.rpc('emettre_situation', { p_situation: id });
      if (error) throw error;
      toast('Situation émise ✅');
      m.fermer(); rendre();
      pdfSituation(id);
    } catch (e) { toast(erreurVentes(e), 'err', 7000); }
  });
  $('#st-pdf', zone)?.addEventListener('click', () => pdfSituation(id));
  $('#st-enc', zone)?.addEventListener('click', () => { m.fermer(); formulaireEncaissement(rendre, s); });
  $('#st-suppr', zone)?.addEventListener('click', async () => {
    if (!(await confirmer(`Supprimer le brouillon de la situation n° ${s.numero} ?`, 'Supprimer'))) return;
    try { await q(sb.from('situations').delete().eq('id', id)); toast('Brouillon supprimé.'); m.fermer(); rendre(); } catch (e) { toast(erreurVentes(e), 'err'); }
  });
}

// ─── Encaissements ───

async function ongletEncaissements(zone, rendre) {
  const { situations, encaissements } = await chargerVentes();
  const emises = situations.filter((s) => s.statut === 'emise');
  const facture = emises.reduce((t, s) => t + num(s.net_a_payer), 0);
  const encaisse = encaissements.reduce((t, e) => t + num(e.montant), 0);
  const retenues = emises.reduce((t, s) => t + num(s.retenue), 0);
  const payeur = can('direction', 'comptable');
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi('Facturé au client (net)', moneyShort(facture))}
      ${kpi('Encaissé', moneyShort(encaisse), `${pct(encaisse, facture)} %`)}
      ${kpi('Reste à encaisser', moneyShort(Math.max(0, facture - encaisse)), '', facture - encaisse > 0 ? 'warn' : '')}
      ${kpi('Retenues de garantie', moneyShort(retenues), 'à récupérer en fin de garantie')}
    </div>
    <div class="card"><div class="card-title">Paiements reçus ${payeur ? '<button type="button" class="btn sm primary" id="ne">＋ Paiement reçu</button>' : ''}</div>
    ${encaissements.length ? `<div class="paie-liste">${encaissements.map((e) => `<div class="paie-ligne">
      <div class="paie-nom"><b>${esc(e.projets?.nom || '')}</b><span>${esc([fdate(e.date_encaissement), e.moyen, e.reference, e.situations ? `Situation n° ${e.situations.numero} (${e.situations.devis?.numero || ''})` : null].filter(Boolean).join(' · '))}</span></div>
      <div class="paie-montant"><b>${money(e.montant)}</b>${payeur ? `<button type="button" class="btn sm ghost" data-suppr-enc="${e.id}">Supprimer</button>` : ''}</div></div>`).join('')}</div>`
      : empty('💵', 'Aucun paiement enregistré. Ajoutez chaque paiement du client (Wave, Orange Money, virement…) pour suivre ce qui reste à encaisser.')}
  </div>`;
  $('#ne', zone)?.addEventListener('click', () => formulaireEncaissement(rendre));
  $$('[data-suppr-enc]', zone).forEach((b) => (b.onclick = async () => {
    if (!(await confirmer('Supprimer ce paiement ?', 'Supprimer'))) return;
    try { await q(sb.from('encaissements').delete().eq('id', b.dataset.supprEnc)); toast('Paiement supprimé.'); rendre(); } catch (e) { toast(erreurVentes(e), 'err'); }
  }));
}

async function formulaireEncaissement(rendre, situation = null) {
  const { situations } = await chargerVentes();
  const emises = situations.filter((s) => s.statut === 'emise');
  const projets = await listeProjets();
  const reste = (s) => Math.max(0, num(s.net_a_payer) - s.encaisse);
  const s0 = situation ? emises.find((x) => x.id === situation.id) : null;
  ouvrirModale({
    titre: 'Paiement reçu du client',
    corps: `<div class="form-grid">
      ${F.select('situation_id', 'Pour la situation', [['', '— Avance ou autre paiement —'], ...emises.map((s) => [s.id, `N° ${s.numero} · ${s.devis?.numero} · ${s.projets?.nom} (reste ${moneyShort(reste(s))})`])], s0?.id || '', { full: true })}
      ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), s0?.projet_id || '', { required: true, vide: '— Choisir —' })}
      ${F.text('montant', `Montant reçu (${devise()})`, s0 ? reste(s0) : '', { type: 'number', min: 1, required: true, inputmode: 'numeric' })}
      ${F.text('date_encaissement', 'Date', todayISO(), { type: 'date', required: true })}
      ${F.select('moyen', 'Moyen de paiement', MOYENS_ENCAISSEMENT.map((x) => [x, x]), 'Virement')}
      ${F.text('reference', 'Référence (n° de transaction, chèque…)', '')}
    </div>`,
    onOpen: (el) => {
      $('[name="situation_id"]', el).onchange = (e) => {
        const s = emises.find((x) => x.id === e.target.value);
        if (s) { $('[name="projet_id"]', el).value = s.projet_id; $('[name="montant"]', el).value = reste(s); }
      };
    },
    onSubmit: async (v) => {
      try {
        await q(sb.from('encaissements').insert({ situation_id: v.situation_id || null, projet_id: v.projet_id, montant: num(v.montant), date_encaissement: v.date_encaissement, moyen: v.moyen, reference: v.reference || null }));
      } catch (e) { throw new Error(erreurVentes(e)); }
      toast('Paiement enregistré ✅');
      ongletVentes = 'encaissements';
      rendre();
    },
  });
}

// ─── Trésorerie ───

async function ongletTresorerie(zone) {
  const debut = (() => { const x = parseDay(todayISO()); x.setDate(1); x.setMonth(x.getMonth() - 5); return x.toLocaleDateString('sv-SE'); })();
  const [enc, factPayees, factAPayer, paie, { situations, encaissements }] = await Promise.all([
    q(sb.from('encaissements').select('montant, date_encaissement').gte('date_encaissement', debut)),
    q(sb.from('factures').select('montant, date_paiement').eq('statut', 'payee').gte('date_paiement', debut)),
    q(sb.from('factures').select('montant').eq('statut', 'a_payer')),
    sb.from('pointages').select('presence, tarif_jour, paye_le').eq('paye', true).gte('paye_le', debut).then((r) => r.data || []),
    chargerVentes(),
  ]);
  const presta = await sb.from('contrat_versements').select('montant, date_versement').gte('date_versement', debut).then((r) => r.data || [], () => []);
  const mois = [...Array(6)].map((_, i) => { const x = parseDay(debut); x.setMonth(x.getMonth() + i); return x.toLocaleDateString('sv-SE').slice(0, 7); });
  const lignes = mois.map((mo) => {
    const entree = enc.filter((e) => String(e.date_encaissement).startsWith(mo)).reduce((t, e) => t + num(e.montant), 0);
    const fournisseurs = factPayees.filter((f) => String(f.date_paiement).startsWith(mo)).reduce((t, f) => t + num(f.montant), 0);
    const mainOeuvre = paie.filter((p) => String(p.paye_le).startsWith(mo)).reduce((t, p) => t + num(p.presence) * num(p.tarif_jour), 0);
    const prestataires = presta.filter((v) => String(v.date_versement).startsWith(mo)).reduce((t, v) => t + num(v.montant), 0);
    return { mo, entree, sortie: fournisseurs + mainOeuvre + prestataires, fournisseurs, mainOeuvre, prestataires };
  });
  const max = Math.max(1, ...lignes.flatMap((l) => [l.entree, l.sortie]));
  const creances = Math.max(0, situations.filter((s) => s.statut === 'emise').reduce((t, s) => t + num(s.net_a_payer), 0) - encaissements.filter((e) => e.situation_id).reduce((t, e) => t + num(e.montant), 0));
  const dettes = factAPayer.reduce((t, f) => t + num(f.montant), 0);
  const solde6 = lignes.reduce((t, l) => t + l.entree - l.sortie, 0);
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi('Le client vous doit', moneyShort(creances), 'situations non encaissées', creances > 0 ? 'warn' : '')}
      ${kpi('Vous devez aux fournisseurs', moneyShort(dettes), 'factures à payer', dettes > 0 ? 'alert' : '')}
      ${kpi('Position nette', moneyShort(creances - dettes), creances - dettes >= 0 ? 'créances > dettes' : 'dettes > créances', creances - dettes < 0 ? 'alert' : '')}
      ${kpi('Solde des 6 derniers mois', moneyShort(solde6), 'entrées − sorties', solde6 < 0 ? 'alert' : '')}
    </div>
    <div class="card"><div class="card-title">Entrées et sorties d’argent, mois par mois</div>
      <div class="treso">${lignes.map((l) => {
        const lib = parseDay(`${l.mo}-01`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        return `<div class="treso-mois"><span class="treso-lib">${esc(lib)}</span>
          <div class="treso-barres"><div class="treso-in" style="width:${(l.entree / max) * 100}%"></div><div class="treso-out" style="width:${(l.sortie / max) * 100}%"></div></div>
          <span class="treso-val"><b class="ok">${l.entree ? `+${moneyShort(l.entree)}` : '—'}</b><b class="out">${l.sortie ? `−${moneyShort(l.sortie)}` : '—'}</b></span></div>`;
      }).join('')}</div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Encaissé (clients)</span><span><i style="background:var(--crit)"></i>Payé (fournisseurs, main-d’œuvre, prestataires)</span></div>
    </div>`;
}

// ─── PDF devis et situation ───

function presenterPDF(blob, nom, message) {
  const fichier = new File([blob], nom, { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const partage = navigator.canShare?.({ files: [fichier] });
  const m = ouvrirModale({
    titre: '📄 PDF prêt',
    corps: `<p style="margin-bottom:10px">${esc(nom)}</p><div class="rc-boutons">
      ${partage ? '<button type="button" class="btn primary" id="pp-partager">📤 Envoyer (WhatsApp…)</button>' : ''}
      <a class="btn ${partage ? '' : 'primary'}" href="${url}" download="${esc(nom)}">⬇️ Télécharger</a>
      <a class="btn ghost" href="${url}" target="_blank" rel="noopener">👁️ Voir</a></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button></div>`,
  });
  $('#pp-partager', m.el)?.addEventListener('click', async () => {
    try { await navigator.share({ files: [fichier], title: nom, text: message }); } catch (e) { if (e?.name !== 'AbortError') toast('Le partage n’a pas fonctionné : téléchargez le PDF.', 'warn'); }
  });
  attendreFermeture(m.el).then(() => setTimeout(() => URL.revokeObjectURL(url), 60000));
}

const couleurPDF = () => hexRgb(S.entreprise?.couleur_marque || MARQUE_DEFAUT);
const couleurPDFClaire = () => { const [r, g, b] = couleurPDF(); const lum = 0.299 * r + 0.587 * g + 0.114 * b; const k = lum < 120 ? 0.45 : 0; return [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k].map(Math.round); };
async function enteteDocumentPDF(doc, titre, sousTitre, droite) {
  const L = 210, M = 16;
  doc.setFillColor(17, 21, 33); doc.rect(0, 0, L, 34, 'F');
  doc.setFillColor(...couleurPDF()); doc.rect(0, 34, L, 1.2, 'F');
  let x = M;
  const dl = await dimensionsLogo();
  if (dl) {
    const h = 22, l = Math.min(44, (dl.l / dl.h) * h), hh = (dl.h / dl.l) * l;
    doc.setFillColor(255, 255, 255); doc.roundedRect(M - 2, 17 - hh / 2 - 2, l + 4, hh + 4, 2, 2, 'F');
    try { doc.addImage(S.entreprise.logo, /webp/.test(S.entreprise.logo) ? 'WEBP' : /jpeg/.test(S.entreprise.logo) ? 'JPEG' : 'PNG', M, 17 - hh / 2, l, hh); x = M + l + 7; } catch { /* logo illisible */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(255, 255, 255);
  doc.text(textePDF(S.entreprise?.nom || ''), x, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(200, 205, 220);
  doc.text(textePDF(S.entreprise?.pays || ''), x, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...couleurPDFClaire());
  doc.text(textePDF(titre), L - M, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(220, 224, 235);
  doc.text(textePDF(sousTitre), L - M, 22, { align: 'right' });
  if (droite) doc.text(textePDF(droite), L - M, 28, { align: 'right' });
}

function piedPDF(doc, libelle) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 229, 238); doc.setLineWidth(0.3); doc.line(16, 284, 194, 284);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 108, 128);
    doc.text(textePDF(`${libelle}  ·  page ${i}/${n}`), 16, 289);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...couleurPDF()); doc.text('Document généré avec KOORDIN', 194, 289, { align: 'right' });
  }
}

function tableauPDF(doc, y, colonnes, lignes, { pied = [] } = {}) {
  const M = 16, LU = 178, H = 297;
  const ent = () => {
    doc.setFillColor(244, 245, 249); doc.rect(M, y - 4.5, LU, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60, 66, 84);
    colonnes.forEach((c) => doc.text(textePDF(c.titre), c.align === 'right' ? c.x + c.l : c.x, y, { align: c.align || 'left' }));
    y += 6;
  };
  ent();
  lignes.forEach((l) => {
    doc.setFont('helvetica', l.gras ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(17, 21, 33);
    const des = doc.splitTextToSize(textePDF(l.cells[0]), colonnes[0].l);
    const h = Math.max(5, des.length * 4.2);
    if (y + h > H - 22) { doc.addPage(); y = 20; ent(); }
    doc.text(des, colonnes[0].x, y);
    l.cells.slice(1).forEach((v, i) => { const c = colonnes[i + 1]; doc.text(textePDF(v), c.align === 'right' ? c.x + c.l : c.x, y, { align: c.align || 'left' }); });
    y += h;
    doc.setDrawColor(235, 237, 243); doc.setLineWidth(0.2); doc.line(M, y - 3, M + LU, y - 3);
  });
  y += 3;
  pied.forEach(([lib, val, fort]) => {
    if (y > H - 30) { doc.addPage(); y = 20; }
    if (fort) { doc.setFillColor(17, 21, 33); doc.rect(M + LU - 92, y - 4.6, 92, 7.4, 'F'); doc.setTextColor(255, 255, 255); } else doc.setTextColor(17, 21, 33);
    doc.setFont('helvetica', fort ? 'bold' : 'normal'); doc.setFontSize(fort ? 10.5 : 9.5);
    doc.text(textePDF(lib), M + LU - 88, y);
    doc.text(textePDF(val), M + LU - 3, y, { align: 'right' });
    y += fort ? 8.5 : 6;
  });
  return y;
}

async function pdfDevis(id) {
  try {
    const JsPDF = await chargerJsPDF();
    const [d, lignes] = await Promise.all([
      q(sb.from('devis').select('*, projets(nom, localisation)').eq('id', id).single()),
      q(sb.from('devis_lignes').select('*').eq('devis_id', id).order('ordre')),
    ]);
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const fin = parseDay(d.date_devis); fin.setDate(fin.getDate() + num(d.validite_jours));
    await enteteDocumentPDF(doc, 'DEVIS', `N° ${d.numero}`, `du ${fdate(d.date_devis)}`);
    let y = 46;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(100, 108, 128); doc.text('CLIENT', 16, y);
    doc.text('CHANTIER', 110, y); y += 5.5;
    doc.setFontSize(11); doc.setTextColor(17, 21, 33);
    doc.text(doc.splitTextToSize(textePDF(d.client || '—'), 88), 16, y);
    doc.text(doc.splitTextToSize(textePDF([d.projets?.nom, d.projets?.localisation].filter(Boolean).join(' - ')), 84), 110, y);
    y += 13;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(doc.splitTextToSize(textePDF(`Objet : ${d.objet}`), 178), 16, y); y += 9;
    const ht = totalDevis(lignes), tva = Math.round(ht * num(d.tva_pct) / 100);
    y = tableauPDF(doc, y, [
      { titre: 'Désignation', x: 16, l: 80 }, { titre: 'Unité', x: 98, l: 14 }, { titre: 'Qté', x: 112, l: 16, align: 'right' },
      { titre: 'Prix unitaire', x: 130, l: 28, align: 'right' }, { titre: 'Montant', x: 160, l: 34, align: 'right' },
    ], lignes.map((l) => ({ cells: [l.designation, l.unite, nf.format(num(l.quantite)), nf.format(num(l.prix_unitaire)), nf.format(montantLigne(l))] })), {
      pied: [['Total HT', money(ht)], [`TVA ${num(d.tva_pct)} %`, money(tva)], ['Total TTC', money(ht + tva), true]],
    });
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 86, 104);
    const conditions = [`Devis valable jusqu'au ${fin.toLocaleDateString('fr-FR')}.`, `Paiement par situations de travaux mensuelles. Retenue de garantie : ${num(d.retenue_pct)} %.`, d.notes].filter(Boolean);
    conditions.forEach((c) => { doc.text(doc.splitTextToSize(textePDF(c), 178), 16, y); y += 5; });
    y += 8;
    if (y > 255) { doc.addPage(); y = 30; }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(17, 21, 33);
    doc.text('Bon pour accord (date, signature et cachet du client)', 16, y);
    doc.text(textePDF(`Pour ${S.entreprise?.nom || ''}`), 120, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 88, 26); doc.rect(120, y + 3, 74, 26);
    piedPDF(doc, `${S.entreprise?.nom || ''} - Devis ${d.numero}`);
    presenterPDF(doc.output('blob'), `Devis-${d.numero}.pdf`, `Bonjour, veuillez trouver ci-joint notre devis ${d.numero} : ${d.objet}. Cordialement, ${S.entreprise?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurVentes(e), 'err', 6000); }
}

async function pdfSituation(id) {
  try {
    const JsPDF = await chargerJsPDF();
    const s = await q(sb.from('situations').select('*, devis(*), projets(nom, localisation)').eq('id', id).single());
    const [lignes, mes, precs] = await Promise.all([
      q(sb.from('devis_lignes').select('*').eq('devis_id', s.devis_id).order('ordre')),
      q(sb.from('situation_lignes').select('*').eq('situation_id', id)),
      q(sb.from('situations').select('id').eq('devis_id', s.devis_id).eq('statut', 'emise').lt('numero', s.numero).order('numero', { ascending: false }).limit(1)),
    ]);
    const precL = precs[0] ? await q(sb.from('situation_lignes').select('*').eq('situation_id', precs[0].id)) : [];
    const pct = (arr, l) => num(arr.find((x) => x.devis_ligne_id === l.id)?.pourcentage);
    const d = s.devis;
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, `SITUATION N° ${s.numero}`, `Marché ${d.numero}`, `au ${fdate(s.date_situation)}`);
    let y = 46;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(100, 108, 128); doc.text('CLIENT', 16, y); doc.text('CHANTIER', 110, y); y += 5.5;
    doc.setFontSize(11); doc.setTextColor(17, 21, 33);
    doc.text(doc.splitTextToSize(textePDF(d.client || '—'), 88), 16, y);
    doc.text(doc.splitTextToSize(textePDF([s.projets?.nom, s.projets?.localisation].filter(Boolean).join(' - ')), 84), 110, y);
    y += 13;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(doc.splitTextToSize(textePDF(`Objet : ${d.objet}`), 178), 16, y); y += 9;
    const total = totalDevis(lignes);
    y = tableauPDF(doc, y, [
      { titre: 'Poste', x: 16, l: 66 }, { titre: 'Montant marché', x: 84, l: 28, align: 'right' },
      { titre: '% préc.', x: 114, l: 16, align: 'right' }, { titre: '% cumulé', x: 132, l: 18, align: 'right' }, { titre: 'Réalisé cumulé', x: 152, l: 42, align: 'right' },
    ], [...lignes.map((l) => ({ cells: [l.designation, nf.format(montantLigne(l)), `${pct(precL, l)} %`, `${pct(mes, l)} %`, nf.format(montantLigne(l, pct(mes, l)))] })),
      { gras: true, cells: ['TOTAL', nf.format(total), '', `${total ? Math.round((num(s.cumul_ht) / total) * 100) : 0} %`, nf.format(num(s.cumul_ht))] }], {
      pied: [
        ['Cumul des travaux réalisés HT', money(s.cumul_ht)], ['Moins situations précédentes', `- ${money(s.precedent_ht)}`],
        ['Travaux de la période HT', money(s.travaux_ht)], [`TVA ${num(d.tva_pct)} %`, money(s.tva)], ['Montant TTC', money(s.ttc)],
        [`Retenue de garantie ${num(d.retenue_pct)} %`, `- ${money(s.retenue)}`], ['NET À PAYER', money(s.net_a_payer), true],
      ],
    });
    y += 8;
    if (y > 255) { doc.addPage(); y = 30; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(17, 21, 33);
    doc.text('Visa du client / maître d\'oeuvre', 16, y); doc.text(textePDF(`Pour ${S.entreprise?.nom || ''}`), 120, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 88, 26); doc.rect(120, y + 3, 74, 26);
    piedPDF(doc, `${S.entreprise?.nom || ''} - Situation n° ${s.numero} - ${d.numero}`);
    presenterPDF(doc.output('blob'), `Situation-${s.numero}-${d.numero}.pdf`, `Bonjour, veuillez trouver ci-joint la situation de travaux n° ${s.numero} (${d.objet}). Net à payer : ${money(s.net_a_payer)}. Cordialement, ${S.entreprise?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurVentes(e), 'err', 6000); }
}

// ═══════════════════════════════ MATÉRIEL ET ENGINS (2.7) ═══════════════════════════════

const CATEGORIES_MATERIEL = { engin: '🚜 Engin', vehicule: '🚚 Véhicule', outil: '🔨 Outil', groupe: '⚡ Groupe électrogène', echafaudage: '🏗️ Échafaudage', autre: '📦 Autre' };
const ETAT_MATERIEL = {
  disponible: ['info', '🅿️ Au dépôt'],
  en_service: ['ok', '✅ En service'],
  en_panne: ['crit', '⚠️ En panne'],
  entretien: ['warn', '🛠️ En entretien'],
};
const TYPE_EVT_MATERIEL = { affectation: '🚚 Déplacement', carburant: '⛽ Carburant', panne: '⚠️ Panne', reparation: '🔧 Réparation', entretien: '🛠️ Entretien', compteur: '⏱️ Relevé du compteur' };
let ongletMateriel = 'parc';
const entretienProche = (m) => m.entretien_tous_les && num(m.compteur) - num(m.dernier_entretien) >= num(m.entretien_tous_les) * 0.9;
const erreurMateriel = (e) => (/relation .*(materiels|materiel_evenements|securite|receptions|reserves)/i.test(String(e?.message)) && /does not exist|schema cache|could not find/i.test(String(e?.message))
  ? 'Cette fonction nécessite la mise à jour 2.7 de la base de données (kit d’installation).' : messageErreur(e));

PAGES.materiel = async () => {
  const gerer = can('direction', 'coordinateur', 'magasinier');
  const p = page(`
    ${entete('Matériel et engins', 'Où est chaque engin, carburant, pannes, entretien et coût par chantier', gerer ? '<button class="btn primary" id="nm">＋ Nouveau matériel</button>' : '')}
    <div class="tabs"><button class="tab ${ongletMateriel === 'parc' ? 'active' : ''}" data-o="parc">🚜 Le parc</button>${can('direction', 'coordinateur', 'comptable', 'magasinier') ? `<button class="tab ${ongletMateriel === 'couts' ? 'active' : ''}" data-o="couts">💰 Coût par chantier</button>` : ''}</div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('🚜', 'Le suivi du matériel fonctionne dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try { if (ongletMateriel === 'couts') await coutsMateriel(zone); else await parcMateriel(zone, rendre); }
    catch (e) { zone.innerHTML = `<div class="card">${empty('🚜', erreurMateriel(e))}</div>`; }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletMateriel = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  $('#nm', p)?.addEventListener('click', () => formulaireMateriel(null, rendre));
  await rendre();
};

async function parcMateriel(zone, rendre) {
  const materiels = await q(sb.from('materiels').select('*, projets(nom)').eq('actif', true).order('nom'));
  const panne = materiels.filter((m) => m.etat === 'en_panne').length;
  const entretien = materiels.filter(entretienProche).length;
  let filtre = '';
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi('Matériels suivis', materiels.length)}
      ${kpi('En service', materiels.filter((m) => m.etat === 'en_service').length)}
      ${kpi('En panne', panne, panne ? 'À réparer' : '✅ Aucune', panne ? 'alert' : '')}
      ${kpi('Entretien à prévoir', entretien, entretien ? 'Vidange, révision…' : '✅ Rien d’urgent', entretien ? 'warn' : '')}
    </div>
    <div class="card"><input class="input" id="mq" placeholder="🔍 Rechercher un engin, un chantier…" style="width:100%">
      <div class="paie-liste" id="ml"></div></div>`;
  const dessiner = () => {
    const l = materiels.filter((m) => !filtre || `${m.nom} ${m.reference || ''} ${m.projets?.nom || ''}`.toLowerCase().includes(filtre));
    $('#ml', zone).innerHTML = l.length ? l.map((m) => `<button type="button" class="paie-ligne vente-ligne" data-mat="${m.id}">
      <div class="paie-nom"><b>${esc(m.nom)}</b><span>${esc([CATEGORIES_MATERIEL[m.categorie], m.reference, m.proprietaire === 'location' ? 'En location' : null].filter(Boolean).join(' · '))}</span>
        <span>📍 ${esc(m.projets?.nom || 'Au dépôt')} · ⏱️ ${nf.format(num(m.compteur))} ${m.unite_compteur}${entretienProche(m) ? ' · <b style="color:var(--warn)">🛠️ Entretien à prévoir</b>' : ''}</span></div>
      <div class="paie-montant">${badge(ETAT_MATERIEL[m.etat])}${num(m.cout_jour) ? `<span>${moneyShort(m.cout_jour)}/jour</span>` : ''}</div></button>`).join('')
      : empty('🚜', materiels.length ? 'Aucun résultat.' : 'Aucun matériel enregistré. Ajoutez vos engins, véhicules et gros outils pour savoir où ils sont et ce qu’ils coûtent.');
    $$('[data-mat]', zone).forEach((b) => (b.onclick = () => ficheMateriel(b.dataset.mat, rendre)));
  };
  $('#mq', zone).oninput = (e) => { filtre = e.target.value.toLowerCase(); dessiner(); };
  dessiner();
}

async function formulaireMateriel(m, rendre) {
  const projets = await q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom'));
  ouvrirModale({
    titre: m ? `Modifier « ${m.nom} »` : 'Nouveau matériel',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom', m?.nom, { required: true, full: true, placeholder: 'Ex. Bétonnière 350 L n°2, Camion benne Renault' })}
      ${F.select('categorie', 'Catégorie', Object.entries(CATEGORIES_MATERIEL), m?.categorie || 'engin')}
      ${F.text('reference', 'Immatriculation / n° de série', m?.reference)}
      ${F.select('proprietaire', 'Propriété', [['entreprise', 'À l’entreprise'], ['location', 'En location']], m?.proprietaire || 'entreprise')}
      ${F.text('cout_jour', `Coût par jour (${devise()})`, m?.cout_jour ?? '', { type: 'number', min: 0, inputmode: 'numeric', hint: 'Prix de location, ou coût interne estimé' })}
      ${F.select('unite_compteur', 'Compteur', [['h', 'Heures (engins)'], ['km', 'Kilomètres (véhicules)']], m?.unite_compteur || 'h')}
      ${F.text('compteur', 'Compteur actuel', m?.compteur ?? 0, { type: 'number', min: 0, step: 'any', inputmode: 'decimal' })}
      ${F.text('entretien_tous_les', 'Entretien tous les… (h ou km)', m?.entretien_tous_les ?? '', { type: 'number', min: 1, step: 'any', inputmode: 'decimal', hint: 'Ex. 250 h pour une vidange. Facultatif.' })}
      ${m ? '' : F.select('projet_id', 'Où se trouve-t-il ?', [['', '🅿️ Au dépôt'], ...projets.map((x) => [x.id, x.nom])], '')}
      ${m ? `<label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="actif" ${m.actif ? 'checked' : ''} style="width:auto"> Toujours dans le parc (décochez s’il est vendu ou rendu)</label>` : ''}
    </div>`,
    onSubmit: async (d) => {
      const data = { nom: d.nom.trim(), categorie: d.categorie, reference: d.reference || null, proprietaire: d.proprietaire, cout_jour: num(d.cout_jour), unite_compteur: d.unite_compteur, compteur: num(d.compteur), entretien_tous_les: d.entretien_tous_les ? num(d.entretien_tous_les) : null };
      try {
        if (m) { data.actif = !!d.actif; await q(sb.from('materiels').update(data).eq('id', m.id)); }
        else {
          data.dernier_entretien = num(d.compteur);
          const cree = await q(sb.from('materiels').insert(data).select('id').single());
          if (d.projet_id) await q(sb.from('materiel_evenements').insert({ materiel_id: cree.id, type: 'affectation', projet_id: d.projet_id }));
        }
      } catch (e) { throw new Error(erreurMateriel(e)); }
      toast(m ? 'Matériel mis à jour.' : `${data.nom} ajouté ✅`);
      rendre();
    },
  });
}

async function ficheMateriel(id, rendre) {
  const [m, evts, projets] = await Promise.all([
    q(sb.from('materiels').select('*, projets(nom)').eq('id', id).single()),
    q(sb.from('materiel_evenements').select('*, projets(nom), profils(nom)').eq('materiel_id', id).order('date_evenement', { ascending: false }).order('created_at', { ascending: false }).limit(40)),
    q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom')),
  ]);
  const gerer = can('direction', 'coordinateur', 'magasinier');
  const terrain = gerer || can('technicien');
  const mm = ouvrirModale({
    titre: m.nom, large: true,
    corps: `<div class="split" style="flex-wrap:wrap;gap:8px;margin-bottom:12px"><span class="muted">${esc([CATEGORIES_MATERIEL[m.categorie], m.reference].filter(Boolean).join(' · '))}</span>${badge(ETAT_MATERIEL[m.etat])}</div>
      <div class="detail-grid">
        <div><span>Où</span><b>${esc(m.projets?.nom || 'Au dépôt')}</b></div>
        <div><span>Compteur</span><b>${nf.format(num(m.compteur))} ${m.unite_compteur}</b></div>
        <div><span>Coût / jour</span><b>${money(m.cout_jour)}</b></div>
        <div><span>Prochain entretien</span><b>${m.entretien_tous_les ? `à ${nf.format(num(m.dernier_entretien) + num(m.entretien_tous_les))} ${m.unite_compteur}` : '—'}</b></div>
      </div>
      ${entretienProche(m) ? '<div class="notice warn">🛠️ Entretien à prévoir bientôt (vidange, graissage, révision).</div>' : ''}
      <div class="rc-boutons mt">
        ${gerer ? '<button type="button" class="btn primary" data-evt="affectation">🚚 Déplacer</button>' : ''}
        ${terrain ? '<button type="button" class="btn" data-evt="carburant">⛽ Carburant</button><button type="button" class="btn" data-evt="panne">⚠️ Panne</button><button type="button" class="btn" data-evt="compteur">⏱️ Compteur</button>' : ''}
        ${gerer ? `<button type="button" class="btn" data-evt="reparation">🔧 Réparation</button><button type="button" class="btn" data-evt="entretien">🛠️ Entretien</button><button type="button" class="btn ghost" id="mt-modif">✏️ Modifier</button>` : ''}
      </div>
      <div class="detail-block mt"><h4>Historique</h4>${evts.length ? `<div class="feed">${evts.map((e) => `<div class="feed-item"><div class="feed-dot ${e.type === 'panne' ? 'attention' : 'info'}">${TYPE_EVT_MATERIEL[e.type].split(' ')[0]}</div>
        <div><div><b>${esc(TYPE_EVT_MATERIEL[e.type].split(' ').slice(1).join(' '))}</b>${e.type === 'affectation' ? ` → ${esc(e.projets?.nom || 'Dépôt')}` : e.projets?.nom ? ` · ${esc(e.projets.nom)}` : ''}${e.quantite ? ` · ${nf.format(num(e.quantite))} L` : ''}${e.montant ? ` · ${money(e.montant)}` : ''}${e.compteur ? ` · ${nf.format(num(e.compteur))} ${m.unite_compteur}` : ''}</div>
        ${e.note ? `<div class="muted" style="font-size:12px">${esc(e.note)}</div>` : ''}<div class="when">${fdate(e.date_evenement)}${e.profils?.nom ? ` · ${esc(e.profils.nom)}` : ''}</div></div></div>`).join('')}</div>` : empty('🕓', 'Aucun mouvement enregistré.')}</div>`,
  });
  $('#mt-modif', mm.el)?.addEventListener('click', () => { mm.fermer(); formulaireMateriel(m, rendre); });
  $$('[data-evt]', mm.el).forEach((b) => (b.onclick = () => { mm.fermer(); formulaireEvenementMateriel(m, b.dataset.evt, projets, rendre); }));
}

function formulaireEvenementMateriel(m, type, projets, rendre) {
  const champs = {
    affectation: F.select('projet_id', 'Nouveau lieu', [['', '🅿️ Retour au dépôt'], ...projets.map((x) => [x.id, x.nom])], m.projet_id || '', { full: true }),
    carburant: `${F.text('quantite', 'Litres', '', { type: 'number', min: 0, step: 'any', required: true, inputmode: 'decimal' })}${F.text('montant', `Montant (${devise()})`, '', { type: 'number', min: 0, inputmode: 'numeric' })}${F.text('compteur', `Compteur (${m.unite_compteur})`, '', { type: 'number', min: 0, step: 'any', inputmode: 'decimal' })}`,
    panne: F.area('note', 'Que se passe-t-il ?', '', { required: true, placeholder: 'Ex. Fuite d’huile hydraulique, ne démarre plus…' }),
    compteur: F.text('compteur', `Compteur actuel (${m.unite_compteur})`, m.compteur, { type: 'number', min: 0, step: 'any', required: true, inputmode: 'decimal' }),
    reparation: `${F.text('montant', `Coût de la réparation (${devise()})`, '', { type: 'number', min: 0, inputmode: 'numeric' })}${F.area('note', 'Réparation effectuée', '', { placeholder: 'Ex. Remplacement du flexible hydraulique' })}`,
    entretien: `${F.text('compteur', `Compteur à l’entretien (${m.unite_compteur})`, m.compteur, { type: 'number', min: 0, step: 'any', inputmode: 'decimal' })}${F.text('montant', `Coût (${devise()})`, '', { type: 'number', min: 0, inputmode: 'numeric' })}${F.area('note', 'Travaux d’entretien', '', { placeholder: 'Ex. Vidange moteur + filtres' })}`,
  }[type];
  ouvrirModale({
    titre: `${TYPE_EVT_MATERIEL[type]} · ${m.nom}`,
    corps: `<div class="form-grid">${champs}${F.text('date_evenement', 'Date', todayISO(), { type: 'date', required: true, max: todayISO() })}</div>`,
    onSubmit: async (d) => {
      const data = { materiel_id: m.id, type, date_evenement: d.date_evenement, note: d.note || null };
      if (type === 'affectation') data.projet_id = d.projet_id || null;
      else data.projet_id = m.projet_id || null;
      if (d.quantite) data.quantite = num(d.quantite);
      if (d.montant) data.montant = num(d.montant);
      if (d.compteur !== undefined && d.compteur !== '' && d.compteur !== null) data.compteur = num(d.compteur);
      try { await q(sb.from('materiel_evenements').insert(data)); } catch (e) { throw new Error(erreurMateriel(e)); }
      toast(type === 'panne' ? 'Panne signalée : la direction et le magasin sont prévenus.' : 'Enregistré ✅');
      rendre();
    },
  });
}

async function coutsMateriel(zone) {
  const [materiels, evts, projets] = await Promise.all([
    q(sb.from('materiels').select('id, nom, cout_jour')),
    q(sb.from('materiel_evenements').select('materiel_id, type, projet_id, date_evenement, montant, quantite, created_at').order('date_evenement').order('created_at')),
    q(sb.from('projets').select('id, nom, statut').order('nom')),
  ]);
  const parProjet = new Map();
  const ligne = (id) => { if (!parProjet.has(id)) parProjet.set(id, { jours: 0, usage: 0, carburant: 0, litres: 0, reparations: 0 }); return parProjet.get(id); };
  const auj = todayISO();
  materiels.forEach((m) => {
    const aff = evts.filter((e) => e.materiel_id === m.id && e.type === 'affectation');
    aff.forEach((e, i) => {
      if (!e.projet_id) return;
      const fin = aff[i + 1]?.date_evenement || auj;
      const jours = Math.max(1, Math.round((parseDay(fin) - parseDay(e.date_evenement)) / 864e5) + (aff[i + 1] ? 0 : 1));
      const l = ligne(e.projet_id); l.jours += jours; l.usage += jours * num(m.cout_jour);
    });
  });
  evts.filter((e) => e.projet_id && e.montant).forEach((e) => {
    const l = ligne(e.projet_id);
    if (e.type === 'carburant') { l.carburant += num(e.montant); l.litres += num(e.quantite); }
    if (e.type === 'reparation' || e.type === 'entretien') l.reparations += num(e.montant);
  });
  const lignes = projets.filter((x) => parProjet.has(x.id)).map((x) => ({ ...x, ...parProjet.get(x.id), total: 0 }));
  lignes.forEach((l) => { l.total = l.usage + l.carburant + l.reparations; });
  zone.innerHTML = `<div class="card"><div class="card-title">Coût du matériel par chantier</div>
    <p class="hint" style="margin:-6px 0 12px">Jours de présence × coût par jour, plus le carburant et les réparations notés sur le chantier.</p>
    ${lignes.length ? `<div class="paie-liste">${lignes.sort((a, b) => b.total - a.total).map((l) => `<div class="paie-ligne">
      <div class="paie-nom"><b>${esc(l.nom)}</b><span>${nf.format(l.jours)} jour(s)-engin · ⛽ ${nf.format(Math.round(l.litres))} L · 🔧 ${moneyShort(l.reparations)}</span></div>
      <div class="paie-montant"><b>${money(l.total)}</b><span>dont usage ${moneyShort(l.usage)}</span></div></div>`).join('')}</div>`
      : empty('💰', 'Pas encore de données : déplacez un engin sur un chantier ou notez un plein de carburant.')}</div>`;
}

// ═══════════════════════════════ SÉCURITÉ CHANTIER (2.7) ═══════════════════════════════

const TYPE_SECURITE = {
  accident: ['crit', '🚑 Accident'],
  presqu_accident: ['warn', '⚠️ Presqu’accident'],
  incident: ['warn', '🔶 Incident / danger'],
  causerie: ['ok', '🗣️ Causerie sécurité'],
  visite: ['info', '🔍 Visite de sécurité'],
};
const GRAVITE = { faible: 'Faible', moyenne: 'Moyenne', grave: 'Grave' };

async function envoyerPhotoChantier(fichier, dossier) {
  const blob = await compresserImage(fichier, 1600, 0.8);
  const chemin = `${S.entreprise.id}/${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return chemin;
}

PAGES.securite = async () => {
  const p = page(`
    ${entete('Sécurité chantier', 'Accidents, presqu’accidents, dangers, causeries et visites', '<button class="btn primary" id="ns">＋ Déclarer</button>')}
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('🦺', 'La sécurité chantier fonctionne dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try { await listeSecurite(zone, rendre); } catch (e) { zone.innerHTML = `<div class="card">${empty('🦺', erreurMateriel(e))}</div>`; }
  };
  $('#ns', p).onclick = () => formulaireSecurite(rendre);
  await rendre();
};

async function listeSecurite(zone, rendre) {
  const [evts, projets] = await Promise.all([
    q(sb.from('securite').select('*, projets(nom), profils(nom)').order('date_evenement', { ascending: false }).order('created_at', { ascending: false }).limit(300)),
    q(sb.from('projets').select('id, nom, date_debut, statut').neq('statut', 'termine').order('nom')),
  ]);
  const auj = parseDay(todayISO());
  const joursDepuis = (iso) => Math.max(0, Math.round((auj - parseDay(iso)) / 864e5));
  const dernierAccident = evts.find((e) => e.type === 'accident');
  const mois = todayISO().slice(0, 7);
  const ouverts = evts.filter((e) => e.statut === 'ouvert');
  const parChantier = projets.map((pr) => {
    const acc = evts.find((e) => e.type === 'accident' && e.projet_id === pr.id);
    return { ...pr, jours: acc ? joursDepuis(acc.date_evenement) : pr.date_debut ? joursDepuis(pr.date_debut) : null };
  });
  const url = await urlsPhotos(evts.map((e) => e.photo).filter(Boolean));
  let filtre = '';
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi('Jours sans accident', dernierAccident ? joursDepuis(dernierAccident.date_evenement) : '—', dernierAccident ? `dernier le ${fdate(dernierAccident.date_evenement)}` : 'Aucun accident déclaré', dernierAccident && joursDepuis(dernierAccident.date_evenement) < 30 ? 'alert' : '')}
      ${kpi('Points ouverts', ouverts.length, ouverts.length ? 'Dangers à traiter' : '✅ Tout est traité', ouverts.length ? 'warn' : '')}
      ${kpi('Causeries ce mois', evts.filter((e) => e.type === 'causerie' && e.date_evenement.startsWith(mois)).length, 'Objectif : 1 par semaine')}
      ${kpi('Presqu’accidents (12 mois)', evts.filter((e) => e.type === 'presqu_accident' && joursDepuis(e.date_evenement) <= 365).length)}
    </div>
    ${parChantier.length ? `<div class="card"><div class="card-title">Jours sans accident par chantier</div><div class="secu-chantiers">${parChantier.map((c) => `<div class="secu-chantier"><b>${c.jours ?? '—'}</b><span>${esc(c.nom)}</span></div>`).join('')}</div></div>` : ''}
    <div class="card"><div class="toolbar"><select class="input" id="sf"><option value="">Tous les chantiers</option>${projets.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></div><div class="paie-liste" id="sl"></div></div>`;
  const dessiner = () => {
    const l = evts.filter((e) => !filtre || e.projet_id === filtre);
    $('#sl', zone).innerHTML = l.length ? l.map((e) => `<button type="button" class="paie-ligne vente-ligne secu-ligne" data-secu="${e.id}">
      ${e.photo && url(e.photo) ? `<img src="${esc(url(e.photo))}" alt="" loading="lazy">` : ''}
      <div class="paie-nom"><b>${esc(TYPE_SECURITE[e.type][1])}${['accident', 'presqu_accident', 'incident'].includes(e.type) ? ` · ${GRAVITE[e.gravite]}` : ''}</b>
        <span>${esc(e.projets?.nom || '')} · ${fdate(e.date_evenement)}${e.participants ? ` · ${e.participants} participant(s)` : ''}</span>
        <span>${esc(e.description.slice(0, 110))}</span></div>
      <div class="paie-montant">${e.statut === 'ouvert' ? badge(['warn', '⏳ Ouvert']) : badge(['ok', '✅ Traité'])}</div></button>`).join('')
      : empty('🦺', 'Rien de déclaré. Pensez à noter chaque causerie sécurité et chaque situation dangereuse : c’est ce qui évite les accidents.');
    $$('[data-secu]', zone).forEach((b) => (b.onclick = () => ficheSecurite(evts.find((x) => x.id === b.dataset.secu), url, rendre)));
  };
  $('#sf', zone).onchange = (e) => { filtre = e.target.value; dessiner(); };
  dessiner();
}

async function formulaireSecurite(rendre) {
  const projets = await q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom'));
  let photo = null;
  ouvrirModale({
    titre: 'Déclarer : sécurité chantier',
    corps: `<div class="form-grid">
      ${F.select('type', 'Type', Object.entries(TYPE_SECURITE).map(([k, [, l]]) => [k, l]), 'causerie', { full: true })}
      ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), projets.length === 1 ? projets[0].id : '', { required: true, vide: '— Choisir —' })}
      ${F.text('date_evenement', 'Date', todayISO(), { type: 'date', required: true, max: todayISO() })}
      <div class="secu-grave">${F.select('gravite', 'Gravité', Object.entries(GRAVITE), 'faible')}</div>
      <div class="secu-part">${F.text('participants', 'Nombre de participants', '', { type: 'number', min: 0, inputmode: 'numeric' })}</div>
      ${F.area('description', 'Description', '', { required: true, placeholder: 'Ex. Causerie : port du harnais en hauteur. / Chute d’un parpaing près de l’entrée.' })}
      ${F.area('mesures', 'Mesures prises ou à prendre', '', { placeholder: 'Ex. Zone balisée, garde-corps posé, rappel aux équipes.' })}
      <div class="field full">Photo (facultatif)<label class="btn" style="width:max-content">📷 Ajouter une photo<input type="file" id="secu-photo" accept="image/*" hidden></label><span class="hint" id="secu-photo-ok"></span></div>
    </div>`,
    onOpen: (el) => {
      const maj = () => {
        const t = $('[name="type"]', el).value;
        $('.secu-grave', el).classList.toggle('hidden', !['accident', 'presqu_accident', 'incident'].includes(t));
        $('.secu-part', el).classList.toggle('hidden', t !== 'causerie');
      };
      $('[name="type"]', el).onchange = maj; maj();
      $('#secu-photo', el).onchange = (e) => { photo = e.target.files[0] || null; $('#secu-photo-ok', el).textContent = photo ? '✅ Photo prête' : ''; };
    },
    onSubmit: async (d) => {
      try {
        const chemin = photo ? await envoyerPhotoChantier(photo, 'securite') : null;
        await q(sb.from('securite').insert({ type: d.type, projet_id: d.projet_id, date_evenement: d.date_evenement, gravite: d.gravite || 'faible', participants: d.participants ? Math.round(num(d.participants)) : null, description: d.description, mesures: d.mesures || null, photo: chemin }));
      } catch (e) { throw new Error(erreurMateriel(e)); }
      toast(d.type === 'accident' ? 'Accident déclaré : la direction est alertée.' : 'Enregistré ✅');
      rendre();
    },
  });
}

function ficheSecurite(e, url, rendre) {
  const gerer = can('direction', 'coordinateur') || e.auteur_id === S.profil.id;
  const m = ouvrirModale({
    titre: TYPE_SECURITE[e.type][1],
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">${esc(e.projets?.nom || '')} · ${fdate(e.date_evenement)}${e.profils?.nom ? ` · déclaré par ${esc(e.profils.nom)}` : ''}</p>
      ${e.photo && url(e.photo) ? `<a href="${esc(url(e.photo))}" target="_blank" rel="noopener"><img class="secu-photo" src="${esc(url(e.photo))}" alt="Photo"></a>` : ''}
      <div class="detail-block"><h4>Description</h4><p>${esc(e.description)}</p></div>
      ${e.statut === 'ouvert' && gerer ? `<label class="field">Mesures prises<textarea id="secu-mesures">${esc(e.mesures || '')}</textarea></label>` : e.mesures ? `<div class="detail-block"><h4>Mesures</h4><p>${esc(e.mesures)}</p></div>` : ''}
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button>${e.statut === 'ouvert' && gerer ? '<button type="button" class="btn primary" id="secu-clore">✅ Marquer comme traité</button>' : ''}</div>`,
  });
  $('#secu-clore', m.el)?.addEventListener('click', async () => {
    try { await q(sb.from('securite').update({ statut: 'clos', mesures: $('#secu-mesures', m.el).value || null }).eq('id', e.id)); toast('Marqué comme traité ✅'); m.fermer(); rendre(); }
    catch (err) { toast(erreurMateriel(err), 'err'); }
  });
}

// ═══════════════════════════════ RÉCEPTION DES TRAVAUX (2.7) ═══════════════════════════════

const TYPE_RECEPTION = { provisoire: 'Réception provisoire', partielle: 'Réception partielle', definitive: 'Réception définitive' };

async function ongletReception(projet, zone) {
  const gerer = can('direction', 'coordinateur');
  const [pvs, reserves] = await Promise.all([
    q(sb.from('receptions').select('id, type, date_reception, statut, nom_client').eq('projet_id', projet.id).order('date_reception', { ascending: false })),
    q(sb.from('reserves').select('id, reception_id, statut').eq('projet_id', projet.id)),
  ]);
  const ouvertes = reserves.filter((r) => r.statut === 'ouverte').length;
  zone.innerHTML = `<div class="card"><div class="card-title">Procès-verbaux de réception ${gerer ? '<button type="button" class="btn sm primary" id="npv">＋ Nouveau PV</button>' : ''}</div>
    ${reserves.length ? `<div class="notice ${ouvertes ? 'warn' : 'ok'}">${ouvertes ? `⏳ <b>${ouvertes}</b> réserve(s) à lever sur ${reserves.length}.` : `✅ Toutes les réserves sont levées (${reserves.length}).`}</div>` : ''}
    ${pvs.length ? `<div class="paie-liste">${pvs.map((pv) => {
      const rs = reserves.filter((r) => r.reception_id === pv.id);
      return `<button type="button" class="paie-ligne vente-ligne" data-pv="${pv.id}"><div class="paie-nom"><b>${TYPE_RECEPTION[pv.type]}</b><span>${fdate(pv.date_reception)}${pv.nom_client ? ` · ${esc(pv.nom_client)}` : ''} · ${rs.length} réserve(s), ${rs.filter((r) => r.statut === 'ouverte').length} à lever</span></div>
        <div class="paie-montant">${pv.statut === 'signe' ? badge(['ok', '✍️ Signé']) : badge(['muted', '📝 Brouillon'])}</div></button>`;
    }).join('')}</div>` : empty('🤝', gerer ? 'Aucun procès-verbal. À la fin des travaux, faites la visite avec le client : notez les réserves en photo et faites signer sur le téléphone.' : 'Aucun procès-verbal de réception pour ce chantier.')}</div>`;
  const rafraichir = () => ongletReception(projet, zone);
  $('#npv', zone)?.addEventListener('click', async () => {
    try {
      const pv = await q(sb.from('receptions').insert({ projet_id: projet.id, objet: projet.nom, nom_client: projet.client || null, nom_entreprise: S.profil.nom }).select('id').single());
      editeurReception(pv.id, projet, rafraichir);
    } catch (e) { toast(erreurMateriel(e), 'err'); }
  });
  $$('[data-pv]', zone).forEach((b) => (b.onclick = () => editeurReception(b.dataset.pv, projet, rafraichir)));
}

function padSignature(conteneur, initiale) {
  conteneur.innerHTML = '<canvas class="signature-pad"></canvas><button type="button" class="btn sm ghost signature-effacer">Effacer</button>';
  const c = $('canvas', conteneur);
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const dims = () => { const r = c.getBoundingClientRect(); c.width = r.width * ratio; c.height = r.height * ratio; const x = c.getContext('2d'); x.scale(ratio, ratio); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111521'; };
  dims();
  let vide = true, trace = false;
  if (initiale) { const img = new Image(); img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, c.width / ratio, c.height / ratio); vide = false; }; img.src = initiale; }
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', (e) => { trace = true; vide = false; c.setPointerCapture(e.pointerId); const x = c.getContext('2d'); x.beginPath(); x.moveTo(...pos(e)); e.preventDefault(); });
  c.addEventListener('pointermove', (e) => { if (!trace) return; const x = c.getContext('2d'); x.lineTo(...pos(e)); x.stroke(); e.preventDefault(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, () => { trace = false; }));
  $('.signature-effacer', conteneur).onclick = () => { c.getContext('2d').clearRect(0, 0, c.width, c.height); vide = true; };
  return { valeur: () => (vide ? null : c.toDataURL('image/png')) };
}

async function editeurReception(id, projet, rafraichir) {
  const [pv, reserves] = await Promise.all([
    q(sb.from('receptions').select('*').eq('id', id).single()),
    q(sb.from('reserves').select('*').eq('reception_id', id).order('created_at')),
  ]);
  const gerer = can('direction', 'coordinateur');
  const signe = pv.statut === 'signe';
  const modifiable = gerer && !signe;
  const url = await urlsPhotos(reserves.flatMap((r) => [r.photo, r.photo_levee]).filter(Boolean));
  const m = ouvrirModale({ titre: `${TYPE_RECEPTION[pv.type]} · ${projet.nom}`, large: true, corps: `
    ${signe ? `<div class="notice ok">✍️ Procès-verbal signé le ${new Date(pv.signe_le).toLocaleDateString('fr-FR')} : il ne peut plus être modifié. Les réserves peuvent être levées.</div>` : ''}
    <form class="form-grid" id="pv-form" onsubmit="return false">
      ${F.select('type', 'Type de réception', Object.entries(TYPE_RECEPTION), pv.type)}
      ${F.text('date_reception', 'Date', pv.date_reception, { type: 'date' })}
      ${F.text('participants', 'Personnes présentes', pv.participants, { full: true, placeholder: 'Ex. M. Kouadio (client), Mme Bamba (architecte), Ange (entreprise)' })}
      ${F.area('observations', 'Observations générales', pv.observations, { placeholder: 'Ex. Ouvrage conforme au marché, sous réserve des points ci-dessous.' })}
    </form>
    <div class="detail-block mt"><h4>Réserves (${reserves.length})</h4>
      <div class="paie-liste">${reserves.map((r) => `<div class="paie-ligne reserve-ligne">
        ${r.photo && url(r.photo) ? `<a href="${esc(url(r.photo))}" target="_blank" rel="noopener"><img src="${esc(url(r.photo))}" alt=""></a>` : ''}
        <div class="paie-nom"><b>${esc(r.description)}</b><span>${esc(r.localisation || '')}${r.statut === 'levee' ? ` · levée le ${new Date(r.levee_le).toLocaleDateString('fr-FR')}` : ''}</span></div>
        <div class="paie-montant">${r.statut === 'levee' ? badge(['ok', '✅ Levée']) : `${badge(['warn', '⏳ À lever'])}${signe && can('direction', 'coordinateur', 'technicien') ? `<label class="btn sm">✅ Lever<input type="file" accept="image/*" data-lever="${r.id}" hidden></label><button type="button" class="btn sm ghost" data-lever-sans="${r.id}">Sans photo</button>` : ''}${modifiable ? `<button type="button" class="btn sm ghost" data-suppr-res="${r.id}">✕</button>` : ''}`}</div></div>`).join('') || '<p class="muted" style="font-size:13px">Aucune réserve : ouvrage accepté sans réserve.</p>'}</div>
      ${modifiable ? `<div class="reserve-ajout">
        <input class="input" id="res-desc" placeholder="Nouvelle réserve (ex. Fissure enduit façade nord)">
        <input class="input" id="res-loc" placeholder="Où ? (ex. Chambre 2, RDC)">
        <label class="btn sm">📷 Photo<input type="file" id="res-photo" accept="image/*" hidden></label>
        <button type="button" class="btn sm primary" id="res-ajout">＋ Ajouter</button></div>` : ''}
    </div>
    <div class="detail-block mt"><h4>Signatures</h4>
      <div class="signatures">
        <div><label class="field">Nom du client / maître d’ouvrage<input name="nom_client" class="input" value="${esc(pv.nom_client || '')}" ${modifiable ? '' : 'disabled'}></label>${signe ? `<img class="signature-img" src="${esc(pv.signature_client)}" alt="Signature du client">` : '<div class="sig" id="sig-client"></div>'}</div>
        <div><label class="field">Pour l’entreprise<input name="nom_entreprise" class="input" value="${esc(pv.nom_entreprise || '')}" ${modifiable ? '' : 'disabled'}></label>${signe ? `<img class="signature-img" src="${esc(pv.signature_entreprise)}" alt="Signature de l’entreprise">` : '<div class="sig" id="sig-entreprise"></div>'}</div>
      </div>
      ${modifiable ? '<p class="hint">Faites signer avec le doigt dans chaque cadre blanc.</p>' : ''}
    </div>
    <div class="rc-boutons mt">
      ${modifiable ? '<button type="button" class="btn" id="pv-ok">💾 Enregistrer le brouillon</button><button type="button" class="btn primary" id="pv-signer">✍️ Signer et finaliser</button>' : ''}
      <button type="button" class="btn ${signe ? 'primary' : ''}" id="pv-pdf">📄 PV en PDF</button>
      ${modifiable ? '<button type="button" class="btn danger" id="pv-suppr">Supprimer</button>' : ''}
    </div>` });
  const el = m.el;
  if (!modifiable) $$('#pv-form input, #pv-form select, #pv-form textarea', el).forEach((x) => { x.disabled = true; });
  const sigC = !signe ? padSignature($('#sig-client', el), pv.signature_client) : null;
  const sigE = !signe ? padSignature($('#sig-entreprise', el), pv.signature_entreprise) : null;
  if (!modifiable && sigC) { $$('.sig', el).forEach((x) => { x.style.pointerEvents = 'none'; x.style.opacity = '.6'; }); }
  const donnees = () => {
    const d = lireFormulaire($('#pv-form', el));
    return { type: d.type, date_reception: d.date_reception, participants: d.participants || null, observations: d.observations || null,
      nom_client: $('[name="nom_client"]', el).value || null, nom_entreprise: $('[name="nom_entreprise"]', el).value || null,
      signature_client: sigC?.valeur() || null, signature_entreprise: sigE?.valeur() || null };
  };
  const rouvrir = () => { m.fermer(); rafraichir(); editeurReception(id, projet, rafraichir); };
  $('#pv-ok', el)?.addEventListener('click', async () => {
    try { await q(sb.from('receptions').update(donnees()).eq('id', id)); toast('Brouillon enregistré ✅'); m.fermer(); rafraichir(); } catch (e) { toast(erreurMateriel(e), 'err'); }
  });
  $('#pv-signer', el)?.addEventListener('click', async () => {
    const d = donnees();
    if (!d.signature_client || !d.signature_entreprise) { toast('Les deux signatures sont nécessaires (client et entreprise).', 'warn'); return; }
    if (!d.nom_client) { toast('Indiquez le nom du client.', 'warn'); return; }
    if (!(await confirmer('Finaliser le procès-verbal ? Une fois signé, il ne pourra plus être modifié (seules les réserves pourront être levées).', 'Signer'))) return;
    try {
      await q(sb.from('receptions').update({ ...d, statut: 'signe' }).eq('id', id));
      toast('Procès-verbal signé ✅');
      m.fermer(); rafraichir();
      pdfReception(id, projet);
    } catch (e) { toast(e?.hint || erreurMateriel(e), 'err', 6000); }
  });
  $('#pv-pdf', el).onclick = async () => { if (modifiable) { try { await q(sb.from('receptions').update(donnees()).eq('id', id)); } catch { /* aperçu quand même */ } } pdfReception(id, projet); };
  $('#pv-suppr', el)?.addEventListener('click', async () => {
    if (!(await confirmer('Supprimer ce brouillon de procès-verbal et ses réserves ?', 'Supprimer'))) return;
    try { await q(sb.from('receptions').delete().eq('id', id)); toast('Brouillon supprimé.'); m.fermer(); rafraichir(); } catch (e) { toast(erreurMateriel(e), 'err'); }
  });
  $('#res-ajout', el)?.addEventListener('click', async () => {
    const desc = $('#res-desc', el).value.trim();
    if (!desc) { toast('Décrivez la réserve.', 'warn'); return; }
    try {
      await q(sb.from('receptions').update(donnees()).eq('id', id));
      const f = $('#res-photo', el).files[0];
      const chemin = f ? await envoyerPhotoChantier(f, 'reception') : null;
      await q(sb.from('reserves').insert({ reception_id: id, projet_id: projet.id, description: desc, localisation: $('#res-loc', el).value.trim() || null, photo: chemin }));
      rouvrir();
    } catch (e) { toast(erreurMateriel(e), 'err'); }
  });
  $('#res-photo', el)?.addEventListener('change', (e) => { if (e.target.files[0]) toast('Photo prête ✅ Touchez « Ajouter ».'); });
  $$('[data-suppr-res]', el).forEach((b) => (b.onclick = async () => { try { await q(sb.from('reserves').delete().eq('id', b.dataset.supprRes)); rouvrir(); } catch (e) { toast(erreurMateriel(e), 'err'); } }));
  const lever = async (rid, fichier) => {
    try {
      const chemin = fichier ? await envoyerPhotoChantier(fichier, 'reception') : null;
      await q(sb.from('reserves').update({ statut: 'levee', ...(chemin ? { photo_levee: chemin } : {}) }).eq('id', rid));
      toast('Réserve levée ✅'); rouvrir();
    } catch (e) { toast(erreurMateriel(e), 'err'); }
  };
  $$('[data-lever]', el).forEach((inp) => (inp.onchange = (e) => { if (e.target.files[0]) lever(inp.dataset.lever, e.target.files[0]); }));
  $$('[data-lever-sans]', el).forEach((b) => (b.onclick = () => lever(b.dataset.leverSans, null)));
}

async function pdfReception(id, projet) {
  try {
    const JsPDF = await chargerJsPDF();
    const [pv, reserves] = await Promise.all([
      q(sb.from('receptions').select('*').eq('id', id).single()),
      q(sb.from('reserves').select('*').eq('reception_id', id).order('created_at')),
    ]);
    const url = await urlsPhotos(reserves.map((r) => r.photo).filter(Boolean));
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, 'PROCÈS-VERBAL', TYPE_RECEPTION[pv.type], `du ${fdate(pv.date_reception)}`);
    let y = 46;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(100, 108, 128); doc.text('CHANTIER', 16, y); doc.text('CLIENT / MAÎTRE D\'OUVRAGE', 110, y); y += 5.5;
    doc.setFontSize(11); doc.setTextColor(17, 21, 33);
    doc.text(doc.splitTextToSize(textePDF([projet.nom, projet.localisation].filter(Boolean).join(' - ')), 88), 16, y);
    doc.text(doc.splitTextToSize(textePDF(pv.nom_client || projet.client || '-'), 84), 110, y);
    y += 13;
    const para = (titre, texte) => {
      if (!texte) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(17, 21, 33); doc.text(textePDF(titre), 16, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.splitTextToSize(textePDF(texte), 178).forEach((l) => { if (y > 270) { doc.addPage(); y = 20; } doc.text(l, 16, y); y += 4.8; });
      y += 3;
    };
    para('Personnes présentes', pv.participants);
    para('Observations', pv.observations || (reserves.length ? 'Les travaux sont reçus sous les réserves listées ci-dessous.' : 'Les travaux sont reçus sans réserve.'));
    if (reserves.length) {
      y = tableauPDF(doc, y + 2, [{ titre: 'Réserve', x: 16, l: 100 }, { titre: 'Localisation', x: 118, l: 46 }, { titre: 'État', x: 166, l: 28, align: 'right' }],
        reserves.map((r) => ({ cells: [r.description, r.localisation || '-', r.statut === 'levee' ? `Levée ${new Date(r.levee_le).toLocaleDateString('fr-FR')}` : 'A lever'] })));
      const photos = reserves.filter((r) => r.photo && url(r.photo)).slice(0, 6);
      if (photos.length) {
        y += 2;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('Photos des réserves', 16, y); y += 4;
        const lp = 56, hp = 42;
        for (let i = 0; i < photos.length; i++) {
          if (i % 3 === 0 && i) y += hp + 9;
          if (y + hp > 270) { doc.addPage(); y = 20; }
          const img = await imagePourPDF(url(photos[i].photo), lp / hp);
          const x = 16 + (i % 3) * (lp + 5);
          if (img) doc.addImage(img.data, 'JPEG', x, y, lp, hp);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 108, 128);
          doc.text(doc.splitTextToSize(textePDF(photos[i].description), lp)[0], x, y + hp + 3.5); doc.setTextColor(17, 21, 33);
        }
        y += hp + 10;
      }
    }
    if (y > 225) { doc.addPage(); y = 25; }
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(textePDF(`Le client : ${pv.nom_client || ''}`), 16, y); doc.text(textePDF(`Pour ${S.entreprise?.nom || ''} : ${pv.nom_entreprise || ''}`), 110, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 84, 32); doc.rect(110, y + 3, 84, 32);
    if (pv.signature_client) doc.addImage(pv.signature_client, 'PNG', 18, y + 5, 80, 28);
    if (pv.signature_entreprise) doc.addImage(pv.signature_entreprise, 'PNG', 112, y + 5, 80, 28);
    y += 40;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 108, 128);
    doc.text(textePDF(pv.statut === 'signe' ? `Signé électroniquement le ${new Date(pv.signe_le).toLocaleString('fr-FR')}.` : 'BROUILLON - document non signé.'), 16, y);
    piedPDF(doc, `${S.entreprise?.nom || ''} - PV de réception - ${projet.nom}`);
    presenterPDF(doc.output('blob'), `PV-reception-${projet.nom}-${pv.date_reception}.pdf`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9.]+/g, '-'), `Bonjour, veuillez trouver ci-joint le procès-verbal de ${TYPE_RECEPTION[pv.type].toLowerCase()} du chantier « ${projet.nom} ». Cordialement, ${S.entreprise?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurMateriel(e), 'err', 6000); }
}

// ═══════════════════════════════ RAPPEL DU RAPPORT DU JOUR (2.7) ═══════════════════════════════

async function rappelRapportTechnicien(aujourdhui, aDesChantiers) {
  if (DEMO || aujourdhui || !aDesChantiers || new Date().getHours() < 16) return;
  const enAttente = (await listeEnvois()).some((x) => x.type === 'rapport' && x.rapport.date_rapport === todayISO());
  if (enAttente) return;
  const cle = `koordin-rappel-${S.profil.id}-${todayISO()}`;
  let deja = null;
  try { deja = localStorage.getItem(cle); localStorage.setItem(cle, '1'); } catch { /* rien */ }
  if (deja) return;
  toast('⏰ La journée se termine : pensez à envoyer votre rapport du jour.', 'warn', 9000);
  try { navigator.vibrate?.([150, 80, 150]); } catch { /* rien */ }
}

async function encartRapportsDuJour() {
  if (DEMO || !can('direction', 'coordinateur')) return;
  const pg = $('#main .page');
  if (!pg) return;
  const auj = todayISO();
  const [projets, rapports, affect] = await Promise.all([
    q(sb.from('projets').select('id, nom').eq('statut', 'en_cours').order('nom')),
    q(sb.from('rapports').select('projet_id').eq('date_rapport', auj)),
    q(sb.from('affectations').select('projet_id, profils(id, nom, role, email, telephone)')),
  ]).catch(() => [[], [], []]);
  if (!projets.length) return;
  const avec = new Set(rapports.map((r) => r.projet_id));
  const sans = projets.filter((x) => !avec.has(x.id));
  const carte = document.createElement('div');
  carte.className = 'card section rapports-jour';
  carte.innerHTML = `<div class="card-title">Rapports du jour <span class="badge ${sans.length ? 'warn' : 'ok'}">${projets.length - sans.length} / ${projets.length} chantiers</span></div>
    ${sans.length ? `<div class="paie-liste">${sans.map((x) => {
      const techs = affect.filter((a) => a.projet_id === x.id && a.profils?.role === 'technicien').map((a) => a.profils);
      return `<div class="paie-ligne"><div class="paie-nom"><b>${esc(x.nom)}</b><span>${techs.length ? `Pas encore de rapport de ${esc(techs.map((t) => t.nom).join(', '))}` : 'Aucun technicien affecté'}</span></div>
        <div class="paie-montant">${techs.map((t) => `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${numeroAuteur(t)}?text=${encodeURIComponent(`Bonjour ${String(t.nom).split(' ')[0]}, pensez à envoyer votre rapport du jour pour « ${x.nom} » dans KOORDIN. Merci ! ${S.profil.nom}`)}">📲 Rappeler ${esc(String(t.nom).split(' ')[0])}</a>`).join('')}</div></div>`;
    }).join('')}</div>` : '<p class="muted" style="font-size:13px">✅ Tous les chantiers en cours ont envoyé leur rapport aujourd’hui.</p>'}`;
  const ancre = $('.grid.k4', pg);
  if (ancre) ancre.after(carte); else pg.append(carte);
}

// ═══════════════════════════════ MON ESPACE ET SALAIRES (2.8) ═══════════════════════════════
// Chaque membre voit ses propres versements, confirme la réception en signant au doigt
// ou signale un problème. La Comptabilité et la Direction enregistrent et valident.

const TYPE_VERSEMENT = { salaire: 'Salaire', avance: 'Avance', prime: 'Prime', autre: 'Versement' };
const STATUT_VERSEMENT = {
  verse: ['warn', '⏳ À confirmer'],
  recu: ['info', '✍️ Reçu, à valider'],
  conteste: ['crit', '⚠️ Problème signalé'],
  valide: ['ok', '✅ Validé'],
};
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const libellePeriode = (per) => `${MOIS_FR[Number(per.slice(5, 7)) - 1]} ${per.slice(0, 4)}`;
const libelleVersement = (v) => `${TYPE_VERSEMENT[v.type] || 'Versement'} ${/^[aeiouéè]/i.test(libellePeriode(v.periode)) ? 'd’' : 'de '}${libellePeriode(v.periode)}`;
const erreurVersement = (e) => {
  const m = String(e?.message || '');
  if (/^VERSEMENT_/.test(m) && e?.hint) return e.hint;
  if (/corriger_mois_versement/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Cette fonction nécessite la mise à jour 3.12 de la base de données (kit d’installation).';
  if (/relation .*versements/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Cette fonction nécessite la mise à jour 2.8 de la base de données (kit d’installation).';
  return messageErreur(e);
};

// ─── Mon espace ───

PAGES['mon-espace'] = async () => {
  const pr = S.profil;
  const p = page(`
    <section class="espace-carte">
      <div class="espace-avatar">${esc(initiales(pr.nom))}</div>
      <div class="espace-qui"><h1 class="page-title">${esc(pr.nom)}</h1>
        <p>${ROLES[pr.role].ico} ${esc(ROLES[pr.role].label)} · ${esc(S.entreprise?.nom || '')}</p>
        <p class="muted">${esc(afficherIdentifiant(pr.email))}</p></div>
    </section>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('👤', 'L’espace personnel fonctionne dans la version installée de KOORDIN.')}</div>`; return; }
  zone.innerHTML = loading();
  try {
    const [versements, chantiers] = await Promise.all([
      q(sb.from('versements').select('*').eq('profil_id', pr.id).order('periode', { ascending: false }).order('created_at', { ascending: false })),
      q(sb.from('affectations').select('projets(nom, statut)').eq('profil_id', pr.id)).catch(() => []),
    ]);
    const annee = todayISO().slice(0, 4);
    const aConfirmer = versements.filter((v) => v.statut === 'verse');
    const recuAnnee = versements.filter((v) => ['recu', 'valide'].includes(v.statut) && v.periode.startsWith(annee)).reduce((s, v) => s + num(v.montant), 0);
    zone.innerHTML = `
      ${aConfirmer.length ? `<div class="notice warn">💵 <b>${aConfirmer.length} versement${aConfirmer.length > 1 ? 's' : ''}</b> à confirmer : touchez-le, vérifiez le montant, puis signez.</div>` : ''}
      <div class="grid k3 paie-kpis">
        ${kpi('À confirmer', aConfirmer.length, aConfirmer.length ? 'Touchez pour signer' : '✅ Rien en attente', aConfirmer.length ? 'warn' : '')}
        ${kpi(`Reçu en ${annee}`, moneyShort(recuAnnee), 'Versements confirmés')}
        ${kpi('Dernier versement', versements[0] ? money(versements[0].montant) : '—', versements[0] ? libelleVersement(versements[0]) : '')}
      </div>
      <div class="card"><div class="card-title">Mes versements <small>visibles par vous, la comptabilité et la direction seulement</small></div>
        ${versements.length ? `<div class="paie-liste">${versements.map((v) => `<button type="button" class="paie-ligne vente-ligne ${v.statut === 'verse' ? 'a-signer' : ''}" data-v="${v.id}">
          <div class="paie-nom"><b>${esc(libelleVersement(v))}</b><span>${esc([fdate(v.date_versement), v.moyen, v.reference].filter(Boolean).join(' · '))}</span></div>
          <div class="paie-montant"><b>${money(v.montant)}</b>${badge(v.statut === 'recu' ? ['info', '📤 Envoyé à la compta'] : STATUT_VERSEMENT[v.statut])}</div></button>`).join('')}</div>`
          : empty('💵', 'Aucun versement pour le moment. Quand la comptabilité enregistrera votre salaire, il apparaîtra ici pour que vous confirmiez la réception.')}
      </div>
      ${chantiers.length ? `<div class="card"><div class="card-title">Mes chantiers</div><div class="paie-liste">${chantiers.filter((a) => a.projets).map((a) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(a.projets.nom)}</b></div><div class="paie-montant">${badge(STATUT_PROJET[a.projets.statut] || ['muted', a.projets.statut])}</div></div>`).join('')}</div></div>` : ''}`;
    $$('[data-v]', zone).forEach((b) => (b.onclick = () => confirmerVersement(versements.find((x) => x.id === b.dataset.v))));
  } catch (e) { zone.innerHTML = `<div class="card">${empty('👤', erreurVersement(e))}</div>`; }
};

function confirmerVersement(v) {
  const aSigner = v.statut === 'verse';
  const m = ouvrirModale({
    titre: libelleVersement(v),
    corps: `<div class="versement-montant">${money(v.montant)}</div>
      <div class="detail-grid">
        <div><span>Versé le</span><b>${fdate(v.date_versement)}</b></div>
        <div><span>Moyen</span><b>${esc(v.moyen)}</b></div>
        <div><span>Référence</span><b>${esc(v.reference || '—')}</b></div>
        <div><span>État</span><b>${esc(STATUT_VERSEMENT[v.statut][1])}</b></div>
      </div>
      ${v.note ? `<div class="detail-block"><h4>Note de la comptabilité</h4><p>${esc(v.note)}</p></div>` : ''}
      ${v.statut === 'conteste' ? `<div class="notice warn">⚠️ Vous avez signalé : « ${esc(v.commentaire_employe || '')} ». La comptabilité va corriger.</div>` : ''}
      ${['recu', 'valide'].includes(v.statut) && v.signature ? `<div class="detail-block"><h4>Votre signature (${new Date(v.confirme_le).toLocaleDateString('fr-FR')})</h4><img class="signature-img" src="${esc(v.signature)}" alt="Signature"></div>` : ''}
      ${aSigner ? `<div class="detail-block"><h4>Je confirme avoir bien reçu ${money(v.montant)}</h4><div class="sig" id="sig-v"></div><p class="hint">Signez avec le doigt dans le cadre blanc.</p></div>
        <div class="vers-probleme hidden"><label class="field">Quel est le problème ?<textarea id="v-pb" placeholder="Ex. J’ai reçu 120 000 au lieu de 150 000 / Je n’ai rien reçu."></textarea></label></div>` : ''}
      <div class="form-actions">
        ${aSigner ? '<button type="button" class="btn ghost" id="v-signaler">⚠️ Signaler un problème</button><button type="button" class="btn primary" id="v-signer">✍️ Signer et envoyer</button>' : '<button type="button" class="btn ghost" data-close>Fermer</button>'}
        ${['recu', 'valide'].includes(v.statut) ? '<button type="button" class="btn" id="v-pdf">📄 Accusé de réception</button>' : ''}
      </div>`,
  });
  const sig = aSigner ? padSignature($('#sig-v', m.el)) : null;
  let modePb = false;
  $('#v-signer', m.el)?.addEventListener('click', async () => {
    const s = sig.valeur();
    if (!s) { toast('Signez avec le doigt dans le cadre blanc.', 'warn'); return; }
    try {
      await q(sb.from('versements').update({ statut: 'recu', signature: s }).eq('id', v.id));
      toast('Merci ✅ Votre confirmation est envoyée à la comptabilité et à la direction.', 'ok', 6000);
      m.fermer(); naviguer();
    } catch (e) { toast(erreurVersement(e), 'err', 6000); }
  });
  $('#v-signaler', m.el)?.addEventListener('click', async (ev) => {
    if (!modePb) {
      modePb = true;
      $('.vers-probleme', m.el).classList.remove('hidden');
      $('#v-pb', m.el).focus();
      ev.target.textContent = '📤 Envoyer le problème';
      ev.target.classList.replace('ghost', 'danger');
      return;
    }
    const txt = $('#v-pb', m.el).value.trim();
    if (!txt) { toast('Expliquez le problème.', 'warn'); return; }
    try {
      await q(sb.from('versements').update({ statut: 'conteste', commentaire_employe: txt }).eq('id', v.id));
      toast('Problème envoyé à la comptabilité et à la direction.', 'warn', 6000);
      m.fermer(); naviguer();
    } catch (e) { toast(erreurVersement(e), 'err', 6000); }
  });
  $('#v-pdf', m.el)?.addEventListener('click', () => pdfAccuseVersement(v, S.profil));
}

async function encartVersementsAConfirmer() {
  if (DEMO) return;
  const pg = $('#main .page');
  if (!pg) return;
  const { count } = await sb.from('versements').select('id', { count: 'exact', head: true }).eq('profil_id', S.profil.id).eq('statut', 'verse');
  if (!count) return;
  const div = document.createElement('a');
  div.href = '#/mon-espace';
  div.className = 'notice warn bandeau-envois';
  div.innerHTML = `💵 <b>${count} versement${count > 1 ? 's' : ''}</b> à confirmer dans votre espace. <span class="btn sm">Ouvrir</span>`;
  pg.prepend(div);
}

// ─── Salaires (Comptabilité et Direction) ───

let filtreSalaires = 'tous';
PAGES.salaires = async () => {
  const p = page(`
    ${entete('Salaires', 'Versements à l’équipe, confirmations signées et validation', '<button class="btn" id="paie-mois">📋 Paie du mois</button><button class="btn primary" id="nv">＋ Versement</button>')}
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('💵', 'Les salaires fonctionnent dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try { await listeSalaires(zone, rendre); } catch (e) { zone.innerHTML = `<div class="card">${empty('💵', erreurVersement(e))}</div>`; }
  };
  $('#nv', p).onclick = () => formulaireVersement(null, rendre);
  $('#paie-mois', p).onclick = () => paieDuMois(rendre);
  await rendre();
};

async function listeSalaires(zone, rendre) {
  await chargerEquipe();
  const versements = await q(sb.from('versements').select('*').order('periode', { ascending: false }).order('created_at', { ascending: false }).limit(1000));
  const mois = todayISO().slice(0, 7);
  const ceMois = versements.filter((v) => v.periode === mois);
  const nb = (s) => versements.filter((v) => v.statut === s).length;
  const filtres = [['tous', 'Tous', versements.length], ['recu', 'À valider', nb('recu')], ['conteste', 'Problèmes', nb('conteste')], ['verse', 'En attente du bénéficiaire', nb('verse')], ['valide', 'Validés', nb('valide')]];
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi(`Versé en ${libellePeriode(mois)}`, moneyShort(ceMois.reduce((s, v) => s + num(v.montant), 0)), `${ceMois.length} versement(s)`)}
      ${kpi('À valider', nb('recu'), 'Confirmés et signés', nb('recu') ? 'warn' : '')}
      ${kpi('Problèmes signalés', nb('conteste'), nb('conteste') ? 'À corriger' : '✅ Aucun', nb('conteste') ? 'alert' : '')}
      ${kpi('En attente du bénéficiaire', nb('verse'), 'Pas encore confirmés')}
    </div>
    <div class="card">
      <div class="galerie-filtres" style="margin-bottom:12px">${filtres.map(([k, l, n]) => `<button type="button" class="chip-filtre ${k === filtreSalaires ? 'actif' : ''}" data-f="${k}">${l} <b>${n}</b></button>`).join('')}</div>
      <div class="toolbar"><input class="input" id="sq" placeholder="🔍 Rechercher un nom…" style="flex:1"><button type="button" class="btn sm" id="s-csv">⬇️ Excel</button></div>
      <div class="paie-liste" id="sl"></div></div>`;
  let filtre = '';
  const dessiner = () => {
    const l = versements.filter((v) => (filtreSalaires === 'tous' || v.statut === filtreSalaires) && (!filtre || nomMembre(v.profil_id).toLowerCase().includes(filtre)));
    $('#sl', zone).innerHTML = l.length ? l.map((v) => `<button type="button" class="paie-ligne vente-ligne" data-v="${v.id}">
      <div class="paie-nom"><b>${esc(nomMembre(v.profil_id))}</b><span>${esc(libelleVersement(v))} · ${esc(v.moyen)} · ${fdate(v.date_versement)}</span>${v.statut === 'conteste' ? `<span style="color:var(--crit)">« ${esc(v.commentaire_employe || '')} »</span>` : ''}</div>
      <div class="paie-montant"><b>${money(v.montant)}</b>${badge(STATUT_VERSEMENT[v.statut])}</div></button>`).join('')
      : empty('💵', versements.length ? 'Rien dans ce filtre.' : 'Aucun versement. Touchez « 📋 Paie du mois » pour enregistrer les salaires de toute l’équipe en une fois.');
    $$('[data-v]', zone).forEach((b) => (b.onclick = () => ficheVersement(versements.find((x) => x.id === b.dataset.v), rendre)));
  };
  $$('[data-f]', zone).forEach((b) => (b.onclick = () => { filtreSalaires = b.dataset.f; $$('[data-f]', zone).forEach((x) => x.classList.toggle('actif', x === b)); dessiner(); }));
  $('#sq', zone).oninput = (e) => { filtre = e.target.value.toLowerCase(); dessiner(); };
  $('#s-csv', zone).onclick = () => exporterCSV(`koordin-salaires-${todayISO()}.csv`,
    ['Bénéficiaire', 'Rôle', 'Type', 'Période', `Montant (${devise()})`, 'Moyen', 'Référence', 'Date du versement', 'État', 'Confirmé le', 'Validé le'],
    versements.map((v) => { const pr = S.equipe.find((x) => x.id === v.profil_id); return [pr?.nom || '', ROLES[pr?.role]?.label || '', TYPE_VERSEMENT[v.type], v.periode, Math.round(num(v.montant)), v.moyen, v.reference || '', v.date_versement, STATUT_VERSEMENT[v.statut][1].replace(/^\S+\s/, ''), v.confirme_le ? v.confirme_le.slice(0, 10) : '', v.valide_le ? v.valide_le.slice(0, 10) : '']; }));
  dessiner();
}

const champsVersement = (v = {}) => `
  ${F.select('type', 'Type', Object.entries(TYPE_VERSEMENT), v.type || 'salaire')}
  ${F.text('periode', 'Mois concerné', v.periode || todayISO().slice(0, 7), { type: 'month', required: true })}
  ${F.select('moyen', 'Moyen de paiement', MOYENS_ENCAISSEMENT.map((x) => [x, x]), v.moyen || 'Wave')}
  ${F.text('date_versement', 'Date du versement', v.date_versement || todayISO(), { type: 'date', required: true })}`;

function formulaireVersement(v, rendre, profilId = null) {
  const membres = S.equipe.filter((x) => x.actif !== false);
  ouvrirModale({
    titre: v ? 'Corriger le versement' : 'Nouveau versement',
    corps: `${v ? '<div class="notice">Après correction, le bénéficiaire devra confirmer à nouveau (une alerte lui est envoyée).</div>' : ''}<div class="form-grid">
      ${F.select('profil_id', 'Bénéficiaire', membres.map((x) => [x.id, `${x.nom} — ${ROLES[x.role]?.label || x.role}`]), v?.profil_id || profilId || '', { required: true, vide: '— Choisir —', full: true })}
      ${champsVersement(v || {})}
      ${F.text('montant', `Montant (${devise()})`, v?.montant ?? '', { type: 'number', min: 1, required: true, inputmode: 'numeric' })}
      ${F.text('reference', 'Référence (n° de transaction…)', v?.reference ?? '')}
      ${F.area('note', 'Note pour le bénéficiaire (facultatif)', v?.note ?? '', { placeholder: 'Ex. Salaire d’octobre moins l’avance du 15.' })}
    </div>`,
    onSubmit: async (d) => {
      const data = { profil_id: d.profil_id, type: d.type, periode: d.periode, moyen: d.moyen, date_versement: d.date_versement, montant: num(d.montant), reference: d.reference || null, note: d.note || null };
      try { if (v) await q(sb.from('versements').update(data).eq('id', v.id)); else await q(sb.from('versements').insert(data)); }
      catch (e) { throw new Error(erreurVersement(e)); }
      toast(v ? 'Versement corrigé : le bénéficiaire est prévenu.' : 'Versement enregistré : le bénéficiaire est prévenu ✅');
      rendre();
    },
  });
}

async function paieDuMois(rendre) {
  await chargerEquipe();
  const membres = S.equipe.filter((x) => x.actif !== false);
  const derniers = await q(sb.from('versements').select('profil_id, montant, periode').eq('type', 'salaire').order('periode', { ascending: false }).limit(500));
  const dernier = (id) => derniers.find((x) => x.profil_id === id)?.montant ?? '';
  ouvrirModale({
    titre: '📋 Paie du mois',
    large: true,
    boutonOk: 'Enregistrer les versements',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">Cochez les personnes payées et vérifiez les montants (repris du dernier salaire). Chacune recevra une alerte pour confirmer la réception.</p>
      <div class="form-grid">${champsVersement({})}</div>
      <div class="paie-liste mt">${membres.map((x) => `<label class="paie-ligne paie-mois-ligne">
        <input type="checkbox" name="inclure-${x.id}" ${dernier(x.id) ? 'checked' : ''} style="width:auto">
        <div class="paie-nom"><b>${esc(x.nom)}</b><span>${esc(ROLES[x.role]?.label || '')}</span></div>
        <input class="input" type="number" min="1" inputmode="numeric" name="montant-${x.id}" value="${esc(dernier(x.id))}" placeholder="Montant" style="width:130px"></label>`).join('')}</div>`,
    onSubmit: async (d) => {
      const lignes = membres.filter((x) => d[`inclure-${x.id}`] && num(d[`montant-${x.id}`]) > 0)
        .map((x) => ({ profil_id: x.id, type: d.type, periode: d.periode, moyen: d.moyen, date_versement: d.date_versement, montant: num(d[`montant-${x.id}`]) }));
      if (!lignes.length) throw new Error('Cochez au moins une personne avec un montant.');
      try { await q(sb.from('versements').insert(lignes)); } catch (e) { throw new Error(erreurVersement(e)); }
      toast(`${lignes.length} versement(s) enregistré(s) : chacun est prévenu ✅`);
      rendre();
    },
  });
}

function ficheVersement(v, rendre) {
  const pr = S.equipe.find((x) => x.id === v.profil_id);
  const m = ouvrirModale({
    titre: `${pr?.nom || ''} · ${libelleVersement(v)}`,
    corps: `<div class="versement-montant">${money(v.montant)}</div>
      <div class="detail-grid">
        <div><span>Versé le</span><b>${fdate(v.date_versement)}</b></div>
        <div><span>Moyen</span><b>${esc(v.moyen)}</b></div>
        <div><span>Référence</span><b>${esc(v.reference || '—')}</b></div>
        <div><span>État</span><b>${esc(STATUT_VERSEMENT[v.statut][1])}</b></div>
      </div>
      ${v.statut === 'conteste' ? `<div class="notice warn">⚠️ ${esc(pr?.nom || '')} signale : « ${esc(v.commentaire_employe || '')} »</div>` : ''}
      ${v.signature ? `<div class="detail-block"><h4>Signature du bénéficiaire (${new Date(v.confirme_le).toLocaleString('fr-FR')})</h4><img class="signature-img" src="${esc(v.signature)}" alt="Signature"></div>` : ''}
      ${v.valide_le ? `<p class="muted" style="font-size:12px">Validé le ${new Date(v.valide_le).toLocaleString('fr-FR')} par ${esc(nomMembre(v.valide_par))}.</p>` : ''}
      ${v.note ? `<div class="detail-block"><h4>Note</h4><p>${esc(v.note)}</p></div>` : ''}
      ${v.periode_initiale && v.periode_initiale !== v.periode ? `<p class="muted" style="font-size:12px">📅 Mois corrigé le ${new Date(v.periode_corrigee_le).toLocaleString('fr-FR')} par ${esc(nomMembre(v.periode_corrigee_par))} (au départ : ${esc(libellePeriode(v.periode_initiale))}).</p>` : ''}
      <div class="rc-boutons mt">
        ${can('direction') ? '<button type="button" class="btn" id="fv-mois">📅 Changer le mois</button>' : ''}
        ${v.statut === 'recu' ? '<button type="button" class="btn primary" id="fv-valider">✅ Valider</button>' : ''}
        ${['verse', 'conteste'].includes(v.statut) ? '<button type="button" class="btn primary" id="fv-corriger">✏️ Corriger</button>' : ''}
        ${v.statut === 'verse' ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${numeroAuteur(pr)}?text=${encodeURIComponent(`Bonjour ${String(pr?.nom || '').split(' ')[0]}, votre ${libelleVersement(v).toLowerCase()} (${money(v.montant)}) a été versé par ${v.moyen}. Merci de confirmer la réception dans KOORDIN (Mon espace). ${S.profil.nom}`)}">📲 Rappeler par WhatsApp</a>` : ''}
        ${['recu', 'valide'].includes(v.statut) ? '<button type="button" class="btn" id="fv-pdf">📄 Accusé de réception</button>' : ''}
        ${['verse', 'conteste'].includes(v.statut) ? '<button type="button" class="btn danger" id="fv-suppr">Supprimer</button>' : ''}
      </div>`,
  });
  $('#fv-valider', m.el)?.addEventListener('click', async () => {
    try { await q(sb.from('versements').update({ statut: 'valide' }).eq('id', v.id)); toast('Versement validé ✅'); m.fermer(); rendre(); } catch (e) { toast(erreurVersement(e), 'err'); }
  });
  $('#fv-corriger', m.el)?.addEventListener('click', () => { m.fermer(); formulaireVersement(v, rendre); });
  $('#fv-mois', m.el)?.addEventListener('click', () => { m.fermer(); changerMoisVersement(v, rendre); });
  $('#fv-pdf', m.el)?.addEventListener('click', () => pdfAccuseVersement(v, pr));
  $('#fv-suppr', m.el)?.addEventListener('click', async () => {
    if (!(await confirmer('Supprimer ce versement ?', 'Supprimer'))) return;
    try { await q(sb.from('versements').delete().eq('id', v.id)); toast('Versement supprimé.'); m.fermer(); rendre(); } catch (e) { toast(erreurVersement(e), 'err'); }
  });
}

// La Direction corrige le mois d'un versement, même déjà signé : le montant et la signature ne bougent pas
function changerMoisVersement(v, rendre) {
  const pr = S.equipe.find((x) => x.id === v.profil_id);
  ouvrirModale({
    titre: '📅 Changer le mois du versement',
    boutonOk: 'Enregistrer le nouveau mois',
    corps: `<p style="margin-bottom:10px"><b>${esc(pr?.nom || '')}</b> · ${esc(TYPE_VERSEMENT[v.type] || 'Versement')} de <b>${money(v.montant)}</b>, actuellement noté <b>${esc(libellePeriode(v.periode))}</b>.</p>
      ${['recu', 'valide'].includes(v.statut) ? '<div class="notice">Ce versement est déjà confirmé : seul le mois change. Le montant, la signature et la validation restent tels quels. Le bénéficiaire est prévenu.</div>' : ''}
      <div class="form-grid">
        ${F.text('periode', 'Mois concerné', v.periode, { type: 'month', required: true })}
        ${F.area('note', 'Note (facultatif)', v.note || '', { placeholder: 'Ex. Salaire d’octobre versé en retard.' })}
      </div>`,
    onSubmit: async (d) => {
      if (!/^\d{4}-\d{2}$/.test(d.periode || '')) throw new Error('Choisissez un mois.');
      try { await q(sb.rpc('corriger_mois_versement', { p_versement: v.id, p_periode: d.periode, p_note: d.note || '' })); }
      catch (e) { throw new Error(erreurVersement(e)); }
      toast(d.periode === v.periode ? 'Note enregistrée.' : `📅 Versement reclassé en ${libellePeriode(d.periode)} : le bénéficiaire est prévenu.`);
      rendre();
    },
  });
}

async function pdfAccuseVersement(v, pr) {
  try {
    const JsPDF = await chargerJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, 'ACCUSÉ DE RÉCEPTION', libelleVersement(v), `versé le ${fdate(v.date_versement)}`);
    let y = 50;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(17, 21, 33);
    const texte = `Je soussigné(e) ${pr?.nom || ''}, ${ROLES[pr?.role]?.label || ''} chez ${S.entreprise?.nom || ''}, reconnais avoir reçu la somme de ${money(v.montant)} au titre de : ${libelleVersement(v)}, versée le ${fdate(v.date_versement)} par ${v.moyen}${v.reference ? ` (référence ${v.reference})` : ''}.`;
    doc.splitTextToSize(textePDF(texte), 178).forEach((l) => { doc.text(l, 16, y); y += 6; });
    y += 6;
    doc.setFillColor(244, 245, 249); doc.roundedRect(16, y, 178, 18, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(textePDF(money(v.montant)), 105, y + 11.5, { align: 'center' });
    y += 30;
    doc.setFontSize(10); doc.text(textePDF(`Signature de ${pr?.nom || ''}`), 16, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 90, 36);
    if (v.signature) doc.addImage(v.signature, 'PNG', 18, y + 5, 86, 32);
    y += 46;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 108, 128);
    doc.text(textePDF(`Confirmé et signé électroniquement dans KOORDIN le ${v.confirme_le ? new Date(v.confirme_le).toLocaleString('fr-FR') : '-'}.${v.valide_le ? ` Validé par la société le ${new Date(v.valide_le).toLocaleDateString('fr-FR')}.` : ''}`), 16, y);
    if (v.periode_initiale && v.periode_initiale !== v.periode) { y += 5; doc.text(textePDF(`Mois corrigé par la Direction le ${new Date(v.periode_corrigee_le).toLocaleDateString('fr-FR')} (enregistré au départ en ${libellePeriode(v.periode_initiale)}).`), 16, y); }
    piedPDF(doc, `${S.entreprise?.nom || ''} - Accusé de réception - ${pr?.nom || ''}`);
    const nom = `Accuse-${libelleVersement(v)}-${pr?.nom || ''}.pdf`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9.]+/g, '-');
    presenterPDF(doc.output('blob'), nom, `Accusé de réception : ${libelleVersement(v)} (${money(v.montant)}) - ${pr?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurVersement(e), 'err', 6000); }
}

// ═══════════════════════════════ PRESTATAIRES ET CONTRATS (2.9) ═══════════════════════════════
// Sous-traitants et prestataires, même sans compte KOORDIN : contrat signé au doigt sur le
// téléphone de l'entreprise, versements avec reçu signé, PDF envoyés par WhatsApp.

const TYPE_CONTRAT = { forfait: 'Au forfait', tache: 'À la tâche', regie: 'En régie (au temps passé)' };
const STATUT_CONTRAT = {
  brouillon: ['muted', '📝 Brouillon'],
  signe: ['ok', '✍️ Signé, en cours'],
  termine: ['info', '🏁 Terminé'],
  resilie: ['crit', '⛔ Résilié'],
};
const NATURE_VERSEMENT = { avance: 'Avance de démarrage', acompte: 'Acompte', solde: 'Solde', retenue: 'Restitution de retenue', autre: 'Autre' };
const CONDITIONS_TYPE = `1. Le prestataire exécute les travaux décrits ci-dessus dans les règles de l’art, en respectant le planning du chantier et les consignes de sécurité.
2. Les matériaux sont fournis par l’entreprise, sauf mention contraire.
3. Les paiements sont faits par avances et acomptes selon l’avancement constaté, chaque versement faisant l’objet d’un reçu signé.
4. Tout travail supplémentaire doit faire l’objet d’un avenant écrit avant exécution.
5. En cas de manquement grave, l’entreprise peut résilier le contrat après mise en demeure ; seuls les travaux réalisés et acceptés sont dus.`;
let ongletContrats = 'contrats';
const erreurContrat = (e) => {
  const m = String(e?.message || '');
  if (/^(CONTRAT_|RECU_)/.test(m) && e?.hint) return e.hint;
  if (/relation .*(prestataires|contrats|contrat_versements)/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Les contrats nécessitent la mise à jour 2.9 de la base de données (kit d’installation).';
  return messageErreur(e);
};
const totalContrat = (c) => num(c.montant) + num(c.avenants);

// ─── Rédaction automatique du contrat (2.9.1) ───
function nombreEnLettres(valeur) {
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  const D = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
  const m100 = (n, fin) => {
    if (n < 17) return U[n];
    if (n < 20) return `dix-${U[n - 10]}`;
    if (n < 70) { const u = n % 10; return D[Math.floor(n / 10)] + (u === 0 ? '' : u === 1 ? ' et un' : `-${U[u]}`); }
    if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${m100(n - 60)}`;
    return n === 80 ? (fin ? 'quatre-vingts' : 'quatre-vingt') : `quatre-vingt-${m100(n - 80)}`;
  };
  const m1000 = (n, fin) => {
    const c = Math.floor(n / 100), r = n % 100;
    let s = c === 1 ? 'cent' : c > 1 ? `${U[c]} cent${r === 0 && fin ? 's' : ''}` : '';
    if (r) s += (s ? ' ' : '') + m100(r, fin);
    return s;
  };
  let n = Math.round(Math.abs(Number(valeur) || 0));
  if (!n) return 'zéro';
  const parts = [];
  const mds = Math.floor(n / 1e9); n %= 1e9;
  const mns = Math.floor(n / 1e6); n %= 1e6;
  const mil = Math.floor(n / 1e3); n %= 1e3;
  if (mds) parts.push(`${m1000(mds, true)} milliard${mds > 1 ? 's' : ''}`);
  if (mns) parts.push(`${m1000(mns, true)} million${mns > 1 ? 's' : ''}`);
  if (mil) parts.push(mil === 1 ? 'mille' : `${m1000(mil, false)} mille`);
  if (n) parts.push(m1000(n, true));
  return parts.join(' ');
}
const montantEnLettres = (v) => `${nombreEnLettres(v)} ${devise() === 'FCFA' ? 'francs CFA' : devise()}`;

const QUALITE_ROLE = { direction: 'Directeur Général', coordinateur: 'Coordinateur des travaux', comptable: 'Responsable administratif et financier', technicien: 'Chef de chantier' };
const MATERIAUX = { entreprise: 'Fournis par l’entreprise (le prestataire apporte la main-d’œuvre)', prestataire: 'Fournis par le prestataire (main-d’œuvre et matériaux)', partage: 'Partagés (préciser)' };
const PAIEMENT = { avancement: 'Acomptes selon l’avancement des travaux', fin: 'Tout à la fin, après réception', echeancier: 'Échéancier personnalisé' };

// Rédige le contrat complet à partir des informations saisies.
// Format du texte : 1re ligne = titre ; « # » article ; « > » ligne centrée ; « - » puce ; sinon paragraphe.
function redigerContrat(d, presta, projet) {
  const V = (x, def = '[à compléter]') => (x != null && String(x).trim() !== '' ? String(x).trim() : def);
  const m = num(d.montant);
  const prix = m ? `${money(m)} (${montantEnLettres(m)})` : '[montant à compléter]';
  const civ = /ivoire/i.test(S.entreprise?.pays || '');
  const ville = V(d.ville, civ ? 'Abidjan' : '[ville]');
  const L = [];
  const art = [];
  const article = (titre, ...lignes) => art.push([titre, lignes.flat().filter(Boolean)]);
  L.push(d.type === 'regie' ? 'CONTRAT DE PRESTATION DE TRAVAUX EN RÉGIE' : 'CONTRAT DE SOUS-TRAITANCE DE TRAVAUX');
  L.push('> ENTRE LES SOUSSIGNÉS :');
  L.push(`${V(S.entreprise?.nom)}, dont le siège est situé à ${V(d.ent_adresse, '[adresse du siège]')}${d.ent_rccm ? `, immatriculée au Registre du Commerce et du Crédit Mobilier sous le n° ${d.ent_rccm}` : ''}, représentée par ${V(d.rep_nom, '[nom du représentant]')}, en qualité de ${V(d.rep_qualite, '[fonction]')}, dûment habilité(e) aux fins des présentes,`);
  L.push('ci-après dénommée « l’Entreprise »,');
  L.push('> D’UNE PART,');
  L.push('> ET');
  L.push(`${V(presta?.nom, '[nom du prestataire]')}${presta?.specialite ? `, ${presta.specialite}` : ''}${presta?.adresse ? `, demeurant à ${presta.adresse}` : ''}${presta?.piece ? `, titulaire de la pièce / du registre n° ${presta.piece}` : ''}${presta?.telephone ? `, joignable au ${presta.telephone}` : ''},`);
  L.push('ci-après dénommé « le Prestataire »,');
  L.push('> D’AUTRE PART,');
  L.push('Ci-après désignés ensemble « les Parties ».');
  L.push('> PRÉAMBULE');
  L.push(`L’Entreprise réalise ${projet ? `les travaux du chantier « ${projet.nom} »${projet.localisation ? ` situé à ${projet.localisation}` : ''}` : 'des travaux de bâtiment et de génie civil'}. Pour l’exécution de certaines prestations, elle a souhaité faire appel au Prestataire, qui déclare disposer des compétences, du personnel et des moyens nécessaires${presta?.specialite ? ` en ${presta.specialite.toLowerCase()}` : ''}. Les Parties se sont rapprochées et ont convenu de ce qui suit :`);

  article('OBJET DU CONTRAT',
    `Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire exécute, pour le compte de l’Entreprise, les travaux suivants : ${V(d.objet, '[description des travaux]')}.`,
    `Lieu d’exécution : ${V(d.lieu || projet?.localisation, '[lieu des travaux]')}.`);
  const taches = String(d.taches || '').split('\n').map((x) => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);
  const mat = d.materiaux === 'prestataire'
    ? 'Le Prestataire fournit la main-d’œuvre, les matériaux, l’outillage et les équipements nécessaires. Les matériaux doivent être neufs, conformes aux normes en vigueur et acceptés par l’Entreprise avant leur mise en œuvre.'
    : d.materiaux === 'partage'
      ? `La fourniture des matériaux est répartie comme suit : ${V(d.materiaux_detail, '[préciser ce que fournit chaque Partie]')}. Le Prestataire fournit dans tous les cas la main-d’œuvre, son outillage et les équipements de protection de son personnel.`
      : 'Les matériaux et fournitures sont mis à disposition par l’Entreprise. Le Prestataire fournit la main-d’œuvre, son petit outillage et les équipements de protection de son personnel. Il est responsable de la bonne utilisation des matériaux qui lui sont confiés et signale sans délai toute perte, casse ou anomalie.';
  article('CONSISTANCE DES TRAVAUX',
    taches.length ? ['Les prestations comprennent notamment :', ...taches.map((t) => `- ${t}`)] : 'Les prestations comprennent l’ensemble des travaux nécessaires à la parfaite réalisation de l’objet décrit à l’article 1, conformément aux plans et aux instructions de l’Entreprise.',
    mat);
  article('DOCUMENTS CONTRACTUELS',
    'Le contrat est constitué, par ordre de priorité décroissant :',
    '- le présent contrat et ses éventuels avenants ;',
    '- les plans, descriptifs et devis remis par l’Entreprise ;',
    '- les consignes écrites données par l’Entreprise en cours de chantier.');
  const pu = num(d.prix_unitaire) ? `${money(d.prix_unitaire)} par ${V(d.unite, 'unité')}` : '';
  article('PRIX',
    d.type === 'tache'
      ? `Les travaux sont rémunérés à la tâche${pu ? `, sur la base de ${pu}` : ''}, pour un montant total de ${prix}. Le montant dû est calculé sur les quantités réellement exécutées et constatées contradictoirement, dans la limite de ce montant sauf avenant.`
      : d.type === 'regie'
        ? `Les travaux sont rémunérés en régie${pu ? `, au taux de ${pu}` : ''}, sur la base des temps réellement passés et constatés contradictoirement, dans la limite d’un montant maximum de ${prix}, sauf avenant.`
        : `Les travaux sont rémunérés à prix global et forfaitaire de ${prix}. Ce prix est ferme et non révisable ; il comprend toutes les sujétions nécessaires à l’exécution complète des travaux.`,
    'Aucun travail supplémentaire ne sera payé s’il n’a pas fait l’objet, avant son exécution, d’un avenant écrit signé par les deux Parties.');
  const av = num(d.avance_pct), ret = num(d.retenue_pct), delai = num(d.delai_paiement);
  article('MODALITÉS DE PAIEMENT',
    av > 0 ? `Une avance de démarrage de ${av} % du montant, soit ${m ? money((m * av) / 100) : '[montant]'}, est versée à la signature du présent contrat. Elle est imputée sur les paiements suivants.` : '',
    d.mode_paiement === 'fin'
      ? `${av > 0 ? 'Le solde est payé' : 'Le prix est payé'} à l’achèvement des travaux, après leur réception sans réserve ou la levée des réserves.`
      : d.mode_paiement === 'echeancier'
        ? `${av > 0 ? 'Le solde est payé' : 'Le prix est payé'} selon l’échéancier suivant : ${V(d.echeancier, '[échéancier à préciser]')}.`
        : `${av > 0 ? 'Le solde est payé' : 'Le prix est payé'} par acomptes successifs, en fonction de l’avancement des travaux constaté contradictoirement par l’Entreprise.`,
    ret > 0 ? `Une retenue de garantie de ${ret} % est appliquée sur chaque paiement. Elle est restituée au Prestataire à la fin du délai de garantie prévu à l’article 11, sous réserve de la levée de toutes les réserves.` : '',
    `Chaque paiement intervient dans un délai de ${delai > 0 ? `${delai} jour${delai > 1 ? 's' : ''}` : 'sept (7) jours'} à compter de la constatation des travaux, par ${V(d.moyens, 'virement, Mobile Money ou espèces')}. Chaque paiement donne lieu à un reçu daté et signé par le Prestataire.`);
  const jours = d.date_debut && d.date_fin ? Math.round((parseDay(d.date_fin) - parseDay(d.date_debut)) / 864e5) + 1 : 0;
  article('DÉLAIS D’EXÉCUTION',
    d.date_debut || d.date_fin
      ? `Les travaux commencent le ${d.date_debut ? fdate(d.date_debut) : '[date de début]'} et doivent être entièrement achevés au plus tard le ${d.date_fin ? fdate(d.date_fin) : '[date de fin]'}${jours > 0 ? `, soit un délai de ${jours} jours calendaires` : ''}.`
      : 'Les travaux sont exécutés selon le planning général du chantier communiqué par l’Entreprise.',
    'Le Prestataire informe l’Entreprise par écrit, sans délai, de toute cause susceptible de retarder les travaux.');
  const pen = num(d.penalite);
  article('PÉNALITÉS DE RETARD',
    pen > 0
      ? `En cas de retard imputable au Prestataire, une pénalité de ${money(pen)} par jour calendaire de retard est appliquée, après mise en demeure restée sans effet, dans la limite de dix pour cent (10 %) du montant du contrat. Elle est déduite des sommes dues au Prestataire.`
      : 'En cas de retard imputable au Prestataire, l’Entreprise peut, après mise en demeure restée sans effet pendant huit (8) jours, faire exécuter les travaux restants par un tiers, aux frais du Prestataire.');
  article('OBLIGATIONS DU PRESTATAIRE',
    'Le Prestataire s’engage à :',
    '- exécuter les travaux dans les règles de l’art, conformément aux plans, aux normes en vigueur et aux instructions de l’Entreprise ;',
    '- respecter le planning, les horaires et le règlement du chantier ;',
    '- fournir à son personnel les équipements de protection individuelle (casque, chaussures de sécurité, gants, gilet…) et faire respecter les consignes de sécurité et d’hygiène ;',
    '- employer un personnel qualifié, dont il demeure le seul employeur et pour lequel il assume l’ensemble des obligations sociales et fiscales ;',
    '- ne pas confier tout ou partie des travaux à un tiers sans l’accord écrit de l’Entreprise ;',
    '- maintenir sa zone de travail propre et évacuer ses déchets ;',
    '- signaler sans délai toute erreur, anomalie ou risque constaté sur le chantier.');
  article('OBLIGATIONS DE L’ENTREPRISE',
    'L’Entreprise s’engage à :',
    '- mettre la zone de travail à disposition du Prestataire et en permettre l’accès ;',
    `- fournir les plans et informations${d.materiaux === 'prestataire' ? '' : ', ainsi que les matériaux prévus à l’article 2,'} nécessaires à l’exécution des travaux ;`,
    '- payer les sommes dues dans les conditions prévues à l’article 5 ;',
    `- désigner un interlocuteur sur le chantier : ${V(d.rep_nom, '[nom]')}.`);
  const g = num(d.garantie_mois) || 12;
  article('RÉCEPTION DES TRAVAUX',
    'À l’achèvement des travaux, le Prestataire en informe l’Entreprise. Une visite de réception est organisée en présence des deux Parties ; elle donne lieu à un procès-verbal, avec ou sans réserves.',
    'Le Prestataire lève les réserves dans le délai fixé au procès-verbal. À défaut, l’Entreprise peut les faire lever par un tiers, aux frais du Prestataire.');
  article('GARANTIE',
    `Le Prestataire garantit la bonne exécution de ses travaux pendant ${g} mois à compter de la réception. Pendant ce délai, il répare à ses frais tout désordre ou malfaçon qui lui est imputable, dans les sept (7) jours suivant le signalement par l’Entreprise.`);
  article('RESPONSABILITÉ',
    'Le Prestataire est responsable des dommages causés par lui-même ou par son personnel aux ouvrages, aux matériaux, aux biens et aux personnes à l’occasion de l’exécution des travaux. Il déclare être couvert par une assurance de responsabilité civile adaptée, ou accepte d’en supporter seul les conséquences.');
  article('RÉSILIATION',
    'En cas de manquement grave de l’une des Parties à ses obligations, l’autre Partie peut résilier le contrat par écrit, huit (8) jours après une mise en demeure restée sans effet.',
    'En cas de résiliation, seuls les travaux réalisés, constatés et acceptés sont payés, déduction faite des sommes déjà versées et des éventuelles pénalités.');
  article('FORCE MAJEURE',
    'Aucune des Parties n’est responsable d’un retard ou d’une inexécution causé par un cas de force majeure (catastrophe naturelle, intempéries exceptionnelles, décision des autorités…). La Partie concernée en informe l’autre sans délai ; les délais sont alors prolongés d’autant.');
  if (String(d.conditions || '').trim()) article('CLAUSES PARTICULIÈRES', String(d.conditions).trim().split('\n').map((x) => x.trim()).filter(Boolean));
  article('LITIGES',
    `Le présent contrat est soumis au ${civ ? 'droit ivoirien et aux Actes uniformes de l’OHADA' : 'droit applicable au lieu d’exécution des travaux'}. En cas de différend, les Parties recherchent d’abord une solution amiable. À défaut d’accord dans un délai de trente (30) jours, le litige est porté devant le tribunal compétent de ${ville}.`);
  article('DISPOSITIONS FINALES',
    'Le présent contrat entre en vigueur à la date de sa signature par les deux Parties. Toute modification fait l’objet d’un avenant écrit signé par les deux Parties.',
    'Il est signé électroniquement sur KOORDIN ; chaque Partie en reçoit un exemplaire au format PDF.');
  art.forEach(([titre, lignes], i) => { L.push(`# ARTICLE ${i + 1} – ${titre}`); L.push(...lignes); });
  L.push(`> Fait à ${ville}, le ${d.date_signature ? fdate(d.date_signature) : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  return L.join('\n');
}

function texteContratHTML(texte) {
  const lignes = String(texte || '').split('\n');
  const fmt = (x) => esc(x).replace(/\[[^\]]+\]/g, (s) => `<mark class="manque">${s}</mark>`);
  return `<h3 class="cp-titre">${fmt(lignes[0] || '')}</h3>${lignes.slice(1).map((l) => {
    if (l.startsWith('# ')) return `<h4>${fmt(l.slice(2))}</h4>`;
    if (l.startsWith('> ')) return `<p class="cp-centre">${fmt(l.slice(2))}</p>`;
    if (l.startsWith('- ')) return `<p class="cp-puce">${fmt(l.slice(2))}</p>`;
    return `<p>${fmt(l)}</p>`;
  }).join('')}`;
}

function lireContrat(c) {
  ouvrirModale({ titre: `📖 ${c.numero}`, large: true, corps: `<div class="contrat-papier">${texteContratHTML(c.texte)}</div><div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" id="lc-pdf">📄 PDF</button></div>` });
  $('#lc-pdf').onclick = () => pdfContrat(c.id);
}

async function editeurContrat(c, rendre) {
  const gestion = can('direction', 'comptable', 'coordinateur');
  const [prest, projets, dernier] = await Promise.all([
    q(sb.from('prestataires').select('*').eq('actif', true).order('nom')),
    q(sb.from('projets').select('id, nom, localisation').neq('statut', 'termine').order('nom')),
    sb.from('contrats').select('clauses').order('created_at', { ascending: false }).limit(1).then((r) => r.data?.[0]?.clauses || {}),
  ]);
  const k = c?.clauses || {};
  const civ = /ivoire/i.test(S.entreprise?.pays || '');
  const val = (x, def = '') => (x != null && x !== '' ? x : def);
  const d0 = {
    prestataire_id: c?.prestataire_id || '', projet_id: c?.projet_id || (projets.length === 1 ? projets[0].id : ''), type: c?.type || 'forfait',
    objet: c?.objet || '', montant: c?.montant || '', retenue_pct: c?.retenue_pct ?? 0, date_debut: c?.date_debut || todayISO(), date_fin: c?.date_fin || '', conditions: c?.conditions || '',
    rep_nom: val(k.rep_nom, S.profil.nom), rep_qualite: val(k.rep_qualite, QUALITE_ROLE[role()] || ''), ent_adresse: val(k.ent_adresse, dernier.ent_adresse || ''), ent_rccm: val(k.ent_rccm, dernier.ent_rccm || ''),
    ville: val(k.ville, dernier.ville || (civ ? 'Abidjan' : '')), lieu: val(k.lieu), taches: val(k.taches), materiaux: val(k.materiaux, 'entreprise'), materiaux_detail: val(k.materiaux_detail),
    prix_unitaire: val(k.prix_unitaire), unite: val(k.unite), avance_pct: val(k.avance_pct, 0), mode_paiement: val(k.mode_paiement, 'avancement'), echeancier: val(k.echeancier),
    delai_paiement: val(k.delai_paiement, 7), moyens: val(k.moyens, 'virement, Mobile Money ou espèces'), penalite: val(k.penalite), garantie_mois: val(k.garantie_mois, 12),
  };
  const sec = (n, titre, html) => `<fieldset class="ce-section"><legend><span>${n}</span>${titre}</legend><div class="form-grid">${html}</div></fieldset>`;
  const m = ouvrirModale({
    titre: c ? `✏️ Modifier ${c.numero}` : '📑 Nouveau contrat',
    large: true,
    corps: `<p class="ce-intro">Remplissez les informations : <b>le contrat se rédige tout seul</b>, article par article, en bas de la page. Les parties surlignées restent à compléter.</p>
    <button type="button" class="btn sm ce-voir" id="ce-voir">📄 Voir le contrat rédigé ↓</button>
    <form id="ce-form" onsubmit="return false">
      ${sec(1, 'Les parties', `
        <label class="field full">Prestataire *<span class="contrat-presta"><select name="prestataire_id" required><option value="">— Choisir —</option>${prest.map((x) => `<option value="${x.id}" ${x.id === d0.prestataire_id ? 'selected' : ''}>${esc(x.nom)}${x.specialite ? ` (${esc(x.specialite)})` : ''}</option>`).join('')}</select><button type="button" class="btn sm" id="ct-np">＋ Nouveau</button></span></label>
        ${F.text('rep_nom', 'Représentant de l’entreprise', d0.rep_nom, { required: true })}
        ${F.text('rep_qualite', 'Sa fonction', d0.rep_qualite, { placeholder: 'Ex. Directeur Général' })}
        ${F.text('ent_adresse', 'Siège de l’entreprise', d0.ent_adresse, { placeholder: 'Ex. Abidjan, Cocody Angré' })}
        ${F.text('ent_rccm', 'N° RCCM de l’entreprise', d0.ent_rccm, { placeholder: 'Ex. CI-ABJ-2020-B-12345' })}`)}
      ${sec(2, 'Les travaux', `
        ${F.select('projet_id', 'Chantier', [...(gestion ? [['', '— Aucun / plusieurs —']] : []), ...projets.map((x) => [x.id, x.nom])], d0.projet_id, { required: !gestion })}
        ${F.text('lieu', 'Lieu des travaux', d0.lieu, { placeholder: 'Par défaut : l’adresse du chantier' })}
        ${F.text('objet', 'Objet des travaux', d0.objet, { required: true, full: true, placeholder: 'Ex. Électricité complète de la villa R+1' })}
        ${F.area('taches', 'Détail des travaux (une tâche par ligne)', d0.taches, { placeholder: 'Pose des gaines et boîtiers\nTirage des câbles\nPose de l’appareillage\nRaccordement au tableau et essais' })}
        ${F.select('materiaux', 'Matériaux', Object.entries(MATERIAUX), d0.materiaux)}
        ${F.text('materiaux_detail', 'Si partagés : qui fournit quoi ?', d0.materiaux_detail)}`)}
      ${sec(3, 'Le prix et les paiements', `
        ${F.select('type', 'Type de contrat', Object.entries(TYPE_CONTRAT), d0.type)}
        ${F.text('montant', `Montant total (${devise()})`, d0.montant, { type: 'number', min: 1, required: true, inputmode: 'numeric' })}
        ${F.text('prix_unitaire', `Prix unitaire (${devise()}) — à la tâche ou en régie`, d0.prix_unitaire, { type: 'number', min: 0, inputmode: 'numeric' })}
        ${F.text('unite', 'Unité', d0.unite, { placeholder: 'Ex. m², point lumineux, jour' })}
        ${F.text('avance_pct', 'Avance au démarrage (%)', d0.avance_pct, { type: 'number', min: 0, max: 100, step: 'any' })}
        ${F.select('mode_paiement', 'Paiement du reste', Object.entries(PAIEMENT), d0.mode_paiement)}
        ${F.text('echeancier', 'Échéancier (si personnalisé)', d0.echeancier, { full: true, placeholder: 'Ex. 30 % à la pose des gaines, 40 % au tirage des câbles, 30 % à la réception' })}
        ${F.text('retenue_pct', 'Retenue de garantie (%)', d0.retenue_pct, { type: 'number', min: 0, max: 20, step: 'any' })}
        ${F.text('delai_paiement', 'Délai de paiement (jours)', d0.delai_paiement, { type: 'number', min: 0 })}
        ${F.text('moyens', 'Moyens de paiement', d0.moyens, { full: true })}`)}
      ${sec(4, 'Délais et garanties', `
        ${F.text('date_debut', 'Début des travaux', d0.date_debut, { type: 'date' })}
        ${F.text('date_fin', 'Fin au plus tard', d0.date_fin, { type: 'date' })}
        ${F.text('penalite', `Pénalité par jour de retard (${devise()})`, d0.penalite, { type: 'number', min: 0, inputmode: 'numeric', hint: 'Laisser vide : pas de pénalité chiffrée' })}
        ${F.text('garantie_mois', 'Garantie après réception (mois)', d0.garantie_mois, { type: 'number', min: 0, max: 120 })}
        ${F.text('ville', 'Ville (signature et tribunal)', d0.ville)}
        ${F.area('conditions', 'Clauses particulières (facultatif)', d0.conditions, { placeholder: 'Ex. Le prestataire doit être présent sur le chantier tous les jours de 7 h 30 à 17 h.' })}`)}
    </form>
    <div class="ce-apercu-tete" id="ce-apercu-tete"><b>📄 Votre contrat, rédigé automatiquement</b><span id="ce-reste"></span></div>
    <div class="contrat-papier" id="ce-apercu"></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn primary" id="ce-ok">💾 Enregistrer le contrat</button></div>`,
  });
  const el = m.el, form = $('#ce-form', el);
  const lire = () => { const d = lireFormulaire(form); return d; };
  const rediger = () => {
    const d = lire();
    const texte = redigerContrat(d, prest.find((x) => x.id === d.prestataire_id), projets.find((x) => x.id === d.projet_id));
    $('#ce-apercu', el).innerHTML = texteContratHTML(texte);
    const manque = (texte.match(/\[[^\]]+\]/g) || []).length;
    $('#ce-reste', el).textContent = manque ? `${manque} élément(s) à compléter` : '✅ Complet';
    $('#ce-reste', el).className = manque ? 'manque-txt' : 'ok-txt';
    return { d, texte };
  };
  let minuteur;
  form.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(rediger, 120); });
  form.addEventListener('change', rediger);
  rediger();
  $('#ce-voir', el).onclick = () => $('#ce-apercu-tete', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#ct-np', el).onclick = () => formulairePrestataire(null, (cree) => {
    if (!cree) return;
    prest.push(cree);
    const s = $('[name="prestataire_id"]', el);
    s.insertAdjacentHTML('beforeend', `<option value="${cree.id}">${esc(cree.nom)}</option>`);
    s.value = cree.id; rediger();
  });
  $('#ce-ok', el).onclick = async () => {
    if (!form.reportValidity()) return;
    const { d, texte } = rediger();
    const clauses = {};
    ['rep_nom', 'rep_qualite', 'ent_adresse', 'ent_rccm', 'ville', 'lieu', 'taches', 'materiaux', 'materiaux_detail', 'prix_unitaire', 'unite', 'avance_pct', 'mode_paiement', 'echeancier', 'delai_paiement', 'moyens', 'penalite', 'garantie_mois'].forEach((x) => { if (d[x] != null) clauses[x] = d[x]; });
    const ligne = { prestataire_id: d.prestataire_id, projet_id: d.projet_id || null, type: d.type, objet: d.objet, montant: num(d.montant), retenue_pct: num(d.retenue_pct), date_debut: d.date_debut || null, date_fin: d.date_fin || null, conditions: d.conditions || null, clauses, texte };
    const btn = $('#ce-ok', el); btn.disabled = true;
    try {
      let id = c?.id;
      if (c) await q(sb.from('contrats').update(ligne).eq('id', c.id));
      else id = (await q(sb.from('contrats').insert(ligne).select('id').single())).id;
      toast(c ? 'Contrat mis à jour ✅' : 'Contrat rédigé et enregistré ✅ Faites-le signer.');
      m.fermer(); rendre(); ficheContrat(id, rendre);
    } catch (e) { toast(erreurContrat(e), 'err', 7000); } finally { btn.disabled = false; }
  };
}


PAGES.contrats = async () => {
  const p = page(`
    ${entete('Contrats', 'Prestataires et sous-traitants : contrats signés, versements et reçus', '<button class="btn primary" id="nct">＋ Nouveau contrat</button>')}
    <div class="tabs">${[['contrats', '📑 Contrats'], ['versements', '💵 Versements'], ['prestataires', '👷 Prestataires']].map(([k, l]) => `<button class="tab ${k === ongletContrats ? 'active' : ''}" data-o="${k}">${l}</button>`).join('')}</div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('📑', 'Les contrats fonctionnent dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try {
      if (ongletContrats === 'prestataires') await listePrestataires(zone, rendre);
      else if (ongletContrats === 'versements') await listeVersementsPrestataires(zone, rendre);
      else await listeContrats(zone, rendre);
    } catch (e) { zone.innerHTML = `<div class="card">${empty('📑', erreurContrat(e))}</div>`; }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletContrats = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  $('#nct', p).onclick = () => editeurContrat(null, rendre);
  await rendre();
};

async function chargerContrats() {
  const [contrats, versements] = await Promise.all([
    q(sb.from('contrats').select('*, prestataires(nom, specialite, telephone), projets(nom)').order('created_at', { ascending: false })),
    q(sb.from('contrat_versements').select('id, contrat_id, montant, date_versement, nature, moyen, reference, signature, nom_signataire, signe_le').order('date_versement', { ascending: false })),
  ]);
  contrats.forEach((c) => { c.paye = versements.filter((v) => v.contrat_id === c.id).reduce((s, v) => s + num(v.montant), 0); });
  return { contrats, versements };
}

async function listeContrats(zone, rendre) {
  const { contrats } = await chargerContrats();
  const actifs = contrats.filter((c) => c.statut === 'signe');
  const engage = actifs.reduce((s, c) => s + totalContrat(c), 0);
  const paye = actifs.reduce((s, c) => s + c.paye, 0);
  zone.innerHTML = `<div class="grid k4 paie-kpis">
      ${kpi('Contrats en cours', actifs.length)}
      ${kpi('Montant engagé', moneyShort(engage), 'contrats en cours')}
      ${kpi('Déjà payé', moneyShort(paye), `${pct(paye, engage)} %`)}
      ${kpi('Reste à payer', moneyShort(engage - paye), '', engage - paye > 0 ? 'warn' : '')}
    </div>
    <div class="card"><div class="paie-liste">${contrats.length ? contrats.map((c) => `<button type="button" class="paie-ligne vente-ligne" data-ct="${c.id}">
      <div class="paie-nom"><b>${esc(c.prestataires?.nom || '')} · ${esc(c.objet)}</b><span>${esc([c.numero, c.projets?.nom, TYPE_CONTRAT[c.type]].filter(Boolean).join(' · '))}</span>
        ${c.statut !== 'brouillon' ? `<span class="vente-barre"><i style="width:${Math.min(100, pct(c.paye, totalContrat(c)))}%"></i></span><span>Payé ${moneyShort(c.paye)} sur ${moneyShort(totalContrat(c))}</span>` : ''}</div>
      <div class="paie-montant"><b>${money(totalContrat(c))}</b>${badge(STATUT_CONTRAT[c.statut])}</div></button>`).join('')
      : empty('📑', 'Aucun contrat. Créez le premier : le prestataire signera au doigt sur votre téléphone, même s’il n’a pas KOORDIN.')}</div></div>`;
  $$('[data-ct]', zone).forEach((b) => (b.onclick = () => ficheContrat(b.dataset.ct, rendre)));
}

async function listeVersementsPrestataires(zone, rendre) {
  const { contrats, versements } = await chargerContrats();
  const ct = (id) => contrats.find((c) => c.id === id);
  const mois = todayISO().slice(0, 7);
  const ceMois = versements.filter((v) => String(v.date_versement).startsWith(mois));
  zone.innerHTML = `<div class="grid k3 paie-kpis">
      ${kpi('Payé ce mois', moneyShort(ceMois.reduce((s, v) => s + num(v.montant), 0)), `${ceMois.length} versement(s)`)}
      ${kpi('Reçus signés', versements.filter((v) => v.signature).length, `sur ${versements.length}`)}
      ${kpi('Sans reçu signé', versements.filter((v) => !v.signature).length, 'À faire signer si possible', versements.some((v) => !v.signature) ? 'warn' : '')}
    </div>
    <div class="card"><div class="toolbar"><span class="muted" style="font-size:13px">${versements.length} versement(s)</span><button type="button" class="btn sm" id="cv-csv" style="margin-left:auto">⬇️ Excel</button></div>
    <div class="paie-liste">${versements.length ? versements.map((v) => { const c = ct(v.contrat_id); return `<button type="button" class="paie-ligne vente-ligne" data-ct="${v.contrat_id}">
      <div class="paie-nom"><b>${esc(c?.prestataires?.nom || '')}</b><span>${esc([NATURE_VERSEMENT[v.nature], c?.numero, c?.projets?.nom].filter(Boolean).join(' · '))}</span><span>${fdate(v.date_versement)} · ${esc(v.moyen)}${v.reference ? ` · ${esc(v.reference)}` : ''}</span></div>
      <div class="paie-montant"><b>${money(v.montant)}</b>${v.signature ? badge(['ok', '✍️ Reçu signé']) : badge(['warn', 'Sans signature'])}</div></button>`; }).join('')
      : empty('💵', 'Aucun versement à un prestataire pour le moment.')}</div></div>`;
  $$('[data-ct]', zone).forEach((b) => (b.onclick = () => ficheContrat(b.dataset.ct, rendre)));
  $('#cv-csv', zone).onclick = () => exporterCSV(`koordin-versements-prestataires-${todayISO()}.csv`,
    ['Date', 'Prestataire', 'Contrat', 'Chantier', 'Nature', `Montant (${devise()})`, 'Moyen', 'Référence', 'Reçu signé'],
    versements.map((v) => { const c = ct(v.contrat_id); return [v.date_versement, c?.prestataires?.nom || '', c?.numero || '', c?.projets?.nom || '', NATURE_VERSEMENT[v.nature], Math.round(num(v.montant)), v.moyen, v.reference || '', v.signature ? `Oui (${v.nom_signataire || ''})` : 'Non']; }));
}

async function listePrestataires(zone, rendre) {
  const [prest, { contrats }] = await Promise.all([q(sb.from('prestataires').select('*').order('nom')), chargerContrats()]);
  zone.innerHTML = `<div class="card"><div class="card-title">${prest.length} prestataire(s) <button type="button" class="btn sm primary" id="npr">＋ Nouveau prestataire</button></div>
    <div class="paie-liste">${prest.length ? prest.map((x) => {
      const cs = contrats.filter((c) => c.prestataire_id === x.id);
      return `<button type="button" class="paie-ligne vente-ligne" data-pr="${x.id}"><div class="paie-nom"><b>${esc(x.nom)}</b><span>${esc([x.specialite, x.telephone].filter(Boolean).join(' · '))}</span></div>
        <div class="paie-montant"><b>${cs.length} contrat(s)</b><span>payé ${moneyShort(cs.reduce((s, c) => s + c.paye, 0))}</span></div></button>`;
    }).join('') : empty('👷', 'Ajoutez vos sous-traitants et prestataires : électricien, plombier, ferrailleur à la tâche, carreleur…')}</div></div>`;
  $('#npr', zone).onclick = () => formulairePrestataire(null, rendre);
  $$('[data-pr]', zone).forEach((b) => (b.onclick = () => formulairePrestataire(prest.find((x) => x.id === b.dataset.pr), rendre)));
}

function formulairePrestataire(x, apres) {
  ouvrirModale({
    titre: x ? `Modifier « ${x.nom} »` : 'Nouveau prestataire',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom ou raison sociale', x?.nom, { required: true, full: true, placeholder: 'Ex. Kouamé Électricité, Traoré Ali' })}
      ${F.text('specialite', 'Spécialité', x?.specialite, { placeholder: 'Ex. Électricité, ferraillage, carrelage' })}
      ${F.text('telephone', 'Téléphone (WhatsApp)', x?.telephone, { type: 'tel', inputmode: 'tel', placeholder: '07 01 02 03 04' })}
      ${F.text('piece', 'N° CNI, RCCM ou compte contribuable', x?.piece)}
      ${F.text('email', 'Email (facultatif)', x?.email, { type: 'email' })}
      ${F.text('adresse', 'Adresse', x?.adresse, { full: true })}
    </div>`,
    onSubmit: async (d) => {
      const data = { nom: d.nom.trim(), specialite: d.specialite || null, telephone: d.telephone || null, piece: d.piece || null, email: d.email || null, adresse: d.adresse || null };
      let cree = null;
      try { if (x) await q(sb.from('prestataires').update(data).eq('id', x.id)); else cree = await q(sb.from('prestataires').insert(data).select('*').single()); }
      catch (e) { throw new Error(erreurContrat(e)); }
      toast(x ? 'Prestataire mis à jour.' : `${data.nom} ajouté ✅`);
      apres?.(cree);
    },
  });
}

async function ficheContrat(id, rendre) {
  const [c, versements] = await Promise.all([
    q(sb.from('contrats').select('*, prestataires(*), projets(nom, localisation)').eq('id', id).single()),
    q(sb.from('contrat_versements').select('*').eq('contrat_id', id).order('date_versement').order('created_at')),
  ]);
  const paye = versements.reduce((s, v) => s + num(v.montant), 0);
  const total = totalContrat(c);
  const payeur = can('direction', 'comptable');
  const brouillon = c.statut === 'brouillon';
  const numero = numeroAuteur({ telephone: c.prestataires?.telephone });
  const m = ouvrirModale({ titre: `${c.numero} · ${c.prestataires?.nom || ''}`, large: true, corps: `
    <div class="split" style="flex-wrap:wrap;gap:8px;margin-bottom:10px"><span class="muted">${esc([c.projets?.nom, TYPE_CONTRAT[c.type]].filter(Boolean).join(' · '))}</span>${badge(STATUT_CONTRAT[c.statut])}</div>
    <p style="margin-bottom:12px"><b>${esc(c.objet)}</b></p>
    <div class="detail-grid">
      <div><span>Montant</span><b>${money(c.montant)}</b></div>
      <div><span>Avenants</span><b>${money(c.avenants)}</b></div>
      <div><span>Déjà payé</span><b>${money(paye)}</b></div>
      <div><span>Reste à payer</span><b style="color:var(--gold)">${money(total - paye)}</b></div>
    </div>
    ${c.statut !== 'brouillon' ? `<div class="vente-barre" style="max-width:none;height:8px;margin:4px 0 14px"><i style="width:${Math.min(100, pct(paye, total))}%"></i></div>` : ''}
    ${brouillon ? `<div class="detail-block"><h4>Signatures (sur ce téléphone)</h4>
      <div class="signatures">
        <div><label class="field">Nom du prestataire (signataire)<input name="nom_signataire" class="input" value="${esc(c.nom_signataire || c.prestataires?.nom || '')}"></label><div class="sig" id="sig-pr"></div></div>
        <div><label class="field">Pour l’entreprise : ${esc(c.clauses?.rep_nom || S.profil.nom)}</label><div class="sig" id="sig-ent"></div></div>
      </div><p class="hint">Faites d’abord lire le contrat au prestataire (bouton 📖 Lire le contrat). En signant avec le doigt, il reconnaît l’avoir lu et accepté ; vous signez ensuite pour l’entreprise.</p></div>`
      : `<div class="detail-block"><h4>Signé le ${new Date(c.signe_le).toLocaleDateString('fr-FR')} par ${esc(c.nom_signataire || '')}</h4></div>`}
    ${!brouillon ? `<div class="detail-block"><h4>Versements (${versements.length})</h4>${versements.length ? `<div class="paie-liste">${versements.map((v) => `<div class="paie-ligne">
      <div class="paie-nom"><b>${esc(NATURE_VERSEMENT[v.nature])}</b><span>${fdate(v.date_versement)} · ${esc(v.moyen)}${v.reference ? ` · ${esc(v.reference)}` : ''}</span></div>
      <div class="paie-montant"><b>${money(v.montant)}</b>${v.signature ? badge(['ok', '✍️ Signé']) : badge(['warn', 'Sans signature'])}<button type="button" class="btn sm" data-recu="${v.id}">📄 Reçu</button>${!v.signature && payeur ? `<button type="button" class="btn sm ghost" data-suppr-cv="${v.id}">✕</button>` : ''}</div></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px">Aucun versement.</p>'}</div>` : ''}
    <div class="rc-boutons mt">
      ${c.texte ? '<button type="button" class="btn" id="ct-lire">📖 Lire le contrat</button>' : ''}
      ${brouillon ? '<button type="button" class="btn primary" id="ct-signer">✍️ Signer le contrat</button><button type="button" class="btn" id="ct-modif">✏️ Modifier</button><button type="button" class="btn danger" id="ct-suppr">Supprimer</button>' : ''}
      ${['signe', 'resilie'].includes(c.statut) && payeur && total - paye > 0 ? '<button type="button" class="btn primary" id="ct-verser">💵 Nouveau versement</button>' : ''}
      ${!brouillon && numero ? `<a class="btn" target="_blank" rel="noopener" id="ct-wa" href="https://wa.me/${numero}?text=${encodeURIComponent(`Bonjour ${String(c.prestataires?.nom || '').split(' ')[0]}, point sur votre contrat ${c.numero} (${c.objet}) : montant ${money(total)}, déjà payé ${money(paye)}, reste à payer ${money(total - paye)}. ${S.entreprise?.nom || ''}`)}">💬 WhatsApp</a>` : ''}
      <button type="button" class="btn" id="ct-pdf">📄 Contrat en PDF</button>
      ${c.statut === 'signe' && can('direction') ? '<button type="button" class="btn" id="ct-avenant">➕ Avenant</button>' : ''}
      ${c.statut === 'signe' && can('direction', 'comptable', 'coordinateur') ? '<button type="button" class="btn ghost" id="ct-terminer">🏁 Terminé</button><button type="button" class="btn ghost" id="ct-resilier">⛔ Résilier</button>' : ''}
    </div>` });
  const el = m.el;
  const sigP = brouillon ? padSignature($('#sig-pr', el)) : null;
  const sigE = brouillon ? padSignature($('#sig-ent', el)) : null;
  const rouvrir = () => { m.fermer(); rendre(); ficheContrat(id, rendre); };
  $('#ct-signer', el)?.addEventListener('click', async () => {
    const nom = $('[name="nom_signataire"]', el).value.trim();
    const sp = sigP.valeur(), se = sigE.valeur();
    if (!nom || !sp || !se) { toast('Il faut le nom du prestataire et les deux signatures.', 'warn'); return; }
    if (!(await confirmer('Signer le contrat ? Une fois signé, il ne pourra plus être modifié (sauf par avenant).', 'Signer'))) return;
    try {
      await q(sb.from('contrats').update({ statut: 'signe', nom_signataire: nom, signature_prestataire: sp, signature_entreprise: se }).eq('id', id));
      toast('Contrat signé ✅'); m.fermer(); rendre(); pdfContrat(id);
    } catch (e) { toast(erreurContrat(e), 'err', 6000); }
  });
  $('#ct-suppr', el)?.addEventListener('click', async () => {
    if (!(await confirmer('Supprimer ce brouillon de contrat ?', 'Supprimer'))) return;
    try { await q(sb.from('contrats').delete().eq('id', id)); toast('Brouillon supprimé.'); m.fermer(); rendre(); } catch (e) { toast(erreurContrat(e), 'err'); }
  });
  $('#ct-pdf', el).onclick = () => pdfContrat(id);
  $('#ct-lire', el)?.addEventListener('click', () => lireContrat(c));
  $('#ct-modif', el)?.addEventListener('click', () => { m.fermer(); editeurContrat(c, rendre); });
  $('#ct-verser', el)?.addEventListener('click', () => { m.fermer(); formulaireVersementContrat(c, total - paye, numero, rendre); });
  $('#ct-avenant', el)?.addEventListener('click', () => ouvrirModale({
    titre: 'Avenant au contrat',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">Ajoutez le montant des travaux supplémentaires acceptés. Total actuel : <b>${money(total)}</b>.</p><div class="form-grid">${F.text('ajout', `Montant ajouté (${devise()})`, '', { type: 'number', min: 1, required: true, inputmode: 'numeric', full: true })}</div>`,
    onSubmit: async (d) => {
      try { await q(sb.from('contrats').update({ avenants: num(c.avenants) + num(d.ajout) }).eq('id', id)); } catch (e) { throw new Error(erreurContrat(e)); }
      toast('Avenant ajouté ✅'); rouvrir();
    },
  }));
  const changer = async (statut, texte) => {
    if (!(await confirmer(texte, 'Confirmer'))) return;
    try { await q(sb.from('contrats').update({ statut }).eq('id', id)); toast('Contrat mis à jour.'); rouvrir(); } catch (e) { toast(erreurContrat(e), 'err'); }
  };
  $('#ct-terminer', el)?.addEventListener('click', () => changer('termine', 'Marquer ce contrat comme terminé ?'));
  $('#ct-resilier', el)?.addEventListener('click', () => changer('resilie', 'Résilier ce contrat ? Seul un solde pourra encore être versé.'));
  $$('[data-recu]', el).forEach((b) => (b.onclick = () => pdfRecuPrestataire(c, versements, b.dataset.recu)));
  $$('[data-suppr-cv]', el).forEach((b) => (b.onclick = async () => {
    if (!(await confirmer('Supprimer ce versement non signé ?', 'Supprimer'))) return;
    try { await q(sb.from('contrat_versements').delete().eq('id', b.dataset.supprCv)); toast('Versement supprimé.'); rouvrir(); } catch (e) { toast(erreurContrat(e), 'err'); }
  }));
}

function formulaireVersementContrat(c, reste, numero, rendre) {
  const m = ouvrirModale({
    titre: `💵 Versement · ${c.prestataires?.nom || ''}`,
    large: true,
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">${esc(c.numero)} · reste à payer <b>${money(reste)}</b></p>
      <form class="form-grid" id="cv-form" onsubmit="return false">
        ${F.select('nature', 'Nature', c.statut === 'resilie' ? [['solde', NATURE_VERSEMENT.solde]] : Object.entries(NATURE_VERSEMENT), c.statut === 'resilie' ? 'solde' : 'acompte')}
        ${F.text('montant', `Montant (${devise()})`, '', { type: 'number', min: 1, max: reste, required: true, inputmode: 'numeric' })}
        ${F.select('moyen', 'Moyen de paiement', MOYENS_ENCAISSEMENT.map((x) => [x, x]), 'Wave')}
        ${F.text('date_versement', 'Date', todayISO(), { type: 'date', required: true })}
        ${F.text('reference', 'Référence (n° de transaction…)', '')}
        ${F.text('note', 'Note (facultatif)', '', { placeholder: 'Ex. Acompte après pose des gaines' })}
      </form>
      <div class="detail-block mt"><h4>Reçu signé par le prestataire (recommandé)</h4>
        <label class="field">Nom de la personne qui reçoit<input class="input" id="cv-nom" value="${esc(c.nom_signataire || c.prestataires?.nom || '')}"></label>
        <div class="sig" id="sig-cv"></div><p class="hint">S’il n’est pas là, laissez vide : le versement sera noté « sans signature ».</p></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn primary" id="cv-ok">💾 Enregistrer le versement</button></div>`,
  });
  const sig = padSignature($('#sig-cv', m.el));
  $('#cv-ok', m.el).onclick = async () => {
    const form = $('#cv-form', m.el);
    if (!form.reportValidity()) return;
    const d = lireFormulaire(form);
    const s = sig.valeur();
    const nom = $('#cv-nom', m.el).value.trim();
    if (s && !nom) { toast('Indiquez le nom de la personne qui signe.', 'warn'); return; }
    try {
      const v = await q(sb.from('contrat_versements').insert({ contrat_id: c.id, nature: d.nature, montant: num(d.montant), moyen: d.moyen, date_versement: d.date_versement, reference: d.reference || null, note: d.note || null, signature: s, nom_signataire: s ? nom : null }).select('*').single());
      m.fermer(); rendre();
      toast('Versement enregistré ✅');
      const versements = await q(sb.from('contrat_versements').select('*').eq('contrat_id', c.id).order('date_versement').order('created_at'));
      pdfRecuPrestataire(c, versements, v.id);
    } catch (e) { toast(erreurContrat(e), 'err', 7000); }
  };
}

async function pdfContrat(id) {
  try {
    const JsPDF = await chargerJsPDF();
    const c = await q(sb.from('contrats').select('*, prestataires(*), projets(nom, localisation)').eq('id', id).single());
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, c.texte ? 'CONTRAT' : 'CONTRAT DE PRESTATION', `N° ${c.numero}`, c.signe_le ? `signé le ${new Date(c.signe_le).toLocaleDateString('fr-FR')}` : 'BROUILLON');
    let y = 46;
    if (c.texte) {
      const lignes = String(c.texte).split('\n');
      const saut = (h) => { if (y + h > 272) { doc.addPage(); y = 20; } };
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 21, 33);
      doc.splitTextToSize(textePDF(lignes[0]), 170).forEach((l) => { doc.text(l, 105, y, { align: 'center' }); y += 6; });
      y += 3;
      lignes.slice(1).forEach((l) => {
        if (l.startsWith('# ')) { saut(14); y += 2.5; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(17, 21, 33); doc.text(textePDF(l.slice(2)), 16, y); y += 5.5; return; }
        const centre = l.startsWith('> '), puce = l.startsWith('- ');
        const t = centre || puce ? l.slice(2) : l;
        doc.setFont('helvetica', centre ? 'bold' : 'normal'); doc.setFontSize(9.8); doc.setTextColor(30, 34, 46);
        doc.splitTextToSize(textePDF(t), puce ? 170 : 178).forEach((x, i) => {
          saut(5);
          if (centre) doc.text(x, 105, y, { align: 'center' });
          else { if (puce && i === 0) doc.text('•', 18, y); doc.text(x, puce ? 24 : 16, y); }
          y += 4.7;
        });
        y += 1.6;
      });
    } else {
    const bloc = (titre, lignes, x) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(100, 108, 128); doc.text(textePDF(titre), x, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(17, 21, 33);
      lignes.filter(Boolean).forEach((l, i) => doc.text(doc.splitTextToSize(textePDF(l), 84)[0], x, y + 5.5 + i * 4.8));
    };
    bloc('ENTRE L’ENTREPRISE', [S.entreprise?.nom, S.entreprise?.pays], 16);
    bloc('ET LE PRESTATAIRE', [c.prestataires?.nom, c.prestataires?.specialite, c.prestataires?.piece && `Pièce / RCCM : ${c.prestataires.piece}`, c.prestataires?.telephone && `Tél. ${c.prestataires.telephone}`, c.prestataires?.adresse], 110);
    y += 32;
    const para = (titre, texte) => {
      if (!texte) return;
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(17, 21, 33); doc.text(textePDF(titre), 16, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.splitTextToSize(textePDF(texte), 178).forEach((l) => { if (y > 272) { doc.addPage(); y = 20; } doc.text(l, 16, y); y += 4.8; });
      y += 3;
    };
    para('Article 1 — Objet', `${c.objet}${c.projets?.nom ? `\nChantier : ${c.projets.nom}${c.projets.localisation ? ` (${c.projets.localisation})` : ''}.` : ''}`);
    para('Article 2 — Prix et mode de rémunération', `${TYPE_CONTRAT[c.type]}. Montant total : ${money(c.montant)}${num(c.avenants) ? `, porté à ${money(totalContrat(c))} par avenant(s)` : ''}.${num(c.retenue_pct) ? ` Une retenue de garantie de ${num(c.retenue_pct)} % est appliquée jusqu’à la réception des travaux.` : ''}`);
    para('Article 3 — Délais', [c.date_debut && `Début des travaux : ${fdate(c.date_debut)}.`, c.date_fin && `Fin prévue : ${fdate(c.date_fin)}.`].filter(Boolean).join(' ') || 'Selon le planning du chantier.');
    para('Article 4 — Conditions', c.conditions);
    }
    if (y > 225) { doc.addPage(); y = 25; }
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(17, 21, 33);
    doc.text(textePDF(`Le Prestataire : ${c.nom_signataire || c.prestataires?.nom || ''}`), 16, y); doc.text(textePDF(`Pour l'Entreprise : ${c.clauses?.rep_nom || S.entreprise?.nom || ''}`), 110, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 84, 32); doc.rect(110, y + 3, 84, 32);
    if (c.signature_prestataire) doc.addImage(c.signature_prestataire, 'PNG', 18, y + 5, 80, 28);
    if (c.signature_entreprise) doc.addImage(c.signature_entreprise, 'PNG', 112, y + 5, 80, 28);
    y += 42;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 108, 128);
    doc.text(textePDF(c.signe_le ? `Lu et approuvé, signé électroniquement le ${new Date(c.signe_le).toLocaleString('fr-FR')}.` : 'BROUILLON - document non signé.'), 16, y);
    piedPDF(doc, `${S.entreprise?.nom || ''} - Contrat ${c.numero}`);
    const prenom = String(c.prestataires?.nom || '').split(' ')[0];
    presenterPDF(doc.output('blob'), `Contrat-${c.numero}.pdf`, `Bonjour ${prenom}, voici votre contrat ${c.numero} (${c.objet}). Cordialement, ${S.entreprise?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurContrat(e), 'err', 6000); }
}

async function pdfRecuPrestataire(c, versements, idVersement) {
  try {
    const JsPDF = await chargerJsPDF();
    const v = versements.find((x) => x.id === idVersement);
    const avant = versements.slice(0, versements.findIndex((x) => x.id === idVersement) + 1).reduce((s, x) => s + num(x.montant), 0);
    const total = totalContrat(c);
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    await enteteDocumentPDF(doc, 'REÇU DE PAIEMENT', `Contrat ${c.numero}`, `du ${fdate(v.date_versement)}`);
    let y = 50;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(17, 21, 33);
    const texte = `Je soussigné(e) ${v.nom_signataire || c.prestataires?.nom || '…'}, pour ${c.prestataires?.nom || ''}, reconnais avoir reçu de ${S.entreprise?.nom || ''} la somme de ${money(v.montant)} (${NATURE_VERSEMENT[v.nature].toLowerCase()}) au titre du contrat ${c.numero} : ${c.objet}, versée le ${fdate(v.date_versement)} par ${v.moyen}${v.reference ? ` (référence ${v.reference})` : ''}.`;
    doc.splitTextToSize(textePDF(texte), 178).forEach((l) => { doc.text(l, 16, y); y += 6; });
    y += 4;
    doc.setFillColor(244, 245, 249); doc.roundedRect(16, y, 178, 18, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(textePDF(money(v.montant)), 105, y + 11.5, { align: 'center' });
    y += 26;
    y = tableauPDF(doc, y, [{ titre: 'Situation du contrat', x: 16, l: 110 }, { titre: 'Montant', x: 130, l: 64, align: 'right' }], [
      { cells: ['Montant du contrat (avec avenants)', money(total)] },
      { cells: ['Total payé à ce jour (ce versement inclus)', money(avant)] },
      { gras: true, cells: ['Reste à payer', money(total - avant)] },
    ]);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(textePDF(`Signature de ${v.nom_signataire || 'la personne qui reçoit'}`), 16, y);
    doc.setDrawColor(200, 204, 214); doc.rect(16, y + 3, 90, 34);
    if (v.signature) doc.addImage(v.signature, 'PNG', 18, y + 5, 86, 30);
    y += 44;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 108, 128);
    doc.text(textePDF(v.signature ? `Signé électroniquement le ${new Date(v.signe_le).toLocaleString('fr-FR')}.` : 'Reçu non signé par le prestataire.'), 16, y);
    piedPDF(doc, `${S.entreprise?.nom || ''} - Reçu - Contrat ${c.numero}`);
    const prenom = String(c.prestataires?.nom || '').split(' ')[0];
    presenterPDF(doc.output('blob'), `Recu-${c.numero}-${v.date_versement}.pdf`, `Bonjour ${prenom}, voici le reçu de votre paiement de ${money(v.montant)} (contrat ${c.numero}). Reste à payer : ${money(total - avant)}. ${S.entreprise?.nom || ''}`);
  } catch (e) { console.error(e); toast(erreurContrat(e), 'err', 6000); }
}

// ═══════════════════════════════ APPELS VIDÉO ET RÉUNIONS (3.0) ═══════════════════════════════
// La vidéo passe directement d'un téléphone à l'autre (WebRTC). Supabase Realtime sert
// uniquement à se trouver (présence) et à échanger les informations de connexion.

const APPEL = { courant: null, sonnerie: null };
const lienAppel = (id) => `${location.origin}${location.pathname}#/appels/${id}`;
const nomAppel = (id) => S.equipe?.find((x) => x.id === id)?.nom || 'Un collègue';
const appelActif = (a) => a.statut === 'en_cours' && Date.now() - new Date(a.created_at).getTime() < 3 * 3600e3;

function erreurAppel(e) {
  const m = String(e?.message || e?.name || '');
  if (/^APPEL_/.test(m) && e?.hint) return e.hint;
  if (/relation .*appels|repondre_appel/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Les appels nécessitent la mise à jour 3.0 de la base de données (kit d’installation).';
  if (e?.name === 'NotAllowedError' || /Permission denied/i.test(m)) return 'Autorisez la caméra et le micro pour KOORDIN (icône 🔒 à côté de l’adresse, puis Autorisations).';
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'Aucune caméra ou aucun micro trouvé sur cet appareil.';
  if (e?.name === 'NotReadableError') return 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
  return messageErreur(e);
}

async function serveursICE() {
  const s = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  try {
    const { data } = await sb.from('parametres_plateforme').select('cle, valeur').in('cle', ['turn_url', 'turn_utilisateur', 'turn_mot_de_passe']);
    const p = Object.fromEntries((data || []).map((x) => [x.cle, x.valeur]));
    if (p.turn_url) s.push({ urls: p.turn_url.split(/[\s,]+/).filter(Boolean), username: p.turn_utilisateur || undefined, credential: p.turn_mot_de_passe || undefined });
  } catch { /* relais facultatif */ }
  return s;
}

PAGES.appels = async (id) => {
  const p = page(`
    ${entete('Appels et réunions', 'Appeler l’équipe, voir un chantier en direct, se réunir')}
    <div class="appel-actions trois">
      <button type="button" class="appel-gros vocal" id="ap-vocal"><span class="appel-gros-ic">📞</span><b>Appel vocal</b><small>Sans caméra : pour parler avec une ou plusieurs personnes</small></button>
      <button type="button" class="appel-gros" id="ap-chantier"><span class="appel-gros-ic">📹</span><b>${role() === 'technicien' ? 'Montrer le chantier en direct' : 'Voir un chantier en direct'}</b><small>${role() === 'technicien' ? 'Vous filmez, la direction voit et vous parle' : 'Le technicien filme, vous voyez et vous parlez'}</small></button>
      <button type="button" class="appel-gros" id="ap-reunion"><span class="appel-gros-ic">👥</span><b>Réunion vidéo</b><small>Se voir à plusieurs, avec la caméra</small></button>
    </div>
    <div id="ap-encours"></div>
    <div class="card"><div class="card-title">Appeler directement</div><div id="ap-equipe" class="paie-liste"></div></div>
    <div class="card"><div class="card-title">Historique des appels</div><div id="ap-histo" class="paie-liste"></div></div>`);
  if (DEMO) { $('#ap-histo', p).innerHTML = empty('📹', 'Les appels vidéo fonctionnent dans la version installée de KOORDIN.'); return; }
  await chargerEquipe();
  const membres = (S.equipe || []).filter((x) => x.actif && x.id !== S.profil.id);
  $('#ap-equipe', p).innerHTML = membres.length ? membres.map((x) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(x.nom)}</b><span>${esc(ROLES[x.role]?.label || x.role)}</span></div>
      <span class="ap-choix"><button type="button" class="btn sm primary" data-vocal="${x.id}" aria-label="Appel vocal ${esc(x.nom)}">📞 Appeler</button><button type="button" class="btn sm" data-appeler="${x.id}" aria-label="Appel vidéo ${esc(x.nom)}">📹 Vidéo</button></span></div>`).join('') : empty('👥', 'Invitez d’abord des membres dans « Équipe ».');
  $$('[data-appeler]', p).forEach((b) => (b.onclick = () => {
    const x = membres.find((m) => m.id === b.dataset.appeler);
    lancerAppel({ mode: role() === 'technicien' || x.role === 'technicien' ? 'chantier' : 'reunion', invites: [x.id] });
  }));
  $$('[data-vocal]', p).forEach((b) => (b.onclick = () => lancerAppel({ mode: 'audio', invites: [b.dataset.vocal] })));
  $('#ap-vocal', p).onclick = () => dialogueReunion(membres, 'audio');
  $('#ap-chantier', p).onclick = () => dialogueChantier(membres);
  $('#ap-reunion', p).onclick = () => dialogueReunion(membres);
  try {
    const appels = await q(sb.from('appels').select('*, projets(nom)').order('created_at', { ascending: false }).limit(30));
    const actifs = appels.filter((a) => appelActif(a) && (a.cree_par === S.profil.id || a.invites.includes(S.profil.id)));
    $('#ap-encours', p).innerHTML = actifs.length ? `<div class="card appel-encours"><div class="card-title">🔴 En cours</div>${actifs.map((a) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(titreAppel(a))}</b><span>${esc(a.projets?.nom || '')} ${ago(a.created_at)}</span></div><button type="button" class="btn sm primary" data-rejoindre="${a.id}">Rejoindre</button></div>`).join('')}</div>` : '';
    $$('[data-rejoindre]', p).forEach((b) => (b.onclick = () => ouvrirEcranAppel(actifs.find((a) => a.id === b.dataset.rejoindre))));
    $('#ap-histo', p).innerHTML = appels.length ? appels.map((a) => {
      const moi = a.cree_par === S.profil.id;
      const manque = !moi && !a.participants.includes(S.profil.id) && !appelActif(a);
      const duree = a.termine_le ? Math.max(1, Math.round((new Date(a.termine_le) - new Date(a.created_at)) / 60000)) : null;
      const st = appelActif(a) ? ['ok', '🔴 En cours'] : manque ? ['warn', a.refus.includes(S.profil.id) ? 'Refusé' : 'Manqué'] : ['muted', duree ? `${duree} min` : 'Terminé'];
      return `<div class="paie-ligne"><div class="paie-nom"><b>${(a.mode === 'chantier' ? '📹' : a.mode === 'audio' ? '📞' : '👥')} ${esc(titreAppel(a))}</b><span>${moi ? 'Vous avez appelé' : `Appel de ${esc(nomAppel(a.cree_par))}`} · ${new Date(a.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${a.projets?.nom ? ` · ${esc(a.projets.nom)}` : ''}</span></div><div class="paie-montant">${badge(st)}</div></div>`;
    }).join('') : empty('📹', 'Aucun appel pour le moment. Appelez un technicien pour voir son chantier en direct.');
  } catch (e) { $('#ap-histo', p).innerHTML = empty('📹', erreurAppel(e)); }
  if (id) rejoindreParLien(id);
};

function titreAppel(a) {
  if (a.titre) return a.titre;
  const autres = [a.cree_par, ...a.invites].filter((x) => x !== S.profil.id).map(nomAppel);
  return `${a.mode === 'chantier' ? 'Chantier en direct' : a.mode === 'audio' ? 'Appel' : 'Réunion'} avec ${autres.slice(0, 3).join(', ')}${autres.length > 3 ? '…' : ''}`;
}

async function dialogueChantier(membres) {
  const projets = await q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom'));
  const tech = role() === 'technicien';
  const cibles = tech ? membres.filter((x) => x.role !== 'technicien') : membres.filter((x) => x.role === 'technicien');
  ouvrirModale({
    titre: tech ? '📹 Montrer le chantier en direct' : '📹 Voir un chantier en direct',
    boutonOk: '📹 Appeler',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">${tech ? 'Votre caméra arrière filme le chantier : la personne appelée voit en direct et vous parle.' : 'Le technicien répond, sa caméra arrière filme le chantier : vous voyez en direct et vous vous parlez.'}</p>
      <div class="form-grid">
        ${F.select('projet_id', 'Chantier', [['', '— Choisir —'], ...projets.map((x) => [x.id, x.nom])], projets.length === 1 ? projets[0].id : '', { full: true })}
        ${F.select('invite', tech ? 'Qui appeler ?' : 'Quel technicien ?', cibles.map((x) => [x.id, `${x.nom} · ${ROLES[x.role]?.label || x.role}`]), '', { full: true, required: true })}
      </div>`,
    onSubmit: async (d) => { await lancerAppel({ mode: 'chantier', invites: [d.invite], projet_id: d.projet_id || null }); },
  });
}

async function dialogueReunion(membres, mode = 'reunion') {
  const projets = await q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom'));
  const vocal = mode === 'audio';
  ouvrirModale({
    titre: vocal ? '📞 Appel vocal' : '👥 Nouvelle réunion vidéo',
    boutonOk: vocal ? '📞 Appeler' : '📹 Démarrer',
    corps: `<div class="form-grid">
        ${vocal ? '<p class="muted full" style="font-size:13px">Sans caméra : idéal pour un échange rapide, même avec peu de réseau. Cochez une ou plusieurs personnes.</p>' : ''}
        ${F.text('titre', vocal ? 'Sujet (facultatif)' : 'Sujet de la réunion', '', { full: true, placeholder: vocal ? 'Ex. Livraison du béton demain' : 'Ex. Point hebdomadaire Villa Cocody' })}
        ${F.select('projet_id', 'Chantier (facultatif)', [['', '— Aucun —'], ...projets.map((x) => [x.id, x.nom])], '', { full: true })}
      </div>
      <div class="field full" style="margin-top:6px">Participants (7 au maximum)</div>
      <div class="reunion-membres">${membres.map((x) => `<label class="reunion-membre"><input type="checkbox" name="m_${x.id}"><span><b>${esc(x.nom)}</b><small>${esc(ROLES[x.role]?.label || x.role)}</small></span></label>`).join('')}</div>`,
    onSubmit: async (d) => {
      const invites = Object.keys(d).filter((k) => k.startsWith('m_') && d[k]).map((k) => k.slice(2));
      if (!invites.length) { toast('Cochez au moins une personne.', 'warn'); return false; }
      if (invites.length > 7) { toast('7 participants au maximum (8 avec vous).', 'warn'); return false; }
      await lancerAppel({ mode, invites, projet_id: d.projet_id || null, titre: d.titre || null });
    },
  });
}

async function lancerAppel(donnees) {
  if (APPEL.courant) { toast('Vous êtes déjà en appel.', 'warn'); return; }
  let a;
  try { a = await q(sb.from('appels').insert(donnees).select('*, projets(nom)').single()); } catch (e) { toast(erreurAppel(e), 'err', 7000); return; }
  await ouvrirEcranAppel(a);
}

async function rejoindreParLien(id) {
  if (APPEL.courant?.id === id) return;
  try {
    const a = await q(sb.from('appels').select('*, projets(nom)').eq('id', id).single());
    if (!appelActif(a)) { toast('Cet appel est terminé.', 'warn'); return; }
    if (await confirmer(`Rejoindre « ${titreAppel(a)} » ? ${a.mode === 'audio' ? 'Le micro va s’activer.' : 'La caméra et le micro vont s’activer.'}`, a.mode === 'audio' ? '📞 Rejoindre' : '📹 Rejoindre')) ouvrirEcranAppel(a);
  } catch (e) { toast(erreurAppel(e), 'err'); }
}

// ─── Sonnerie : appel entrant ───
function gererAppelTempsReel(payload) {
  const a = payload.new;
  if (!a?.id) return;
  if (payload.eventType === 'INSERT') {
    if (a.cree_par !== S.profil.id && a.invites?.includes(S.profil.id)) sonner(a);
    return;
  }
  if (APPEL.sonnerie?.id === a.id && (a.statut === 'termine' || a.participants.includes(S.profil.id) || a.refus.includes(S.profil.id))) {
    arreterSonnerie();
    if (a.statut === 'termine') toast(`${a.mode === 'audio' ? '📞' : '📹'} Appel manqué de ${nomAppel(a.cree_par)}.`, 'warn', 8000);
  }
  const c = APPEL.courant;
  if (c?.id === a.id) {
    c.appel = { ...c.appel, ...a };
    if (a.statut === 'termine' && c.appel.cree_par !== S.profil.id) c.terminer('L’appel est terminé.');
    else if (c.appel.cree_par === S.profil.id && c.salle.pairs.size === 0 && a.invites.every((x) => a.refus.includes(x))) c.terminer(`${a.invites.length > 1 ? 'Personne ne peut' : `${nomAppel(a.invites[0])} ne peut pas`} répondre pour le moment.`, true);
  }
}

async function verifierAppelsEnAttente() {
  try {
    const depuis = new Date(Date.now() - 60e3).toISOString();
    const { data } = await sb.from('appels').select('*, projets(nom)').eq('statut', 'en_cours').gte('created_at', depuis).contains('invites', [S.profil.id]);
    const a = (data || []).find((x) => !x.participants.includes(S.profil.id) && !x.refus.includes(S.profil.id));
    if (a) sonner(a);
  } catch { /* table absente : rien */ }
}

function sonner(a) {
  if (APPEL.courant || APPEL.sonnerie) return;
  const qui = nomAppel(a.cree_par);
  const el = document.createElement('div');
  el.className = 'sonnerie';
  el.innerHTML = `<div class="sonnerie-carte" role="alertdialog" aria-label="Appel entrant">
    <div class="sonnerie-onde"><div class="sonnerie-avatar">${esc(initiales(qui))}</div></div>
    <b>${esc(qui)}</b>
    <span>${a.mode === 'chantier' ? (role() === 'technicien' ? '📹 veut voir le chantier en direct' : '📹 veut vous montrer le chantier') : a.mode === 'audio' ? (a.invites.length > 1 ? '📞 appel vocal de groupe' : '📞 vous appelle') : '👥 vous invite à une réunion vidéo'}${a.titre ? `<br>« ${esc(a.titre)} »` : ''}</span>
    <div class="sonnerie-boutons">
      <button type="button" class="rond rouge" id="so-non" aria-label="Refuser">✕</button>
      <button type="button" class="rond vert" id="so-oui" aria-label="Répondre">${a.mode === 'audio' ? '📞' : '📹'}</button>
    </div><div class="sonnerie-legende"><span>Refuser</span><span>Répondre</span></div></div>`;
  document.body.appendChild(el);
  let ctx = null;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* pas de son */ }
  const bip = () => {
    try { navigator.vibrate?.([400, 200, 400]); } catch { /* rien */ }
    if (!ctx || ctx.state !== 'running') { ctx?.resume?.().catch(() => {}); if (!ctx || ctx.state !== 'running') return; }
    [0, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.42);
    });
  };
  bip();
  const iv = setInterval(bip, 2200);
  const fin = setTimeout(() => { arreterSonnerie(); toast(`${a.mode === 'audio' ? '📞' : '📹'} Appel manqué de ${qui}.`, 'warn', 8000); }, 45000);
  APPEL.sonnerie = { id: a.id, el, stop: () => { clearInterval(iv); clearTimeout(fin); try { ctx?.close(); } catch { /* rien */ } el.remove(); } };
  $('#so-non', el).onclick = async () => { arreterSonnerie(); try { await sb.rpc('repondre_appel', { p_appel: a.id, p_reponse: 'refuse' }); } catch { /* rien */ } };
  $('#so-oui', el).onclick = () => { arreterSonnerie(); ouvrirEcranAppel(a); };
}
function arreterSonnerie() { APPEL.sonnerie?.stop(); APPEL.sonnerie = null; }

// ─── Connexions vidéo entre les participants (maillage pair à pair) ───
class SalleVisio {
  constructor(appel, flux, ui) { this.a = appel; this.flux = flux; this.ui = ui; this.pid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; this.pairs = new Map(); }
  async demarrer() {
    this.ice = await serveursICE();
    this.canal = sb.channel(`appel-${this.a.id}`, { config: { broadcast: { self: false }, presence: { key: this.pid } } });
    this.canal
      .on('broadcast', { event: 'signal' }, ({ payload }) => this.signal(payload))
      .on('broadcast', { event: 'fin' }, () => this.ui.terminer('L’appel a été terminé par l’organisateur.'))
      .on('presence', { event: 'sync' }, () => this.sync())
      .on('presence', { event: 'leave' }, ({ key }) => { if (!this.canal.presenceState()[key]) this.retirer(key); })
      .subscribe(async (st) => { if (st === 'SUBSCRIBED') await this.canal.track({ profil: S.profil.id, nom: S.profil.nom }); });
  }
  sync() {
    const etat = this.canal.presenceState();
    Object.entries(etat).forEach(([pid, metas]) => {
      if (pid === this.pid || this.pairs.has(pid)) return;
      if (this.pid < pid) this.creerPair(pid, metas[0], true);
    });
    [...this.pairs.keys()].forEach((pid) => { if (!etat[pid] && this.pairs.get(pid).vu) this.retirer(pid); });
    this.pairs.forEach((p, pid) => { if (etat[pid]) p.vu = true; });
    this.ui.maj();
  }
  creerPair(pid, meta, initiateur) {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const pair = { pc, pid, nom: meta?.nom || '…', profil: meta?.profil, file: [], flux: new MediaStream(), vu: false };
    this.pairs.set(pid, pair);
    if (initiateur) {
      pc.onnegotiationneeded = async () => {
        try { await pc.setLocalDescription(await pc.createOffer()); this.envoyer(pid, 'offer', pc.localDescription.toJSON()); } catch (e) { console.warn(e); }
      };
    }
    pc.ontrack = (e) => { if (e.streams[0]) pair.flux = e.streams[0]; else pair.flux.addTrack(e.track); this.ui.tuile(pair); };
    pc.onicecandidate = (e) => { if (e.candidate) this.envoyer(pid, 'ice', e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      this.ui.etat(pair);
      if (pc.connectionState === 'failed' && initiateur) this.relancer(pair);
    };
    this.flux.getTracks().forEach((t) => pc.addTrack(t, this.flux));
    this.ui.tuile(pair);
    this.ui.maj();
    return pair;
  }
  async relancer(pair) {
    try { await pair.pc.setLocalDescription(await pair.pc.createOffer({ iceRestart: true })); this.envoyer(pair.pid, 'offer', pair.pc.localDescription.toJSON()); } catch { /* rien */ }
  }
  envoyer(to, type, data) { this.canal.send({ type: 'broadcast', event: 'signal', payload: { from: this.pid, to, type, data, nom: S.profil.nom, profil: S.profil.id } }); }
  async signal(m) {
    if (m.to !== this.pid) return;
    let pair = this.pairs.get(m.from);
    if (!pair) { if (m.type !== 'offer') return; pair = this.creerPair(m.from, { nom: m.nom, profil: m.profil }, false); }
    if (pair.nom === '…') { pair.nom = m.nom; this.ui.tuile(pair); }
    const pc = pair.pc;
    try {
      if (m.type === 'offer') {
        await pc.setRemoteDescription(m.data); await this.vider(pair);
        await pc.setLocalDescription(await pc.createAnswer());
        this.envoyer(m.from, 'answer', pc.localDescription.toJSON());
      } else if (m.type === 'answer') { await pc.setRemoteDescription(m.data); await this.vider(pair); }
      else if (m.type === 'ice') { if (pc.remoteDescription) await pc.addIceCandidate(m.data); else pair.file.push(m.data); }
    } catch (e) { console.warn('signal', e); }
  }
  async vider(pair) { while (pair.file.length) { try { await pair.pc.addIceCandidate(pair.file.shift()); } catch { /* rien */ } } }
  retirer(pid) {
    const p = this.pairs.get(pid);
    if (!p) return;
    p.pc.close(); this.pairs.delete(pid);
    this.ui.retirerTuile(pid); this.ui.maj();
  }
  async remplacerVideo(piste) {
    for (const p of this.pairs.values()) {
      const s = p.pc.getSenders().find((x) => x.track?.kind === 'video' || (!x.track && x.dtmf === null));
      if (s) await s.replaceTrack(piste);
    }
  }
  fermer(pourTous) {
    try { if (pourTous) this.canal?.send({ type: 'broadcast', event: 'fin', payload: {} }); } catch { /* rien */ }
    this.pairs.forEach((p) => p.pc.close()); this.pairs.clear();
    if (this.canal) setTimeout(() => sb.removeChannel(this.canal), pourTous ? 400 : 0);
    this.flux.getTracks().forEach((t) => t.stop());
  }
}

// ─── Écran d'appel ───
async function ouvrirEcranAppel(a) {
  if (APPEL.courant) { toast('Vous êtes déjà en appel.', 'warn'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { toast('Ce navigateur ne permet pas les appels. Utilisez Chrome à jour.', 'err', 7000); return; }
  APPEL.courant = { id: a.id, appel: a, terminer: () => {} };
  const vocal = a.mode === 'audio';
  const createur = a.cree_par === S.profil.id;
  let face = a.mode === 'chantier' && role() === 'technicien' ? 'environment' : 'user';
  const contraintes = (f) => ({ facingMode: f, width: { ideal: f === 'environment' ? 1280 : 640 }, height: { ideal: f === 'environment' ? 720 : 480 }, frameRate: { ideal: 24, max: 30 } });
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: vocal ? false : contraintes(face) });
  } catch (e) {
    try { flux = await navigator.mediaDevices.getUserMedia({ audio: true }); if (!vocal) toast('Caméra indisponible : vous êtes en audio seulement.', 'warn', 6000); }
    catch (e2) { APPEL.courant = null; toast(erreurAppel(e2), 'err', 9000); return; }
  }
  try { await q(sb.rpc('repondre_appel', { p_appel: a.id, p_reponse: 'rejoint' })); }
  catch (e) { flux.getTracks().forEach((t) => t.stop()); APPEL.courant = null; toast(erreurAppel(e), 'err', 7000); return; }

  const peutPhoto = !vocal && a.projet_id && can('direction', 'coordinateur', 'technicien');
  const autres = [a.cree_par, ...a.invites].filter((x) => x !== S.profil.id);
  const el = document.createElement('div');
  el.className = `appel-ecran${vocal ? ' vocal' : ''}`;
  el.innerHTML = `
    <div class="ap-haut"><div class="ap-titre"><b>${esc(titreAppel(a))}</b><span><i class="ap-point"></i><span id="ap-chrono">00:00</span> · <span id="ap-nb">1 personne</span>${a.projets?.nom ? ` · ${esc(a.projets.nom)}` : ''}</span></div>
      <button type="button" class="ap-mini" id="ap-relancer" title="Relancer par WhatsApp">📲</button></div>
    <div class="ap-grille" id="ap-grille" data-n="0"><div class="ap-attente" id="ap-attente"><div class="sonnerie-onde"><div class="sonnerie-avatar">${esc(initiales(nomAppel(autres[0])))}</div></div><b>${createur ? `Appel de ${esc(autres.map(nomAppel).slice(0, 3).join(', '))}…` : 'Connexion…'}</b><span>${createur ? 'Ça sonne chez eux. S’ils ne voient pas l’appel, appuyez sur 📲 pour leur envoyer le lien par WhatsApp.' : 'Connexion à l’appel en cours.'}</span></div></div>
    <video class="ap-moi ${face === 'user' ? 'miroir' : ''}" id="ap-moi" autoplay playsinline muted></video>
    <div class="ap-bas">
      <button type="button" class="ap-btn" id="ap-micro" aria-label="Micro"><span>🎤</span><small>Micro</small></button>
      ${vocal ? '<button type="button" class="ap-btn" id="ap-hp" aria-label="Haut-parleur"><span>🔊</span><small>Haut-parleur</small></button>' : `<button type="button" class="ap-btn" id="ap-cam" aria-label="Caméra"><span>📷</span><small>Caméra</small></button>
      <button type="button" class="ap-btn" id="ap-retourner" aria-label="Changer de caméra"><span>🔄</span><small>Retourner</small></button>`}
      ${peutPhoto ? '<button type="button" class="ap-btn" id="ap-photo" aria-label="Photo"><span>📸</span><small>Photo</small></button>' : ''}
      <button type="button" class="ap-btn rouge" id="ap-fin" aria-label="Raccrocher"><span>✆</span><small>${createur ? 'Terminer' : 'Quitter'}</small></button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('en-appel');
  const moi = $('#ap-moi', el);
  moi.srcObject = flux;
  const grille = $('#ap-grille', el);
  const debut = Date.now();
  const chrono = setInterval(() => { const s = Math.floor((Date.now() - debut) / 1000); $('#ap-chrono', el).textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  let verrou = null;
  try { verrou = await navigator.wakeLock?.request('screen'); } catch { /* rien */ }
  let sansReponse = createur ? setTimeout(() => {
    if (salle.pairs.size === 0) $('#ap-attente span', el).innerHTML = 'Pas encore de réponse. Envoyez le lien par WhatsApp avec 📲, ou raccrochez et réessayez plus tard.';
  }, 40000) : null;

  const ui = {
    tuile(pair) {
      let t = grille.querySelector(`[data-pid="${pair.pid}"]`);
      if (!t) {
        t = document.createElement('div');
        t.className = 'ap-tuile'; t.dataset.pid = pair.pid;
        t.innerHTML = `<video autoplay playsinline></video>${vocal ? `<div class="ap-avatar"><span>${esc(initiales(pair.nom))}</span></div>` : ''}<span class="ap-nom"></span><span class="ap-etat">Connexion…</span>`;
        t.onclick = () => { const f = t.classList.toggle('focus'); $$('.ap-tuile', grille).forEach((x) => { if (x !== t) x.classList.toggle('cache', f); }); };
        grille.appendChild(t);
      }
      $('.ap-nom', t).textContent = pair.nom;
      if (vocal && $('.ap-avatar span', t)) $('.ap-avatar span', t).textContent = initiales(pair.nom);
      const v = $('video', t);
      if (v.srcObject !== pair.flux) { v.srcObject = pair.flux; v.play?.().catch(() => {}); }
      $('#ap-attente', el)?.classList.add('hidden');
      grille.dataset.n = grille.querySelectorAll('.ap-tuile').length;
    },
    etat(pair) {
      const t = grille.querySelector(`[data-pid="${pair.pid}"] .ap-etat`);
      if (!t) return;
      const s = pair.pc.connectionState;
      t.textContent = s === 'connected' ? '' : s === 'failed' ? '⚠️ Connexion difficile…' : s === 'disconnected' ? '📶 Réseau faible…' : 'Connexion…';
      t.classList.toggle('hidden', s === 'connected');
      if (s === 'connected') { clearTimeout(sansReponse); sansReponse = null; }
    },
    retirerTuile(pid) {
      grille.querySelector(`[data-pid="${pid}"]`)?.remove();
      grille.dataset.n = grille.querySelectorAll('.ap-tuile').length;
      if (!grille.querySelector('.ap-tuile')) { const at = $('#ap-attente', el); at.classList.remove('hidden'); $('b', at).textContent = 'Seul dans l’appel'; $('span', at).textContent = 'Les autres participants ont quitté.'; }
    },
    maj() { const n = salle.pairs.size + 1; $('#ap-nb', el).textContent = `${n} personne${n > 1 ? 's' : ''}`; },
    terminer: (msg, pourTous) => terminer(msg, pourTous),
  };
  const salle = new SalleVisio(a, flux, ui);
  let fini = false;
  async function terminer(msg, pourTous) {
    if (fini) return;
    fini = true;
    const dernier = salle.pairs.size === 0;
    salle.fermer(pourTous);
    clearInterval(chrono); clearTimeout(sansReponse);
    try { await verrou?.release(); } catch { /* rien */ }
    window.removeEventListener('pagehide', surFermeture);
    el.remove(); document.body.classList.remove('en-appel');
    APPEL.courant = null;
    if (pourTous || dernier) { try { await sb.rpc('repondre_appel', { p_appel: a.id, p_reponse: 'termine' }); } catch { /* rien */ } }
    if (msg) toast(msg, 'ok', 6000);
    if ((hashCourant() || '').startsWith('#/appels')) { if (hashCourant() !== '#/appels') location.hash = '#/appels'; else naviguer(); }
  }
  const surFermeture = () => terminer(null, createur);
  window.addEventListener('pagehide', surFermeture);
  APPEL.courant = { id: a.id, appel: a, salle, terminer: (m, t) => terminer(m, t) };
  await salle.demarrer();

  const piste = (k) => flux.getTracks().find((t) => t.kind === k);
  $('#ap-micro', el).onclick = (e) => { const t = piste('audio'); if (!t) return; t.enabled = !t.enabled; e.currentTarget.classList.toggle('off', !t.enabled); $('span', e.currentTarget).textContent = t.enabled ? '🎤' : '🔇'; };
  $('#ap-hp', el)?.addEventListener('click', (e) => {
    // Le volume des voix des autres : fort (haut-parleur) ou normal
    const fort = !e.currentTarget.classList.toggle('off');
    $$('.ap-tuile video', grille).forEach((v) => { v.volume = fort ? 1 : 0.35; });
    $('span', e.currentTarget).textContent = fort ? '🔊' : '🔉';
  });
  if (vocal) $('#ap-moi', el).classList.add('hidden');
  if (!$('#ap-cam', el)) { /* appel vocal : pas de caméra */ } else $('#ap-cam', el).onclick = (e) => { const t = piste('video'); if (!t) return; t.enabled = !t.enabled; e.currentTarget.classList.toggle('off', !t.enabled); moi.classList.toggle('hidden', !t.enabled); };
  if ($('#ap-retourner', el)) $('#ap-retourner', el).onclick = async (e) => {
    const ancienne = piste('video');
    const btn = e.currentTarget; btn.disabled = true;
    const voulu = face === 'user' ? 'environment' : 'user';
    try {
      ancienne?.stop();
      const nouveau = await navigator.mediaDevices.getUserMedia({ video: contraintes(voulu) });
      const p = nouveau.getVideoTracks()[0];
      if (ancienne) flux.removeTrack(ancienne);
      flux.addTrack(p);
      await salle.remplacerVideo(p);
      face = voulu; moi.srcObject = flux; moi.classList.toggle('miroir', face === 'user');
    } catch (err) {
      toast(erreurAppel(err), 'err');
      try { const r = await navigator.mediaDevices.getUserMedia({ video: contraintes(face) }); const p = r.getVideoTracks()[0]; if (ancienne) flux.removeTrack(ancienne); flux.addTrack(p); await salle.remplacerVideo(p); moi.srcObject = flux; } catch { /* rien */ }
    } finally { btn.disabled = false; }
  };
  $('#ap-photo', el)?.addEventListener('click', async (e) => {
    const v = grille.querySelector('.ap-tuile.focus video') || (face === 'environment' ? moi : grille.querySelector('.ap-tuile video')) || moi;
    if (!v.videoWidth) { toast('Image pas encore disponible.', 'warn'); return; }
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      const chemin = `${S.entreprise.id}/galerie/${a.projet_id}/visio-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('photos-chantier').upload(chemin, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      await q(sb.from('projet_photos').insert({ projet_id: a.projet_id, chemin, legende: `Capture de l’appel vidéo du ${new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` }));
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 300);
      toast('📸 Photo ajoutée à la galerie du chantier.');
    } catch (err) { toast(messageErreur(err), 'err'); } finally { btn.disabled = false; }
  });
  $('#ap-relancer', el).onclick = () => {
    const cible = autres.length === 1 ? S.equipe?.find((x) => x.id === autres[0]) : null;
    const numero = cible ? numeroAuteur(cible) : '';
    const texte = `${vocal ? '📞' : '📹'} ${S.profil.nom} vous attend dans un appel ${vocal ? '' : 'vidéo '}KOORDIN. Appuyez ici pour rejoindre : ${lienAppel(a.id)}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texte)}`, '_blank', 'noopener');
  };
  $('#ap-fin', el).onclick = async () => {
    if (createur && salle.pairs.size > 1 && !(await confirmer('Terminer la réunion pour tout le monde ?', 'Terminer'))) return;
    terminer(null, createur);
  };
}

// ═══════════════════════════════ STOCK ═══════════════════════════════

let ongletStock = 'articles';

function tableauStock(articles, { compact = false } = {}) {
  if (!articles.length) return empty('📦', compact ? 'Aucun article sous le seuil ✅' : 'Aucun article');
  const mouv = can('direction', 'magasinier', 'technicien');
  const gerer = can('direction', 'magasinier', 'achats');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="num">Quantité</th><th class="num">Seuil</th><th>État</th>${compact || can('technicien') ? '' : '<th class="num">Valeur</th>'}${!compact && (mouv || gerer) ? '<th></th>' : ''}</tr></thead><tbody>
    ${articles.map((a) => `<tr class="${a.alerte ? 'over' : ''}"><td><b>${esc(a.nom)}</b></td>
      <td class="num"><b>${esc(qteLisible(a, a.quantite))}</b></td><td class="num muted">${esc(qteLisible(a, a.seuil_min))}</td>
      <td>${a.alerte ? badge(['crit', '🚨 À réapprovisionner']) : badge(['ok', '✅ OK'])}</td>
      ${compact || can('technicien') ? '' : `<td class="num">${money(num(a.quantite) * num(a.prix_unitaire))}</td>`}
      ${!compact && (mouv || gerer) ? `<td class="right nowrap">${mouv ? `<button class="btn sm" data-mv="sortie" data-art="${a.id}">⬆️ ${can('technicien') ? 'Prendre' : 'Sortie'}</button><button class="btn sm" data-mv="entree" data-art="${a.id}">⬇️ ${can('technicien') ? 'Rendre' : 'Entrée'}</button>` : ''}
        ${gerer ? `<button class="btn sm" data-ea="${a.id}">Modifier</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function tableauMouvements(mouvements, { supprimer = false } = {}) {
  if (!mouvements.length) return empty('🔄', 'Aucun mouvement');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Article</th><th>Mouvement</th><th>Projet</th><th>Par</th><th>Commentaire</th>${supprimer ? '<th></th>' : ''}</tr></thead><tbody>
    ${mouvements.map((m) => `<tr><td class="nowrap">${new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td><b>${esc(m.articles?.nom)}</b></td>
      <td>${m.type === 'entree' ? badge(['ok', `⬇️ +${qteLisible(m.articles, m.quantite)}`]) : badge(['info', `⬆️ −${qteLisible(m.articles, m.quantite)}`])}</td>
      <td>${esc(m.projets?.nom || '—')}</td><td>${esc(nomMembre(m.created_by))}</td><td class="muted">${esc(m.commentaire || '')}</td>${supprimer ? `<td class="right"><button class="btn sm ghost" data-sm="${m.id}" aria-label="Supprimer ce mouvement" title="Supprimer ce mouvement">🗑️</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

// ─────────────────────────────── Pointage et paie des journaliers ───────────────────────────────
// Le chef de chantier fait l'appel chaque jour ; la paie se fait chaque semaine.

let ongletPointage = null;
const METIERS = ['Maçon', 'Ferrailleur', 'Coffreur', 'Manœuvre', 'Électricien', 'Plombier', 'Menuisier', 'Carreleur', 'Peintre', 'Soudeur', 'Chauffeur', 'Gardien', 'Autre'];
const decalerJour = (iso, j) => { const d = parseDay(iso); d.setDate(d.getDate() + j); return d.toLocaleDateString('sv-SE'); };
const lundiDe = (iso) => decalerJour(iso, -((parseDay(iso).getDay() + 6) % 7));
const erreurPointage = (e) => {
  const m = String(e?.message || '');
  if (/pointages_ouvrier_id_date_pointage_key|duplicate key/.test(m)) return 'Un de ces ouvriers est déjà pointé ce jour-là sur un autre chantier.';
  if (/POINTAGE_|tarif d'un ouvrier|marquer la paie/.test(m)) return e.hint || m;
  if (/relation .*(ouvriers|pointages)|pointages_du_jour/.test(m)) return 'Le pointage nécessite la mise à jour 1.9 de la base de données : dans Supabase → SQL Editor, exécutez le fichier supabase/mise-a-jour-1.9.sql.';
  return messageErreur(e);
};

PAGES.pointage = async () => {
  const onglets = [
    ...(can('direction', 'coordinateur', 'technicien') ? [['appel', '📋 Appel du jour']] : []),
    ['paie', '💵 Paie de la semaine'],
    ...(can('direction', 'coordinateur', 'technicien') ? [['ouvriers', '👷 Ouvriers']] : []),
  ];
  if (!onglets.some(([k]) => k === ongletPointage)) ongletPointage = onglets[0][0];
  if (!navigator.onLine && onglets.some(([k]) => k === 'appel')) ongletPointage = 'appel';
  const p = page(`
    ${entete('Pointage', 'Présence des ouvriers journaliers et paie de la semaine')}
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletPointage ? 'active' : ''}" data-o="${k}">${l}</button>`).join('')}</div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  if (DEMO) { zone.innerHTML = `<div class="card">${empty('👷', 'Le pointage des ouvriers fonctionne dans la version installée de KOORDIN.')}</div>`; return; }
  const rendre = async () => {
    zone.innerHTML = loading();
    try {
      if (ongletPointage === 'appel') await ongletAppel(zone);
      else if (ongletPointage === 'paie') await ongletPaie(zone);
      else await ongletOuvriers(zone);
    } catch (e) { zone.innerHTML = `<div class="card">${empty('👷', erreurPointage(e))}</div>`; }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletPointage = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  await rendre();
};

async function ongletAppel(zone) {
  const projets = await avecCache('projets-actifs', () => q(sb.from('projets').select('id, nom, statut').neq('statut', 'termine').order('nom')));
  if (!projets.length) { zone.innerHTML = `<div class="card">${empty('🏗️', 'Aucun chantier en cours. Le pointage se fait sur un chantier.')}</div>`; return; }
  const tech = role() === 'technicien';
  const auj = todayISO();
  let projetId = memo.get('koordin-pointage-projet');
  if (!projets.some((x) => x.id === projetId)) projetId = projets[0].id;
  let date = auj;
  let ouvriers = [], deja = new Map(), ailleurs = new Map(), choix = new Map(), filtre = '';

  zone.innerHTML = `<div class="card">
      <div class="form-grid">
        ${F.select('projet', 'Chantier', projets.map((x) => [x.id, x.nom]), projetId)}
        ${F.text('date', 'Jour', date, { type: 'date', max: auj, min: tech ? decalerJour(auj, -2) : null })}
      </div>
    </div>
    <div id="appel"></div>`;
  const zAppel = $('#appel', zone);

  const charger = async () => {
    zAppel.innerHTML = loading();
    const [o, pt, ail] = await Promise.all([
      avecCache('ouvriers-actifs', () => q(sb.from('ouvriers').select('id, nom, metier, telephone, tarif_jour, actif').eq('actif', true).order('nom'))),
      avecCache(`pointages-${projetId}-${date}`, () => q(sb.from('pointages').select('id, ouvrier_id, presence, tarif_jour, paye').eq('projet_id', projetId).eq('date_pointage', date)), { defaut: [] }),
      avecCache(`ailleurs-${date}`, async () => { const r = await sb.rpc('pointages_du_jour', { p_date: date }); if (r.error) throw r.error; return r.data || []; }, { defaut: [] }),
    ]);
    ouvriers = o;
    deja = new Map(pt.map((x) => [x.ouvrier_id, x]));
    ailleurs = new Map(ail.filter((x) => x.projet_id !== projetId).map((x) => [x.ouvrier_id, x.projet]));
    choix = new Map(pt.map((x) => [x.ouvrier_id, Number(x.presence)]));
    dessiner();
  };

  const resume = () => {
    let jours = 0, cout = 0, presents = 0, demis = 0;
    choix.forEach((v, id) => {
      if (!v) return;
      const ouv = ouvriers.find((x) => x.id === id);
      const tarif = deja.get(id)?.tarif_jour ?? ouv?.tarif_jour ?? 0;
      jours += v; cout += v * num(tarif);
      if (v === 1) presents++; else demis++;
    });
    return { jours, cout, presents, demis };
  };
  const majResume = () => {
    const r = resume();
    $('#ap-resume', zAppel).innerHTML = `<b>${r.presents}</b> présent${r.presents > 1 ? 's' : ''}${r.demis ? ` · <b>${r.demis}</b> demi-journée${r.demis > 1 ? 's' : ''}` : ''} · Coût du jour : <b>${money(r.cout)}</b>`;
  };

  const dessiner = () => {
    const liste = ouvriers.filter((x) => !filtre || `${x.nom} ${x.metier || ''}`.toLowerCase().includes(filtre));
    zAppel.innerHTML = `<div class="card">
      <div class="appel-tete">
        <div id="ap-resume" class="appel-resume"></div>
        <div class="appel-actions"><button type="button" class="btn sm" id="ap-tous">✅ Tous présents</button><button type="button" class="btn sm" id="ap-nouv">＋ Nouvel ouvrier</button></div>
      </div>
      ${ouvriers.length > 10 ? '<input class="input mt" id="ap-q" placeholder="🔍 Rechercher un ouvrier…" style="width:100%">' : ''}
      ${ouvriers.length ? `<div class="appel-liste">${liste.map((x) => {
        const bloque = ailleurs.get(x.id) || (deja.get(x.id)?.paye ? 'paye' : null);
        const v = choix.get(x.id) || 0;
        return `<div class="appel-ligne ${v ? 'present' : ''}">
          <div class="appel-nom"><b>${esc(x.nom)}</b><span>${esc([x.metier, money(deja.get(x.id)?.tarif_jour ?? x.tarif_jour) + '/jour'].filter(Boolean).join(' · '))}</span>
            ${bloque === 'paye' ? '<span class="badge muted">💵 Déjà payé</span>' : bloque ? `<span class="badge warn">📍 Sur ${esc(bloque)}</span>` : ''}</div>
          <div class="segment" role="group" aria-label="Présence de ${esc(x.nom)}">${[[0, 'Absent'], [0.5, '½ j.'], [1, 'Présent']].map(([val, lib]) => `<button type="button" data-ouv="${x.id}" data-v="${val}" class="${v === val ? 'actif' : ''}" ${bloque ? 'disabled' : ''}>${lib}</button>`).join('')}</div>
        </div>`;
      }).join('')}</div>` : empty('👷', 'Aucun ouvrier enregistré. Ajoutez vos journaliers une seule fois avec « ＋ Nouvel ouvrier », puis faites l’appel chaque jour en un geste.')}
      ${ouvriers.length ? '<div class="form-actions"><button type="button" class="btn primary" id="ap-ok">💾 Enregistrer l’appel</button></div>' : ''}
    </div>`;
    majResume();
    $('#ap-q', zAppel)?.addEventListener('input', (e) => { filtre = e.target.value.toLowerCase(); const pos = e.target.selectionStart; dessiner(); const i = $('#ap-q', zAppel); i.focus(); i.setSelectionRange(pos, pos); });
    if ($('#ap-q', zAppel) && filtre) $('#ap-q', zAppel).value = filtre;
    $$('[data-ouv]', zAppel).forEach((b) => (b.onclick = () => {
      choix.set(b.dataset.ouv, Number(b.dataset.v));
      const ligne = b.closest('.appel-ligne');
      $$('button', ligne).forEach((x) => x.classList.toggle('actif', x === b));
      ligne.classList.toggle('present', Number(b.dataset.v) > 0);
      majResume();
    }));
    $('#ap-tous', zAppel).onclick = () => {
      ouvriers.forEach((x) => { if (!ailleurs.has(x.id) && !deja.get(x.id)?.paye) choix.set(x.id, 1); });
      dessiner();
    };
    $('#ap-nouv', zAppel).onclick = () => formulaireOuvrier(null, () => charger());
    $('#ap-ok', zAppel)?.addEventListener('click', enregistrer);
  };

  const enregistrer = async () => {
    const btn = $('#ap-ok', zAppel);
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const appel = { projet_id: projetId, date, choix: [...choix].filter(([id]) => !ailleurs.has(id) && !deja.get(id)?.paye) };
    const r = resume();
    const garderSurTelephone = async () => {
      await ajouterEnvoi({ type: 'appel', appel, libelle: `${projets.find((x) => x.id === projetId)?.nom || ''} · ${r.presents + r.demis} ouvrier(s)` });
      memoriser(`pointages-${projetId}-${date}`, appel.choix.filter(([, v]) => v).map(([id, v]) => ({ id: null, ouvrier_id: id, presence: v, tarif_jour: ouvriers.find((x) => x.id === id)?.tarif_jour, paye: false })));
      toast('📶 Pas de réseau : appel enregistré sur le téléphone. Il partira tout seul dès que le réseau revient ✅', 'warn', 7000);
      majIndicateurReseau();
      btn.disabled = false; btn.textContent = '💾 Enregistrer l’appel';
    };
    try {
      if (!navigator.onLine) { await garderSurTelephone(); return; }
      await envoyerAppel(appel);
      toast(`Appel enregistré ✅ ${r.presents + r.demis} ouvrier(s) pointé(s) le ${fdate(date)}.`);
      await charger();
    } catch (e) {
      if (estErreurReseau(e)) { try { await garderSurTelephone(); return; } catch { /* stockage indisponible */ } }
      toast(erreurPointage(e), 'err', 7000);
      btn.disabled = false; btn.textContent = '💾 Enregistrer l’appel';
    }
  };

  $('[name="projet"]', zone).onchange = (e) => { projetId = e.target.value; memo.set('koordin-pointage-projet', projetId); charger(); };
  $('[name="date"]', zone).onchange = (e) => { if (e.target.value) { date = e.target.value > auj ? auj : e.target.value; charger(); } };
  await charger();
}

async function ongletPaie(zone) {
  const auj = todayISO();
  const lundi = lundiDe(auj);
  const semaines = [0, 1, 2, 3].map((k) => {
    const du = decalerJour(lundi, -7 * k), au = decalerJour(du, 6);
    const lib = k === 0 ? 'Cette semaine' : k === 1 ? 'La semaine dernière' : `Semaine du ${parseDay(du).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    return [du, `${lib} (${parseDay(du).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${parseDay(au).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`];
  });
  const projets = await q(sb.from('projets').select('id, nom').order('nom'));
  let du = memo.get('koordin-paie-semaine') || lundi;
  if (!semaines.some(([d]) => d === du)) du = lundi;
  let projetId = '';
  const payeur = can('direction', 'comptable');

  zone.innerHTML = `<div class="card"><div class="form-grid">
      ${F.select('semaine', 'Semaine', semaines, du)}
      ${F.select('projet', 'Chantier', [['', 'Tous les chantiers'], ...projets.map((x) => [x.id, x.nom])], projetId)}
    </div></div><div id="paie"></div>`;
  const zPaie = $('#paie', zone);

  const charger = async () => {
    zPaie.innerHTML = loading();
    const au = decalerJour(du, 6);
    let req = sb.from('pointages').select('id, ouvrier_id, projet_id, date_pointage, presence, tarif_jour, paye, ouvriers(nom, metier, telephone), projets(nom)')
      .gte('date_pointage', du).lte('date_pointage', au).order('date_pointage');
    if (projetId) req = req.eq('projet_id', projetId);
    const pts = await q(req);
    const parOuvrier = new Map();
    pts.forEach((x) => {
      const o = parOuvrier.get(x.ouvrier_id) || { id: x.ouvrier_id, nom: x.ouvriers?.nom || '?', metier: x.ouvriers?.metier, tel: x.ouvriers?.telephone, jours: 0, montant: 0, apayer: 0, nonPayes: [], chantiers: new Set(), detail: [] };
      const m = num(x.presence) * num(x.tarif_jour);
      o.jours += num(x.presence); o.montant += m;
      if (!x.paye) { o.apayer += m; o.nonPayes.push(x.id); }
      o.chantiers.add(x.projets?.nom || '');
      o.detail.push(x);
      parOuvrier.set(x.ouvrier_id, o);
    });
    const lignes = [...parOuvrier.values()].sort((a, b) => a.nom.localeCompare(b.nom));
    const total = lignes.reduce((s, o) => s + o.montant, 0);
    const apayer = lignes.reduce((s, o) => s + o.apayer, 0);
    const jours = lignes.reduce((s, o) => s + o.jours, 0);
    const jourCourt = (iso) => parseDay(iso).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
    zPaie.innerHTML = `
      <div class="grid k4 paie-kpis">
        <div class="kpi"><div class="kpi-label">Reste à payer</div><div class="kpi-value" style="color:var(--gold)">${moneyShort(apayer)}</div></div>
        <div class="kpi"><div class="kpi-label">Total de la semaine</div><div class="kpi-value">${moneyShort(total)}</div></div>
        <div class="kpi"><div class="kpi-label">Ouvriers</div><div class="kpi-value">${lignes.length}</div></div>
        <div class="kpi"><div class="kpi-label">Jours travaillés</div><div class="kpi-value">${String(jours).replace('.', ',')}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Liste de paie <span class="paie-boutons">${lignes.length ? '<button type="button" class="btn sm" id="pa-csv">⬇️ Excel</button>' : ''}${payeur && apayer > 0 ? '<button type="button" class="btn sm primary" id="pa-tout">✅ Tout marquer payé</button>' : ''}</span></div>
        ${lignes.length ? `<div class="paie-liste">${lignes.map((o) => `<div class="paie-ligne">
            <div class="paie-nom"><b>${esc(o.nom)}</b><span>${esc([o.metier, [...o.chantiers].join(', ')].filter(Boolean).join(' · '))}</span>
              <span class="paie-jours">${o.detail.map((x) => `<i class="${x.paye ? 'ok' : ''}" title="${fdate(x.date_pointage)}">${jourCourt(x.date_pointage)}${num(x.presence) < 1 ? '½' : ''}</i>`).join('')}</span></div>
            <div class="paie-montant"><b>${money(o.montant)}</b><span>${String(o.jours).replace('.', ',')} j.</span>
              ${o.apayer > 0 ? (payeur ? `<button type="button" class="btn sm" data-payer="${o.id}">Payer ${money(o.apayer)}</button>` : `<span class="badge warn">À payer</span>`) : '<span class="badge ok">✅ Payé</span>'}</div>
          </div>`).join('')}</div>` : empty('💵', 'Aucun pointage sur cette période.')}
      </div>`;
    const payer = async (ids, texte) => {
      if (!(await confirmer(texte, 'Marquer payé'))) return;
      try {
        await q(sb.from('pointages').update({ paye: true }).in('id', ids));
        toast('Paie enregistrée ✅');
        await charger();
      } catch (e) { toast(erreurPointage(e), 'err', 7000); }
    };
    $$('[data-payer]', zPaie).forEach((b) => (b.onclick = () => {
      const o = parOuvrier.get(b.dataset.payer);
      payer(o.nonPayes, `Confirmer le paiement de ${money(o.apayer)} à ${o.nom} ?`);
    }));
    $('#pa-tout', zPaie)?.addEventListener('click', () => payer(lignes.flatMap((o) => o.nonPayes), `Confirmer le paiement de ${money(apayer)} à ${lignes.filter((o) => o.apayer > 0).length} ouvrier(s) ?`));
    $('#pa-csv', zPaie)?.addEventListener('click', () => exporterCSV(`koordin-paie-${du}.csv`,
      ['Ouvrier', 'Métier', 'Téléphone', 'Chantier(s)', 'Jours', `Montant (${devise()})`, `Reste à payer (${devise()})`],
      lignes.map((o) => [o.nom, o.metier || '', o.tel || '', [...o.chantiers].join(', '), String(o.jours).replace('.', ','), Math.round(o.montant), Math.round(o.apayer)])));
  };
  $('[name="semaine"]', zone).onchange = (e) => { du = e.target.value; memo.set('koordin-paie-semaine', du); charger(); };
  $('[name="projet"]', zone).onchange = (e) => { projetId = e.target.value; charger(); };
  await charger();
}

async function ongletOuvriers(zone) {
  const ouvriers = await q(sb.from('ouvriers').select('*').order('actif', { ascending: false }).order('nom'));
  const gerer = can('direction', 'coordinateur');
  zone.innerHTML = `<div class="card">
    <div class="card-title">${ouvriers.filter((x) => x.actif).length} ouvrier(s) actif(s) <button type="button" class="btn sm primary" id="ou-nouv">＋ Nouvel ouvrier</button></div>
    ${ouvriers.length ? `<div class="paie-liste">${ouvriers.map((x) => `<div class="paie-ligne ${x.actif ? '' : 'inactif'}">
        <div class="paie-nom"><b>${esc(x.nom)}</b><span>${esc([x.metier, x.telephone].filter(Boolean).join(' · '))}</span></div>
        <div class="paie-montant"><b>${money(x.tarif_jour)}</b><span>par jour</span>
          ${x.actif ? '' : '<span class="badge muted">Inactif</span>'}<button type="button" class="btn sm" data-edit="${x.id}">✏️ Modifier</button></div>
      </div>`).join('')}</div>` : empty('👷', 'Aucun ouvrier pour l’instant. Ajoutez vos journaliers une seule fois : nom, métier, tarif par jour.')}
    ${gerer ? '' : '<p class="hint mt">Le tarif d’un ouvrier existant ne peut être changé que par la Direction ou la Coordination.</p>'}
  </div>`;
  const rafraichir = () => ongletOuvriers(zone);
  $('#ou-nouv', zone).onclick = () => formulaireOuvrier(null, rafraichir);
  $$('[data-edit]', zone).forEach((b) => (b.onclick = () => formulaireOuvrier(ouvriers.find((x) => x.id === b.dataset.edit), rafraichir)));
}

function formulaireOuvrier(o, apres) {
  const tarifBloque = o && role() === 'technicien';
  ouvrirModale({
    titre: o ? `Modifier « ${o.nom} »` : 'Nouvel ouvrier',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom et prénom', o?.nom, { required: true, full: true, placeholder: 'Ex. Konan Yao' })}
      ${F.select('metier', 'Métier', METIERS.map((m) => [m, m]), o?.metier || 'Manœuvre')}
      ${F.text('telephone', 'Téléphone (facultatif)', o?.telephone, { type: 'tel', inputmode: 'tel', placeholder: '07 01 02 03 04' })}
      ${F.text('tarif_jour', `Tarif par jour (${devise()})`, o?.tarif_jour ?? '', { type: 'number', min: 0, step: '1', required: true, inputmode: 'numeric', placeholder: 'Ex. 5000', hint: tarifBloque ? 'Seules la Direction et la Coordination peuvent changer ce tarif.' : 'Le tarif est figé au jour du pointage : le changer ne modifie pas les jours déjà pointés.' })}
      ${o ? `<label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="actif" ${o.actif ? 'checked' : ''} style="width:auto"> Actif (apparaît dans l’appel du jour)</label>` : ''}
    </div>`,
    onOpen: (ov) => { if (tarifBloque) $('[name="tarif_jour"]', ov).disabled = true; },
    onSubmit: async (d) => {
      const data = { nom: d.nom.trim(), metier: d.metier, telephone: d.telephone || null };
      if (!tarifBloque) data.tarif_jour = num(d.tarif_jour);
      if (o) data.actif = !!d.actif;
      try {
        let cree = null;
        if (o) await q(sb.from('ouvriers').update(data).eq('id', o.id));
        else cree = await q(sb.from('ouvriers').insert(data).select('id').single());
        toast(o ? 'Ouvrier mis à jour.' : `${data.nom} ajouté ✅`);
        apres?.(cree);
      } catch (e) { throw new Error(erreurPointage(e)); }
    },
  });
}

// ─── 3.17 : UN STOCK PAR CHANTIER ───
// Deux commandes claires : « Réception de matériel » (arrivé sur le chantier → s'ajoute au stock)
// et « Sortie de stock » (utilisé dans la journée → sort du stock). Plus le transfert entre chantiers.
// Les mouvements d'avant la 3.17 (sans chantier) forment le « stock non affecté ».
const NON_AFFECTE = 'aucun';
const jourLisible = (ts) => {
  const d = new Date(ts), auj = new Date(); const hier = new Date(); hier.setDate(auj.getDate() - 1);
  if (d.toDateString() === auj.toDateString()) return 'Aujourd’hui';
  if (d.toDateString() === hier.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
// Ce que dit une ligne d'historique
function sensMouvement(m) {
  const lieu = m.lieu?.nom || m.projets?.nom;
  if (m.lieu_id) {
    if (m.nature === 'transfert') return m.type === 'entree' ? ['🔁', `Transfert reçu sur ${lieu}`] : ['🔁', `Transfert envoyé depuis ${lieu}`];
    if (m.nature === 'perte') return ['⚠️', `Perte ou casse sur ${lieu}`];
    return m.type === 'entree' ? ['📥', `Réception : arrivé sur ${lieu}`] : ['📤', `Sortie : utilisé sur ${lieu}`];
  }
  if (m.nature === 'transfert') return ['🔁', 'Transfert depuis le stock non affecté'];
  return m.type === 'entree' ? ['📥', m.projet_id ? `Retour de ${m.projets?.nom || 'chantier'} (ancien)` : 'Arrivée (stock non affecté)'] : ['📤', `Sortie vers ${m.projets?.nom || 'un chantier'} (ancien)`];
}
function ligneMouvement(m, { avecArticle = true, supprimer = false } = {}) {
  const ent = m.type === 'entree';
  const [ic, txt] = sensMouvement(m);
  return `<div class="sk-mv ${ent ? 'entree' : 'sortie'}">
    <span class="sk-mv-ic">${ic}</span>
    <div class="sk-mv-txt"><span><b>${ent ? '+' : '−'}${esc(qteLisible(m.articles, m.quantite))}</b>${avecArticle ? ` · ${esc(m.articles?.nom || '')}` : ''}</span>
      <small>${esc(txt)} · ${esc(nomMembre(m.created_by))} · ${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${m.commentaire && m.commentaire !== 'Transfert' ? ` · « ${esc(m.commentaire)} »` : ''}</small></div>
    ${supprimer && m.nature !== 'transfert' ? `<button type="button" class="btn sm ghost" data-sm="${m.id}" aria-label="Supprimer ce mouvement" title="Supprimer (erreur de saisie)">🗑️</button>` : ''}</div>`;
}
function listeMouvementsParJour(mouvements, o = {}) {
  if (!mouvements.length) return empty('🕘', 'Aucun mouvement pour le moment');
  let jour = '';
  return mouvements.map((m) => {
    const j = jourLisible(m.created_at); const tete = j !== jour ? `<div class="sk-jour">${esc(j)}</div>` : ''; jour = j;
    return tete + ligneMouvement(m, o);
  }).join('');
}
const SELECT_MVT = '*, articles(*), projets!mouvements_stock_projet_id_fkey(nom), lieu:projets!mouvements_stock_lieu_id_fkey(nom)';

// Charge le catalogue et le stock de chaque chantier
async function chargerStock() {
  const [articles, lieux, projets] = await Promise.all([
    q(sb.from('v_stock').select('*').order('nom')),
    q(sb.from('v_stock_lieux').select('*')),
    listeProjets(),
  ]);
  const visibles = new Set(projets.map((x) => x.id));
  const parLieu = new Map(); // `${article}|${lieu}` → quantité
  lieux.forEach((l) => { if (!l.lieu_id || visibles.has(l.lieu_id)) parLieu.set(`${l.article_id}|${l.lieu_id || NON_AFFECTE}`, num(l.quantite)); });
  const nonAffecte = lieux.some((l) => !l.lieu_id && Math.abs(num(l.quantite)) > 0.001);
  return { articles, parLieu, projets: projets.filter((x) => x.statut !== 'termine' || lieux.some((l) => l.lieu_id === x.id && num(l.quantite) > 0)), nonAffecte };
}
const qteSur = (st, articleId, lieu) => {
  if (lieu) return st.parLieu.get(`${articleId}|${lieu}`) || 0;
  let t = 0; st.parLieu.forEach((v, k) => { if (k.startsWith(`${articleId}|`)) t += v; }); return t;
};
const nomLieu = (st, lieu) => (lieu === NON_AFFECTE ? 'Stock non affecté' : st.projets.find((x) => x.id === lieu)?.nom || 'Chantier');

async function supprimerMouvement(m, st) {
  const qteTxt = qteLisible(m.articles, m.quantite);
  const lieu = m.lieu_id || NON_AFFECTE;
  if (m.type === 'entree' && qteSur(st, m.article_id, lieu) - num(m.quantite) < 0) {
    toast(`Impossible : une partie de cette réception a déjà été utilisée sur ${nomLieu(st, lieu)}. Supprimez d’abord les sorties concernées.`, 'warn', 8000);
    return false;
  }
  const effet = m.type === 'entree' ? `Le stock de « ${m.articles?.nom} » baissera de ${qteTxt}.` : `Les ${qteTxt} de « ${m.articles?.nom} » reviendront dans le stock.`;
  if (!(await confirmer(`Supprimer ce mouvement (${m.type === 'entree' ? 'réception' : 'sortie'} de ${qteTxt}) ? ${effet}`, 'Supprimer'))) return false;
  const r = await q(sb.from('mouvements_stock').delete().eq('id', m.id).select('id'));
  if (!r?.length) { toast('Suppression refusée : seule la Direction peut supprimer un mouvement.', 'err'); return false; }
  toast('Mouvement supprimé, stock recalculé ✅');
  return true;
}
const erreurStock = (e) => {
  const m = String(e?.message || '');
  if (/^STOCK_/.test(m) && e?.hint) return e.hint;
  if (/v_stock_lieux|lieu_id|transferer_stock/.test(m) && /does not exist|schema cache|could not find|column/i.test(m)) return 'Le stock par chantier nécessite la mise à jour 3.17 de la base de données (kit d’installation).';
  return messageErreur(e);
};

let filtreStock = 'tous';
let lieuStock = null;
PAGES.stock = async () => {
  const tech = can('technicien'), mouv = can('direction', 'magasinier', 'technicien', 'coordinateur'), gerer = can('direction', 'magasinier', 'achats');
  const p = page(`
    ${entete('Stock des chantiers', 'Ce qui arrive sur chaque chantier, ce qui en sort, et ce qui reste')}
    <div class="sk-lieux" id="sk-lieux"></div>
    ${mouv ? `<div class="sk-actions n2">
      <button type="button" class="sk-gros-btn rendre" data-act="entree"><span>📥</span><b>Réception de matériel</b><small>Le matériel est arrivé sur le chantier : il s’ajoute au stock</small></button>
      <button type="button" class="sk-gros-btn prendre" data-act="sortie"><span>📤</span><b>Sortie de stock</b><small>Matériel utilisé dans la journée : il sort du stock</small></button></div>` : ''}
    <div class="sk-petites">${mouv ? '<button type="button" class="btn sm" data-act="transfert">🔁 Transfert entre chantiers</button>' : ''}${gerer || can('technicien', 'coordinateur') ? '<button type="button" class="btn sm" data-act="article">＋ Nouveau matériel</button>' : ''}</div>
    <div class="tabs"><button class="tab" data-o="articles">📦 Ce qui reste</button><button class="tab" data-o="mouvements">🕘 Historique</button><button class="tab" data-o="chantiers">📊 Consommation</button></div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  let st = { articles: [], parLieu: new Map(), projets: [], nonAffecte: false };
  if (!['articles', 'mouvements', 'chantiers'].includes(ongletStock)) ongletStock = 'articles';
  const lieuxDispo = () => [...st.projets.map((x) => [x.id, `🏗️ ${x.nom}`]), ...(st.nonAffecte ? [[NON_AFFECTE, '📦 Non affecté (ancien stock)']] : [])];
  const dessinerLieux = () => {
    const l = lieuxDispo();
    if (lieuStock && !l.some(([k]) => k === lieuStock)) lieuStock = null;
    if (lieuStock === null && tech && st.projets.length === 1) lieuStock = st.projets[0].id;
    $('#sk-lieux', p).innerHTML = `<span class="sk-lieux-titre">Stock de :</span>${[['', '🏗️ Tous les chantiers'], ...l].map(([k, n]) => `<button type="button" class="sk-chip ${(lieuStock || '') === k ? 'actif' : ''}" data-lieu="${k}">${esc(n)}</button>`).join('')}`;
  };
  const rendre = async () => {
    $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x.dataset.o === ongletStock));
    zone.innerHTML = loading();
    try { st = await chargerStock(); } catch (e) { zone.innerHTML = `<div class="card">${empty('📦', erreurStock(e))}</div>`; return; }
    dessinerLieux();
    if (ongletStock === 'articles') vueReste();
    else if (ongletStock === 'mouvements') await vueHistorique();
    else await vueConso();
  };

  // ── Ce qui reste (sur le chantier choisi, ou partout) ──
  const vueReste = () => {
    const lieu = lieuStock || '';
    if (!st.articles.length) {
      zone.innerHTML = `<div class="card sk-guide"><div class="card-title">Comment ça marche ?</div>
        <ol><li><b>Quand du matériel arrive sur un chantier</b> : touchez « 📥 Réception de matériel ». Il s’ajoute au stock de ce chantier.</li>
          <li><b>Quand on utilise du matériel dans la journée</b> : touchez « 📤 Sortie de stock ». Il sort du stock du chantier.</li>
          <li>KOORDIN calcule tout seul ce qui reste sur chaque chantier et prévient quand un matériel passe sous son seuil.</li></ol>
        ${gerer || can('technicien', 'coordinateur') ? '<button type="button" class="btn primary" data-act="article">＋ Ajouter mon premier matériel</button>' : ''}</div>`;
      return;
    }
    const qte = (a) => qteSur(st, a.id, lieu);
    const bas = (a) => (lieu ? num(a.seuil_min) > 0 && qte(a) < num(a.seuil_min) : st.projets.some((x) => num(a.seuil_min) > 0 && qteSur(st, a.id, x.id) > 0 && qteSur(st, a.id, x.id) < num(a.seuil_min)));
    const presents = st.articles.filter((a) => Math.abs(qte(a)) > 0.001);
    const aRacheter = st.articles.filter(bas);
    const valeur = presents.reduce((s, a) => s + Math.max(0, qte(a)) * num(a.prix_unitaire), 0);
    zone.innerHTML = `<div class="sk-bilan">
        <div><b>${presents.length}</b><span>matériel${presents.length > 1 ? 's' : ''} en stock</span></div>
        <div class="${aRacheter.length ? 'mauvais' : 'bon'}"><b>${aRacheter.length}</b><span>presque épuisé${aRacheter.length > 1 ? 's' : ''}</span></div>
        ${tech ? '' : `<div class="valeur"><b>${moneyShort(valeur)}</b><span>valeur</span></div>`}</div>
      <div class="sk-filtres"><input class="input" type="search" id="fq" placeholder="🔍 Chercher : ciment, HA 10, sable…" aria-label="Chercher un matériel">
        <div class="sk-chips"><button type="button" class="sk-chip" data-f="tous">En stock</button><button type="button" class="sk-chip" data-f="bas">🚨 Presque épuisés (${aRacheter.length})</button><button type="button" class="sk-chip" data-f="tout">Tout le catalogue</button></div></div>
      <div id="ta"></div>
      <p class="muted sk-astuce">Touchez un matériel pour voir sa fiche : stock sur chaque chantier, historique${gerer ? ', modifier ou supprimer' : ''}.</p>`;
    const filtrer = () => {
      const txt = $('#fq', zone).value.trim().toLowerCase();
      $$('[data-f]', zone).forEach((x) => x.classList.toggle('actif', x.dataset.f === filtreStock));
      const l = st.articles.filter((a) => (!txt || a.nom.toLowerCase().includes(txt)) && (filtreStock === 'tout' || (filtreStock === 'bas' ? bas(a) : Math.abs(qte(a)) > 0.001)));
      $('#ta', zone).innerHTML = l.length ? `<div class="sk-cartes">${l.map((a) => carteArticle(a, qte(a), bas(a), lieu)).join('')}</div>`
        : empty('📦', filtreStock === 'tous' ? `Rien en stock${lieu ? ` sur ${nomLieu(st, lieu)}` : ''} pour le moment. Touchez « 📥 Réception de matériel » quand du matériel arrive.` : 'Aucun matériel ne correspond');
    };
    $('#fq', zone).oninput = filtrer;
    $$('[data-f]', zone).forEach((x) => (x.onclick = () => { filtreStock = x.dataset.f; filtrer(); }));
    filtrer();
  };
  const carteArticle = (a, qte, bas, lieu) => {
    const seuil = num(a.seuil_min);
    const pct = seuil > 0 ? Math.min(100, Math.round((qte / (seuil * 3)) * 100)) : (qte > 0 ? 100 : 0);
    const repartition = !lieu ? lieuxDispo().map(([k, n]) => [n.replace(/^\S+\s/, ''), qteSur(st, a.id, k)]).filter(([, v]) => Math.abs(v) > 0.001) : [];
    return `<div class="sk-carte ${bas ? 'bas' : ''}" data-fiche="${a.id}" role="button" tabindex="0">
      <div class="sk-carte-tete"><span class="sk-emoji">${emojiArticle(a.nom)}</span><div class="sk-art-txt"><b>${esc(a.nom)}</b><small>${bas ? '🚨 Presque épuisé' : qte > 0 ? '✅ En stock' : 'Pas de stock'}${seuil ? ` · alerte sous ${esc(qteLisible(a, seuil))}` : ''}</small></div><span class="sk-chevron">›</span></div>
      <div class="sk-carte-qte">${esc(qteLisible(a, qte))}<small> ${lieu ? `sur ${esc(nomLieu(st, lieu))}` : 'en tout'}</small></div>
      ${repartition.length > 1 ? `<div class="sk-repartition">${repartition.map(([n, v]) => `<span>${esc(n)} : <b>${esc(qteLisible(a, v))}</b></span>`).join('')}</div>` : ''}
      <div class="sk-jauge"><i style="width:${pct}%"></i></div>
      ${mouv ? `<div class="sk-carte-btns"><button type="button" class="btn" data-mv="entree" data-art="${a.id}">📥 Réception</button><button type="button" class="btn" data-mv="sortie" data-art="${a.id}">📤 Sortie</button></div>` : ''}
    </div>`;
  };

  // ── Historique du chantier choisi ──
  const vueHistorique = async () => {
    let req = sb.from('mouvements_stock').select(SELECT_MVT).order('created_at', { ascending: false }).limit(300);
    if (lieuStock === NON_AFFECTE) req = req.is('lieu_id', null);
    else if (lieuStock) req = req.eq('lieu_id', lieuStock);
    const mouvements = await q(req);
    const peut = can('direction');
    let sens = 'tout';
    zone.innerHTML = `<div class="card"><div class="sk-chips sk-sens"><button type="button" class="sk-chip" data-s="tout">Tout</button><button type="button" class="sk-chip" data-s="entree">📥 Réceptions</button><button type="button" class="sk-chip" data-s="sortie">📤 Sorties</button></div>
      ${peut ? '<p class="muted sk-astuce">Une erreur de saisie ? Touchez 🗑️ sur la ligne : le stock est recalculé tout seul.</p>' : ''}
      <div id="sk-hist"></div></div>`;
    const dessiner = () => {
      $$('[data-s]', zone).forEach((x) => x.classList.toggle('actif', x.dataset.s === sens));
      $('#sk-hist', zone).innerHTML = listeMouvementsParJour(mouvements.filter((m) => sens === 'tout' || m.type === sens), { supprimer: peut });
    };
    $$('[data-s]', zone).forEach((x) => (x.onclick = () => { sens = x.dataset.s; dessiner(); }));
    $('#sk-hist', zone).addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sm]'); if (!b) return;
      if (await supprimerMouvement(mouvements.find((x) => x.id === b.dataset.sm), st)) rendre();
    });
    dessiner();
  };

  // ── Consommation : ce que chaque chantier a utilisé ──
  const vueConso = async () => {
    const mouvements = await q(sb.from('mouvements_stock').select('article_id, projet_id, lieu_id, type, nature, quantite').eq('type', 'sortie').not('projet_id', 'is', null).limit(5000));
    const parProjet = new Map();
    for (const m of mouvements) {
      if (m.nature === 'transfert') continue;
      const id = m.lieu_id || m.projet_id;
      if (lieuStock && lieuStock !== NON_AFFECTE && id !== lieuStock) continue;
      const pr = parProjet.get(id) || { nom: st.projets.find((x) => x.id === id)?.nom || 'Chantier', art: new Map() };
      pr.art.set(m.article_id, (pr.art.get(m.article_id) || 0) + num(m.quantite));
      parProjet.set(id, pr);
    }
    const blocs = [...parProjet.values()].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((pr) => {
      const lignes = [...pr.art].map(([id, qte]) => [st.articles.find((a) => a.id === id), qte]).filter(([a, qte]) => a && qte > 0);
      if (!lignes.length) return '';
      const total = lignes.reduce((s, [a, qte]) => s + qte * num(a.prix_unitaire), 0);
      return `<div class="card sk-chantier"><div class="card-title">🏗️ ${esc(pr.nom)}${tech ? '' : `<span class="sk-total">${money(total)}</span>`}</div>
        ${lignes.map(([a, qte]) => `<div class="sk-conso"><span class="sk-emoji">${emojiArticle(a.nom)}</span><span>${esc(a.nom)}</span><b>${esc(qteLisible(a, qte))}</b></div>`).join('')}</div>`;
    }).join('');
    zone.innerHTML = `<p class="muted sk-astuce">Tout le matériel sorti du stock et utilisé sur chaque chantier (les transferts ne comptent pas).</p>${blocs || empty('📊', 'Aucune sortie de stock pour le moment.')}`;
  };

  // Fiche d'un matériel : stock sur chaque chantier, historique, actions
  const ouvrirFiche = async (a) => {
    const peutSuppr = can('direction');
    const repartition = lieuxDispo().map(([k, n]) => [k, n, qteSur(st, a.id, k)]);
    const total = qteSur(st, a.id, '');
    const fiche = ouvrirModale({
      titre: `${emojiArticle(a.nom)} ${a.nom}`,
      corps: `<div class="sk-fiche">
        <div class="sk-fiche-qte"><small>Sur tous les chantiers</small><b>${esc(qteLisible(a, total))}</b></div>
        <div class="sk-fiche-lieux">${repartition.map(([k, n, v]) => `<div class="${num(a.seuil_min) > 0 && v > 0 && v < num(a.seuil_min) ? 'bas' : ''}"><span>${esc(n)}</span><b>${esc(qteLisible(a, v))}</b></div>`).join('')}</div>
        <div class="sk-fiche-infos">
          <div><span>Alerte sous</span><b>${esc(qteLisible(a, a.seuil_min))}</b></div>
          ${estEnBottes(a) ? `<div><span>1 botte</span><b>${pluriel(num(a.barres_par_botte), 'barre', 'barres')}</b></div>` : `<div><span>Unité</span><b>${esc(a.unite)}</b></div>`}
          ${tech ? '' : `<div><span>Prix ${estEnBottes(a) ? 'd’une barre' : 'unitaire'}</span><b>${money(a.prix_unitaire)}</b></div><div><span>Valeur</span><b>${money(Math.max(0, total) * num(a.prix_unitaire))}</b></div>`}
        </div>
        ${mouv ? '<div class="sk-carte-btns"><button type="button" class="btn" data-fmv="entree">📥 Réception</button><button type="button" class="btn primary" data-fmv="sortie">📤 Sortie</button></div>' : ''}
        <div class="sk-fiche-titre">Ses derniers mouvements</div>
        <div id="sk-fiche-hist">${loading()}</div>
        ${gerer ? '<div class="sk-fiche-bas"><button type="button" class="btn" data-fmod>✏️ Modifier</button><button type="button" class="btn danger" data-fsuppr>🗑️ Supprimer</button></div>' : ''}
      </div>`,
      large: true,
    });
    const el = fiche.el;
    const mouvements = await q(sb.from('mouvements_stock').select(SELECT_MVT).eq('article_id', a.id).order('created_at', { ascending: false }).limit(40));
    $('#sk-fiche-hist', el).innerHTML = listeMouvementsParJour(mouvements, { avecArticle: false, supprimer: peutSuppr });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fmv) { fiche.fermer(); formulaireMouvement(st, b.dataset.fmv, a.id, rendre); }
      else if ('fmod' in b.dataset) { fiche.fermer(); formulaireArticle(a, rendre); }
      else if ('fsuppr' in b.dataset) { if (await supprimerArticle(a, total)) { fiche.fermer(); rendre(); } }
      else if (b.dataset.sm) { if (await supprimerMouvement(mouvements.find((x) => x.id === b.dataset.sm), st)) { fiche.fermer(); await rendre(); } }
    });
  };

  p.addEventListener('click', (e) => {
    const l = e.target.closest('[data-lieu]');
    if (l) { lieuStock = l.dataset.lieu || null; dessinerLieux(); return ongletStock === 'articles' ? vueReste() : ongletStock === 'mouvements' ? vueHistorique() : vueConso(); }
    const act = e.target.closest('[data-act]');
    if (act) {
      const t = act.dataset.act;
      if (t === 'article') return formulaireArticle(null, rendre);
      if (t === 'transfert') return formulaireTransfert(st, rendre);
      return formulaireMouvement(st, t, null, rendre);
    }
    const mv = e.target.closest('[data-mv]');
    if (mv) { e.stopPropagation(); return formulaireMouvement(st, mv.dataset.mv, mv.dataset.art, rendre); }
    const c = e.target.closest('[data-fiche]');
    if (c) ouvrirFiche(st.articles.find((a) => a.id === c.dataset.fiche));
  });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-fiche]')) ouvrirFiche(st.articles.find((a) => a.id === e.target.dataset.fiche)); });
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletStock = b.dataset.o; rendre(); }));
  await rendre();
};

async function supprimerArticle(a, reste = 0) {
  const msg = reste > 0
    ? `Supprimer « ${a.nom} » ? Il en reste ${qteLisible(a, reste)} sur les chantiers. Le matériel et tout son historique seront effacés.`
    : `Supprimer « ${a.nom} » ? Le matériel et tout son historique seront effacés.`;
  if (!(await confirmer(msg, 'Supprimer'))) return false;
  try {
    const r = await q(sb.from('articles').delete().eq('id', a.id).select('id'));
    if (!r?.length) throw new Error('Suppression refusée : seuls la Direction, le Magasin et les Achats peuvent supprimer un matériel.');
    toast(`« ${a.nom} » supprimé.`);
    return true;
  } catch (e) { toast(messageErreur(e), 'err', 6000); return false; }
}

// Quantité en bottes + barres, ou dans l'unité de l'article
function champsQuantite(a, prefixe = 'q') {
  if (estEnBottes(a)) return `<div class="sk-pas"><span>Bottes</span><input class="input" inputmode="numeric" name="${prefixe}_b" value="0"></div><div class="sk-pas"><span>Barres en plus</span><input class="input" inputmode="numeric" name="${prefixe}_r" value="0"></div>`;
  return F.text(`${prefixe}_q`, `Quantité (${a?.unite || ''})`, '', { type: 'number', min: 0.01, step: 'any', inputmode: 'decimal', required: true });
}
const lireQuantite = (a, d, prefixe = 'q') => (estEnBottes(a) ? num(d[`${prefixe}_b`]) * num(a.barres_par_botte) + num(d[`${prefixe}_r`]) : num(d[`${prefixe}_q`]));

async function formulaireTransfert(st, refresh) {
  const lieux = [...st.projets.map((x) => [x.id, x.nom]), ...(st.nonAffecte && can('direction', 'magasinier', 'coordinateur') ? [[NON_AFFECTE, 'Stock non affecté (ancien stock)']] : [])];
  if (st.projets.length < 1) return toast('Il faut au moins un chantier.', 'warn');
  let article = st.articles[0];
  ouvrirModale({
    titre: '🔁 Transfert entre chantiers',
    boutonOk: 'Transférer',
    corps: `<p class="muted" style="font-size:13px;margin-bottom:10px">Du matériel part d’un chantier vers un autre : il sort du stock du premier et s’ajoute au stock du second.</p>
      <div class="form-grid">
        ${F.select('article', 'Matériel', st.articles.map((a) => [a.id, a.nom]), article?.id, { required: true, full: true })}
        ${F.select('de', 'Depuis', lieux, lieuStock || '', { required: true, vide: '— Choisir —' })}
        ${F.select('vers', 'Vers le chantier', st.projets.map((x) => [x.id, x.nom]), '', { required: true, vide: '— Choisir —' })}
        <div class="full" id="tr-qte">${champsQuantite(article, 't')}</div>
        <p class="hint full" id="tr-dispo"></p>
        ${F.text('note', 'Note (facultatif)', '', { full: true, placeholder: 'Ex. Fin du gros œuvre sur Cocody' })}
      </div>`,
    onOpen: (ov) => {
      const maj = () => {
        article = st.articles.find((a) => a.id === $('[name="article"]', ov).value);
        const de = $('[name="de"]', ov).value;
        $('#tr-dispo', ov).textContent = de ? `Disponible : ${qteLisible(article, qteSur(st, article.id, de))}` : '';
      };
      $('[name="article"]', ov).onchange = () => { maj(); $('#tr-qte', ov).innerHTML = champsQuantite(article, 't'); };
      $('[name="de"]', ov).onchange = maj; maj();
    },
    onSubmit: async (d) => {
      const a = st.articles.find((x) => x.id === d.article);
      const qte = lireQuantite(a, d, 't');
      if (qte <= 0) throw new Error('Indiquez la quantité à transférer.');
      if (qte > qteSur(st, a.id, d.de)) throw new Error(`Il n’y a que ${qteLisible(a, qteSur(st, a.id, d.de))} à cet endroit.`);
      try { await q(sb.rpc('transferer_stock', { p_article: a.id, p_quantite: qte, p_de: d.de === NON_AFFECTE ? null : d.de, p_vers: d.vers, p_note: d.note || null })); }
      catch (e) { throw new Error(erreurStock(e)); }
      toast(`🔁 ${qteLisible(a, qte)} de ${a.nom} transféré vers ${nomLieu(st, d.vers)} ✅`);
      refresh();
    },
  });
}

// ─── 3.9 : acier en bottes et saisie simplifiée ───
const estEnBottes = (a) => num(a?.barres_par_botte) > 1;
const pluriel = (n, un, plusieurs) => `${nf.format(n)} ${Math.abs(n) > 1 ? plusieurs : un}`;
// « 3 bottes + 4 barres » pour l'acier, « 12 sac » sinon
function qteLisible(a, qte) {
  const v = num(qte);
  if (!estEnBottes(a)) return `${nf.format(v)} ${a?.unite || ''}`.trim();
  const bpb = num(a.barres_par_botte), abs = Math.abs(v);
  const b = Math.floor(abs / bpb), r = Math.round((abs - b * bpb) * 100) / 100;
  const t = [b ? pluriel(b, 'botte', 'bottes') : '', r ? pluriel(r, 'barre', 'barres') : ''].filter(Boolean).join(' + ') || '0 botte';
  return (v < 0 ? '−' : '') + t;
}
const ressembleAcier = (nom) => /\b(ha|fer|acier|t\s?\d|tor|rond)\b|ha\s?\d/i.test(nom || '');
const EMOJI_ARTICLE = [[/ciment|cpj|cem/i, '🧱'], [/ha\s?\d|acier|fer|\btor/i, '🔩'], [/sable/i, '⏳'], [/gravier|gravillon|caillou|concass/i, '🪨'], [/bois|planche|chevron|madrier|contreplaqu/i, '🪵'], [/clou|pointe|vis|fil\b|attache/i, '📌'], [/tuyau|pvc|tube/i, '🧪'], [/peinture/i, '🎨'], [/carreau|faïence/i, '◻️'], [/c[aâ]ble|électr|gaine/i, '🔌'], [/eau/i, '💧']];
const emojiArticle = (nom) => (EMOJI_ARTICLE.find(([r]) => r.test(nom || '')) || [0, '📦'])[1];
const recentsStock = () => { try { return JSON.parse(localStorage.getItem('koordin:stock-recents') || '[]'); } catch { return []; } };
const noterRecents = (ids) => { try { localStorage.setItem('koordin:stock-recents', JSON.stringify([...new Set([...ids, ...recentsStock()])].slice(0, 12))); } catch { /* rien */ } };

function formulaireArticle(a, refresh) {
  const bottes = a ? estEnBottes(a) : false;
  const bpb = num(a?.barres_par_botte) || '';
  ouvrirModale({
    titre: a ? `Modifier « ${a.nom} »` : 'Nouvel article',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Désignation', a?.nom, { required: true, full: true, placeholder: 'Ex. Ciment CPJ 42.5, Acier HA 10…' })}
      <label class="field full sk-bascule"><input type="checkbox" name="en_bottes" id="sk-bottes" ${bottes ? 'checked' : ''}> <span><b>🔩 Acier compté en bottes</b><small>Pour les fers HA : le stock s’affiche en bottes et barres.</small></span></label>
      <div class="full sk-si-bottes form-grid" style="${bottes ? '' : 'display:none'}">
        ${F.text('barres_par_botte', 'Nombre de barres dans une botte', bpb, { type: 'number', min: 2, step: 1, inputmode: 'numeric', placeholder: 'Ex. 10', hint: 'Indiqué par votre fournisseur ou sur le bon de livraison.', full: true })}
      </div>
      <div class="sk-si-unite" style="${bottes ? 'display:none' : ''}">${F.text('unite', 'Unité', a && !bottes ? a.unite : 'sac', { hint: 'sac, m³, kg, u…' })}</div>
      <label class="field">Seuil d’alerte <span class="sk-lib-seuil">${bottes ? '(en bottes)' : ''}</span>
        <input name="seuil_min" type="number" min="0" step="any" inputmode="decimal" value="${esc(bottes ? num(a.seuil_min) / num(a.barres_par_botte) : a?.seuil_min ?? 0)}">
        <span class="hint">Alerte quand le stock d’un chantier passe en dessous</span></label>
      <label class="field" ${can('technicien') ? 'hidden' : ''}>Prix <span class="sk-lib-prix">${bottes ? 'd’une barre' : 'unitaire'}</span> (${esc(devise())})
        <input name="prix_unitaire" type="number" min="0" step="any" inputmode="decimal" value="${esc(a?.prix_unitaire ?? 0)}"></label>
      ${!a ? '<p class="hint full">Pour mettre ce matériel en stock sur un chantier, faites ensuite une « 📥 Réception de matériel ».</p>' : ''}
    </div>
    ${a ? '<button type="button" class="btn danger sk-suppr" id="sk-suppr">🗑️ Supprimer cet article</button>' : ''}`,
    onOpen: (ov) => {
      const cb = $('#sk-bottes', ov), nom = $('[name="nom"]', ov);
      $('#sk-suppr', ov)?.addEventListener('click', async () => { if (await supprimerArticle(a)) { $('.modal-head [data-close]', ov)?.click(); refresh(); } });
      const maj = () => {
        const on = cb.checked;
        $('.sk-si-bottes', ov).style.display = on ? '' : 'none';
        $('.sk-si-unite', ov).style.display = on ? 'none' : '';
        $$('.sk-lib-seuil', ov).forEach((s) => (s.textContent = on ? '(en bottes)' : ''));
        $('.sk-lib-prix', ov).textContent = on ? 'd’une barre' : 'unitaire';
        $('[name="barres_par_botte"]', ov).required = on;
      };
      cb.onchange = maj;
      if (!a) nom.addEventListener('input', () => { if (!cb.dataset.touche && ressembleAcier(nom.value) !== cb.checked) { cb.checked = ressembleAcier(nom.value); maj(); } });
      cb.addEventListener('click', () => (cb.dataset.touche = '1'));
      maj();
    },
    onSubmit: async (d) => {
      const enB = !!d.en_bottes, n = Math.round(num(d.barres_par_botte));
      if (enB && n < 2) throw new Error('Indiquez le nombre de barres dans une botte (au moins 2).');
      const k = enB ? n : 1;
      const data = { nom: d.nom.trim(), unite: enB ? 'barre' : (d.unite || 'u').trim() || 'u', barres_par_botte: enB ? n : null, seuil_min: Math.round(num(d.seuil_min) * k * 100) / 100, prix_unitaire: num(d.prix_unitaire) };
      try {
        if (a) await q(sb.from('articles').update(data).eq('id', a.id));
        else {
          const cree = await q(sb.from('articles').insert(data).select('id').single());
          if (num(d.stock_initial) > 0) await q(sb.from('mouvements_stock').insert({ article_id: cree.id, type: 'entree', quantite: Math.round(num(d.stock_initial) * k * 100) / 100, commentaire: 'Stock initial' }));
        }
      } catch (e) {
        if (/barres_par_botte/.test(String(e?.message))) throw new Error('Les bottes nécessitent la mise à jour 3.9 de la base de données (kit d’installation).');
        throw e;
      }
      toast('Article enregistré.');
      refresh();
    },
  });
}

// Saisie en 3 gestes : je prends / je rends → mon chantier → je touche le matériel et je règle la quantité
// « 📥 Réception de matériel » ou « 📤 Sortie de stock » : 1. le chantier, 2. le matériel et les quantités, 3. une note
async function formulaireMouvement(st, type, articleId, refresh) {
  const recep = type === 'entree';
  if (!st.projets.length) return toast('Aucun chantier en cours : créez d’abord un chantier.', 'warn');
  const etat = { lieu: lieuStock && lieuStock !== NON_AFFECTE ? lieuStock : (st.projets.length === 1 ? st.projets[0].id : ''), panier: new Map(), filtre: '', perte: false };
  const ajouter = (a) => etat.panier.set(a.id, estEnBottes(a) ? num(a.barres_par_botte) : 1);
  if (articleId) { const a0 = st.articles.find((a) => a.id === articleId); if (a0) ajouter(a0); }
  const rec = recentsStock();
  const peutCreer = can('direction', 'magasinier', 'achats', 'technicien', 'coordinateur');
  const m = ouvrirModale({
    titre: recep ? '📥 Réception de matériel' : '📤 Sortie de stock',
    boutonOk: 'Valider',
    corps: `<input type="hidden" name="_">
      <p class="sk-explique">${recep ? 'Le matériel <b>est arrivé sur le chantier</b> : il <b>s’ajoute</b> au stock de ce chantier.' : 'Le matériel <b>a été utilisé</b> sur le chantier : il <b>sort</b> du stock de ce chantier.'}</p>
      <div class="sk-etape"><div class="sk-num">1</div><div class="sk-quoi">${recep ? 'Sur quel chantier est-il arrivé ?' : 'Sur quel chantier a-t-il été utilisé ?'}</div></div>
      <div class="sk-chips" id="sk-projets">${st.projets.map((x) => `<button type="button" class="sk-chip" data-p="${x.id}">🏗️ ${esc(x.nom)}</button>`).join('')}</div>
      <div class="sk-etape"><div class="sk-num">2</div><div class="sk-quoi">${recep ? 'Quel matériel est arrivé ?' : 'Quel matériel est sorti ?'} <small>touchez pour ajouter</small></div></div>
      ${st.articles.length > 6 ? '<input class="input sk-cherche" type="search" placeholder="🔍 Chercher : ciment, HA 10, sable…" aria-label="Chercher un matériel">' : ''}
      <div class="sk-liste" id="sk-liste"></div>
      ${recep && peutCreer ? '<button type="button" class="btn sm ghost sk-nouveau" id="sk-nouveau">＋ Ce matériel n’est pas dans la liste</button>' : ''}
      <div class="sk-etape"><div class="sk-num">3</div><div class="sk-quoi">${recep ? 'D’où vient-il ? <small>facultatif</small>' : 'Pour quel travail ? <small>facultatif</small>'}</div></div>
      ${recep ? '' : '<div class="sk-chips" style="margin-bottom:8px"><button type="button" class="sk-chip actif" data-nat="utilisation">🔨 Utilisé pour les travaux</button><button type="button" class="sk-chip" data-nat="perte">⚠️ Perte, casse ou vol</button></div>'}
      <input class="input" name="commentaire" placeholder="${recep ? 'Ex. Livraison Quincaillerie du Plateau, BL n° 4512' : 'Ex. Coulage de la dalle du R+1'}">
      <div class="sk-resume" id="sk-resume"></div>`,
    onOpen: (ov) => {
      ov.querySelector('.modal')?.classList.add('sk-modale');
      const liste = $('#sk-liste', ov);
      const art = (id) => st.articles.find((a) => a.id === id);
      const dispo = (a) => (etat.lieu ? qteSur(st, a.id, etat.lieu) : 0);
      const carte = (a) => {
        const dans = etat.panier.has(a.id), qte = etat.panier.get(a.id) || 0;
        const trop = !recep && etat.lieu && qte > dispo(a);
        let regl = '';
        if (dans) {
          if (estEnBottes(a)) {
            const bpb = num(a.barres_par_botte), b = Math.floor(qte / bpb), r = Math.round((qte - b * bpb) * 100) / 100;
            regl = `<div class="sk-regl"><div class="sk-pas"><span>Bottes</span><button type="button" data-moins="${bpb}" aria-label="Une botte de moins">−</button><input inputmode="numeric" data-champ="b" value="${b}" aria-label="Nombre de bottes"><button type="button" data-plus="${bpb}" aria-label="Une botte de plus">+</button></div>
              <div class="sk-pas"><span>Barres en plus</span><button type="button" data-moins="1" aria-label="Une barre de moins">−</button><input inputmode="numeric" data-champ="r" value="${r}" aria-label="Barres en plus"><button type="button" data-plus="1" aria-label="Une barre de plus">+</button></div>
              <small class="muted">1 botte = ${pluriel(bpb, 'barre', 'barres')}</small></div>`;
          } else {
            regl = `<div class="sk-regl"><div class="sk-pas"><span>${esc(a.unite)}</span><button type="button" data-moins="1" aria-label="Un de moins">−</button><input inputmode="decimal" data-champ="q" value="${qte || ''}" placeholder="0" aria-label="Quantité"><button type="button" data-plus="1" aria-label="Un de plus">+</button></div>
              <div class="sk-rapides">${[5, 10, 20, 50].map((n) => `<button type="button" data-ajout="${n}">+${n}</button>`).join('')}</div></div>`;
          }
        }
        return `<div class="sk-art ${dans ? 'choisi' : ''} ${trop ? 'trop' : ''}" data-a="${a.id}">
          <button type="button" class="sk-art-tete" data-basc="${a.id}"><span class="sk-emoji">${emojiArticle(a.nom)}</span><span class="sk-art-txt"><b>${esc(a.nom)}</b><small>${etat.lieu ? `Sur ce chantier : ${esc(qteLisible(a, dispo(a)))}` : 'Choisissez d’abord le chantier'}</small></span><span class="sk-coche">${dans ? '✓' : '＋'}</span></button>
          ${regl}${trop ? `<div class="sk-alerte">Il n’y en a que ${esc(qteLisible(a, dispo(a)))} sur ce chantier.</div>` : ''}</div>`;
      };
      const resume = () => {
        const l = [...etat.panier].filter(([, q]) => q > 0);
        const lieu = etat.lieu ? nomLieu(st, etat.lieu) : '…';
        $('#sk-resume', ov).innerHTML = l.length ? `<b>${recep ? `📥 Arrivé sur ${esc(lieu)}` : `📤 Sorti du stock de ${esc(lieu)}`} :</b> ${l.map(([id, q]) => `${esc(qteLisible(art(id), q))} de ${esc(art(id).nom)}`).join(', ')}` : '';
        $('button[type="submit"]', ov).textContent = l.length ? `✅ ${recep ? 'Ajouter au stock' : 'Sortir du stock'} (${l.length} matériel${l.length > 1 ? 's' : ''})` : 'Valider';
      };
      const dessiner = () => {
        const f = etat.filtre;
        // En sortie : d'abord ce qui est présent sur le chantier ; en réception : les plus utilisés
        const ordre = (a) => (recep ? (rec.indexOf(a.id) < 0 ? 99 : rec.indexOf(a.id)) : (dispo(a) > 0 ? 0 : 1));
        const vus = st.articles.filter((a) => etat.panier.has(a.id) || !f || a.nom.toLowerCase().includes(f)).sort((x, y) => ordre(x) - ordre(y) || x.nom.localeCompare(y.nom, 'fr'));
        const choisis = vus.filter((a) => etat.panier.has(a.id)), autres = vus.filter((a) => !etat.panier.has(a.id));
        liste.innerHTML = [...choisis, ...autres].map(carte).join('') || `<p class="muted">${st.articles.length ? 'Aucun matériel ne correspond.' : 'Le catalogue est vide : ajoutez le matériel avec le bouton ci-dessous.'}</p>`;
        resume();
      };
      const redessinerCarte = (id) => { const el = $(`.sk-art[data-a="${id}"]`, liste); if (el) el.outerHTML = carte(art(id)); resume(); };
      const regler = (id, v) => { etat.panier.set(id, Math.max(0, Math.round(v * 100) / 100)); redessinerCarte(id); };
      liste.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const id = b.closest('.sk-art')?.dataset.a; const a = art(id);
        if (b.dataset.basc) {
          if (etat.panier.has(id)) etat.panier.delete(id); else ajouter(a);
          dessiner();
          if (etat.panier.has(id)) $(`.sk-art[data-a="${id}"]`, liste)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (b.dataset.plus) regler(id, (etat.panier.get(id) || 0) + num(b.dataset.plus));
        else if (b.dataset.moins) regler(id, (etat.panier.get(id) || 0) - num(b.dataset.moins));
        else if (b.dataset.ajout) regler(id, (etat.panier.get(id) || 0) + num(b.dataset.ajout));
      });
      liste.addEventListener('change', (e) => {
        const i = e.target.closest('[data-champ]'); if (!i) return;
        const el = i.closest('.sk-art'), id = el.dataset.a, a = art(id);
        if (i.dataset.champ === 'q') regler(id, num(i.value));
        else regler(id, num($('[data-champ="b"]', el).value) * num(a.barres_par_botte) + num($('[data-champ="r"]', el).value));
      });
      liste.addEventListener('focusin', (e) => { if (e.target.matches('[data-champ]')) e.target.select?.(); });
      $('.sk-cherche', ov)?.addEventListener('input', (e) => { etat.filtre = e.target.value.trim().toLowerCase(); dessiner(); });
      const choisirLieu = (v) => { etat.lieu = v; $$('#sk-projets .sk-chip', ov).forEach((x) => x.classList.toggle('actif', x.dataset.p === v)); dessiner(); };
      $('#sk-projets', ov).addEventListener('click', (e) => { const c = e.target.closest('.sk-chip'); if (c) choisirLieu(c.dataset.p); });
      $$('[data-nat]', ov).forEach((b) => (b.onclick = () => { etat.perte = b.dataset.nat === 'perte'; $$('[data-nat]', ov).forEach((x) => x.classList.toggle('actif', x === b)); }));
      $('#sk-nouveau', ov)?.addEventListener('click', () => formulaireArticle(null, async () => {
        const avant = new Set(st.articles.map((a) => a.id));
        st.articles = await q(sb.from('v_stock').select('*').order('nom'));
        st.articles.filter((a) => !avant.has(a.id)).forEach(ajouter);
        dessiner();
      }));
      choisirLieu(etat.lieu);
    },
    onSubmit: async (d) => {
      const lignes = [...etat.panier].filter(([, q]) => q > 0);
      if (!etat.lieu) throw new Error('Choisissez le chantier (étape 1).');
      if (!lignes.length) throw new Error('Touchez au moins un matériel et indiquez la quantité (étape 2).');
      if (!recep) {
        const manque = lignes.find(([id, q]) => q > qteSur(st, id, etat.lieu));
        if (manque) { const a = st.articles.find((x) => x.id === manque[0]); throw new Error(`Il n’y a que ${qteLisible(a, qteSur(st, a.id, etat.lieu))} de « ${a.nom} » sur ${nomLieu(st, etat.lieu)}. Faites d’abord une réception ou un transfert.`); }
      }
      try {
        await q(sb.from('mouvements_stock').insert(lignes.map(([id, qte]) => ({ article_id: id, type, quantite: qte, projet_id: etat.lieu, lieu_id: etat.lieu, nature: recep ? 'livraison' : etat.perte ? 'perte' : 'utilisation', commentaire: d.commentaire || null }))));
      } catch (e) { throw new Error(erreurStock(e)); }
      noterRecents(lignes.map(([id]) => id));
      const n = `${lignes.length} matériel${lignes.length > 1 ? 's' : ''}`;
      toast(recep ? `📥 Réception enregistrée : ${n} ajouté${lignes.length > 1 ? 's' : ''} au stock de ${nomLieu(st, etat.lieu)} ✅` : `📤 Sortie enregistrée : ${n} sorti${lignes.length > 1 ? 's' : ''} du stock de ${nomLieu(st, etat.lieu)} ✅`);
      lieuStock = etat.lieu;
      refresh();
    },
  });
  return m;
}

// ═══════════════════════════════ ÉQUIPE ═══════════════════════════════

function messageInvitation(inv) {
  const url = location.origin + location.pathname;
  return `Bonjour ${inv.nom || ''},\n\nVous êtes invité(e) à rejoindre ${S.entreprise.nom} sur KOORDIN, notre plateforme de suivi des chantiers, en tant que ${ROLES[inv.role].label}.\n\n1. Ouvrez : ${url}\n2. Choisissez « J’ai une invitation »\n3. ${estTelephone(inv.email) ? `Tapez ce numéro de téléphone : ${afficherIdentifiant(inv.email).replace(/^\+225 /, '')}` : `Utilisez cette adresse email : ${inv.email}`}
4. Choisissez votre mot de passe\n\nSur téléphone, vous pouvez ensuite « Ajouter à l’écran d’accueil » pour l’utiliser comme une application.`;
}

PAGES.equipe = async () => {
  await chargerEquipe();
  const [invitations, affect] = await Promise.all([
    q(sb.from('invitations').select('*').is('acceptee_at', null).order('created_at', { ascending: false })),
    q(sb.from('affectations').select('profil_id')),
  ]);
  const nbProjets = (id) => affect.filter((a) => a.profil_id === id).length;
  const p = page(`
    ${entete('Équipe', `${S.equipe.length} membre(s) · ${invitations.length} invitation(s) en attente`, '<button class="btn primary" id="inv">＋ Inviter une personne</button>')}
    <div class="card"><div class="card-title">Membres</div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th class="num">Projets affectés</th><th>Accès</th></tr></thead><tbody>
      ${S.equipe.map((m) => {
        const moi = m.id === S.profil.id;
        return `<tr><td><b>${esc(m.nom)}</b>${moi ? ' <span class="badge muted">vous</span>' : ''}</td><td class="muted">${esc(afficherIdentifiant(m.email))}</td>
          <td><select class="input" data-role="${m.id}" ${moi ? 'disabled' : ''} style="min-width:150px">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${r.ico} ${r.label}</option>`).join('')}</select></td>
          <td class="num">${m.role === 'technicien' ? nbProjets(m.id) : '<span class="muted">tous</span>'}</td>
          <td class="nowrap">${moi ? badge(['ok', '✅ Actif']) : `<button class="btn sm" data-mdp="${m.id}">🔑 Mot de passe</button><button class="btn sm ${m.actif ? '' : 'primary'}" data-actif="${m.id}">${m.actif ? '🚫 Désactiver' : '✅ Réactiver'}</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="muted mt" style="font-size:12px">Un membre désactivé ne peut plus rien consulter. Ses rapports et saisies restent dans l’historique.</p></div>
    <div class="card"><div class="card-title">Invitations en attente</div>
      ${invitations.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Envoyée</th><th></th></tr></thead><tbody>
      ${invitations.map((i) => `<tr><td><b>${esc(i.nom || '—')}</b></td><td>${esc(afficherIdentifiant(i.email))}</td><td>${ROLES[i.role].ico} ${ROLES[i.role].label}</td><td class="muted">${ago(i.created_at)}</td>
        <td class="right nowrap"><button class="btn sm" data-partager="${i.id}">📤 Envoyer</button><button class="btn sm" data-annuler="${i.id}">Annuler</button></td></tr>`).join('')}</tbody></table></div>` : empty('✉️', 'Aucune invitation en attente')}
    </div>
    <div class="card"><div class="card-title">Ce que voit chaque rôle</div>
      <div class="table-wrap"><table class="tbl"><tbody>
        <tr><td>👔 <b>Direction</b></td><td>Tout : tableaux de bord, projets, budget, achats, comptabilité, stock, équipe, IA. Seul rôle à gérer l’équipe.</td></tr>
        <tr><td>🗂️ <b>Coordination</b></td><td>Tous les projets, lots, planning, affectations ; reçoit et valide les rapports ; consulte achats et stock.</td></tr>
        <tr><td>🔧 <b>Technicien</b></td><td>Uniquement ses chantiers affectés ; envoie ses rapports avec photos ; voit le planning. Aucun montant.</td></tr>
        <tr><td>🛒 <b>Achats</b></td><td>Commandes et fournisseurs ; budget engagé par projet et par lot, avec alertes de dépassement.</td></tr>
        <tr><td>📊 <b>Comptabilité</b></td><td>Factures, dépenses, paiements, échéances ; budget et réalisé ; export Excel.</td></tr>
        <tr><td>📦 <b>Magasin</b></td><td>Stock, entrées et sorties par chantier, seuils d’alerte ; réception des commandes.</td></tr>
      </tbody></table></div></div>`);

  $('#inv', p).onclick = () => ouvrirModale({
    titre: 'Inviter une personne',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Nom complet', '', { required: true })}
      ${F.text('email', 'Numéro WhatsApp ou email', '', { required: true, placeholder: '07 01 02 03 04', hint: 'Un numéro de téléphone suffit : pas besoin d’adresse email.' })}
      ${F.select('role', 'Rôle', Object.entries(ROLES).map(([k, r]) => [k, `${r.ico} ${r.label}`]), 'technicien', { required: true, full: true })}
    </div><p class="muted mt" style="font-size:12px">La personne ouvre le lien reçu, crée son compte avec ce numéro (ou cet email) et rejoint automatiquement votre entreprise avec ce rôle.</p>`,
    boutonOk: 'Créer l’invitation',
    onSubmit: async (d) => {
      const email = versIdentifiant(d.email);
      if (S.equipe.some((m) => m.email.toLowerCase() === email)) throw new Error('Cette personne fait déjà partie de l’équipe.');
      const inv = await q(sb.from('invitations').insert({ entreprise_id: S.entreprise.id, email, nom: d.nom, role: d.role }).select().single());
      partagerInvitation(inv);
      PAGES.equipe();
    },
  });
  $$('[data-partager]', p).forEach((b) => (b.onclick = () => partagerInvitation(invitations.find((i) => i.id === b.dataset.partager))));
  $$('[data-annuler]', p).forEach((b) => (b.onclick = async () => {
    try { await q(sb.from('invitations').delete().eq('id', b.dataset.annuler)); toast('Invitation annulée.'); PAGES.equipe(); } catch (e) { toast(messageErreur(e), 'err'); }
  }));
  $$('[data-role]', p).forEach((s) => (s.onchange = async () => {
    try { await q(sb.from('profils').update({ role: s.value }).eq('id', s.dataset.role)); toast('Rôle modifié.'); await chargerEquipe(); } catch (e) { toast(messageErreur(e), 'err'); PAGES.equipe(); }
  }));
  $$('[data-mdp]', p).forEach((b) => (b.onclick = () => {
    const m = S.equipe.find((x) => x.id === b.dataset.mdp);
    ouvrirModale({
      titre: `Nouveau mot de passe pour ${m.nom}`,
      corps: `${F.text('mdp', 'Nouveau mot de passe (8 caractères minimum)', '', { required: true, full: true })}
        <p class="muted mt" style="font-size:12px">Utile quand la personne a oublié son mot de passe, notamment pour un compte créé avec un numéro de téléphone. Communiquez-lui le nouveau mot de passe en privé.</p>`,
      boutonOk: 'Enregistrer le mot de passe',
      onSubmit: async (d) => {
        if (!d.mdp || d.mdp.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
        const { error } = await sb.rpc('changer_mot_de_passe_membre', { p_profil: m.id, p_mot_de_passe: d.mdp });
        if (error) {
          if (/changer_mot_de_passe_membre|function|PGRST202/i.test(error.message || '') || error.code === 'PGRST202') throw new Error('Cette fonction nécessite une petite mise à jour de la base de données (voir le kit d’installation).');
          throw error;
        }
        toast(`Mot de passe de ${m.nom} modifié.`);
        const numero = numeroWhatsApp(m.email);
        if (numero) {
          const texte = `Bonjour ${m.nom}, votre nouveau mot de passe KOORDIN est : ${d.mdp}\nConnexion : ${location.origin + location.pathname}`;
          setTimeout(() => ouvrirModale({
            titre: 'Prévenir la personne',
            corps: `<p style="margin-bottom:12px">Envoyez-lui son nouveau mot de passe sur WhatsApp :</p>
              <a class="btn primary block" target="_blank" rel="noopener" href="https://wa.me/${numero}?text=${encodeURIComponent(texte)}">💬 Envoyer sur son WhatsApp</a>`,
          }), 50);
        }
      },
    });
  }));
  $$('[data-actif]', p).forEach((b) => (b.onclick = async () => {
    const m = S.equipe.find((x) => x.id === b.dataset.actif);
    if (m.actif && !(await confirmer(`Désactiver l’accès de ${m.nom} ?`, 'Désactiver'))) return;
    try { await q(sb.from('profils').update({ actif: !m.actif }).eq('id', m.id)); toast(m.actif ? 'Accès désactivé.' : 'Accès réactivé.'); PAGES.equipe(); } catch (e) { toast(messageErreur(e), 'err'); }
  }));
};

function partagerInvitation(inv) {
  const texte = messageInvitation(inv);
  const m = ouvrirModale({
    titre: 'Envoyer l’invitation',
    corps: `<p style="margin-bottom:10px">Invitation créée pour <b>${esc(afficherIdentifiant(inv.email))}</b>. Envoyez-lui ce message :</p>
      <textarea class="input" readonly style="min-height:190px;width:100%">${esc(texte)}</textarea>
      <div class="form-actions" style="flex-wrap:wrap">
        <a class="btn ${numeroWhatsApp(inv.email) ? 'primary' : ''}" target="_blank" rel="noopener" href="https://wa.me/${numeroWhatsApp(inv.email) || ''}?text=${encodeURIComponent(texte)}">💬 ${numeroWhatsApp(inv.email) ? 'Envoyer sur son WhatsApp' : 'WhatsApp'}</a>
        ${estTelephone(inv.email) ? '' : `<a class="btn" href="mailto:${esc(inv.email)}?subject=${encodeURIComponent(`Invitation KOORDIN — ${S.entreprise.nom}`)}&body=${encodeURIComponent(texte)}">✉️ Email</a>`}
        <button class="btn ${numeroWhatsApp(inv.email) ? '' : 'primary'}" id="copier">📋 Copier le message</button></div>`,
  });
  $('#copier', m.el).onclick = async () => {
    try { await navigator.clipboard.writeText(texte); toast('Message copié.'); } catch { $('textarea', m.el).select(); document.execCommand('copy'); toast('Message copié.'); }
  };
}

// ═══════════════════════════════ ASSISTANT IA ═══════════════════════════════

const SUGGESTIONS_IA = {
  direction: ['Quels projets sont en retard et pourquoi ?', 'Fais-moi le rapport de direction de la semaine', 'Où risque-t-on de dépasser le budget ?', 'Quelles décisions dois-je prendre en priorité ?'],
  coordinateur: ['Quels chantiers dois-je visiter en priorité cette semaine ?', 'Résume les incidents des rapports récents', 'Quelles tâches du planning sont en retard ?', 'Quels besoins matériaux remontent du terrain ?'],
  achats: ['Quels lots sont proches du dépassement ?', 'Quelles commandes sont en attente de livraison ?', 'Rédige une relance fournisseur pour une livraison en retard', 'Quels matériaux faut-il commander cette semaine ?'],
  comptable: ['Quelles factures sont échues ?', 'Résume la situation financière par projet', 'Y a-t-il des risques de double facturation ?', 'Prépare un point de trésorerie pour la direction'],
  magasinier: ['Quels articles faut-il réapprovisionner ?', 'Quels chantiers consomment le plus ?', 'Quelles livraisons sont attendues ?', 'Prépare une liste de commande pour les achats'],
};

function formatIA(texte) {
  return esc(texte)
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

PAGES.ia = async () => {
  const p = page(`
    ${entete('🧠 Assistant IA', 'Posez vos questions sur vos chantiers : l’assistant analyse vos données réelles (selon vos habilitations).', S.ia.length ? '<button class="btn" id="raz">🗑️ Nouvelle conversation</button>' : '')}
    <div class="chat">
      <div class="chat-msgs" id="msgs"></div>
      <div class="chat-suggest" id="sugg">${(SUGGESTIONS_IA[role()] || []).map((s) => `<button class="btn sm" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <form class="chat-input" id="f-ia"><textarea id="qia" placeholder="Ex. Quel est l’état du chantier Tour Ivoire ?" rows="1"></textarea><button class="btn primary" type="submit" id="send">Envoyer</button></form>
    </div>`);
  const msgs = $('#msgs', p);
  const rendre = () => {
    msgs.innerHTML = (S.ia.length ? '' : `<div class="msg ia">Bonjour ${esc(S.profil.nom.split(' ')[0])} 👋 Je suis l’assistant KOORDIN. J’ai accès aux projets, rapports, budgets et stocks que votre rôle permet de consulter. Que voulez-vous savoir ?</div>`)
      + S.ia.map((m) => `<div class="msg ${m.role === 'user' ? 'moi' : m.erreur ? 'err' : 'ia'}">${m.role === 'user' ? esc(m.content) : formatIA(m.content)}</div>`).join('');
    msgs.scrollTop = msgs.scrollHeight;
  };
  rendre();
  const envoyer = async (question) => {
    question = question.trim();
    if (!question) return;
    $('#qia', p).value = '';
    S.ia.push({ role: 'user', content: question });
    rendre();
    msgs.insertAdjacentHTML('beforeend', '<div class="msg ia" id="typing"><span class="typing"><i></i><i></i><i></i></span> Analyse de vos données…</div>');
    msgs.scrollTop = msgs.scrollHeight;
    $('#send', p).disabled = true;
    try {
      const historique = S.ia.filter((m) => !m.erreur).map(({ role: r, content }) => ({ role: r, content }));
      const { data, error } = await sb.functions.invoke('koordin-ia', { body: { messages: historique } });
      if (error) {
        let detail = null;
        try { detail = (await error.context.json()).erreur; } catch { /* rien */ }
        throw new Error(detail || 'L’assistant IA n’est pas joignable. Vérifiez que la fonction « koordin-ia » est déployée (voir le guide).');
      }
      S.ia.push({ role: 'assistant', content: data.reponse || data.erreur || '…' });
    } catch (e) {
      S.ia.pop();
      S.ia.push({ role: 'user', content: question });
      S.ia.push({ role: 'assistant', content: `⚠️ ${messageErreur(e)}`, erreur: true });
    } finally {
      $('#send', p).disabled = false;
      rendre();
    }
  };
  $('#f-ia', p).onsubmit = (e) => { e.preventDefault(); envoyer($('#qia', p).value); };
  $('#qia', p).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(e.target.value); } });
  $$('[data-q]', p).forEach((b) => (b.onclick = () => envoyer(b.dataset.q)));
  $('#raz', p)?.addEventListener('click', () => { S.ia = []; PAGES.ia(); });
};

// ═══════════════════════════════ PARAMÈTRES ═══════════════════════════════

PAGES.parametres = async () => {
  const e = S.entreprise;
  let sansProprietaire = false;
  if (!DEMO) {
    const { data } = await sb.rpc('plateforme_a_un_admin');
    sansProprietaire = data === false;
  }
  const p = page(`
    ${entete('Paramètres', 'Entreprise et démonstration')}
    <div class="grid c2">
      <form class="card" id="f-ent"><div class="card-title">Entreprise</div>
        <div class="form-grid">
          ${F.text('nom', 'Nom de l’entreprise', e.nom, { required: true, full: true })}
          ${F.text('pays', 'Pays', e.pays)}
          ${F.text('devise', 'Devise', e.devise, { required: true, hint: 'Ex. FCFA, EUR, USD, MAD' })}
        </div>
        <div class="form-actions"><button class="btn primary" type="submit">Enregistrer</button></div></form>
      ${DEMO ? `<div class="card"><div class="card-title">Démonstration</div>
        <p style="font-size:13px;margin-bottom:12px">Remet l’entreprise fictive dans son état de départ : vos projets, rapports, commandes et factures de test sont effacés.</p>
        <button class="btn" id="raz-demo">↺ Réinitialiser la démonstration</button></div>` : `<div class="card"><div class="card-title">Données de démonstration</div>
        <p style="font-size:13px;margin-bottom:12px">Ajoute 3 chantiers d’exemple (lots, planning, commandes, factures, stock, rapports) pour découvrir KOORDIN ou faire une présentation. Vous pourrez supprimer ces projets ensuite.</p>
        <button class="btn" id="demo">🎬 Charger la démonstration</button></div>`}
    </div>
    ${sansProprietaire ? `<div class="card section" style="border-color:var(--gold)"><div class="card-title">🛡️ Propriétaire de la plateforme KOORDIN</div>
      <p style="font-size:13px;margin-bottom:12px">Aucun propriétaire n’est encore déclaré. Si vous êtes l’éditeur de KOORDIN, activez votre console : vous pourrez fixer les prix, valider les paiements et gérer les licences de toutes les entreprises clientes. Votre propre entreprise n’aura pas de date d’expiration.</p>
      <p class="notice warn" style="margin-bottom:12px">⚠️ À faire une seule fois, par vous seul : le premier compte qui l’active devient propriétaire.</p>
      <button class="btn primary" id="devenir-admin">Je suis le propriétaire de KOORDIN : activer ma console</button></div>` : ''}
    ${can('direction') && !DEMO ? carteMarque() : ''}
    <div class="card section"><div class="card-title">Installer KOORDIN sur un téléphone</div>
      <p style="font-size:13px;line-height:1.8">• <b>Android (Chrome)</b> : ouvrez l’adresse de l’application → menu ⋮ → « Ajouter à l’écran d’accueil ».<br>
      • <b>iPhone (Safari)</b> : ouvrez l’adresse → bouton Partager → « Sur l’écran d’accueil ».<br>
      Adresse à partager avec votre équipe : <b>${esc(location.origin + location.pathname)}</b></p></div>`);
  brancherMarque(p);
  $('#f-ent', p).onsubmit = async (ev) => {
    ev.preventDefault();
    const d = lireFormulaire(ev.target);
    try {
      const maj = await q(sb.from('entreprises').update({ nom: d.nom, pays: d.pays, devise: d.devise }).eq('id', e.id).select().single());
      S.entreprise = maj;
      $('.topbar .company').textContent = maj.nom;
      toast('Paramètres enregistrés.');
    } catch (err) { toast(messageErreur(err), 'err'); }
  };
  $('#devenir-admin', p)?.addEventListener('click', async () => {
    if (!(await confirmer('Confirmer que vous êtes l’éditeur de KOORDIN ? Ce compte deviendra le propriétaire de la plateforme.', 'Oui, activer'))) return;
    try {
      await q(sb.rpc('devenir_admin_plateforme'));
      toast('Console KOORDIN activée.');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(messageErreur(err), 'err'); }
  });
  $('#raz-demo', p)?.addEventListener('click', async () => {
    if (!(await confirmer('Effacer vos essais et revenir aux données de départ ?', 'Réinitialiser'))) return;
    await q(sb.rpc('reinitialiser_demo'));
    S.ia = [];
    await chargerEquipe();
    toast('Démonstration réinitialisée.');
    allerA('#/dashboard');
  });
  if ($('#demo', p)) $('#demo', p).onclick = async () => {
    if (!(await confirmer('Ajouter les 3 projets de démonstration à votre espace ?', 'Charger'))) return;
    try {
      await q(sb.rpc('charger_demo'));
      toast('Démonstration chargée 🎉');
      allerA('#/dashboard');
    } catch (err) { toast(messageErreur(err), 'err'); }
  };
};

// ═══════════════════════════════ ABONNEMENT (Direction) ═══════════════════════════════

const PERIODES = { mois: ['Mensuel', 1], trimestre: ['Trimestriel', 3], annee: ['Annuel', 12] };
const MOYENS = ['Wave', 'Orange Money', 'MTN MoMo', 'Moov Money', 'Virement bancaire', 'Espèces'];
let periodeChoisie = 'mois';

async function chargerTarifs() {
  const [plans, params] = await Promise.all([
    q(sb.from('plans').select('*').order('ordre')),
    q(sb.from('parametres_plateforme').select('*')),
  ]);
  return { plans, params: Object.fromEntries(params.map((x) => [x.cle, x.valeur || ''])) };
}
function prixPeriode(plan, periode, params) {
  const mois = PERIODES[periode][1];
  const remise = periode === 'trimestre' ? num(params.remise_trimestre_pct) : periode === 'annee' ? num(params.remise_annee_pct) : 0;
  return Math.round((num(plan.prix_mensuel) * mois * (1 - remise / 100)) / 100) * 100;
}
const limite = (v) => (v == null ? 'illimité' : nf.format(v));
function etiquetteLicence() {
  const l = etatLicence();
  if (!l) return badge(['muted', '—']);
  if (l.illimitee) return badge(['ok', '♾️ Sans expiration']);
  if (l.expiree) return badge(['crit', '🔒 Expirée']);
  if (l.essai) return badge(['info', `🎁 Essai : ${l.jours} j restants`]);
  return badge([l.jours <= 7 ? 'warn' : 'ok', `✅ Active : ${l.jours} j restants`]);
}

PAGES.abonnement = async () => {
  const { data: ent } = await sb.from('entreprises').select('*').eq('id', S.entreprise.id).single();
  if (ent) S.entreprise = ent;
  const [{ plans, params }, paiements, nbProjets, nbProfils, nbInvit] = await Promise.all([
    chargerTarifs(),
    q(sb.from('paiements').select('*').order('created_at', { ascending: false })),
    sb.from('projets').select('id', { count: 'exact', head: true }).neq('statut', 'termine'),
    sb.from('profils').select('id', { count: 'exact', head: true }).eq('actif', true),
    sb.from('invitations').select('id', { count: 'exact', head: true }).is('acceptee_at', null),
  ]);
  const actuel = plans.find((x) => x.code === S.entreprise.plan) || {};
  const l = etatLicence();
  const utilisateurs = (nbProfils.count || 0) + (nbInvit.count || 0);
  const barreUsage = (val, max) => (max == null ? `<b>${val}</b> <span class="muted">/ illimité</span>` : progressBar(Math.min(100, pct(val, max)), { cls: val >= max ? 'crit' : val >= max * 0.8 ? 'warn' : 'ok', label: `${val} / ${max}` }).replace(/ %<\/span>/, '</span>'));
  const enAttente = paiements.find((x) => x.statut === 'declare');
  const publics = plans.filter((x) => x.public);

  const p = page(`
    ${entete('Abonnement', 'Votre formule KOORDIN, son échéance et vos paiements')}
    ${enAttente ? `<div class="notice">⏳ Paiement de <b>${money(enAttente.montant)}</b> déclaré le ${new Date(enAttente.created_at).toLocaleDateString('fr-FR')} : en cours de vérification par KOORDIN. Votre licence sera prolongée dès la validation.</div>` : ''}
    <div class="grid c2">
      <div class="card"><div class="card-title">Formule actuelle ${etiquetteLicence()}</div>
        <div class="kpi-value" style="font-size:24px">${esc(actuel.nom || S.entreprise.plan)}</div>
        <p class="muted" style="margin:4px 0 14px">${l?.illimitee ? 'Licence sans date d’expiration.' : `${l?.expiree ? 'Expirée depuis le' : 'Valable jusqu’au'} <b>${l?.fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</b>`}</p>
        <div class="detail-block"><h4>Projets actifs</h4>${barreUsage(nbProjets.count || 0, actuel.max_projets)}</div>
        <div class="detail-block"><h4>Utilisateurs (avec invitations en attente)</h4>${barreUsage(utilisateurs, actuel.max_utilisateurs)}</div>
      </div>
      <div class="card"><div class="card-title">Comment ça marche</div>
        <ol style="padding-left:18px;font-size:13px;line-height:1.8">
          <li>Choisissez une formule et une durée ci-dessous.</li>
          <li>Payez par Mobile Money ou virement aux coordonnées indiquées.</li>
          <li>Déclarez votre paiement avec la référence de la transaction.</li>
          <li>KOORDIN vérifie et prolonge votre licence, en général dans la journée.</li>
        </ol>
        <p class="muted mt" style="font-size:12px">Votre licence est prolongée à partir de sa date de fin actuelle : vous ne perdez aucun jour en payant en avance.</p>
      </div>
    </div>
    <div id="parrainage"></div>
    <div class="tabs section">${Object.entries(PERIODES).map(([k, [lbl]]) => {
      const r = k === 'trimestre' ? num(params.remise_trimestre_pct) : k === 'annee' ? num(params.remise_annee_pct) : 0;
      return `<button class="tab ${k === periodeChoisie ? 'active' : ''}" data-periode="${k}">${lbl}${r ? ` <span class="badge ok">−${r} %</span>` : ''}</button>`;
    }).join('')}</div>
    <div class="projects">${publics.map((pl) => {
      const prix = prixPeriode(pl, periodeChoisie, params);
      const mois = PERIODES[periodeChoisie][1];
      const courant = pl.code === S.entreprise.plan;
      return `<div class="card project-card" style="cursor:default;${courant ? 'border-color:var(--gold)' : ''}">
        <div class="pc-top"><h3>${esc(pl.nom)}</h3>${courant ? badge(['ok', 'Formule actuelle']) : ''}</div>
        <div><span class="kpi-value" style="font-size:24px">${money(prix)}</span><span class="muted"> / ${mois === 1 ? 'mois' : mois === 3 ? 'trimestre' : 'an'}</span>
          ${mois > 1 ? `<div class="muted" style="font-size:12px">soit ${money(prix / mois)} par mois</div>` : ''}</div>
        <p class="meta">${esc(pl.description || '')}</p>
        <div class="pc-stats" style="grid-template-columns:1fr 1fr">
          <div><b>${limite(pl.max_projets)}</b><span>projets actifs</span></div>
          <div><b>${limite(pl.max_utilisateurs)}</b><span>utilisateurs</span></div>
        </div>
        <button class="btn ${courant ? '' : 'primary'} block" data-choisir="${esc(pl.code)}">${courant ? 'Renouveler' : 'Choisir cette formule'}</button>
      </div>`;
    }).join('') || `<div class="card">${empty('💳', 'Aucune formule n’est encore proposée.')}</div>`}</div>
    <div class="card section"><div class="card-title">Historique des paiements</div>
      ${paiements.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Formule</th><th>Durée</th><th class="num">Montant</th><th>Moyen / référence</th><th>Statut</th></tr></thead><tbody>
      ${paiements.map((x) => `<tr><td class="nowrap">${new Date(x.created_at).toLocaleDateString('fr-FR')}</td><td>${esc(plans.find((pl) => pl.code === x.plan)?.nom || x.plan)}</td>
        <td>${PERIODES[x.periode][0]}</td><td class="num">${money(x.montant)}</td><td class="muted">${esc([x.moyen, x.reference].filter(Boolean).join(' · '))}</td>
        <td>${badge({ declare: ['warn', '⏳ En vérification'], valide: ['ok', '✅ Validé'], refuse: ['crit', '✖️ Refusé'] }[x.statut])}${x.note ? `<div class="muted" style="font-size:12px">${esc(x.note)}</div>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('🧾', 'Aucun paiement pour le moment')}</div>`);

  $$('[data-periode]', p).forEach((b) => (b.onclick = () => { periodeChoisie = b.dataset.periode; PAGES.abonnement(); }));
  carteParrainage($('#parrainage', p));
  $$('[data-choisir]', p).forEach((b) => (b.onclick = () => formulairePaiement(plans.find((x) => x.code === b.dataset.choisir), params)));
};

async function carteParrainage(zone) {
  if (DEMO || !zone) return;
  const { data, error } = await sb.rpc('mon_parrainage');
  if (error || !data?.code) { zone.innerHTML = ''; return; }
  const lien = lienParrainage(data.code);
  const gagnes = data.filleules.filter((f) => f.abonnee).length * data.mois_offerts;
  const message = `Bonjour, j’utilise KOORDIN pour piloter mes chantiers : rapports du terrain avec photos, pointage des ouvriers, budget, achats et stock, tout sur le téléphone. Essayez-le gratuitement pendant ${data.essai_jours} jours avec mon lien : ${lien}`;
  zone.innerHTML = `<div class="card section parrainage">
    <div class="card-title">🎁 Parrainez une entreprise ${gagnes ? badge(['ok', `${gagnes} mois gagné${gagnes > 1 ? 's' : ''}`]) : ''}</div>
    <div class="parrainage-grille">
      <div class="parrainage-regle"><b>${data.mois_offerts} mois offert${data.mois_offerts > 1 ? 's' : ''}</b><span>pour vous, dès que l’entreprise invitée paie son premier abonnement</span></div>
      <div class="parrainage-regle"><b>${data.essai_jours} jours d’essai</b><span>pour elle, au lieu de 14</span></div>
    </div>
    <div class="parrainage-code"><span>Votre code</span><b>${esc(data.code)}</b></div>
    <div class="rc-boutons">
      <a class="btn primary" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">📲 Inviter par WhatsApp</a>
      <button type="button" class="btn" id="pa-copier">📋 Copier le lien</button>
    </div>
    ${data.filleules.length ? `<div class="paie-liste">${data.filleules.map((f) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(f.nom)}</b><span>Inscrite le ${new Date(f.inscrite_le).toLocaleDateString('fr-FR')}</span></div>
      <div class="paie-montant">${f.abonnee ? badge(['ok', `✅ Abonnée · +${data.mois_offerts} mois`]) : badge(['warn', '⏳ En essai'])}</div></div>`).join('')}</div>`
      : '<p class="hint mt">Aucune entreprise parrainée pour l’instant. Pensez à vos partenaires, sous-traitants et confrères du BTP.</p>'}
  </div>`;
  $('#pa-copier', zone).onclick = async () => {
    try { await navigator.clipboard.writeText(lien); toast('Lien de parrainage copié ✅'); } catch { toast(lien, 'warn', 8000); }
  };
}

function formulairePaiement(plan, params) {
  const montant = prixPeriode(plan, periodeChoisie, params);
  const lignes = [['Wave', params.paiement_wave], ['Orange Money', params.paiement_orange_money]].filter(([, v]) => v);
  const copier = (v) => `<button type="button" class="btn sm" data-copie="${esc(v)}">Copier</button>`;
  ouvrirModale({
    titre: `Formule ${plan.nom} · ${PERIODES[periodeChoisie][0]}`,
    corps: `<div class="kpi" style="margin-bottom:14px"><div class="kpi-label">Montant à payer</div><div class="kpi-value">${money(montant)}</div>
        <div class="kpi-foot">${PERIODES[periodeChoisie][1]} mois de licence ${esc(plan.nom)}</div></div>
      ${lignes.length ? `<div class="detail-block"><h4>1. Payez à</h4>
        ${lignes.map(([moyen, numero]) => `<div class="split" style="padding:6px 0"><span>${moyen} : <b>${esc(numero)}</b></span>${copier(numero)}</div>`).join('')}
        ${params.paiement_beneficiaire ? `<p class="muted" style="font-size:12px">Bénéficiaire : ${esc(params.paiement_beneficiaire)}</p>` : ''}</div>`
        : '<div class="notice warn">Les coordonnées de paiement ne sont pas encore renseignées. Contactez KOORDIN avant de payer.</div>'}
      <div class="detail-block"><h4>2. Déclarez votre paiement</h4></div>
      <div class="form-grid">
        ${F.select('moyen', 'Moyen de paiement', MOYENS.map((m) => [m, m]), lignes[0]?.[0] || 'Wave', { required: true })}
        ${F.text('reference', 'Référence de la transaction', '', { required: true, placeholder: 'Ex. code reçu par SMS', hint: 'Indiquée dans le SMS de confirmation de votre paiement.' })}
      </div>`,
    boutonOk: 'J’ai payé : déclarer le paiement',
    onOpen: (el) => $$('[data-copie]', el).forEach((b) => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copie); toast('Numéro copié.'); } catch { toast(b.dataset.copie); }
    })),
    onSubmit: async (d) => {
      await q(sb.from('paiements').insert({ plan: plan.code, periode: periodeChoisie, montant, moyen: d.moyen, reference: d.reference }));
      toast('Paiement déclaré. KOORDIN va le vérifier et prolonger votre licence.');
      PAGES.abonnement();
      const wa = String(params.contact_whatsapp || '').replace(/\D/g, '');
      if (wa) {
        const texte = `Bonjour KOORDIN, je viens de payer ${money(montant)} pour la formule ${plan.nom} (${PERIODES[periodeChoisie][0].toLowerCase()}).\nEntreprise : ${S.entreprise.nom}\nMoyen : ${d.moyen}\nRéférence : ${d.reference}`;
        setTimeout(() => ouvrirModale({
          titre: 'Accélérer la validation',
          corps: `<p style="margin-bottom:12px">Vous pouvez prévenir KOORDIN sur WhatsApp pour une validation plus rapide :</p>
            <a class="btn primary block" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(texte)}">💬 Envoyer la confirmation sur WhatsApp</a>`,
        }), 50);
      }
    },
  });
}

// ═══════════════════════════════ CONSOLE DU PROPRIÉTAIRE ═══════════════════════════════

let ongletConsole = 'paiements';

PAGES.console = async () => {
  if (!S.plateformeAdmin) return PAGES.dashboard();
  const [entreprises, { plans, params }, paiements] = await Promise.all([
    q(sb.rpc('console_entreprises')),
    chargerTarifs(),
    q(sb.from('paiements').select('*').order('created_at', { ascending: false }).limit(300)),
  ]);
  const nomEnt = (id) => entreprises.find((x) => x.id === id)?.nom || '—';
  const nomPlan = (c) => plans.find((x) => x.code === c)?.nom || c;
  const attente = paiements.filter((x) => x.statut === 'declare');
  const maintenant = Date.now();
  const actives = entreprises.filter((x) => new Date(x.licence_fin).getTime() > maintenant && x.plan !== 'essai');
  const essais = entreprises.filter((x) => new Date(x.licence_fin).getTime() > maintenant && x.plan === 'essai');
  const revenusMois = paiements.filter((x) => x.statut === 'valide' && new Date(x.traite_at || x.created_at).getMonth() === new Date().getMonth() && new Date(x.traite_at || x.created_at).getFullYear() === new Date().getFullYear()).reduce((s, x) => s + num(x.montant), 0);
  const etatEnt = (x) => {
    const j = Math.ceil((new Date(x.licence_fin).getTime() - maintenant) / 86400000);
    if (j > 3650) return badge(['ok', '♾️ Sans expiration']);
    if (j <= 0) return badge(['crit', `🔒 Expirée`]);
    return badge([x.plan === 'essai' ? 'info' : j <= 7 ? 'warn' : 'ok', `${x.plan === 'essai' ? '🎁 Essai' : '✅'} ${j} j`]);
  };

  const p = page(`
    ${entete('🛡️ Console KOORDIN', 'Vos entreprises clientes, leurs licences et vos paiements')}
    <div class="grid k4">
      ${kpi('Paiements à valider', attente.length, attente.length ? moneyShort(attente.reduce((s, x) => s + num(x.montant), 0)) : '✅ Rien en attente', attente.length ? 'warn' : '')}
      ${kpi('Clients payants', actives.length, `${entreprises.length} entreprise(s) au total`)}
      ${kpi('En essai', essais.length)}
      ${kpi('Encaissé ce mois-ci', moneyShort(revenusMois))}
    </div>
    <div class="tabs section">
      <button class="tab ${ongletConsole === 'paiements' ? 'active' : ''}" data-o="paiements">Paiements${attente.length ? ` <span class="badge warn">${attente.length}</span>` : ''}</button>
      <button class="tab ${ongletConsole === 'entreprises' ? 'active' : ''}" data-o="entreprises">Entreprises</button>
      <button class="tab ${ongletConsole === 'annonces' ? 'active' : ''}" data-o="annonces">Annonces</button>
      <button class="tab ${ongletConsole === 'tarifs' ? 'active' : ''}" data-o="tarifs">Tarifs et paiement</button>
    </div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  const recharger = () => PAGES.console();

  const rendre = async () => {
    if (ongletConsole === 'paiements') {
      zone.innerHTML = `<div class="card">${paiements.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Entreprise</th><th>Formule</th><th class="num">Montant</th><th>Moyen / référence</th><th>Statut</th><th></th></tr></thead><tbody>
        ${paiements.map((x) => `<tr><td class="nowrap">${new Date(x.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
          <td><b>${esc(nomEnt(x.entreprise_id))}</b></td><td>${esc(nomPlan(x.plan))} · ${PERIODES[x.periode][0]}</td><td class="num">${money(x.montant)}</td>
          <td>${esc(x.moyen)}<div class="muted" style="font-size:12px">${esc(x.reference || '')}</div></td>
          <td>${badge({ declare: ['warn', '⏳ À vérifier'], valide: ['ok', '✅ Validé'], refuse: ['crit', '✖️ Refusé'] }[x.statut])}</td>
          <td class="right nowrap">${x.statut === 'declare' ? `<button class="btn sm primary" data-valider="${x.id}">✅ Valider</button><button class="btn sm" data-refuser="${x.id}">Refuser</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : empty('🧾', 'Aucun paiement déclaré pour le moment')}
        <p class="muted mt" style="font-size:12px">Vérifiez la réception de l’argent sur votre compte Wave / Orange Money avant de valider. La validation prolonge automatiquement la licence du client.</p></div>`;
      $$('[data-valider]', zone).forEach((b) => (b.onclick = async () => {
        const pa = paiements.find((x) => x.id === b.dataset.valider);
        if (!(await confirmer(`Confirmer la réception de ${money(pa.montant)} de ${nomEnt(pa.entreprise_id)} (réf. ${pa.reference || '—'}) ?`, 'Valider'))) return;
        try { await q(sb.rpc('traiter_paiement', { p_paiement: pa.id, p_valider: true, p_note: null })); toast('Paiement validé, licence prolongée.'); recharger(); } catch (e) { toast(messageErreur(e), 'err'); }
      }));
      $$('[data-refuser]', zone).forEach((b) => (b.onclick = () => ouvrirModale({
        titre: 'Refuser le paiement',
        corps: F.area('note', 'Motif (visible par le client)', '', { required: true, placeholder: 'Ex. Aucun paiement reçu avec cette référence' }),
        boutonOk: 'Refuser',
        onSubmit: async (d) => { await q(sb.rpc('traiter_paiement', { p_paiement: b.dataset.refuser, p_valider: false, p_note: d.note })); toast('Paiement refusé.'); recharger(); },
      })));
    } else if (ongletConsole === 'entreprises') {
      zone.innerHTML = `<div class="card">${entreprises.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Entreprise</th><th>Direction</th><th>Formule</th><th>Licence</th><th class="num">Projets</th><th class="num">Utilisateurs</th><th></th></tr></thead><tbody>
        ${entreprises.map((x) => `<tr><td><b>${esc(x.nom)}</b><div class="muted" style="font-size:12px">depuis le ${new Date(x.created_at).toLocaleDateString('fr-FR')}</div></td>
          <td>${esc(x.direction || '—')}<div class="muted" style="font-size:12px">${esc(afficherIdentifiant(x.contact))}</div></td>
          <td>${esc(nomPlan(x.plan))}</td><td>${etatEnt(x)}<div class="muted" style="font-size:12px">${new Date(x.licence_fin).toLocaleDateString('fr-FR')}</div></td>
          <td class="num">${x.nb_projets}</td><td class="num">${x.nb_utilisateurs}</td>
          <td class="right"><button class="btn sm" data-prolonger="${x.id}">Gérer la licence</button></td></tr>`).join('')}
        </tbody></table></div>` : empty('🏢', 'Aucune entreprise inscrite')}</div>`;
      $$('[data-prolonger]', zone).forEach((b) => (b.onclick = () => {
        const x = entreprises.find((e) => e.id === b.dataset.prolonger);
        ouvrirModale({
          titre: `Licence de ${x.nom}`,
          corps: `<p class="muted" style="margin-bottom:12px">Fin actuelle : ${new Date(x.licence_fin).toLocaleDateString('fr-FR')}. La durée s’ajoute à partir de cette date (ou d’aujourd’hui si elle est passée).</p>
            <div class="form-grid">
              ${F.select('plan', 'Formule', plans.map((pl) => [pl.code, pl.nom]), x.plan, { required: true })}
              ${F.select('mois', 'Ajouter', [['0', 'Rien (changer seulement la formule)'], ['1', '1 mois'], ['3', '3 mois'], ['6', '6 mois'], ['12', '12 mois'], ['1200', 'Sans expiration (100 ans)']], '1', { required: true })}
            </div>`,
          boutonOk: 'Appliquer',
          onSubmit: async (d) => {
            const fin = await q(sb.rpc('prolonger_licence', { p_entreprise: x.id, p_plan: d.plan, p_mois: Number(d.mois) }));
            toast(`Licence de ${x.nom} : jusqu’au ${new Date(fin).toLocaleDateString('fr-FR')}.`);
            recharger();
          },
        });
      }));
    } else if (ongletConsole === 'annonces') {
      zone.innerHTML = loading();
      const { data: annonces, error } = await sb.from('annonces').select('*').order('created_at', { ascending: false });
      if (error) {
        zone.innerHTML = `<div class="card">${empty('🧩', 'Les annonces nécessitent la mise à jour 1.5 de la base de données : exécutez supabase/mise-a-jour-1.5.sql dans Supabase → SQL Editor.')}</div>`;
        return;
      }
      const auj = todayISO();
      const enCours = (a) => a.actif && a.debut <= auj && (!a.fin || a.fin >= auj);
      zone.innerHTML = `<div class="grid k3">
          ${kpi('Annonces en ligne', annonces.filter(enCours).length, `${annonces.length} au total`, '', '📣')}
          ${kpi('Affichages', nf.format(annonces.reduce((s, a) => s + a.impressions, 0)), 'Toutes annonces confondues', '', '👁️')}
          ${kpi('Revenus publicitaires', moneyShort(annonces.reduce((s, a) => s + num(a.prix), 0)), 'Montants saisis', '', '💰')}
        </div>
        <div class="card section"><div class="card-title">Vos annonces <button class="btn sm primary" id="na">＋ Nouvelle annonce</button></div>
        ${annonces.length ? `<div class="annonces-liste">${annonces.map((a) => `
          <div class="annonce-ligne">
            <div class="al-img">${a.image ? `<img src="${esc(urlImageAnnonce(a.image))}" alt="">` : sceneChantier(empreinte(a.id))}</div>
            <div class="al-corps"><b>${esc(a.titre)}</b><div class="muted" style="font-size:12px">${esc(a.annonceur)} · ${a.roles?.length ? a.roles.map((r) => ROLES[r]?.label).join(', ') : 'Tous les rôles'}</div>
              <div class="muted" style="font-size:12px">Du ${fdate(a.debut)}${a.fin ? ` au ${fdate(a.fin)}` : ' (sans fin)'}${a.prix ? ` · ${money(a.prix)}` : ''}</div></div>
            <div class="al-stats"><b>${nf.format(a.impressions)}</b><span>vues</span></div>
            <div class="al-stats"><b>${nf.format(a.clics)}</b><span>clics${a.impressions ? ` · ${Math.round((a.clics / a.impressions) * 1000) / 10} %` : ''}</span></div>
            <div>${enCours(a) ? badge(['ok', '● En ligne']) : badge(['muted', a.actif ? 'Programmée / terminée' : 'En pause'])}</div>
            <button class="btn sm" data-ea="${a.id}">Modifier</button>
          </div>`).join('')}</div>` : empty('📣', 'Aucune annonce. Proposez aux fournisseurs, loueurs d’engins ou banques de se faire connaître auprès des entreprises du BTP.')}
        <p class="muted mt" style="font-size:12px">Les annonces apparaissent dans les tableaux de bord, marquées « Sponsorisé », une à la fois et au hasard parmi celles en ligne.</p></div>`;
      const form = (a = null) => ouvrirModale({
        titre: a ? 'Modifier l’annonce' : 'Nouvelle annonce',
        large: true,
        corps: `<div class="form-grid">
          ${F.text('annonceur', 'Annonceur', a?.annonceur, { required: true, placeholder: 'Ex. SOACOFER' })}
          ${F.text('prix', 'Prix facturé (FCFA)', a?.prix ?? '', { type: 'number', min: 0, hint: 'Pour votre suivi des revenus' })}
          ${F.text('titre', 'Titre', a?.titre, { required: true, full: true, placeholder: 'Ex. Fer à béton : −10 % pour les entreprises KOORDIN' })}
          ${F.area('texte', 'Texte (court)', a?.texte, { placeholder: 'Une ou deux phrases' })}
          ${F.text('lien', 'Lien : site web ou numéro WhatsApp', a?.lien, { placeholder: 'www.exemple.ci ou 07 00 00 00 00' })}
          ${F.text('bouton', 'Texte du bouton', a?.bouton || 'En savoir plus')}
          ${F.text('debut', 'Début', a?.debut || todayISO(), { type: 'date', required: true })}
          ${F.text('fin', 'Fin (vide = sans fin)', a?.fin, { type: 'date' })}
          <div class="field full">Visible par
            <div class="chips">${Object.entries(ROLES).map(([k, r]) => `<label class="chip"><input type="checkbox" name="role_${k}" ${!a?.roles || a.roles.includes(k) ? 'checked' : ''}> ${r.ico} ${r.label}</label>`).join('')}</div></div>
          <div class="field full">Image (format paysage conseillé)
            <label class="btn" style="width:max-content">🖼️ Choisir une image<input type="file" id="img-annonce" accept="image/*" hidden></label>
            <div id="apercu-annonce" class="mt">${a?.image ? `<img src="${esc(urlImageAnnonce(a.image))}" alt="" style="max-height:140px;border-radius:10px">` : ''}</div></div>
          <label class="field full" style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="actif" ${a?.actif === false ? '' : 'checked'} style="width:auto"> Annonce active</label>
        </div>${a ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-annonce">Supprimer l’annonce</button></div>' : ''}`,
        onOpen: (el) => {
          $('#img-annonce', el).onchange = async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            el.imageAnnonce = await compresserImage(f, 1400, 0.85);
            $('#apercu-annonce', el).innerHTML = `<img src="${URL.createObjectURL(el.imageAnnonce)}" alt="" style="max-height:140px;border-radius:10px">`;
          };
          $('#del-annonce', el)?.addEventListener('click', async () => {
            if (!(await confirmer('Supprimer définitivement cette annonce ?', 'Supprimer'))) return;
            try { await q(sb.from('annonces').delete().eq('id', a.id)); el.remove(); toast('Annonce supprimée.'); cacheAnnonces = null; rendre(); } catch (err) { toast(messageErreur(err), 'err'); }
          });
        },
        onSubmit: async (d, formEl) => {
          const roles = Object.keys(ROLES).filter((k) => formEl.querySelector(`[name="role_${k}"]`).checked);
          if (!roles.length) throw new Error('Choisissez au moins un rôle.');
          const data = {
            annonceur: d.annonceur, titre: d.titre, texte: d.texte, lien: d.lien, bouton: d.bouton || 'En savoir plus',
            debut: d.debut, fin: d.fin, prix: d.prix != null ? num(d.prix) : null,
            actif: formEl.querySelector('[name="actif"]').checked,
            roles: roles.length === Object.keys(ROLES).length ? null : roles,
          };
          const blob = formEl.closest('.overlay').imageAnnonce;
          if (blob) {
            const chemin = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error: e2 } = await sb.storage.from('annonces').upload(chemin, blob, { contentType: 'image/jpeg' });
            if (e2) throw e2;
            data.image = chemin;
          }
          if (a) await q(sb.from('annonces').update(data).eq('id', a.id));
          else await q(sb.from('annonces').insert(data));
          cacheAnnonces = null;
          toast('Annonce enregistrée.');
          rendre();
        },
      });
      $('#na', zone).onclick = () => form();
      $$('[data-ea]', zone).forEach((b) => (b.onclick = () => form(annonces.find((x) => x.id === b.dataset.ea))));
    } else {
      zone.innerHTML = `<div class="card"><div class="card-title">Formules et prix <small>Modifiez puis enregistrez chaque ligne</small></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Formule</th><th>Prix mensuel (FCFA)</th><th>Projets max</th><th>Utilisateurs max</th><th>Proposée</th><th></th></tr></thead><tbody>
        ${plans.map((pl) => `<tr data-plan="${esc(pl.code)}">
          <td><input class="input" name="nom" value="${esc(pl.nom)}" style="min-width:120px"><input class="input mt" name="description" value="${esc(pl.description || '')}" placeholder="Description" style="min-width:180px"></td>
          <td><input class="input" name="prix_mensuel" type="number" min="0" value="${num(pl.prix_mensuel)}" style="min-width:110px"></td>
          <td><input class="input" name="max_projets" type="number" min="0" value="${pl.max_projets ?? ''}" placeholder="illimité" style="min-width:90px"></td>
          <td><input class="input" name="max_utilisateurs" type="number" min="0" value="${pl.max_utilisateurs ?? ''}" placeholder="illimité" style="min-width:90px"></td>
          <td><input type="checkbox" name="public" ${pl.public ? 'checked' : ''} ${pl.code === 'essai' ? 'disabled' : ''}></td>
          <td><button class="btn sm primary" data-save-plan="${esc(pl.code)}">Enregistrer</button></td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted mt" style="font-size:12px">« Essai gratuit » s’applique automatiquement aux nouvelles entreprises. Laissez une limite vide pour « illimité ».</p></div>
        <form class="card" id="f-params"><div class="card-title">Essai, remises et coordonnées de paiement</div>
          <div class="form-grid">
            ${F.text('duree_essai_jours', 'Durée de l’essai gratuit (jours)', params.duree_essai_jours, { type: 'number', min: 1 })}
            ${F.text('contact_whatsapp', 'Votre WhatsApp (pour les clients)', params.contact_whatsapp, { placeholder: '+225 07 00 00 00 00' })}
            ${F.text('remise_trimestre_pct', 'Remise trimestrielle (%)', params.remise_trimestre_pct, { type: 'number', min: 0, max: 90 })}
            ${F.text('remise_annee_pct', 'Remise annuelle (%)', params.remise_annee_pct, { type: 'number', min: 0, max: 90 })}
            ${F.text('paiement_wave', 'Numéro Wave', params.paiement_wave, { placeholder: '07 00 00 00 00' })}
            ${F.text('paiement_orange_money', 'Numéro Orange Money', params.paiement_orange_money, { placeholder: '07 00 00 00 00' })}
            ${F.text('paiement_beneficiaire', 'Nom du bénéficiaire', params.paiement_beneficiaire, { full: true, placeholder: 'Ex. GECREO SARL' })}
            ${F.text('turn_url', 'Relais vidéo TURN (facultatif)', params.turn_url, { full: true, placeholder: 'turn:relais.exemple.com:3478', hint: 'Améliore les appels vidéo sur les réseaux difficiles. Laisser vide si les appels fonctionnent.' })}
            ${F.text('turn_utilisateur', 'Relais : utilisateur', params.turn_utilisateur)}
            ${F.text('turn_mot_de_passe', 'Relais : mot de passe', params.turn_mot_de_passe)}
          </div>
          <div class="form-actions"><button class="btn primary" type="submit">Enregistrer</button></div></form>`;
      $$('[data-save-plan]', zone).forEach((b) => (b.onclick = async () => {
        const tr = b.closest('tr');
        const v = (n) => tr.querySelector(`[name="${n}"]`);
        const entier = (n) => (v(n).value === '' ? null : Math.round(num(v(n).value)));
        try {
          await q(sb.from('plans').update({
            nom: v('nom').value.trim() || b.dataset.savePlan, description: v('description').value.trim() || null,
            prix_mensuel: num(v('prix_mensuel').value), max_projets: entier('max_projets'), max_utilisateurs: entier('max_utilisateurs'),
            public: b.dataset.savePlan === 'essai' ? false : v('public').checked,
          }).eq('code', b.dataset.savePlan));
          toast('Formule enregistrée.');
        } catch (e) { toast(messageErreur(e), 'err'); }
      }));
      $('#f-params', zone).onsubmit = async (ev) => {
        ev.preventDefault();
        const d = lireFormulaire(ev.target);
        try {
          await q(sb.from('parametres_plateforme').upsert(Object.entries(d).map(([cle, valeur]) => ({ cle, valeur: valeur ?? '' }))));
          toast('Paramètres enregistrés.');
        } catch (e) { toast(messageErreur(e), 'err'); }
      };
    }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletConsole = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  rendre();
};

// ═══════════════════════════════ Clics globaux ═══════════════════════════════

document.addEventListener('click', (e) => {
  const lienInterne = DEMO && e.target.closest('a[href^="#/"]');
  if (lienInterne) {
    e.preventDefault();
    const rapLien = e.target.closest('[data-projet-rapport]');
    if (rapLien) memo.set('koordin-projet-rapport', rapLien.dataset.projetRapport);
    if (e.target.closest('[data-nouveau-projet]')) memo.set('koordin-ouvrir', 'projet');
    if (e.target.closest('[data-nouvelle-commande]')) memo.set('koordin-ouvrir', 'commande');
    if (e.target.closest('[data-nouvelle-facture]')) memo.set('koordin-ouvrir', 'facture');
    allerA(lienInterne.getAttribute('href'));
    return;
  }
  const go = e.target.closest('[data-go]');
  if (go && !e.target.closest('button, a, select, input')) {
    allerA(go.dataset.go);
    return;
  }
  const rap = e.target.closest('[data-rapport]');
  if (rap) { detailRapport(rap.dataset.rapport); return; }
  const prj = e.target.closest('[data-projet-rapport]');
  if (prj) memo.set('koordin-projet-rapport', prj.dataset.projetRapport);
  if (e.target.closest('[data-nouveau-projet]')) memo.set('koordin-ouvrir', 'projet');
  if (e.target.closest('[data-nouvelle-commande]')) memo.set('koordin-ouvrir', 'commande');
  if (e.target.closest('[data-nouvelle-facture]')) memo.set('koordin-ouvrir', 'facture');
  if (e.target.closest('[data-nouvelle-depense]')) memo.set('koordin-ouvrir', 'depense');
});

demarrer();
