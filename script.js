// ═══════════════════════════════
//  STATE
// ═══════════════════════════════
const ADMIN_PASS = 'admin123';
const STORAGE_KEY = 'vote_pondere_state';

// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDzFT3X1cBoJr_PBoqr2XALXz6GGucGUxA",
    authDomain: "election-50c56.firebaseapp.com",
    projectId: "election-50c56",
    storageBucket: "election-50c56.firebasestorage.app",
    messagingSenderId: "348088231029",
    appId: "1:348088231029:web:954201deba9a706d73c43c",
    measurementId: "G-43PGRFC9XD"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

// ─────────────────────────────────────────────────────────────────
//  PARAMÈTRE PRINCIPAL — nombre max de candidats par votant
//  Modifiez cette valeur pour changer la limite globale
const MAX_VOTES_PAR_VOTANT = 20;
// ─────────────────────────────────────────────────────────────────


function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Si on détecte l'ancien état par défaut (3 candidats) ou un état vide, on force la mise à jour
      if (!parsed.candidates || parsed.candidates.length === 0 || (parsed.candidates.length === 3 && parsed.candidates[0].name === 'Alice Martin')) {
        localStorage.removeItem(STORAGE_KEY);
        return defaultState();
      }
      return parsed;
    }
  } catch(e) {}
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

let state = loadState();
let currentMode = null; // 'admin' | 'live' | null (gate)
let gateMode = 'admin';

// ═══════════════════════════════
//  UTILS
// ═══════════════════════════════
function uid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 2800);
}

function copy(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copié !', 'success')).catch(() => toast('Copie impossible', 'error'));
}

function getVoterUrl(token) {
  return `${location.origin}${location.pathname}?vote=${token}`;
}

function computeResults() {
  const result = {};
  state.candidates.forEach(c => result[c.id] = 0);
  state.votes.forEach(v => {
    if (result[v.candidateId] !== undefined) {
      result[v.candidateId] += v.weight;
    }
  });
  return result;
}

// ═══════════════════════════════
//  GATE / AUTH
// ═══════════════════════════════
function setGateMode(m) {
  gateMode = m;
  document.getElementById('gate-admin').style.display = m === 'admin' ? '' : 'none';
  document.getElementById('gate-voter').style.display = m === 'voter' ? '' : 'none';
  document.getElementById('gate-admin-tab').style.cssText = m === 'admin' ? 'flex:1;padding:7px;font-size:12px;background:var(--accent);color:#fff;' : 'flex:1;padding:7px;font-size:12px;background:transparent;color:var(--muted);';
  document.getElementById('gate-voter-tab').style.cssText = m === 'voter' ? 'flex:1;padding:7px;font-size:12px;background:var(--accent);color:#fff;' : 'flex:1;padding:7px;font-size:12px;background:transparent;color:var(--muted);';
}

function checkAdminPass() {
  const val = document.getElementById('admin-pass-input').value;
  if (val === ADMIN_PASS) {
    enterAdmin();
  } else {
    toast('Mot de passe incorrect', 'error');
    document.getElementById('admin-pass-input').focus();
  }
}

function enterAdmin() {
  document.getElementById('admin-gate').style.display = 'none';
  document.getElementById('voter-page').style.display = 'none';
  document.getElementById('app-pages').style.display = 'block';
  document.getElementById('main-nav').style.display = 'flex';
  currentMode = 'admin';
  showPage('admin');
  renderAdmin();
}

function logout() {
  document.getElementById('admin-gate').style.display = 'flex';
  document.getElementById('app-pages').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('admin-pass-input').value = '';
}

function accessVoterByCode() {
  const code = document.getElementById('voter-token-input').value.trim();
  if (!code) return;
  openVoterPage(code);
}

function openVoterPage(token) {
  const link = state.links.find(l => l.token === token);
  document.getElementById('admin-gate').style.display = 'none';
  document.getElementById('app-pages').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('voter-page').style.display = 'block';
  currentMode = 'voter';
  renderVoterPage(link, token);
}

// ═══════════════════════════════
//  VOTER PAGE
// ═══════════════════════════════
function renderVoterPage(link, token) {
  const el = document.getElementById('voter-content');

  if (!link) {
    el.innerHTML = `<div class="error-state">
      <div class="error-title">Lien invalide</div>
      <div class="error-text">Ce lien de vote n'existe pas ou a été supprimé.</div>
    </div>`;
    return;
  }

  if (link.used) {
    el.innerHTML = `<div class="error-state">
      <div class="error-title">Vote déjà enregistré</div>
      <div class="error-text">Ce lien a déjà été utilisé. Un seul vote par lien est autorisé.</div>
    </div>`;
    return;
  }

  if (!state.electionOpen) {
    el.innerHTML = `<div class="error-state">
      <div style="font-size:36px;margin-bottom:12px;">🔒</div>
      <div class="error-title">Élection fermée</div>
      <div class="error-text">L'élection n'est pas encore ouverte ou est terminée. Contactez l'administrateur.</div>
    </div>`;
    return;
  }

  const maxChoix = Math.min(state.maxVotesParVotant || MAX_VOTES_PAR_VOTANT, state.candidates.length);

  const candidatesHTML = state.candidates.map(c => `
    <div class="candidate-option" id="opt-${c.id}" onclick="toggleCandidate('${c.id}', this)">
      <div class="candidate-dot"><div class="candidate-dot-inner"></div></div>
      <div>
        <div class="candidate-name">${esc(c.name)}</div>
        ${c.desc ? `<div class="candidate-desc">${esc(c.desc)}</div>` : ''}
      </div>
    </div>
  `).join('');

  const pluriel = maxChoix > 1 ? `jusqu'à ${maxChoix} candidats` : `1 candidat`;

  el.innerHTML = `
    <div class="voter-title">Votre vote</div>
    <div class="voter-subtitle">Sélectionnez ${pluriel}. Ce vote est définitif et anonyme.</div>
    <div class="vote-counter">
      <span class="vote-counter-label">Sélectionnés</span>
      <span class="vote-counter-val" id="vote-counter-val">0 / ${maxChoix}</span>
    </div>
    ${candidatesHTML}
    <div style="margin-top:20px;">
      <button class="btn btn-primary" style="width:100%" id="submit-vote-btn" onclick="submitVote('${token}')" disabled>Confirmer le vote</button>
    </div>
    <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:12px;">Ce lien sera désactivé après votre vote.</div>
  `;

  window._selectedCandidateIds = new Set();
  window._maxChoix = maxChoix;
}

function toggleCandidate(id, el) {
  const sel = window._selectedCandidateIds;
  const max = window._maxChoix;

  if (sel.has(id)) {
    sel.delete(id);
    el.classList.remove('selected');
  } else {
    if (sel.size >= max) return;
    sel.add(id);
    el.classList.add('selected');
  }

  // update counter
  const counterEl = document.getElementById('vote-counter-val');
  counterEl.textContent = `${sel.size} / ${max}`;
  counterEl.className = 'vote-counter-val ' + (sel.size === max ? 'full' : sel.size > 0 ? 'ok' : '');

  // disable non-selected options if max reached
  document.querySelectorAll('.candidate-option').forEach(o => {
    const oid = o.id.replace('opt-', '');
    if (sel.size >= max && !sel.has(oid)) {
      o.classList.add('maxed');
    } else {
      o.classList.remove('maxed');
    }
  });

  document.getElementById('submit-vote-btn').disabled = sel.size === 0;
}

function submitVote(token) {
  const selectedIds = [...window._selectedCandidateIds];
  if (!selectedIds.length) return;

  const link = state.links.find(l => l.token === token);
  if (!link || link.used || !state.electionOpen) {
    toast('Vote impossible', 'error');
    return;
  }

  // Enregistrer un vote pondéré par candidat sélectionné (anonymisé)
  const ts = Date.now();
  selectedIds.forEach(candidateId => {
    state.votes.push({ candidateId, weight: link.multiplier, ts });
  });

  // Désactiver le lien
  link.used = true;
  link.usedAt = ts;
  saveState();

  // Afficher le succès
  const names = selectedIds.map(id => {
    const c = state.candidates.find(c => c.id === id);
    return c ? `<strong style="color:var(--text)">${esc(c.name)}</strong>` : '';
  }).join(', ');

  document.getElementById('voter-content').innerHTML = `
    <div class="success-state">
      <div class="success-icon">✓</div>
      <div class="success-title">Vote enregistré</div>
      <div class="success-text">Vos votes pour ${names} ont bien été pris en compte.<br><br>Ce lien est maintenant désactivé.</div>
    </div>
  `;
}

// ═══════════════════════════════
//  PAGE ROUTING
// ═══════════════════════════════
function showPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  if (p === 'admin') renderAdmin();
  if (p === 'live') renderLive();
}

// ═══════════════════════════════
//  ADMIN RENDER
// ═══════════════════════════════
function renderAdmin() {
  renderAdminStats();
  renderCandidatesTable();
  renderLinksTable();
  renderAdminResults();
  renderToggles();
}

function renderAdminStats() {
  const totalVotes = state.votes.length;
  const totalWeighted = state.votes.reduce((a, v) => a + v.weight, 0);
  const activeLinks = state.links.filter(l => !l.used).length;
  const usedLinks = state.links.filter(l => l.used).length;

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Votes exprimés</div><div class="stat-value accent">${totalVotes}</div></div>
    <div class="stat-card"><div class="stat-label">Points totaux</div><div class="stat-value">${totalWeighted}</div></div>
    <div class="stat-card"><div class="stat-label">Liens actifs</div><div class="stat-value green">${activeLinks}</div></div>
    <div class="stat-card"><div class="stat-label">Liens utilisés</div><div class="stat-value">${usedLinks}</div></div>
  `;
}

function renderToggles() {
  const te = document.getElementById('toggle-election');
  const tl = document.getElementById('toggle-live');
  te.className = 'toggle' + (state.electionOpen ? ' on' : '');
  tl.className = 'toggle' + (state.liveEnabled ? ' on' : '');

  const badge = document.getElementById('election-status-badge');
  badge.innerHTML = state.electionOpen
    ? '<span class="badge badge-green">Ouverte</span>'
    : '<span class="badge badge-red">Fermée</span>';

  const maxVal = state.maxVotesParVotant || MAX_VOTES_PAR_VOTANT;
  document.getElementById('max-votes-display').textContent = maxVal;
  const sel = document.getElementById('max-votes-select');
  if (sel) sel.value = String(maxVal);
}

function updateMaxVotes(val) {
  state.maxVotesParVotant = parseInt(val);
  saveState();
  document.getElementById('max-votes-display').textContent = val;
  toast(`Maximum fixé à ${val} choix par votant`, 'success');
}

function toggleElection() {
  state.electionOpen = !state.electionOpen;
  saveState();
  renderToggles();
  toast(state.electionOpen ? 'Élection ouverte' : 'Élection fermée', 'success');
}

function toggleLive() {
  state.liveEnabled = !state.liveEnabled;
  saveState();
  renderToggles();
  toast(state.liveEnabled ? 'Page live activée' : 'Page live désactivée', 'success');
}

function renderCandidatesTable() {
  const results = computeResults();
  const tbody = document.getElementById('candidates-tbody');
  if (!state.candidates.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:20px;">Aucun candidat</td></tr>';
    return;
  }
  tbody.innerHTML = state.candidates.map(c => `
    <tr>
      <td style="font-weight:500">${esc(c.name)}</td>
      <td style="color:var(--muted)">${esc(c.desc || '—')}</td>
      <td><span class="badge badge-accent">${results[c.id] || 0} pts</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="confirmDeleteCandidate('${c.id}')">Suppr.</button></td>
    </tr>
  `).join('');
}

function renderLinksTable() {
  const tbody = document.getElementById('links-tbody');
  if (!state.links.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:20px;">Aucun lien généré</td></tr>';
    return;
  }
  tbody.innerHTML = state.links.map(l => {
    const statusBadge = l.used
      ? '<span class="badge badge-red">Utilisé</span>'
      : '<span class="badge badge-green">Actif</span>';
    const url = getVoterUrl(l.token);
    return `
      <tr>
        <td style="font-size:12px;color:var(--muted)">${esc(l.label || '—')}</td>
        <td><span class="badge badge-amber">×${l.multiplier}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="link-box">
            <code title="${url}">${url.length > 45 ? url.slice(0, 45) + '…' : url}</code>
            <button class="copy-btn" onclick="copy('${url}')" title="Copier">⧉</button>
          </div>
        </td>
        <td><button class="btn btn-danger btn-sm" onclick="confirmDeleteLink('${l.id}')">Suppr.</button></td>
      </tr>
    `;
  }).join('');
}

function renderAdminResults() {
  const el = document.getElementById('admin-results');
  if (!state.candidates.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Aucun candidat</div>';
    return;
  }
  const results = computeResults();
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const sorted = [...state.candidates].sort((a, b) => (results[b.id] || 0) - (results[a.id] || 0));

  el.innerHTML = sorted.map((c, i) => {
    const pts = results[c.id] || 0;
    const pct = total > 0 ? Math.round(pts / total * 100) : 0;
    return `
      <div class="progress-wrap">
        <div class="progress-meta">
          <span class="progress-name">${esc(c.name)}</span>
          <span class="progress-score">${pts} pts — ${pct}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill bar-${i % 5}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════
//  LIVE RENDER
// ═══════════════════════════════
function renderLive() {
  if (!state.liveEnabled) {
    document.getElementById('live-stats').innerHTML = '';
    document.getElementById('live-results').innerHTML = `
      <div style="text-align:center;padding:48px 0;color:var(--muted);">
        <div style="font-size:32px;margin-bottom:12px;">🔒</div>
        <div style="font-size:15px;">La page live n'est pas activée.</div>
        <div style="font-size:12px;margin-top:8px;">Activez-la depuis le panneau admin.</div>
      </div>
    `;
    return;
  }

  const results = computeResults();
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const sorted = [...state.candidates].sort((a, b) => (results[b.id] || 0) - (results[a.id] || 0));

  document.getElementById('live-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Votes exprimés</div><div class="stat-value accent">${state.votes.length}</div></div>
    <div class="stat-card"><div class="stat-label">Points totaux</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-label">Candidats</div><div class="stat-value">${state.candidates.length}</div></div>
  `;

  document.getElementById('live-results').innerHTML = sorted.map((c, i) => {
    const pts = results[c.id] || 0;
    const pct = total > 0 ? Math.round(pts / total * 100) : 0;
    return `
      <div class="progress-wrap">
        <div class="progress-meta">
          <span class="progress-name">${esc(c.name)}</span>
          <span class="progress-score">${pts} pts — ${pct}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill bar-${i % 5}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════
//  CANDIDATES
// ═══════════════════════════════
function openCandidateModal() {
  document.getElementById('cand-name').value = '';
  document.getElementById('cand-desc').value = '';
  openModal('candidate-modal');
}

function addCandidate() {
  const name = document.getElementById('cand-name').value.trim();
  if (!name) { toast('Nom requis', 'error'); return; }
  state.candidates.push({ id: uid(), name, desc: document.getElementById('cand-desc').value.trim() });
  saveState();
  closeModal('candidate-modal');
  renderAdmin();
  toast('Candidat ajouté', 'success');
}

function confirmDeleteCandidate(id) {
  const c = state.candidates.find(x => x.id === id);
  document.getElementById('confirm-title').textContent = 'Supprimer le candidat ?';
  document.getElementById('confirm-text').textContent = `"${c.name}" sera définitivement supprimé ainsi que ses votes associés.`;
  document.getElementById('confirm-ok-btn').onclick = () => { deleteCandidate(id); closeModal('confirm-modal'); };
  openModal('confirm-modal');
}

function deleteCandidate(id) {
  state.candidates = state.candidates.filter(c => c.id !== id);
  state.votes = state.votes.filter(v => v.candidateId !== id);
  saveState();
  renderAdmin();
  toast('Candidat supprimé', 'success');
}

// ═══════════════════════════════
//  LINKS
// ═══════════════════════════════
function openLinkModal() {
  document.getElementById('link-label').value = '';
  document.getElementById('link-multiplier').value = '5';
  document.getElementById('custom-multiplier-wrap').style.display = 'none';
  document.getElementById('custom-multiplier-input').value = '';
  openModal('link-modal');
}

function onMultiplierChange(val) {
  const wrap = document.getElementById('custom-multiplier-wrap');
  wrap.style.display = val === 'custom' ? 'block' : 'none';
  if (val === 'custom') document.getElementById('custom-multiplier-input').focus();
}

function validateCustomMultiplier(input) {
  const hint = document.getElementById('custom-multiplier-hint');
  const v = parseInt(input.value);
  if (!input.value || isNaN(v) || v < 1) {
    hint.textContent = 'Entrez un entier positif.';
    hint.style.color = 'var(--muted)';
  } else {
    hint.textContent = `× ${v} — chaque vote comptera pour ${v} points.`;
    hint.style.color = 'var(--green)';
  }
}

function generateLink() {
  const label = document.getElementById('link-label').value.trim();
  const selectVal = document.getElementById('link-multiplier').value;
  let multiplier;

  if (selectVal === 'custom') {
    const raw = parseInt(document.getElementById('custom-multiplier-input').value);
    if (isNaN(raw) || raw < 1) {
      toast('Entrez un multiplicateur valide (≥ 1)', 'error');
      document.getElementById('custom-multiplier-input').focus();
      return;
    }
    multiplier = raw;
  } else {
    multiplier = parseInt(selectVal);
  }

  const token = uid() + uid();
  state.links.push({ id: uid(), token, label, multiplier, used: false, createdAt: Date.now() });
  saveState();
  closeModal('link-modal');
  renderAdmin();
  toast(`Lien ×${multiplier} généré !`, 'success');
}

function confirmDeleteLink(id) {
  document.getElementById('confirm-title').textContent = 'Supprimer ce lien ?';
  document.getElementById('confirm-text').textContent = 'Ce lien sera définitivement supprimé.';
  document.getElementById('confirm-ok-btn').onclick = () => { deleteLink(id); closeModal('confirm-modal'); };
  openModal('confirm-modal');
}

function deleteLink(id) {
  state.links = state.links.filter(l => l.id !== id);
  saveState();
  renderAdmin();
  toast('Lien supprimé', 'success');
}

// ═══════════════════════════════
//  MODALS
// ═══════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ═══════════════════════════════
//  UTILS
// ═══════════════════════════════
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════
//  INIT
// ═══════════════════════════════
function init() {
  const params = new URLSearchParams(location.search);
  const voteToken = params.get('vote');

  if (voteToken) {
    // Direct voter link
    const link = state.links.find(l => l.token === voteToken);
    openVoterPage(voteToken);
  } else {
    // Show gate
    document.getElementById('admin-gate').style.display = 'flex';
    setGateMode('admin');
  }
}

// Live auto-refresh
setInterval(() => {
  if (currentMode === 'admin') {
    state = loadState();
    renderAdmin();
  } else if (currentMode === 'live') {
    state = loadState();
    renderLive();
  }
}, 5000);

init();
