/* ═══════════════════════════════════════════════════════════════════
   KOORDIN — application web (PWA)
   Une seule page, connectée à Supabase. Chaque rôle voit ses écrans ;
   la base de données applique les habilitations (voir supabase/schema.sql).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const CFG = window.KOORDIN_CONFIG || {};
// Version de l'application : à augmenter en même temps que version.json à chaque mise à jour publiée.
const VERSION = '3.3';
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
  { r: 'nouveau-rapport', court: 'Rapport', label: 'Nouveau rapport', ico: '➕', roles: ['technicien'] },
  { r: 'rapports', court: 'Rapports',        label: 'Rapports',        ico: '📋', roles: ROLES_RAPPORT, labelTech: 'Mes rapports' },
  { r: 'pointage', court: 'Pointage', label: 'Pointage', ico: '👷', roles: ['direction', 'coordinateur', 'technicien', 'comptable'] },
  { r: 'achats', court: 'Achats',          label: 'Achats',          ico: '🛒', roles: ['direction', 'coordinateur', 'achats', 'comptable', 'magasinier'] },
  { r: 'compta', court: 'Compta',          label: 'Comptabilité',    ico: '💰', roles: ['direction', 'comptable'] },
  { r: 'ventes', court: 'Clients', label: 'Facturation client', ico: '💼', roles: ['direction', 'comptable', 'coordinateur'] },
  { r: 'salaires', court: 'Salaires', label: 'Salaires', ico: '💵', roles: ['direction', 'comptable'] },
  { r: 'contrats', court: 'Contrats', label: 'Contrats et prestataires', ico: '📑', roles: ['direction', 'comptable', 'coordinateur', 'technicien'] },
  { r: 'stock', court: 'Stock',           label: 'Stock',           ico: '📦', roles: ['direction', 'coordinateur', 'achats', 'magasinier'] },
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
  soumis: ['warn', '⏳ À valider'],
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

// ─── Envoi d'un rapport (même chemin en ligne et depuis la boîte d'envoi) ───
async function envoyerRapport(rapport, photos, progression = () => {}) {
  const { error } = await sb.from('rapports').insert(rapport);
  if (error && !/duplicate key|rapports_pkey|23505/.test(`${error.message} ${error.code}`)) throw error;
  let echecs = 0;
  const deja = photos.length ? ((await sb.from('rapport_photos').select('chemin').eq('rapport_id', rapport.id)).data || []).map((x) => x.chemin) : [];
  for (let i = 0; i < photos.length; i++) {
    progression(i + 1, photos.length);
    const chemin = `${S.entreprise.id}/${rapport.id}/photo-${i + 1}.jpg`;
    if (deja.includes(chemin)) continue;
    const { error: e1 } = await sb.storage.from('photos-chantier').upload(chemin, photos[i], { contentType: 'image/jpeg', upsert: false });
    if (e1 && !/exists|Duplicate/i.test(e1.message)) { if (estErreurReseau(e1)) throw e1; echecs++; continue; }
    const { error: e2 } = await sb.from('rapport_photos').insert({ rapport_id: rapport.id, chemin });
    if (e2) { if (estErreurReseau(e2)) throw e2; echecs++; }
  }
  return { echecs };
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
          const { echecs } = await envoyerRapport(envoi.rapport, envoi.photos || []);
          if (echecs) toast(`Rapport envoyé, mais ${echecs} photo(s) n’ont pas pu être envoyées.`, 'warn', 6000);
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
      <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
      <div class="sep"></div>
      <div class="company">${esc(S.entreprise?.nom)}</div>
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
  ['terrain', 'Terrain', ['nouveau-rapport', 'pointage', 'securite', 'materiel']],
  ['argent', 'Argent', ['compta', 'ventes', 'contrats', 'salaires', 'achats']],
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
    { r: 'projets', ic: 'projets', t: 'Nouveau projet', s: 'Créer un chantier', attr: 'data-nouveau-projet', ok: can('direction', 'coordinateur') },
    { r: 'compta', ic: 'compta', t: 'Facture', s: 'Scanner ou saisir', attr: 'data-nouvelle-facture' },
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
  const [salut, emoji] = h < 12 ? ['Bonjour', '☀️'] : h < 18 ? ['Bon après-midi', '🌤️'] : ['Bonsoir', '🌙'];
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
      ${jaugeVal != null ? `<div class="cockpit-jauge">${jauge(jaugeVal, jaugeLib, prevu)}</div>` : ''}
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
  dashboard: ['Voici votre cockpit du jour ! La jauge montre l’avancement moyen de vos chantiers.', 'Le bouton doré ＋ en bas permet de tout créer en un geste.', 'Touchez une pastille du cockpit pour aller droit au problème.', 'Appuyez longtemps sur moi et dites « ouvre la compta » ou « appelle Koffi » 🎤'],
  projets: ['Touchez un chantier pour voir son planning, ses photos et son budget.', 'Une photo de couverture rend vos chantiers bien plus faciles à reconnaître 📸'],
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
  el.innerHTML = `<div class="koko-bulle hidden" role="status" aria-live="polite"><span class="koko-texte"></span><div class="koko-outils">${Reconnaissance ? '<button type="button" class="koko-micro" aria-label="Parler à Koko">🎤 Me parler</button>' : ''}<button type="button" class="koko-voix" aria-label="Voix de Koko">🔊</button><button type="button" class="koko-masquer" aria-label="Masquer Koko">Masquer</button></div></div>
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
  majBoutonsKoko();
  // Il se pousse quand on fait défiler la page
  document.addEventListener('scroll', () => {
    if (!KOKO.el) return;
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
  if (forcer || !KOKO.vus.has(page)) {
    KOKO.vus.add(page);
    if (KOKO.vus.size > 1 || forcer) {
      const c = KOKO_CONSEILS[page];
      if (c) setTimeout(() => kokoDire(c[0], 4500), 450);
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

function kokoParler(texte) {
  if (!('speechSynthesis' in window) || !kokoVoixActive() || !KOKO.el) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const propre = String(texte).replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/«|»/g, '').replace(/\s+/g, ' ').trim();
  if (!propre) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(propre);
    u.lang = 'fr-FR'; if (voixKoko) u.voice = voixKoko;
    u.rate = 1.04; u.pitch = 1.3; u.volume = 1;
    u.onstart = () => KOKO.el?.classList.add('parle');
    u.onend = u.onerror = () => KOKO.el?.classList.remove('parle');
    window.speechSynthesis.speak(u);
  } catch { /* rien */ }
}
function kokoBasculerVoix() {
  const on = !kokoVoixActive();
  try { localStorage.setItem('koordin-koko-voix', on ? 'on' : 'off'); } catch { /* rien */ }
  if (!on) window.speechSynthesis?.cancel();
  majBoutonsKoko();
  kokoDire(on ? 'Ma voix est activée 🔊' : 'D’accord, je me tais 🤐', 2500);
}
function majBoutonsKoko() {
  const b = $('.koko-voix', KOKO.el || document);
  if (b) { b.textContent = kokoVoixActive() ? '🔊' : '🔇'; b.setAttribute('aria-label', kokoVoixActive() ? 'Couper la voix de Koko' : 'Activer la voix de Koko'); }
}

const sansAccents = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const KOKO_ROUTES = [
  [/nouveau rapport|faire (mon|un) rapport|rapport du jour|ecrire un rapport/, 'nouveau-rapport'],
  [/valider|rapports?/, 'rapports'],
  [/compta|comptabilite|factures? fournisseur|depense/, 'compta'],
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
];

async function kokoComprendre(phrase) {
  const t = sansAccents(phrase);
  const visibles = new Set(menuVisible().map((m) => m.r));
  const repondre = (txt) => kokoDire(txt, 5500);
  if (/^(bonjour|salut|bonsoir|coucou|hello)/.test(t)) return repondre(`Bonjour ${String(S.profil.nom).split(' ')[0]} ! Que puis-je faire pour vous ?`);
  if (/merci/.test(t)) return repondre('Avec plaisir ! 😊');
  if (/quelle heure|l heure/.test(t)) return repondre(`Il est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
  if (/aide|que sais.tu|tu sais faire|comment ca marche/.test(t)) return repondre('Dites par exemple : « ouvre la compta », « nouveau rapport », « appelle Koffi », « combien de rapports à valider ».');
  // Appeler quelqu'un
  const appel = /(appelle|appeler|telephone a|lance un appel avec|visio avec)\s+(.+)/.exec(t);
  if (appel) {
    const nom = appel[2].replace(/^(le |la |l |monsieur |madame |m )/, '').trim();
    const qui = (S.equipe || []).filter((x) => x.actif && x.id !== S.profil.id).find((x) => sansAccents(x.nom).split(/\s+/).some((m) => m.length > 1 && nom.split(/\s+/).includes(m)) || sansAccents(x.nom).includes(nom));
    if (qui) { repondre(`J’appelle ${qui.nom} 📹`); setTimeout(() => lancerAppel({ mode: role() === 'technicien' || qui.role === 'technicien' ? 'chantier' : 'reunion', invites: [qui.id] }), 900); return; }
    repondre(`Je ne trouve pas « ${nom} » dans votre équipe.`); return;
  }
  if (/combien/.test(t) && /rapport/.test(t) && !DEMO) {
    try {
      const p = await q(sb.from('v_projets').select('rapports_en_attente'));
      const n = p.reduce((s, x) => s + num(x.rapports_en_attente), 0);
      return repondre(n ? `Vous avez ${n} rapport${n > 1 ? 's' : ''} à valider.` : 'Aucun rapport en attente. Tout est à jour ✅');
    } catch { return repondre('Je n’arrive pas à compter les rapports pour le moment.'); }
  }
  if (/combien/.test(t) && /chantier|projet/.test(t) && !DEMO) {
    try { const p = await q(sb.from('projets').select('id').neq('statut', 'termine')); return repondre(`Vous avez ${p.length} chantier${p.length > 1 ? 's' : ''} en cours.`); } catch { /* rien */ }
  }
  for (const [motif, r] of KOKO_ROUTES) {
    if (motif.test(t) && (visibles.has(r) || (r === 'nouveau-rapport' && can(...ROLES_RAPPORT)))) {
      const nom = menuVisible().find((m) => m.r === r)?.label || 'Nouveau rapport';
      repondre(`J’ouvre ${nom} 👍`);
      setTimeout(() => allerA(`#/${r}`), 700);
      return;
    }
  }
  repondre(`Je n’ai pas compris « ${phrase} ». Dites par exemple « ouvre la compta » ou « appelle Koffi ».`);
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

// ═══════════════════════════════ TABLEAUX DE BORD ═══════════════════════════════

PAGES.dashboard = async () => {
  const tableaux = { technicien: dashTechnicien, achats: dashAchats, comptable: dashComptable, magasinier: dashMagasinier };
  await (tableaux[role()] || dashDirection)();
  await encartRapportsDuJour();
  await encartVersementsAConfirmer().catch(() => {});
  placerAnnonce($('#zone-annonce'));
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
    q(sb.from('mouvements_stock').select('*, articles(nom, unite), projets(nom)').order('created_at', { ascending: false }).limit(10)),
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
    paragraphe(message, { taille: 10.5 });
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
    paragraphe(r.travaux, { retrait: 0 });
    y += 2;
  });

  const incidents = d.rapports.filter((r) => r.incidents?.trim());
  titre('Points d’attention');
  if (!incidents.length) paragraphe('Aucun incident signalé sur cette période.', { couleur: GRIS });
  incidents.forEach((r) => { paragraphe(`${jourLong(r.date_rapport)} : ${r.incidents}`); y += 1.5; });

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
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" id="rc-creer">📄 Créer le rapport</button></div>`,
  });
  const btn = $('#rc-creer', m.el);
  const zone = $('.rc-resultat', m.el);
  let lienPDF = null;
  m.el.addEventListener('click', (e) => { if ((e.target === m.el || e.target.closest('[data-close]')) && lienPDF) URL.revokeObjectURL(lienPDF); });
  btn.onclick = async () => {
    const d = lireFormulaire($('#f-rc', m.el));
    const { du, au } = periodeRapport(d.periode);
    btn.disabled = true; btn.textContent = 'Préparation…';
    try {
      const donnees = await donneesRapportClient(projet, { du, au, valides: !!d.valides });
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
      btn.textContent = '↻ Refaire le rapport';
      btn.classList.remove('primary');
    } catch (err) {
      console.error(err);
      toast(messageErreur(err), 'err', 6000);
      btn.textContent = '📄 Créer le rapport';
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

  zone.innerHTML = `
    <div class="suivi-entete">
      <div class="brand"><div class="hex"></div><div><div class="suivi-ent">${esc(d.entreprise)}</div><div class="suivi-sous">Suivi de votre chantier</div></div></div>
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
    ...(can('direction', 'coordinateur', 'technicien') && !DEMO ? [['reception', '🤝 Réception']] : []),
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
      ${can('direction', 'coordinateur') ? '<button class="btn" id="rc-p">📄 Rapport client</button>' : ''}
      ${can('direction', 'coordinateur') && !DEMO ? '<button class="btn" id="ac-p">👁️ Accès client</button>' : ''}
      ${can('direction', 'coordinateur') ? '<button class="btn" id="edit-p">✏️ Modifier</button>' : ''}
      ${can('direction') ? '<button class="btn danger" id="del-p">Supprimer</button>' : ''}
    </div>
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletProjet ? 'active' : ''}" data-onglet="${k}">${l}</button>`).join('')}</div>
    <div id="onglet"></div>`);

  $('#edit-p', p)?.addEventListener('click', () => formulaireProjet(projet));
  $('#rc-p', p)?.addEventListener('click', () => rapportClient(projet));
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
  const ONGLETS = { apercu: ongletApercu, lots: ongletLots, planning: ongletPlanning, rapports: ongletRapports, equipe: ongletEquipe, achats: ongletAchatsProjet, communiques: ongletCommuniques, galerie: ongletGalerie, reception: ongletReception };
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
        <select class="input" id="f-s"><option value="">Tous les statuts</option>${Object.entries(STATUT_RAPPORT).map(([k, [, l]]) => `<option value="${k}" ${!tech && k === 'soumis' ? 'selected' : ''}>${l}</option>`).join('')}</select>
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
  if (statut) req = req.eq('statut', statut);
  const rapports = await q(req);
  zone.innerHTML = (!sansFiltre ? `<div class="card-title">Rapports du projet <a class="btn sm primary" href="#/nouveau-rapport">➕ Nouveau rapport</a></div>` : '')
    + (rapports.length ? rapports.map((r) => `
    <div class="report card" data-rapport="${r.id}">
      <div class="avatar">${esc(initiales(r.auteur?.nom))}</div>
      <div class="r-body">
        <div class="r-title">${esc(r.projets?.nom)}${r.lots?.nom ? ` · ${esc(r.lots.nom)}` : ''} ${badge(STATUT_RAPPORT[r.statut])} ${r.incidents ? badge(['crit', '⚠️ Incident']) : ''}</div>
        <div class="r-meta">${fdate(r.date_rapport)} · ${esc(r.auteur?.nom)} · ${r.effectif ?? '—'} pers. · ${esc(r.meteo || '')}${r.avancement != null ? ` · ${r.avancement} %` : ''}${r.rapport_photos?.length ? ` · 📷 ${r.rapport_photos.length}` : ''}</div>
        <div class="r-text">${esc(r.travaux)}</div>
      </div>
    </div>`).join('') : empty('📋', 'Aucun rapport pour ces critères'));
}

async function detailRapport(id) {
  const m = ouvrirModale({ titre: 'Rapport de chantier', large: true, corps: loading() });
  try {
    const r = await q(sb.from('rapports')
      .select('*, projets(nom), lots(nom, avancement), auteur:profils!rapports_auteur_id_fkey(nom, email, telephone), validateur:profils!rapports_valide_par_fkey(nom), rapport_photos(chemin)')
      .eq('id', id).single());
    let urls = [];
    if (r.rapport_photos?.length) {
      const { data } = await sb.storage.from('photos-chantier').createSignedUrls(r.rapport_photos.map((x) => x.chemin), 3600);
      urls = (data || []).map((x) => x.signedUrl).filter(Boolean);
    }
    const valider = can('direction', 'coordinateur') && r.statut === 'soumis';
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
      ${r.statut !== 'soumis' ? `<div class="notice ${r.statut === 'rejete' ? 'warn' : ''}">${r.statut === 'valide' ? 'Validé' : 'Rejeté'} par ${esc(r.validateur?.nom || '—')} ${r.valide_at ? ago(r.valide_at) : ''}${r.commentaire_validation ? ` — « ${esc(r.commentaire_validation)} »` : ''}</div>` : ''}
      ${valider ? `<div class="card" style="background:var(--surface-2)">
        <label class="field">Commentaire (facultatif, obligatoire pour un rejet)<textarea id="com-val" placeholder="Ex. Merci, bon travail / Préciser les quantités…"></textarea></label>
        ${r.lot_id && r.avancement != null ? `<p class="muted mt" style="font-size:12px">En validant, l’avancement du lot « ${esc(r.lots?.nom)} » passera de ${r.lots?.avancement} % à <b>${r.avancement} %</b>.</p>` : ''}
        <div class="form-actions"><button class="btn danger" id="rej">↩️ Rejeter</button><button class="btn primary" id="val">✅ Valider le rapport</button></div></div>` : ''}`;
    const decider = async (statut) => {
      const com = $('#com-val', m.el).value.trim();
      if (statut === 'rejete' && !com) return toast('Indiquez le motif du rejet.', 'warn');
      try {
        await q(sb.from('rapports').update({ statut, commentaire_validation: com || null }).eq('id', r.id));
        m.fermer();
        naviguer();
        if (r.auteur_id !== S.profil.id) proposerWhatsAppRapport(r, statut, com);
        else toast(statut === 'valide' ? 'Rapport validé.' : 'Rapport rejeté.');
      } catch (e) { toast(messageErreur(e), 'err'); }
    };
    $('#val', m.el)?.addEventListener('click', () => decider('valide'));
    $('#rej', m.el)?.addEventListener('click', () => decider('rejete'));
  } catch (e) {
    $('.modal-body', m.el).innerHTML = empty('⚠️', messageErreur(e));
  }
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
    ? `Bonjour ${prenom}, votre rapport du ${quand} sur « ${r.projets?.nom} » a été validé ✅.${commentaire ? ` Commentaire : ${commentaire}` : ''}\n${S.profil.nom} (KOORDIN)`
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
  try {
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return await new Promise((res) => c.toBlob((b) => res(b || fichier), 'image/jpeg', qualite));
  } catch {
    return fichier;
  }
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
        <div class="field full">Photos du chantier
          <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn">📷 Prendre une photo<input type="file" class="choix-photos" accept="image/*" capture="environment" hidden></label>
            <label class="btn">🖼️ Choisir dans la galerie<input type="file" class="choix-photos" accept="image/*" multiple hidden></label></div>
          <span class="hint">Les photos sont compressées automatiquement pour économiser vos données mobiles.</span>
          <div class="photos mt" id="apercu-photos"></div></div>
      </div>
      <div class="form-actions"><button type="button" class="btn ghost" id="effacer">Effacer le brouillon</button><button class="btn primary" type="submit" id="envoyer">📤 Envoyer le rapport</button></div>
    </form>`);
  const form = $('#f-rap', p);
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

  const rendrePhotos = () => {
    $('#apercu-photos', p).innerHTML = photos.map((ph, i) => `<div class="photo-pick"><img src="${ph.url}" alt="Photo ${i + 1}"><button type="button" data-suppr="${i}" aria-label="Retirer">×</button></div>`).join('');
    $$('[data-suppr]', p).forEach((b) => (b.onclick = () => { URL.revokeObjectURL(photos[b.dataset.suppr].url); photos.splice(Number(b.dataset.suppr), 1); rendrePhotos(); }));
  };
  const ajouterPhotos = async (e) => {
    const fichiers = [...e.target.files].slice(0, 12 - photos.length);
    for (const f of fichiers) {
      const blob = await compresserImage(f);
      photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    e.target.value = '';
    rendrePhotos();
  };
  $$('.choix-photos', p).forEach((inp) => (inp.onchange = ajouterPhotos));
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
      travaux: d.travaux, incidents: d.incidents, besoins: d.besoins,
      avancement: d.lot_id ? Math.round(num(av.value)) : null,
    };
    const blobs = photos.map((ph) => ph.blob);
    const garderSurTelephone = async () => {
      await ajouterEnvoi({ type: 'rapport', rapport, photos: blobs, libelle: projets.find((x) => x.id === d.projet_id)?.nom || '' });
      try { localStorage.removeItem(cle); } catch { /* rien */ }
      toast('📶 Pas de réseau : rapport enregistré sur le téléphone. Il partira tout seul dès que le réseau revient ✅', 'warn', 7000);
      majIndicateurReseau();
      allerA('#/rapports');
    };
    try {
      if (!navigator.onLine) { await garderSurTelephone(); return; }
      const { echecs } = await envoyerRapport(rapport, blobs, (i, n) => { btn.textContent = `Envoi des photos ${i}/${n}…`; });
      try { localStorage.removeItem(cle); } catch { /* rien */ }
      toast(echecs ? `Rapport envoyé, mais ${echecs} photo(s) n’ont pas pu être envoyées.` : 'Rapport envoyé ✅ La coordination est prévenue.', echecs ? 'warn' : 'ok');
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
        ${ajouter ? '<label class="btn primary">📷 Ajouter des photos<input type="file" id="g-ajout" accept="image/*" multiple hidden></label>' : ''}
      </div>
      ${liste.length ? [...mois].map(([m, idx]) => `<section class="galerie-mois"><h4>${esc(m.charAt(0).toUpperCase() + m.slice(1))} <span class="muted">· ${idx.length} photo${idx.length > 1 ? 's' : ''}</span></h4>
        <div class="galerie">${idx.map((i) => `<button type="button" class="galerie-vignette" data-i="${i}" aria-label="Agrandir la photo du ${fdate(liste[i].date_photo)}">
          <img src="${esc(url(liste[i].chemin))}" alt="" loading="lazy">${liste[i].source === 'rapport' ? '<span class="galerie-tag">📋</span>' : ''}</button>`).join('')}</div></section>`).join('')
      : `<div class="card">${empty('📷', photos.length ? 'Aucune photo dans ce filtre.' : 'Aucune photo pour ce chantier. Les photos ajoutées ici et celles des rapports du terrain s’afficheront dans la galerie.')}</div>`}`;
    $$('[data-filtre]', zone).forEach((b) => (b.onclick = () => { filtre = b.dataset.filtre; rendre(); }));
    $$('[data-i]', zone).forEach((b) => (b.onclick = () => visionneuse(liste, Number(b.dataset.i))));
    $('#g-ajout', zone)?.addEventListener('change', (e) => envoyerGalerie([...e.target.files]));
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
        ${compact ? '' : `<td>${esc(f.projets?.nom || '')}<div class="muted" style="font-size:12px">${esc(f.lots?.nom || '')}</div></td><td>${esc(f.fournisseurs?.nom || '—')}</td>`}
        <td class="num">${money(f.montant)}</td>
        <td class="nowrap">${f.date_echeance ? `${fdate(f.date_echeance)}${echue ? ' <span class="badge crit">⏰ Échue</span>' : ''}` : '—'}</td>
        <td>${badge(STATUT_FACTURE[f.statut])}</td>
        ${gerer ? `<td class="right nowrap">${f.statut === 'a_payer' ? `<button class="btn sm" data-payer="${f.id}">💳 Payée</button>` : ''}<button class="btn sm" data-edit-fac="${f.id}">Modifier</button></td>` : ''}</tr>`;
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

PAGES.compta = async () => {
  const [factures, projets] = await Promise.all([
    q(sb.from('factures').select('*, projets(nom), fournisseurs(nom), lots(nom)').order('date_facture', { ascending: false }).limit(1000)),
    q(sb.from('v_projets').select('id, nom, budget, engage, facture, paye, statut').order('nom')),
  ]);
  const total = factures.reduce((s, f) => s + num(f.montant), 0);
  const paye = factures.filter((f) => f.statut === 'payee').reduce((s, f) => s + num(f.montant), 0);
  const echues = factures.filter((f) => f.statut === 'a_payer' && f.date_echeance && f.date_echeance < todayISO());
  const p = page(`
    ${entete('Comptabilité', 'Factures, dépenses et situation financière', `<button class="btn" id="csv">📊 Export Excel</button>${can('direction', 'comptable') ? `${DEMO ? '' : '<label class="btn">📷 Scanner des factures<input type="file" id="scan-f" accept="image/*,application/pdf" multiple hidden></label>'}<button class="btn primary" id="nfa">＋ Saisir une facture</button>` : ''}`)}
    <div class="grid k4">
      ${kpi('Total facturé', moneyShort(total))}
      ${kpi('Payé', moneyShort(paye), `${pct(paye, total)} %`)}
      ${kpi('Reste à payer', moneyShort(total - paye), '', total - paye > 0 ? 'warn' : '')}
      ${kpi('Échéances dépassées', echues.length, echues.length ? moneyShort(echues.reduce((s, f) => s + num(f.montant), 0)) : '✅ Aucune', echues.length ? 'alert' : '')}
    </div>
    <div class="tabs section"><button class="tab ${ongletCompta === 'factures' ? 'active' : ''}" data-o="factures">Factures et dépenses</button><button class="tab ${ongletCompta === 'budget' ? 'active' : ''}" data-o="budget">Budget et réalisé</button></div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  let fp = '', fs = '', fc = '';
  const filtrees = () => factures.filter((f) => (!fp || f.projet_id === fp) && (!fs || f.statut === fs || (fs === 'echue' && echues.includes(f))) && (!fc || f.categorie === fc));
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
        <select class="input" id="fs"><option value="">Tous les statuts</option><option value="a_payer" ${fs === 'a_payer' ? 'selected' : ''}>⏳ À payer</option><option value="echue" ${fs === 'echue' ? 'selected' : ''}>⏰ Échues</option><option value="payee" ${fs === 'payee' ? 'selected' : ''}>✅ Payées</option></select>
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

async function enteteDocumentPDF(doc, titre, sousTitre, droite) {
  const L = 210, M = 16;
  doc.setFillColor(17, 21, 33); doc.rect(0, 0, L, 34, 'F');
  doc.setFillColor(232, 160, 32); doc.rect(0, 34, L, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(255, 255, 255);
  doc.text(textePDF(S.entreprise?.nom || ''), M, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(200, 205, 220);
  doc.text(textePDF(S.entreprise?.pays || ''), M, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(232, 160, 32);
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
    doc.setFont('helvetica', 'bold'); doc.setTextColor(232, 160, 32); doc.text('Document généré avec KOORDIN', 194, 289, { align: 'right' });
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
const libelleVersement = (v) => `${TYPE_VERSEMENT[v.type] || 'Versement'} de ${libellePeriode(v.periode)}`;
const erreurVersement = (e) => {
  const m = String(e?.message || '');
  if (/^VERSEMENT_/.test(m) && e?.hint) return e.hint;
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
      <div class="rc-boutons mt">
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
  $('#fv-pdf', m.el)?.addEventListener('click', () => pdfAccuseVersement(v, pr));
  $('#fv-suppr', m.el)?.addEventListener('click', async () => {
    if (!(await confirmer('Supprimer ce versement ?', 'Supprimer'))) return;
    try { await q(sb.from('versements').delete().eq('id', v.id)); toast('Versement supprimé.'); m.fermer(); rendre(); } catch (e) { toast(erreurVersement(e), 'err'); }
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
    ${entete('Appels et réunions', 'Voir un chantier en direct et se réunir en vidéo')}
    <div class="appel-actions">
      <button type="button" class="appel-gros" id="ap-chantier"><span class="appel-gros-ic">📹</span><b>${role() === 'technicien' ? 'Montrer le chantier en direct' : 'Voir un chantier en direct'}</b><small>${role() === 'technicien' ? 'Vous filmez, la direction voit et vous parle' : 'Le technicien filme, vous voyez et vous parlez'}</small></button>
      <button type="button" class="appel-gros" id="ap-reunion"><span class="appel-gros-ic">👥</span><b>Démarrer une réunion</b><small>Vidéo avec plusieurs personnes de l’équipe</small></button>
    </div>
    <div id="ap-encours"></div>
    <div class="card"><div class="card-title">Appeler directement</div><div id="ap-equipe" class="paie-liste"></div></div>
    <div class="card"><div class="card-title">Historique des appels</div><div id="ap-histo" class="paie-liste"></div></div>`);
  if (DEMO) { $('#ap-histo', p).innerHTML = empty('📹', 'Les appels vidéo fonctionnent dans la version installée de KOORDIN.'); return; }
  await chargerEquipe();
  const membres = (S.equipe || []).filter((x) => x.actif && x.id !== S.profil.id);
  $('#ap-equipe', p).innerHTML = membres.length ? membres.map((x) => `<div class="paie-ligne"><div class="paie-nom"><b>${esc(x.nom)}</b><span>${esc(ROLES[x.role]?.label || x.role)}</span></div>
      <button type="button" class="btn sm primary" data-appeler="${x.id}">📹 Appeler</button></div>`).join('') : empty('👥', 'Invitez d’abord des membres dans « Équipe ».');
  $$('[data-appeler]', p).forEach((b) => (b.onclick = () => {
    const x = membres.find((m) => m.id === b.dataset.appeler);
    lancerAppel({ mode: role() === 'technicien' || x.role === 'technicien' ? 'chantier' : 'reunion', invites: [x.id] });
  }));
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
      return `<div class="paie-ligne"><div class="paie-nom"><b>${a.mode === 'chantier' ? '📹' : '👥'} ${esc(titreAppel(a))}</b><span>${moi ? 'Vous avez appelé' : `Appel de ${esc(nomAppel(a.cree_par))}`} · ${new Date(a.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${a.projets?.nom ? ` · ${esc(a.projets.nom)}` : ''}</span></div><div class="paie-montant">${badge(st)}</div></div>`;
    }).join('') : empty('📹', 'Aucun appel pour le moment. Appelez un technicien pour voir son chantier en direct.');
  } catch (e) { $('#ap-histo', p).innerHTML = empty('📹', erreurAppel(e)); }
  if (id) rejoindreParLien(id);
};

function titreAppel(a) {
  if (a.titre) return a.titre;
  const autres = [a.cree_par, ...a.invites].filter((x) => x !== S.profil.id).map(nomAppel);
  return `${a.mode === 'chantier' ? 'Chantier en direct' : 'Réunion'} avec ${autres.slice(0, 3).join(', ')}${autres.length > 3 ? '…' : ''}`;
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

async function dialogueReunion(membres) {
  const projets = await q(sb.from('projets').select('id, nom').neq('statut', 'termine').order('nom'));
  ouvrirModale({
    titre: '👥 Nouvelle réunion vidéo',
    boutonOk: '📹 Démarrer',
    corps: `<div class="form-grid">
        ${F.text('titre', 'Sujet de la réunion', '', { full: true, placeholder: 'Ex. Point hebdomadaire Villa Cocody' })}
        ${F.select('projet_id', 'Chantier (facultatif)', [['', '— Aucun —'], ...projets.map((x) => [x.id, x.nom])], '', { full: true })}
      </div>
      <div class="field full" style="margin-top:6px">Participants (7 au maximum)</div>
      <div class="reunion-membres">${membres.map((x) => `<label class="reunion-membre"><input type="checkbox" name="m_${x.id}"><span><b>${esc(x.nom)}</b><small>${esc(ROLES[x.role]?.label || x.role)}</small></span></label>`).join('')}</div>`,
    onSubmit: async (d) => {
      const invites = Object.keys(d).filter((k) => k.startsWith('m_') && d[k]).map((k) => k.slice(2));
      if (!invites.length) { toast('Cochez au moins une personne.', 'warn'); return false; }
      if (invites.length > 7) { toast('7 participants au maximum (8 avec vous).', 'warn'); return false; }
      await lancerAppel({ mode: 'reunion', invites, projet_id: d.projet_id || null, titre: d.titre || null });
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
    if (await confirmer(`Rejoindre « ${titreAppel(a)} » ? La caméra et le micro vont s’activer.`, '📹 Rejoindre')) ouvrirEcranAppel(a);
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
    if (a.statut === 'termine') toast(`📹 Appel manqué de ${nomAppel(a.cree_par)}.`, 'warn', 8000);
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
    <span>${a.mode === 'chantier' ? (role() === 'technicien' ? '📹 veut voir le chantier en direct' : '📹 veut vous montrer le chantier') : '👥 vous invite à une réunion vidéo'}${a.titre ? `<br>« ${esc(a.titre)} »` : ''}</span>
    <div class="sonnerie-boutons">
      <button type="button" class="rond rouge" id="so-non" aria-label="Refuser">✕</button>
      <button type="button" class="rond vert" id="so-oui" aria-label="Répondre">📹</button>
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
  const fin = setTimeout(() => { arreterSonnerie(); toast(`📹 Appel manqué de ${qui}.`, 'warn', 8000); }, 45000);
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
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { toast('Ce navigateur ne permet pas les appels vidéo. Utilisez Chrome à jour.', 'err', 7000); return; }
  APPEL.courant = { id: a.id, appel: a, terminer: () => {} };
  const createur = a.cree_par === S.profil.id;
  let face = a.mode === 'chantier' && role() === 'technicien' ? 'environment' : 'user';
  const contraintes = (f) => ({ facingMode: f, width: { ideal: f === 'environment' ? 1280 : 640 }, height: { ideal: f === 'environment' ? 720 : 480 }, frameRate: { ideal: 24, max: 30 } });
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: contraintes(face) });
  } catch (e) {
    try { flux = await navigator.mediaDevices.getUserMedia({ audio: true }); toast('Caméra indisponible : vous êtes en audio seulement.', 'warn', 6000); }
    catch (e2) { APPEL.courant = null; toast(erreurAppel(e2), 'err', 9000); return; }
  }
  try { await q(sb.rpc('repondre_appel', { p_appel: a.id, p_reponse: 'rejoint' })); }
  catch (e) { flux.getTracks().forEach((t) => t.stop()); APPEL.courant = null; toast(erreurAppel(e), 'err', 7000); return; }

  const peutPhoto = a.projet_id && can('direction', 'coordinateur', 'technicien');
  const autres = [a.cree_par, ...a.invites].filter((x) => x !== S.profil.id);
  const el = document.createElement('div');
  el.className = 'appel-ecran';
  el.innerHTML = `
    <div class="ap-haut"><div class="ap-titre"><b>${esc(titreAppel(a))}</b><span><i class="ap-point"></i><span id="ap-chrono">00:00</span> · <span id="ap-nb">1 personne</span>${a.projets?.nom ? ` · ${esc(a.projets.nom)}` : ''}</span></div>
      <button type="button" class="ap-mini" id="ap-relancer" title="Relancer par WhatsApp">📲</button></div>
    <div class="ap-grille" id="ap-grille" data-n="0"><div class="ap-attente" id="ap-attente"><div class="sonnerie-onde"><div class="sonnerie-avatar">${esc(initiales(nomAppel(autres[0])))}</div></div><b>${createur ? `Appel de ${esc(autres.map(nomAppel).slice(0, 3).join(', '))}…` : 'Connexion…'}</b><span>${createur ? 'Ça sonne chez eux. S’ils ne voient pas l’appel, appuyez sur 📲 pour leur envoyer le lien par WhatsApp.' : 'Connexion à l’appel en cours.'}</span></div></div>
    <video class="ap-moi ${face === 'user' ? 'miroir' : ''}" id="ap-moi" autoplay playsinline muted></video>
    <div class="ap-bas">
      <button type="button" class="ap-btn" id="ap-micro" aria-label="Micro"><span>🎤</span><small>Micro</small></button>
      <button type="button" class="ap-btn" id="ap-cam" aria-label="Caméra"><span>📷</span><small>Caméra</small></button>
      <button type="button" class="ap-btn" id="ap-retourner" aria-label="Changer de caméra"><span>🔄</span><small>Retourner</small></button>
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
        t.innerHTML = '<video autoplay playsinline></video><span class="ap-nom"></span><span class="ap-etat">Connexion…</span>';
        t.onclick = () => { const f = t.classList.toggle('focus'); $$('.ap-tuile', grille).forEach((x) => { if (x !== t) x.classList.toggle('cache', f); }); };
        grille.appendChild(t);
      }
      $('.ap-nom', t).textContent = pair.nom;
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
  $('#ap-cam', el).onclick = (e) => { const t = piste('video'); if (!t) return; t.enabled = !t.enabled; e.currentTarget.classList.toggle('off', !t.enabled); moi.classList.toggle('hidden', !t.enabled); };
  $('#ap-retourner', el).onclick = async (e) => {
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
    const texte = `📹 ${S.profil.nom} vous attend dans un appel vidéo KOORDIN. Appuyez ici pour rejoindre : ${lienAppel(a.id)}`;
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
  const mouv = can('direction', 'magasinier');
  const gerer = can('direction', 'magasinier', 'achats');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="num">Quantité</th><th class="num">Seuil</th><th>État</th>${compact ? '' : '<th class="num">Valeur</th>'}${!compact && (mouv || gerer) ? '<th></th>' : ''}</tr></thead><tbody>
    ${articles.map((a) => `<tr class="${a.alerte ? 'over' : ''}"><td><b>${esc(a.nom)}</b></td>
      <td class="num"><b>${nf.format(num(a.quantite))}</b> ${esc(a.unite)}</td><td class="num muted">${nf.format(num(a.seuil_min))}</td>
      <td>${a.alerte ? badge(['crit', '🚨 À réapprovisionner']) : badge(['ok', '✅ OK'])}</td>
      ${compact ? '' : `<td class="num">${money(num(a.quantite) * num(a.prix_unitaire))}</td>`}
      ${!compact && (mouv || gerer) ? `<td class="right nowrap">${mouv ? `<button class="btn sm" data-mv="entree" data-art="${a.id}">⬇️ Entrée</button><button class="btn sm" data-mv="sortie" data-art="${a.id}">⬆️ Sortie</button>` : ''}
        ${gerer ? `<button class="btn sm" data-ea="${a.id}">Modifier</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function tableauMouvements(mouvements) {
  if (!mouvements.length) return empty('🔄', 'Aucun mouvement');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Article</th><th>Mouvement</th><th>Projet</th><th>Par</th><th>Commentaire</th></tr></thead><tbody>
    ${mouvements.map((m) => `<tr><td class="nowrap">${new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td><b>${esc(m.articles?.nom)}</b></td>
      <td>${m.type === 'entree' ? badge(['ok', `⬇️ +${nf.format(num(m.quantite))} ${m.articles?.unite || ''}`]) : badge(['info', `⬆️ −${nf.format(num(m.quantite))} ${m.articles?.unite || ''}`])}</td>
      <td>${esc(m.projets?.nom || '—')}</td><td>${esc(nomMembre(m.created_by))}</td><td class="muted">${esc(m.commentaire || '')}</td></tr>`).join('')}</tbody></table></div>`;
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

PAGES.stock = async () => {
  const p = page(`
    ${entete('Stock', 'Magasin central : quantités, seuils d’alerte et mouvements',
      `${can('direction', 'magasinier') ? '<button class="btn" id="mv">🔄 Entrée / sortie</button>' : ''}${can('direction', 'magasinier', 'achats') ? '<button class="btn primary" id="na">＋ Nouvel article</button>' : ''}`)}
    <div class="tabs"><button class="tab ${ongletStock === 'articles' ? 'active' : ''}" data-o="articles">Articles</button><button class="tab ${ongletStock === 'mouvements' ? 'active' : ''}" data-o="mouvements">Historique des mouvements</button></div>
    <div id="zone"></div>`);
  const zone = $('#zone', p);
  let articles = [];
  const rendre = async () => {
    zone.innerHTML = loading();
    articles = await q(sb.from('v_stock').select('*').order('nom'));
    if (ongletStock === 'articles') {
      zone.innerHTML = `<div class="card"><div class="toolbar"><input class="input" id="fq" placeholder="🔍 Rechercher un article…"><span class="muted" style="margin-left:auto;font-size:13px">
        Valeur totale : <b>${money(articles.reduce((s, a) => s + num(a.quantite) * num(a.prix_unitaire), 0))}</b> · ${articles.filter((a) => a.alerte).length} alerte(s)</span></div><div id="ta"></div></div>`;
      const filtrer = (txt) => {
        const l = articles.filter((a) => !txt || a.nom.toLowerCase().includes(txt));
        $('#ta', zone).innerHTML = tableauStock(l);
        $$('[data-mv]', zone).forEach((b) => (b.onclick = () => formulaireMouvement(articles, b.dataset.mv, b.dataset.art, rendre)));
        $$('[data-ea]', zone).forEach((b) => (b.onclick = () => formulaireArticle(articles.find((a) => a.id === b.dataset.ea), rendre)));
      };
      $('#fq', zone).oninput = (e) => filtrer(e.target.value.toLowerCase());
      filtrer('');
    } else {
      const mouvements = await q(sb.from('mouvements_stock').select('*, articles(nom, unite), projets(nom)').order('created_at', { ascending: false }).limit(300));
      zone.innerHTML = `<div class="card">${tableauMouvements(mouvements)}</div>`;
    }
  };
  $$('[data-o]', p).forEach((b) => (b.onclick = () => { ongletStock = b.dataset.o; $$('[data-o]', p).forEach((x) => x.classList.toggle('active', x === b)); rendre(); }));
  $('#na', p)?.addEventListener('click', () => formulaireArticle(null, rendre));
  $('#mv', p)?.addEventListener('click', () => formulaireMouvement(articles, 'sortie', null, rendre));
  await rendre();
};

function formulaireArticle(a, refresh) {
  ouvrirModale({
    titre: a ? `Modifier « ${a.nom} »` : 'Nouvel article',
    corps: `<div class="form-grid">
      ${F.text('nom', 'Désignation', a?.nom, { required: true, full: true, placeholder: 'Ex. Ciment CPJ 42.5' })}
      ${F.text('unite', 'Unité', a?.unite || 'sac', { required: true, hint: 'sac, barre, m³, kg, u…' })}
      ${F.text('seuil_min', 'Seuil d’alerte', a?.seuil_min ?? 0, { type: 'number', min: 0, step: 'any', hint: 'Alerte quand le stock passe en dessous' })}
      ${F.text('prix_unitaire', `Prix unitaire (${devise()})`, a?.prix_unitaire ?? 0, { type: 'number', min: 0, step: 'any' })}
      ${!a && can('direction', 'magasinier') ? F.text('stock_initial', 'Stock initial', 0, { type: 'number', min: 0, step: 'any' }) : ''}
    </div>`,
    onSubmit: async (d) => {
      const data = { nom: d.nom, unite: d.unite, seuil_min: num(d.seuil_min), prix_unitaire: num(d.prix_unitaire) };
      if (a) await q(sb.from('articles').update(data).eq('id', a.id));
      else {
        const cree = await q(sb.from('articles').insert(data).select('id').single());
        if (num(d.stock_initial) > 0) await q(sb.from('mouvements_stock').insert({ article_id: cree.id, type: 'entree', quantite: num(d.stock_initial), commentaire: 'Stock initial' }));
      }
      toast('Article enregistré.');
      refresh();
    },
  });
}

async function formulaireMouvement(articles, type, articleId, refresh) {
  if (!articles.length) return toast('Créez d’abord un article.', 'warn');
  const projets = (await listeProjets()).filter((x) => x.statut !== 'termine');
  ouvrirModale({
    titre: 'Mouvement de stock',
    corps: `<div class="form-grid">
      ${F.select('type', 'Type', [['entree', '⬇️ Entrée (livraison, retour chantier)'], ['sortie', '⬆️ Sortie (vers un chantier)']], type, { full: true })}
      ${F.select('article_id', 'Article', articles.map((a) => [a.id, `${a.nom} — ${nf.format(num(a.quantite))} ${a.unite} en stock`]), articleId, { required: true, full: true, vide: '— Choisir —' })}
      ${F.text('quantite', 'Quantité', '', { type: 'number', min: 0.01, step: 'any', required: true, inputmode: 'decimal' })}
      ${F.select('projet_id', 'Chantier', projets.map((x) => [x.id, x.nom]), '', { vide: '— Aucun —' })}
      ${F.text('commentaire', 'Commentaire', '', { full: true, placeholder: 'Ex. BL n° 4512, bon de sortie…' })}
    </div>`,
    onSubmit: async (d) => {
      if (num(d.quantite) <= 0) throw new Error('La quantité doit être positive.');
      if (d.type === 'sortie' && !d.projet_id) throw new Error('Indiquez le chantier destinataire de la sortie.');
      await q(sb.from('mouvements_stock').insert({ article_id: d.article_id, type: d.type, quantite: num(d.quantite), projet_id: d.projet_id, commentaire: d.commentaire }));
      toast(d.type === 'entree' ? 'Entrée enregistrée.' : 'Sortie enregistrée.');
      refresh();
    },
  });
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
    <div class="card section"><div class="card-title">Installer KOORDIN sur un téléphone</div>
      <p style="font-size:13px;line-height:1.8">• <b>Android (Chrome)</b> : ouvrez l’adresse de l’application → menu ⋮ → « Ajouter à l’écran d’accueil ».<br>
      • <b>iPhone (Safari)</b> : ouvrez l’adresse → bouton Partager → « Sur l’écran d’accueil ».<br>
      Adresse à partager avec votre équipe : <b>${esc(location.origin + location.pathname)}</b></p></div>`);
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
});

demarrer();
