/* ═══════════════════════════════════════════════════════════════════
   KOORDIN — application web (PWA)
   Une seule page, connectée à Supabase. Chaque rôle voit ses écrans ;
   la base de données applique les habilitations (voir supabase/schema.sql).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const CFG = window.KOORDIN_CONFIG || {};
// Version de l'application : à augmenter en même temps que version.json à chaque mise à jour publiée.
const VERSION = '1.5';
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
  { r: 'nouveau-rapport', court: 'Rapport', label: 'Nouveau rapport', ico: '➕', roles: ['technicien'] },
  { r: 'rapports', court: 'Rapports',        label: 'Rapports',        ico: '📋', roles: ROLES_RAPPORT, labelTech: 'Mes rapports' },
  { r: 'achats', court: 'Achats',          label: 'Achats',          ico: '🛒', roles: ['direction', 'coordinateur', 'achats', 'comptable', 'magasinier'] },
  { r: 'compta', court: 'Compta',          label: 'Comptabilité',    ico: '💰', roles: ['direction', 'comptable'] },
  { r: 'stock', court: 'Stock',           label: 'Stock',           ico: '📦', roles: ['direction', 'coordinateur', 'achats', 'magasinier'] },
  { r: 'equipe', court: 'Équipe',          label: 'Équipe',          ico: '👥', roles: ['direction'] },
  { r: 'ia', court: 'IA',              label: 'Assistant IA',    ico: '🧠', roles: ROLES_IA },
  { r: 'abonnement', court: 'Abonnement', label: 'Abonnement', ico: '💳', roles: ['direction'], licence: true },
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
  if (/row-level security|permission denied|42501/i.test(m)) return 'Vous n’avez pas l’autorisation pour cette action.';
  if (/factures_numero_unique|duplicate key/i.test(m)) return 'Ce numéro existe déjà pour ce fournisseur (doublon possible).';
  if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Confirmez d’abord votre adresse email (lien reçu par mail).';
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet email. Connectez-vous.';
  if (/Password should be/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives. Patientez quelques minutes.';
  return m || 'Une erreur est survenue.';
}

function toast(msg, type = 'ok', duree = 4200) {
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
  S.equipe = await q(sb.from('profils').select('id, nom, email, role, actif, telephone').order('nom'));
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
  const { data: { session } } = await sb.auth.getSession();
  if (location.hash.includes('type=recovery')) return;
  if (!session) return ecranConnexion();
  await ouvrirApplication(session);
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
      <button class="btn primary block" type="submit">Créer mon espace KOORDIN</button>
      <p class="muted" style="font-size:12px">Vous serez l’administrateur (rôle Direction) et pourrez inviter votre équipe.</p>`,
    invite: `
      <p class="muted" style="font-size:12px">Utilisez <b>exactement</b> le numéro de téléphone ou l’email indiqué dans votre invitation.</p>
      ${F.text('nom', 'Votre nom complet', '', { required: true, autocomplete: 'name' })}
      ${F.text('email', 'Numéro de téléphone ou email (celui de l’invitation)', '', { required: true, autocomplete: 'username', placeholder: '07 01 02 03 04' })}
      ${F.text('password', 'Choisissez un mot de passe (8 caractères minimum)', '', { type: 'password', required: true, autocomplete: 'new-password' })}
      <button class="btn primary block" type="submit">Rejoindre mon équipe</button>`,
  };
  $('#root').innerHTML = `<div class="auth-wrap auth-split">
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
      const { data, error } = await sb.auth.signUp({
        email: v.email, password: v.password,
        options: { data: meta, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
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
    let profil = await q(sb.from('profils').select('*, entreprises(*)').eq('id', session.user.id).maybeSingle());
    if (!profil) {
      const rejoint = await q(sb.rpc('accepter_invitation'));
      if (rejoint) profil = await q(sb.from('profils').select('*, entreprises(*)').eq('id', session.user.id).maybeSingle());
    }
    if (!profil) return ecranSansEntreprise(session.user.email);
    S.profil = profil;
    S.entreprise = profil.entreprises;
    S.plateformeAdmin = false;
    if (!DEMO) {
      const { data: admin } = await sb.rpc('est_admin_plateforme');
      S.plateformeAdmin = admin === true;
    }
    await chargerEquipe();
    construireInterface();
    ecouterTempsReel();
    if (!DEMO) window.onhashchange = naviguer;
    await naviguer();
    if (!DEMO) suivreMisesAJour();
  } catch (e) {
    console.error(e);
    $('#root').innerHTML = `<div class="auth-wrap"><div class="auth-card"><div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
      <div class="auth-msg err" style="margin:16px 0">${esc(messageErreur(e))}</div>
      <button class="btn primary block" onclick="location.reload()">Réessayer</button></div></div>`;
  }
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

function menuVisible() {
  return MENU.filter((m) => m.roles.includes(role()) && (!m.admin || S.plateformeAdmin) && (!m.licence || !DEMO)).map((m) => ({ ...m, label: role() === 'technicien' && m.labelTech ? m.labelTech : m.label }));
}

function construireInterface() {
  const items = menuVisible();
  const lien = (m) => `<a class="nav-item" href="#/${m.r}" data-nav="${m.r}"><span class="ico">${m.ico}</span><span class="lbl-long">${esc(m.label)}</span><span class="lbl-court">${esc(m.court)}</span></a>`;
  const p = S.profil;
  $('#root').innerHTML = `<div class="app">
    <header class="topbar">
      <div class="brand"><div class="hex"></div><div class="brand-name">KOORDIN</div></div>
      <div class="sep"></div>
      <div class="company">${esc(S.entreprise?.nom)}</div>
      <div class="topbar-right">
        <button class="icon-btn" id="btn-notif" title="Activité et alertes" aria-label="Activité et alertes">🔔<span class="count hidden" id="notif-count"></span></button>
        <button class="user-chip" id="btn-user">
          <div class="avatar">${esc(initiales(p.nom))}</div>
          <div class="who"><b>${esc(p.nom)}</b><span>${ROLES[p.role].ico} ${esc(ROLES[p.role].label)}</span></div>
        </button>
      </div>
    </header>
    <nav class="sidebar">${items.map(lien).join('')}</nav>
    <main class="main" id="main"></main>
    <nav class="bottom-nav">${items.map(lien).join('')}</nav>
  </div>`;
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
  $('#m-out', m).onclick = async () => { fermerPanneaux(); S.canal?.unsubscribe(); await sb.auth.signOut(); };
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
      if (a.type === 'equipe') chargerEquipe();
      if (a.acteur_id !== S.profil.id && a.niveau !== 'info') toast(a.message, a.niveau === 'critique' ? 'err' : 'warn', 7000);
      else if (a.acteur_id !== S.profil.id && a.type === 'rapport') toast(a.message, 'ok');
      majCompteurNotifications();
    })
    .subscribe();
}

const ICONES_ACTIVITE = { projet: '🏗️', rapport: '📋', validation: '✅', commande: '🛒', facture: '🧾', stock: '📦', alerte: '🚨', equipe: '👥' };
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
  fermerPanneaux();
  detruireGraphiques();
  const main = $('#main');
  main.innerHTML = loading();
  main.scrollTop = 0;
  try {
    await PAGES[cible](id);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="page"><div class="card">${empty('⚠️', messageErreur(e))}<div class="right"><button class="btn" onclick="location.reload()">Recharger</button></div></div></div>`;
  }
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
const kpi = (label, valeur, pied = '', cls = '', ico = '') => `<div class="kpi ${cls}">${ico ? `<div class="kpi-ico" aria-hidden="true">${ico}</div>` : ''}<div class="kpi-label">${esc(label)}</div><div class="kpi-value">${valeur}</div>${pied ? `<div class="kpi-foot">${pied}</div>` : ''}</div>`;

function bonjour() {
  const h = new Date().getHours();
  return `${h < 18 ? 'Bonjour' : 'Bonsoir'} ${esc(S.profil.nom.split(' ')[0])}`;
}

// ═══════════════════════════════ TABLEAUX DE BORD ═══════════════════════════════

PAGES.dashboard = async () => {
  const tableaux = { technicien: dashTechnicien, achats: dashAchats, comptable: dashComptable, magasinier: dashMagasinier };
  await (tableaux[role()] || dashDirection)();
  placerAnnonce($('#zone-annonce'));
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
  page(`
    <section class="hero">
      <div class="hero-illu">${sceneChantier(empreinte(S.entreprise.id))}</div>
      <div class="hero-txt">
        <p class="hero-date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(S.entreprise.nom)}</p>
        <h1 class="page-title">${bonjour()}</h1>
        <p class="hero-resume">${esc(resume)}</p>
      </div>
      <div class="hero-actions">
        ${can('direction', 'coordinateur') ? '<a class="btn primary" href="#/projets" data-nouveau-projet>＋ Nouveau projet</a>' : ''}
        ${attente ? `<a class="btn" href="#/rapports">📋 Valider ${attente} rapport${attente > 1 ? 's' : ''}</a>` : ''}
        ${can(...ROLES_IA) ? '<a class="btn ghost" href="#/ia">🧠 Demander à l’IA</a>' : ''}
      </div>
    </section>
    ${!projets.length && can('direction') ? `<div class="notice">Bienvenue ! Créez votre premier projet, ou chargez des <b>données de démonstration</b> depuis <a href="#/parametres">Paramètres</a> pour découvrir KOORDIN.</div>` : ''}
    <div class="grid k4">
      ${kpi('Projets actifs', actifs.length, critiques ? `<span style="color:var(--crit)">🚨 ${critiques} en situation critique</span>` : '✅ Aucun projet critique', critiques ? 'alert' : '', '🏗️')}
      ${kpi('Avancement moyen', `${avMoyen} %`, prevuMoyen != null ? `Prévu à date : ${prevuMoyen} %` : '', '', '📈')}
      ${kpi('Budget consommé', `${pct(engage, budget)} %`, `${moneyShort(engage)} sur ${moneyShort(budget)}`, pct(engage, budget) > 100 ? 'alert' : '', '💰')}
      ${kpi('Rapports à valider', attente, alertesStock ? `📦 ${alertesStock} article(s) sous le seuil` : 'Stock : aucune alerte', attente ? 'warn' : '', '📋')}
    </div>
    ${actifs.length ? `<div class="grid c2 section">
      <div class="card"><div class="card-title">Avancement réel et prévu</div>
        ${legende([['Réel', '--series-1'], ['Prévu à date', '--series-ref']])}
        <div class="chart-box"><canvas id="ch-av"></canvas></div></div>
      <div class="card"><div class="card-title">Budget, engagé et facturé</div>
        ${legende([['Budget', '--series-1'], ['Engagé (commandes)', '--series-2'], ['Facturé', '--series-3']])}
        <div class="chart-box"><canvas id="ch-bud"></canvas></div></div>
    </div>` : ''}
    <div class="grid c21 section">
      <div class="card"><div class="card-title">Tous les projets <small>Cliquez pour le détail</small></div>${tableauProjets(projets)}</div>
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
  const url = await urlsPhotos(projets.map(couvertureDe));
  page(`
    ${entete(bonjour(), 'Votre journée sur le terrain')}
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
    ${entete(bonjour(), 'Achats et suivi budgétaire', '<a class="btn primary" href="#/achats" data-nouvelle-commande>＋ Nouvelle commande</a>')}
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
    ${entete(bonjour(), 'Situation financière des chantiers', '<a class="btn primary" href="#/compta" data-nouvelle-facture>＋ Saisir une facture</a>')}
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
    ${entete(bonjour(), 'Magasin et approvisionnement', '<a class="btn primary" href="#/stock">📦 Gérer le stock</a>')}
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
      ${can('direction', 'coordinateur') ? '<button class="btn" id="edit-p">✏️ Modifier</button>' : ''}
      ${can('direction') ? '<button class="btn danger" id="del-p">Supprimer</button>' : ''}
    </div>
    <div class="tabs">${onglets.map(([k, l]) => `<button class="tab ${k === ongletProjet ? 'active' : ''}" data-onglet="${k}">${l}</button>`).join('')}</div>
    <div id="onglet"></div>`);

  $('#edit-p', p)?.addEventListener('click', () => formulaireProjet(projet));
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
      toast('Photo du chantier enregistrée.');
      naviguer();
    } catch (err) {
      toast(/photo/.test(String(err?.message)) ? 'La mise à jour de la base de données « Images et annonces » est nécessaire (voir le kit).' : messageErreur(err), 'err', 7000);
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
  const ONGLETS = { apercu: ongletApercu, lots: ongletLots, planning: ongletPlanning, rapports: ongletRapports, equipe: ongletEquipe, achats: ongletAchatsProjet };
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
      .select('*, projets(nom), lots(nom, avancement), auteur:profils!rapports_auteur_id_fkey(nom), validateur:profils!rapports_valide_par_fkey(nom), rapport_photos(chemin)')
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
        toast(statut === 'valide' ? 'Rapport validé.' : 'Rapport rejeté, le technicien est informé.');
        m.fermer();
        naviguer();
      } catch (e) { toast(messageErreur(e), 'err'); }
    };
    $('#val', m.el)?.addEventListener('click', () => decider('valide'));
    $('#rej', m.el)?.addEventListener('click', () => decider('rejete'));
  } catch (e) {
    $('.modal-body', m.el).innerHTML = empty('⚠️', messageErreur(e));
  }
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
  const projets = (await q(sb.from('projets').select('id, nom, statut').neq('statut', 'termine').order('nom')));
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
          <label class="btn" style="width:max-content">📷 Prendre / ajouter des photos<input type="file" id="photos" accept="image/*" capture="environment" multiple hidden></label>
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
    lots = selProjet.value ? await q(sb.from('lots').select('id, nom, avancement').eq('projet_id', selProjet.value).order('ordre')) : [];
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
  $('#photos', p).onchange = async (e) => {
    const fichiers = [...e.target.files].slice(0, 12 - photos.length);
    for (const f of fichiers) {
      const blob = await compresserImage(f);
      photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    e.target.value = '';
    rendrePhotos();
  };
  $('#effacer', p).onclick = () => { try { localStorage.removeItem(cle); } catch { /* rien */ } naviguer(); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = lireFormulaire(form);
    const btn = $('#envoyer', p);
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    try {
      const rapport = await q(sb.from('rapports').insert({
        projet_id: d.projet_id, lot_id: d.lot_id, date_rapport: d.date_rapport, meteo: d.meteo,
        effectif: d.effectif != null ? Math.round(num(d.effectif)) : null,
        travaux: d.travaux, incidents: d.incidents, besoins: d.besoins,
        avancement: d.lot_id ? Math.round(num(av.value)) : null,
      }).select('id').single());
      let echecs = 0;
      for (let i = 0; i < photos.length; i++) {
        btn.textContent = `Envoi des photos ${i + 1}/${photos.length}…`;
        const chemin = `${S.entreprise.id}/${rapport.id}/${Date.now()}-${i + 1}.jpg`;
        const { error } = await sb.storage.from('photos-chantier').upload(chemin, photos[i].blob, { contentType: 'image/jpeg' });
        if (error) { echecs++; continue; }
        await sb.from('rapport_photos').insert({ rapport_id: rapport.id, chemin });
      }
      try { localStorage.removeItem(cle); } catch { /* rien */ }
      toast(echecs ? `Rapport envoyé, mais ${echecs} photo(s) n’ont pas pu être envoyées.` : 'Rapport envoyé ✅ La coordination est prévenue.', echecs ? 'warn' : 'ok');
      allerA('#/rapports');
    } catch (err) {
      toast(`${messageErreur(err)} Votre saisie est conservée en brouillon.`, 'err', 7000);
      btn.disabled = false;
      btn.textContent = '📤 Envoyer le rapport';
    }
  });
};

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
        <td><b>${esc(f.libelle)}</b><div class="muted" style="font-size:12px">${esc([f.numero, CATEGORIES[f.categorie], compact ? f.projets?.nom : null].filter(Boolean).join(' · '))}</div></td>
        ${compact ? '' : `<td>${esc(f.projets?.nom || '')}<div class="muted" style="font-size:12px">${esc(f.lots?.nom || '')}</div></td><td>${esc(f.fournisseurs?.nom || '—')}</td>`}
        <td class="num">${money(f.montant)}</td>
        <td class="nowrap">${f.date_echeance ? `${fdate(f.date_echeance)}${echue ? ' <span class="badge crit">⏰ Échue</span>' : ''}` : '—'}</td>
        <td>${badge(STATUT_FACTURE[f.statut])}</td>
        ${gerer ? `<td class="right nowrap">${f.statut === 'a_payer' ? `<button class="btn sm" data-payer="${f.id}">💳 Payée</button>` : ''}<button class="btn sm" data-edit-fac="${f.id}">Modifier</button></td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>`;
}

function brancherFactures(zone, factures, refresh) {
  $$('[data-payer]', zone).forEach((b) => (b.onclick = async () => {
    try {
      await q(sb.from('factures').update({ statut: 'payee', date_paiement: todayISO() }).eq('id', b.dataset.payer));
      toast('Facture marquée comme payée.');
      refresh();
    } catch (e) { toast(messageErreur(e), 'err'); }
  }));
  $$('[data-edit-fac]', zone).forEach((b) => (b.onclick = () => formulaireFacture(factures.find((f) => f.id === b.dataset.editFac), refresh)));
}

async function formulaireFacture(fac, refresh, projetId = null) {
  const [projets, fournisseurs] = await Promise.all([listeProjets(), listeFournisseurs()]);
  const v = fac || { projet_id: projetId, categorie: 'materiaux', statut: 'a_payer', date_facture: todayISO() };
  ouvrirModale({
    titre: fac ? 'Modifier la facture' : 'Saisir une facture ou une dépense',
    large: true,
    corps: `<div class="form-grid">
      ${F.select('projet_id', 'Projet', projets.map((x) => [x.id, x.nom]), v.projet_id, { required: true, vide: '— Choisir —' })}
      <label class="field">Lot<select name="lot_id" id="f-lot"><option value="">— Sans lot —</option></select></label>
      ${F.text('libelle', 'Libellé', v.libelle, { required: true, full: true, placeholder: 'Ex. Facture acier HA 12 — livraison du 12/03' })}
      ${F.select('categorie', 'Catégorie', Object.entries(CATEGORIES), v.categorie)}
      ${F.select('fournisseur_id', 'Fournisseur', fournisseurs.map((f) => [f.id, f.nom]), v.fournisseur_id, { vide: '— Aucun —' })}
      <label class="field">Commande liée<select name="commande_id" id="f-cmd"><option value="">— Aucune —</option></select></label>
      ${F.text('numero', 'N° de facture', v.numero, { hint: 'Contrôle automatique des doublons' })}
      ${F.text('montant', `Montant TTC (${devise()})`, v.montant, { type: 'number', min: 0, required: true, inputmode: 'numeric' })}
      ${F.text('date_facture', 'Date de facture', v.date_facture, { type: 'date', required: true })}
      ${F.text('date_echeance', 'Date d’échéance', v.date_echeance, { type: 'date' })}
      ${F.select('statut', 'Statut', Object.entries(STATUT_FACTURE).map(([k, [, l]]) => [k, l]), v.statut)}
      ${F.text('date_paiement', 'Date de paiement', v.date_paiement, { type: 'date' })}
    </div>
    ${fac ? '<div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn danger sm" id="del-f">Supprimer</button></div>' : ''}`,
    onSubmit: async (d) => {
      const data = {
        projet_id: d.projet_id, lot_id: d.lot_id, libelle: d.libelle, categorie: d.categorie, fournisseur_id: d.fournisseur_id,
        commande_id: d.commande_id, numero: d.numero, montant: num(d.montant), date_facture: d.date_facture,
        date_echeance: d.date_echeance, statut: d.statut, date_paiement: d.statut === 'payee' ? (d.date_paiement || todayISO()) : null,
      };
      if (fac) await q(sb.from('factures').update(data).eq('id', fac.id));
      else await q(sb.from('factures').insert(data));
      toast('Facture enregistrée.');
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
      $('#del-f', el)?.addEventListener('click', async () => {
        if (!(await confirmer('Supprimer cette facture ?', 'Supprimer'))) return;
        try { await q(sb.from('factures').delete().eq('id', fac.id)); el.remove(); toast('Facture supprimée.'); refresh(); } catch (e) { toast(messageErreur(e), 'err'); }
      });
    },
  });
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
    ${entete('Comptabilité', 'Factures, dépenses et situation financière', `<button class="btn" id="csv">⬇️ Export Excel (CSV)</button>${can('direction', 'comptable') ? '<button class="btn primary" id="nfa">＋ Saisir une facture</button>' : ''}`)}
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
  $('#csv', p).onclick = () => DEMO ? toast('L’export Excel fonctionne dans la version installée de KOORDIN.', 'warn') : exporterCSV(`koordin-factures-${todayISO()}.csv`,
    ['Date', 'N°', 'Libellé', 'Catégorie', 'Projet', 'Lot', 'Fournisseur', 'Montant', 'Échéance', 'Statut', 'Date paiement'],
    filtrees().map((f) => [f.date_facture, f.numero, f.libelle, CATEGORIES[f.categorie], f.projets?.nom, f.lots?.nom, f.fournisseurs?.nom, f.montant, f.date_echeance, f.statut === 'payee' ? 'Payée' : 'À payer', f.date_paiement]));
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
  $$('[data-choisir]', p).forEach((b) => (b.onclick = () => formulairePaiement(plans.find((x) => x.code === b.dataset.choisir), params)));
};

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
        zone.innerHTML = `<div class="card">${empty('🧩', 'Les annonces nécessitent la mise à jour de la base « Images et annonces » (voir le kit d’installation).')}</div>`;
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
