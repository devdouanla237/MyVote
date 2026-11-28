/* ==========================================================
   P2P-VoteEngine · Bulletin de vote (page 8)
   JavaScript pur. Demande common.js chargé avant ce fichier.
   Variantes : unique (radio), multiple (cases), pondérée (points).
   Essai rapide : vote.html?type=single | multiple | weighted
   Simulation d'erreurs : ?sim=dup (double vote) | ?sim=err (réseau)
   ========================================================== */
'use strict';

(() => {
  const { $, $$, sleep, esc, store, KEYS, initTheme, initNetwork, toast } = P2P;

  /* ---------- Réglages ---------- */
  const CONFIG = {
    TOTAL_POINTS: 10,              // points à répartir (variante pondérée)
    DEFAULT_MAX: 3,                // choix maximum (variante multiple)
    DEMO_DURATION_MS: (2 * 3600 + 14 * 60 + 8) * 1000,
    RESULTS_PAGE: null,            // ex. 'resultats.html'
    RECEIPT_PAGE: null             // ex. 'recu.html' (sinon, une notification affiche l'empreinte)
  };

  /* ---------- Données d'exemple (à remplacer par celles du réseau P2P) ---------- */
  const PEOPLE = {
    'Aminata Fotso': { role: 'Étudiante · ISI3', slogan: 'Une classe unie, des décisions claires.',
      points: ['Un point mensuel avec l’administration', 'Un canal unique pour toutes les annonces', 'Des séances de révision partagées'] },
    'Brice Nkou': { role: 'Étudiant · ISI3', slogan: 'Moins de promesses, plus d’actions.',
      points: ['Un tableau public de suivi des demandes', 'Des sorties pédagogiques chaque semestre', 'Un référent pour chaque matière'] },
    'Carine Mbarga': { role: 'Étudiante · ISI3', slogan: 'Écouter d’abord, décider ensemble.',
      points: ['Une boîte à idées anonyme', 'Un tutorat entre les promotions', 'Un bilan trimestriel ouvert à tous'] },
    'Daniel Essomba': { role: 'Étudiant · ISI3', slogan: 'Un campus plus vivant.',
      points: ['Un week-end d’intégration', 'Un club de projets web', 'Un budget d’événements partagé'] },
    'Salle de coworking': { role: 'Coût estimé · 4 500 000 FCFA', slogan: 'Un espace calme ouvert tous les jours.',
      points: ['Vingt postes de travail équipés', 'Wi-Fi fibre et prises à chaque place', 'Ouvert de 8 h à 20 h'] },
    'Bornes de recharge': { role: 'Coût estimé · 1 800 000 FCFA', slogan: 'Recharger téléphones et ordinateurs sur le campus.',
      points: ['Six bornes installées dans la cour', 'Alimentation solaire d’appoint', 'Maintenance assurée par le campus'] },
    'Jardin partagé': { role: 'Coût estimé · 900 000 FCFA', slogan: 'Un coin vert géré par les étudiants.',
      points: ['Bacs de culture et arrosage', 'Compost du restaurant universitaire', 'Ateliers mensuels ouverts à tous'] }
  };
  const DEMO = {
    single: { title: 'Élection du délégué de classe ISI3',
      desc: 'Vote à bulletin secret pour désigner le délégué de la promotion 2026-2027. Un seul choix possible.',
      labels: ['Aminata Fotso', 'Brice Nkou', 'Carine Mbarga'] },
    multiple: { title: 'Élection du bureau des étudiants',
      desc: 'Choisissez jusqu’à 3 candidats pour composer le bureau.',
      labels: ['Aminata Fotso', 'Brice Nkou', 'Carine Mbarga', 'Daniel Essomba'] },
    weighted: { title: 'Budget participatif 2027',
      desc: 'Répartissez vos 10 points entre les projets proposés.',
      labels: ['Salle de coworking', 'Bornes de recharge', 'Jardin partagé'] }
  };

  /* ==========================================================
     1. Charger le scrutin (brouillon de la page 2, sinon exemple)
     ========================================================== */
  function loadBallot() {
    const q = new URLSearchParams(location.search);
    let draft = null;
    try { draft = JSON.parse(store.get('localStorage', KEYS.draft) || 'null'); } catch { /* ignoré */ }

    const forced = q.get('type');
    const useDraft = !forced && draft && Array.isArray(draft.choices) && draft.choices.length >= 2;
    const type = forced && DEMO[forced] ? forced : (useDraft ? draft.type : 'single');
    const base = DEMO[type] || DEMO.single;

    const labels = useDraft ? draft.choices.map(c => c.label) : base.labels;
    return {
      type,
      title: useDraft ? draft.title : base.title,
      desc: useDraft ? (draft.description || '') : base.desc,
      max: type === 'multiple' ? (useDraft && draft.maxChoices ? draft.maxChoices : CONFIG.DEFAULT_MAX) : 0,
      end: useDraft && draft.endAt ? new Date(draft.endAt).getTime() : Date.now() + CONFIG.DEMO_DURATION_MS,
      items: labels.map(label => ({ label, ...(PEOPLE[label] || {}) }))
    };
  }

  const ballot = loadBallot();
  const state = {
    type: ballot.type,
    items: ballot.items,
    max: ballot.max,
    total: CONFIG.TOTAL_POINTS,
    sel: new Set(),                       // choix cochés (unique / multiple)
    pts: ballot.items.map(() => 0),       // points par choix (pondérée)
    blank: false,
    detail: null,                         // choix dont on voit le détail
    closed: false
  };

  /* ---------- Petites aides ---------- */
  const used = () => state.pts.reduce((a, b) => a + b, 0);
  const isChosen = i => state.type === 'weighted' ? state.pts[i] > 0 : state.sel.has(i);
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pad = n => String(n).padStart(2, '0');

  function isValid() {
    if (state.closed) return false;
    if (state.blank) return true;
    if (state.type === 'single') return state.sel.size === 1;
    if (state.type === 'multiple') return state.sel.size >= 1 && state.sel.size <= state.max;
    return used() === state.total;
  }

  /* ==========================================================
     2. Afficher la liste des choix
     ========================================================== */
  const list = $('#choices');
  const detailEl = $('#detail');

  function stepperHTML(i) {
    const it = state.items[i];
    const off = state.closed || state.blank;
    return `<div class="stepper" role="group" aria-label="Points pour ${esc(it.label)}">
      <button type="button" class="step-btn" data-act="minus" data-i="${i}" aria-label="Retirer un point"${off || state.pts[i] <= 0 ? ' disabled' : ''}><svg class="icon"><use href="#i-minus"/></svg></button>
      <input class="step-input" type="number" inputmode="numeric" min="0" max="${state.total}" value="${state.pts[i]}" data-act="input" data-i="${i}" aria-label="Points pour ${esc(it.label)}"${off ? ' disabled' : ''}>
      <button type="button" class="step-btn" data-act="plus" data-i="${i}" aria-label="Ajouter un point"${off || used() >= state.total ? ' disabled' : ''}><svg class="icon"><use href="#i-plus"/></svg></button>
    </div>`;
  }

  function rowHTML(it, i) {
    const chosen = isChosen(i);
    const off = state.closed || state.blank;
    const avatar = `<span class="avatar" aria-hidden="true">${esc(initials(it.label))}</span>`;
    const info = `<span class="choice-info"><span class="choice-name">${esc(it.label)}</span><span class="choice-role">${esc(it.role || '')}</span></span>`;

    if (state.type === 'weighted') {
      const pct = state.pts[i] / state.total * 100;
      return `<li class="choice choice--weighted${chosen ? ' is-selected' : ''}">
        <div class="choice-top">
          <button type="button" class="choice-main" data-act="open" data-i="${i}"${state.closed ? ' disabled' : ''}>${avatar}${info}</button>
          ${stepperHTML(i)}
        </div>
        <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
      </li>`;
    }

    const kind = state.type === 'single' ? 'radio' : 'checkbox';
    return `<li class="choice${chosen ? ' is-selected' : ''}">
      <button type="button" class="ctrl ctrl--${kind === 'radio' ? 'radio' : 'check'}" role="${kind}" aria-checked="${chosen}"
              aria-label="Choisir ${esc(it.label)}" data-act="toggle" data-i="${i}"${off ? ' disabled' : ''}></button>
      <button type="button" class="choice-main" data-act="open" data-i="${i}"${state.closed ? ' disabled' : ''}>
        ${avatar}${info}<svg class="icon chev" aria-hidden="true"><use href="#i-chev"/></svg>
      </button>
    </li>`;
  }

  /* Redessine tout, puis redonne le focus au bouton utilisé */
  function render(focusSelector) {
    list.innerHTML = state.items.map(rowHTML).join('');
    list.setAttribute('role', state.type === 'single' ? 'radiogroup' : 'list');
    renderDetail();
    updateUI();
    if (focusSelector) {
      const scope = detailEl.classList.contains('is-open') ? detailEl : document;
      const el = $(focusSelector, scope);
      if (el && !el.disabled) el.focus();
    }
  }

  /* ==========================================================
     3. Panneau de détail (page séparée sur téléphone)
     ========================================================== */
  function renderDetail() {
    const i = state.detail;
    if (i === null) {
      detailEl.innerHTML = `<div class="detail-empty">
        <svg class="icon" aria-hidden="true"><use href="#i-user"/></svg>
        <strong>Aucun profil sélectionné</strong>
        <p>Sélectionnez une option pour voir son détail avant de voter.</p>
      </div>`;
      return;
    }
    const it = state.items[i];
    const chosen = isChosen(i);
    const weighted = state.type === 'weighted';
    const pts = (it.points || []).map(p =>
      `<li><svg class="icon icon--sm" aria-hidden="true"><use href="#i-check"/></svg><span>${esc(p)}</span></li>`).join('');

    detailEl.innerHTML = `
      <button type="button" class="detail-back" data-act="back"><svg class="icon icon--sm"><use href="#i-back"/></svg>Retour à la liste</button>
      <article class="detail-card">
        <div class="detail-head">
          <span class="avatar avatar--lg" aria-hidden="true">${esc(initials(it.label))}</span>
          <div><h2>${esc(it.label)}</h2><span class="muted">${esc(it.role || '')}</span></div>
        </div>
        ${chosen ? `<span class="chip chip--ok"><svg class="icon icon--sm"><use href="#i-check"/></svg>${weighted ? 'Points attribués : ' + state.pts[i] : 'Votre choix'}</span>` : ''}
        ${it.slogan ? `<p class="slogan">« ${esc(it.slogan)} »</p>` : ''}
        <hr>
        <h3>${weighted ? 'Ce que le projet apporte' : 'Programme'}</h3>
        ${pts ? `<ul class="checklist">${pts}</ul>` : '<p class="muted">Aucun détail fourni par l’organisateur.</p>'}
        ${weighted ? stepperHTML(i)
          : `<button type="button" class="btn ${chosen ? 'btn--secondary' : 'btn--primary'} btn--block" data-act="pick" data-i="${i}"${state.closed || state.blank ? ' disabled' : ''}>${chosen ? 'Retirer mon choix' : 'Choisir cette personne'}</button>`}
      </article>
      <button type="button" class="btn ${weighted || chosen ? 'btn--primary' : 'btn--secondary'} btn--block detail-return" data-act="back">Retour à la liste</button>`;
  }

  function openDetail(i) {
    state.detail = i;
    renderDetail();
    detailEl.classList.add('is-open');            // ouvre la « page » sur téléphone
    detailEl.scrollTop = 0;
    const back = $('.detail-back', detailEl);
    if (back && getComputedStyle(back).display !== 'none') back.focus();
  }
  function closeDetail() { detailEl.classList.remove('is-open'); }

  /* ==========================================================
     4. Actions : cocher, points, vote blanc
     ========================================================== */
  function toggle(i) {
    if (state.type === 'single') {
      if (state.sel.has(i)) state.sel.clear(); else { state.sel.clear(); state.sel.add(i); }
    } else {
      if (state.sel.has(i)) state.sel.delete(i);
      else if (state.sel.size < state.max) state.sel.add(i);
      else { toast(`Vous pouvez choisir ${state.max} options au maximum.`, 'error'); return; }
    }
    state.detail = i;
  }

  function setPoints(i, value) {
    const v = Math.max(0, Math.floor(Number(value) || 0));
    const room = state.total - (used() - state.pts[i]);   // points encore libres pour ce choix
    state.pts[i] = Math.min(v, room);
    state.detail = i;
  }

  function handleAction(act, i) {
    if (act === 'toggle' || act === 'pick') toggle(i);
    else if (act === 'plus') setPoints(i, state.pts[i] + 1);
    else if (act === 'minus') setPoints(i, state.pts[i] - 1);
    else if (act === 'open') { openDetail(i); return; }
    render(i !== undefined ? `[data-act="${act}"][data-i="${i}"]` : null);
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'back') { closeDetail(); return; }
    if (b.dataset.act === 'input') return;
    handleAction(b.dataset.act, Number(b.dataset.i));
  }
  list.addEventListener('click', onClick);
  detailEl.addEventListener('click', onClick);

  /* Saisie directe d'un nombre de points */
  function onChange(e) {
    if (e.target.dataset.act !== 'input') return;
    const i = Number(e.target.dataset.i);
    setPoints(i, e.target.value);
    render(`.step-input[data-i="${i}"]`);
  }
  list.addEventListener('change', onChange);
  detailEl.addEventListener('change', onChange);

  /* Vote blanc / abstention */
  $('#blank').addEventListener('change', e => {
    state.blank = e.target.checked;
    if (state.blank) { state.sel.clear(); state.pts.fill(0); }
    render();
  });

  /* ==========================================================
     5. Compteur, message d'aide, bouton Confirmer
     ========================================================== */
  function updateUI() {
    const counter = $('#counter');
    const w = state.type === 'weighted';
    $('#listTitle').textContent = w ? 'Répartissez vos points' : (state.type === 'multiple' ? 'Vos choix' : 'Votre choix');

    if (state.type === 'multiple') counter.textContent = `${state.sel.size}/${state.max} choisis`;
    else if (w) counter.textContent = `Points restants : ${state.total - used()} / ${state.total}`;
    else counter.textContent = 'Un seul choix';
    counter.classList.toggle('counter--chip', state.type !== 'single');

    const valid = isValid();
    $('#voteHint').textContent = state.closed ? 'Votre choix n’a pas été envoyé.'
      : valid ? 'Votre vote est anonyme et sera chiffré avant l’envoi.'
      : (w ? `Répartissez les ${state.total} points pour confirmer.` : 'Choisissez une option pour continuer.');

    const btn = $('#confirmBtn');
    btn.disabled = state.closed ? !CONFIG.RESULTS_PAGE : !valid;
    $('#confirmLabel').textContent = state.closed ? 'Voir les résultats' : 'Confirmer mon vote';

    const blankRow = $('#blankRow');
    blankRow.classList.toggle('is-selected', state.blank);
    blankRow.classList.toggle('is-disabled', state.closed);
    $('#blank').disabled = state.closed;
    $('#ballotForm').style.opacity = state.closed ? '.55' : '';
  }

  /* ==========================================================
     6. Compte à rebours et scrutin clos (ELECTION_CLOSED)
     ========================================================== */
  let timer = null;
  function tick() {
    const left = ballot.end - Date.now();
    if (left <= 0) { closeBallot(); return; }
    const s = Math.floor(left / 1000);
    $('#timeLabel').textContent =
      `Temps restant · ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
  }
  function closeBallot() {
    if (state.closed) return;
    state.closed = true;
    clearInterval(timer);
    $('#timeLabel').textContent = 'Scrutin clos';
    $('#timePill').classList.add('pill--error');
    $('#closedBanner').hidden = false;
    closeDetail();
    if ($('#confirmDialog').open) $('#confirmDialog').close();
    render();
  }

  /* ==========================================================
     7. Confirmation (récapitulatif) puis envoi
     ========================================================== */
  const confirmDlg = $('#confirmDialog');
  const sendDlg = $('#sendDialog');

  $('#confirmBtn').addEventListener('click', () => {
    if (state.closed) { if (CONFIG.RESULTS_PAGE) location.href = CONFIG.RESULTS_PAGE; return; }
    if (!isValid()) return;
    let rows;
    if (state.blank) rows = ['Vote blanc / abstention'];
    else if (state.type === 'weighted') rows = state.items.map((it, i) => state.pts[i] > 0 ? `${it.label} : ${state.pts[i]} pts` : null).filter(Boolean);
    else rows = [...state.sel].map(i => state.items[i].label);
    $('#recapList').innerHTML = rows.map(r => `<strong>${esc(r)}</strong>`).join('<br>');
    $('#recapBallot').textContent = ballot.title;
    confirmDlg.showModal();
  });
  $('#editBtn').addEventListener('click', () => confirmDlg.close());
  sendDlg.addEventListener('cancel', e => e.preventDefault());   // pas de fermeture pendant l'envoi

  /* Le bulletin qui sera chiffré */
  function buildPayload() {
    return {
      title: ballot.title,
      type: state.type,
      blank: state.blank,
      choices: state.blank ? [] : state.items
        .map((it, i) => ({ label: it.label, points: state.type === 'weighted' ? state.pts[i] : 1, chosen: isChosen(i) }))
        .filter(c => c.chosen)
        .map(({ label, points }) => ({ label, points })),
      nonce: crypto.getRandomValues(new Uint32Array(4)).join('-')
    };
  }

  /* Empreinte de 16 caractères, par groupes de 4 (ex. 7F3A-92KD-18XQ-ZM4P) */
  async function receiptCode(payload) {
    const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let hex;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    }
    const chars = Array.from({ length: 16 }, (_, k) => ALPHA[parseInt(hex.substr(k * 2, 2), 16) % ALPHA.length]);
    return chars.join('').match(/.{4}/g).join('-');
  }

  function setStep(n, status) {
    $$('#sendSteps li').forEach(li => {
      const k = Number(li.dataset.step);
      li.classList.toggle('is-done', k < n || (k === n && status === 'done'));
      li.classList.toggle('is-active', k === n && status === 'active');
    });
    $('#sendBar').style.width = ({ '1active': 10, '1done': 33, '2active': 45, '2done': 66, '3active': 80, '3done': 100 })[n + status] + '%';
  }

  async function sendVote() {
    const sim = new URLSearchParams(location.search).get('sim');
    sendDlg.showModal();
    try {
      if (state.closed) throw new Error('ELECTION_CLOSED');

      setStep(1, 'active');
      const payload = buildPayload();                // À remplacer : chiffrement RSA-OAEP avec la clé publique de la session
      await sleep(800);
      setStep(1, 'done');

      setStep(2, 'active');
      await sleep(900);
      if (!navigator.onLine || sim === 'err') throw new Error('NETWORK_ERROR');
      setStep(2, 'done');

      setStep(3, 'active');
      await sleep(600);
      if (sim === 'dup') throw new Error('DUPLICATE_TOKEN');
      setStep(3, 'done');

      const code = await receiptCode(payload);
      const block = Number(store.get('localStorage', 'p2pve.blockCounter') || 13) + 1;
      store.set('localStorage', 'p2pve.blockCounter', String(block));
      store.set('sessionStorage', KEYS.receipt, JSON.stringify({ code, block, title: ballot.title, at: new Date().toISOString() }));
      await sleep(400);
      sendDlg.close();

      if (CONFIG.RECEIPT_PAGE) { location.href = CONFIG.RECEIPT_PAGE + '?status=ok'; return; }
      toast(`Vote enregistré (bloc n° ${block}). Empreinte : ${code}`, 'success');
    } catch (err) {
      sendDlg.close();
      const messages = {
        ELECTION_CLOSED: 'Le scrutin est clos : le vote n’est plus possible.',
        NETWORK_ERROR: 'Problème de connexion : vérifiez votre Internet puis réessayez.',
        DUPLICATE_TOKEN: 'Ce jeton a déjà voté : le bloc est rejeté.'
      };
      if (err.message === 'ELECTION_CLOSED') closeBallot();
      toast(messages[err.message] || 'Une erreur est survenue.', 'error');
      if (CONFIG.RECEIPT_PAGE && err.message === 'DUPLICATE_TOKEN') location.href = CONFIG.RECEIPT_PAGE + '?status=dup';
    }
  }
  $('#sendBtn').addEventListener('click', () => { confirmDlg.close(); sendVote(); });

  /* ==========================================================
     8. Démarrage
     ========================================================== */
  initTheme();
  initNetwork(4);
  $('#ballotTitle').textContent = ballot.title;
  $('#ballotDesc').textContent = ballot.desc;
  document.title = ballot.title + ' · P2P-VoteEngine';
  render();
  tick();
  timer = setInterval(tick, 1000);
})();