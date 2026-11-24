/* ==========================================================
   P2P-VoteEngine · Création du scrutin (page 2)
   JavaScript pur, sans framework.
   ========================================================== */
'use strict';

(() => {
  /* ---------- Configuration ---------- */
  const CONFIG = {
    HOME_PAGE: 'index.html',
    NEXT_PAGE: null,            // ex. 'registre.html' quand la page 3 existera
    STORAGE_KEY: 'p2pve.ballotDraft',
    THEME_KEY: 'p2pve.theme',
    LANG_KEY: 'p2pve.lang',
    MIN_CHOICES: 2,
    SAVE_DELAY: 900,            // simulation du chargement (ms)
    PEER_COUNT: 0               // aucun pair avant le lancement de la session
  };

  /* ---------- Textes FR / EN ---------- */
  const I18N = {
    fr: {
      'a11y.skip': 'Aller au contenu',
      'theme.aria': 'Thème', 'theme.light': 'Clair', 'theme.dark': 'Sombre',
      'net.online': 'Connecté · {n} pair', 'net.onlineMany': 'Connecté · {n} pairs',
      'net.degraded': 'Réseau dégradé', 'net.offline': 'Déconnecté',
      'nav.aria': 'Fil d’Ariane', 'nav.home': 'Accueil', 'nav.organizer': 'Espace organisateur',
      'title': 'Création du scrutin',
      'lead': 'Définissez le scrutin, puis chargez le registre des électeurs autorisés.',
      'step.aria': 'Progression', 'step.1': 'Scrutin', 'step.2': 'Registre', 'step.3': 'Lancement',
      'step.compact': 'Étape 1 sur 3 · Scrutin',
      'field.title': 'Titre du scrutin', 'ph.title': 'Ex. Élection du délégué de classe',
      'field.desc': 'Description', 'optional': '(facultatif)', 'ph.desc': 'Précisez l’objet du vote pour les électeurs',
      'field.type': 'Type de scrutin',
      'type.single': 'Unique', 'type.single.sub': '1 choix',
      'type.multiple': 'Multiple', 'type.multiple.sub': 'Plusieurs',
      'type.weighted': 'Pondéré', 'type.weighted.sub': 'Points',
      'hint.single': 'Un seul choix par électeur.',
      'hint.multiple': 'Chaque électeur peut cocher plusieurs choix, dans la limite fixée.',
      'hint.weighted': 'Chaque choix a un poids ; l’électeur répartit ses points.',
      'field.max': 'Nombre maximum de choix', 'hint.max': 'Entre 1 et {n}.',
      'field.date': 'Date de fin', 'field.time': 'Heure',
      'choices.label': 'Choix du scrutin',
      'choices.count': '{n} choix · min. {min}', 'choices.countWeighted': '{n} choix · total {p} pts',
      'choices.add': 'Ajouter un choix', 'choices.dragHint': 'Glissez la poignée pour réordonner les choix.',
      'choice.placeholder': 'Choix {n}', 'choice.weight': 'Poids du choix {n}', 'choice.unit': 'pts',
      'choice.delete': 'Supprimer le choix {n}',
      'choice.move': 'Déplacer le choix {n} (glisser, ou flèches haut et bas)',
      'actions.cancel': 'Annuler', 'actions.next': 'Suivant', 'actions.loading': 'Vérification…',
      'status.valid': 'Formulaire valide',
      'status.incomplete': 'Complétez les champs obligatoires (*) pour continuer.',
      'status.saving': 'Enregistrement du scrutin…',
      'err.title': 'Le titre est obligatoire.',
      'err.dateRequired': 'La date de fin est obligatoire.',
      'err.datePast': 'La date de fin doit être dans le futur.',
      'err.timeRequired': 'L’heure est obligatoire.',
      'err.minChoices': 'Ajoutez au moins {min} choix pour continuer.',
      'err.emptyChoice': 'Remplissez ou supprimez les choix vides.',
      'err.dupChoice': 'Les choix doivent être différents.',
      'err.weight': 'Le poids doit être un entier supérieur ou égal à 1.',
      'err.max': 'Saisissez un nombre entier entre 1 et {n}.',
      'toast.saved': 'Scrutin enregistré. Étape suivante : le registre des électeurs.',
      'toast.saveError': 'Impossible d’enregistrer le brouillon sur cet appareil.',
      'toast.offline': 'Problème de connexion : vérifiez votre Internet puis réessayez.',
      'dlg.title': 'Abandonner la création ?', 'dlg.text': 'Les informations saisies seront perdues.',
      'dlg.stay': 'Continuer la saisie', 'dlg.leave': 'Quitter'
    },
    en: {
      'a11y.skip': 'Skip to content',
      'theme.aria': 'Theme', 'theme.light': 'Light', 'theme.dark': 'Dark',
      'net.online': 'Connected · {n} peer', 'net.onlineMany': 'Connected · {n} peers',
      'net.degraded': 'Degraded network', 'net.offline': 'Disconnected',
      'nav.aria': 'Breadcrumb', 'nav.home': 'Home', 'nav.organizer': 'Organizer area',
      'title': 'Create the ballot',
      'lead': 'Define the ballot, then load the register of authorized voters.',
      'step.aria': 'Progress', 'step.1': 'Ballot', 'step.2': 'Register', 'step.3': 'Launch',
      'step.compact': 'Step 1 of 3 · Ballot',
      'field.title': 'Ballot title', 'ph.title': 'e.g. Class representative election',
      'field.desc': 'Description', 'optional': '(optional)', 'ph.desc': 'Explain what the vote is about',
      'field.type': 'Ballot type',
      'type.single': 'Single', 'type.single.sub': '1 choice',
      'type.multiple': 'Multiple', 'type.multiple.sub': 'Several',
      'type.weighted': 'Weighted', 'type.weighted.sub': 'Points',
      'hint.single': 'One choice per voter.',
      'hint.multiple': 'Each voter can tick several choices, up to the set limit.',
      'hint.weighted': 'Each choice has a weight; voters spread their points.',
      'field.max': 'Maximum number of choices', 'hint.max': 'Between 1 and {n}.',
      'field.date': 'End date', 'field.time': 'Time',
      'choices.label': 'Ballot choices',
      'choices.count': '{n} choices · min. {min}', 'choices.countWeighted': '{n} choices · total {p} pts',
      'choices.add': 'Add a choice', 'choices.dragHint': 'Drag the handle to reorder the choices.',
      'choice.placeholder': 'Choice {n}', 'choice.weight': 'Weight of choice {n}', 'choice.unit': 'pts',
      'choice.delete': 'Delete choice {n}',
      'choice.move': 'Move choice {n} (drag, or up and down arrows)',
      'actions.cancel': 'Cancel', 'actions.next': 'Next', 'actions.loading': 'Checking…',
      'status.valid': 'Form is valid',
      'status.incomplete': 'Fill in the required fields (*) to continue.',
      'status.saving': 'Saving the ballot…',
      'err.title': 'The title is required.',
      'err.dateRequired': 'The end date is required.',
      'err.datePast': 'The end date must be in the future.',
      'err.timeRequired': 'The time is required.',
      'err.minChoices': 'Add at least {min} choices to continue.',
      'err.emptyChoice': 'Fill in or remove the empty choices.',
      'err.dupChoice': 'Choices must be different.',
      'err.weight': 'The weight must be a whole number of 1 or more.',
      'err.max': 'Enter a whole number between 1 and {n}.',
      'toast.saved': 'Ballot saved. Next step: the voter register.',
      'toast.saveError': 'The draft could not be saved on this device.',
      'toast.offline': 'Connection problem: check your Internet and try again.',
      'dlg.title': 'Discard this ballot?', 'dlg.text': 'The information entered will be lost.',
      'dlg.stay': 'Keep editing', 'dlg.leave': 'Leave'
    }
  };

  /* ---------- Utilitaires ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
  };

  let lang = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    const l = q || store.get(CONFIG.LANG_KEY) || 'fr';
    return I18N[l] ? l : 'fr';
  })();
  const t = (key, vars = {}) =>
    String((I18N[lang] && I18N[lang][key]) ?? I18N.fr[key] ?? key)
      .replace(/\{(\w+)\}/g, (_, n) => (vars[n] ?? ''));

  /* ---------- Éléments ---------- */
  const form = $('#ballotForm');
  const fields = $('#formFields');
  const titleInput = $('#title');
  const descInput = $('#desc');
  const maxField = $('#maxField');
  const maxInput = $('#maxChoices');
  const dateInput = $('#endDate');
  const timeInput = $('#endTime');
  const typeHint = $('#typeHint');
  const choicesList = $('#choicesList');
  const choicesCount = $('#choicesCount');
  const addBtn = $('#addChoice');
  const nextBtn = $('#nextBtn');
  const nextLabel = $('#nextLabel');
  const nextArrow = $('#nextArrow');
  const spinner = $('.spinner', nextBtn);
  const cancelBtn = $('#cancelBtn');
  const statusHint = $('#statusHint');
  const statusValid = $('#statusValid');
  const dialog = $('#leaveDialog');

  /* ---------- État ---------- */
  const state = {
    type: 'single',
    choices: [],
    touched: new Set(),
    errors: {},
    loading: false,
    nextId: 1
  };
  const newChoice = (label = '', weight = 1) => ({ id: state.nextId++, label, weight });

  /* ==========================================================
     Traduction
     ========================================================== */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('title') + ' · P2P-VoteEngine';
    typeHint.textContent = t('hint.' + state.type);
    updateNetwork();
    renderChoices();
    refresh();
  }

  /* ==========================================================
     Thème clair / sombre
     ========================================================== */
  function setTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    $$('[data-theme-btn]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.themeBtn === theme)));
    if (persist) store.set(CONFIG.THEME_KEY, theme);
  }
  $$('[data-theme-btn]').forEach(b =>
    b.addEventListener('click', () => setTheme(b.dataset.themeBtn)));

  /* ==========================================================
     Indicateur réseau (vert / orange / rouge)
     ========================================================== */
  function updateNetwork() {
    const net = $('#net');
    const conn = navigator.connection;
    let s = 'online';
    if (!navigator.onLine) s = 'offline';
    else if (conn && ['slow-2g', '2g'].includes(conn.effectiveType)) s = 'degraded';
    net.dataset.state = s;
    $('#netLabel').textContent =
      s === 'offline' ? t('net.offline')
      : s === 'degraded' ? t('net.degraded')
      : t(CONFIG.PEER_COUNT > 1 ? 'net.onlineMany' : 'net.online', { n: CONFIG.PEER_COUNT });
  }
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);
  if (navigator.connection) navigator.connection.addEventListener('change', updateNetwork);

  /* ==========================================================
     Liste des choix
     ========================================================== */
  function buildRow(c) {
    const li = document.createElement('li');
    li.className = 'choice-row';
    li.dataset.id = c.id;
    li.innerHTML = `
      <button type="button" class="grip" aria-label=""><svg class="icon"><use href="#i-grip"/></svg></button>
      <span class="badge" aria-hidden="true"></span>
      <div class="control grow"><input type="text" class="choice-input" maxlength="80" autocomplete="off"></div>
      <div class="control control--weight"><input type="number" class="weight-input" inputmode="numeric" min="1" step="1"><span class="unit"></span></div>
      <button type="button" class="icon-btn delete"><svg class="icon"><use href="#i-trash"/></svg></button>`;
    $('.choice-input', li).value = c.label;
    $('.weight-input', li).value = Number.isFinite(c.weight) ? c.weight : '';
    return li;
  }

  function renderChoices() {
    choicesList.replaceChildren(...state.choices.map(buildRow));
    choicesList.dataset.type = state.type;
    updateRowLabels();
  }

  /* Numéros, libellés accessibles, bouton supprimer (min. 2 choix) */
  function updateRowLabels() {
    const rows = $$('.choice-row', choicesList);
    rows.forEach((row, i) => {
      const n = i + 1;
      $('.badge', row).textContent = n;
      $('.grip', row).setAttribute('aria-label', t('choice.move', { n }));
      const inp = $('.choice-input', row);
      inp.placeholder = t('choice.placeholder', { n });
      inp.setAttribute('aria-label', t('choice.placeholder', { n }));
      $('.weight-input', row).setAttribute('aria-label', t('choice.weight', { n }));
      $('.unit', row).textContent = t('choice.unit');
      const del = $('.delete', row);
      del.setAttribute('aria-label', t('choice.delete', { n }));
      del.disabled = rows.length <= CONFIG.MIN_CHOICES;
    });
  }

  function syncOrderFromDom() {
    const ids = $$('.choice-row', choicesList).map(r => Number(r.dataset.id));
    state.choices.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    updateRowLabels();
    refresh();
  }

  const rowById = id => $(`.choice-row[data-id="${id}"]`, choicesList);
  const choiceById = id => state.choices.find(c => c.id === Number(id));

  addBtn.addEventListener('click', () => {
    const c = newChoice();
    state.choices.push(c);
    const row = buildRow(c);
    choicesList.append(row);
    updateRowLabels();
    $('.choice-input', row).focus();
    refresh();
  });

  choicesList.addEventListener('input', e => {
    const row = e.target.closest('.choice-row');
    if (!row) return;
    const c = choiceById(row.dataset.id);
    if (e.target.classList.contains('choice-input')) c.label = e.target.value;
    if (e.target.classList.contains('weight-input')) c.weight = e.target.value === '' ? NaN : Number(e.target.value);
    refresh();
  });

  choicesList.addEventListener('focusout', e => {
    if (e.target.matches('input')) { state.touched.add('choices'); refresh(); }
  });

  choicesList.addEventListener('click', e => {
    const del = e.target.closest('.delete');
    if (!del || del.disabled) return;
    const row = del.closest('.choice-row');
    state.choices = state.choices.filter(c => c.id !== Number(row.dataset.id));
    row.remove();
    state.touched.add('choices');
    updateRowLabels();
    refresh();
    const next = $('.choice-input', choicesList);
    if (next) next.focus();
  });

  /* Réordonner : clavier (flèches haut / bas sur la poignée) */
  choicesList.addEventListener('keydown', e => {
    const grip = e.target.closest('.grip');
    if (!grip || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const row = grip.closest('.choice-row');
    if (e.key === 'ArrowUp' && row.previousElementSibling) choicesList.insertBefore(row, row.previousElementSibling);
    if (e.key === 'ArrowDown' && row.nextElementSibling) choicesList.insertBefore(row.nextElementSibling, row);
    syncOrderFromDom();
    $('.grip', row).focus();
  });

  /* Réordonner : glisser avec la souris ou le doigt (Pointer Events) */
  let dragRow = null;
  choicesList.addEventListener('pointerdown', e => {
    const grip = e.target.closest('.grip');
    if (!grip || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragRow = grip.closest('.choice-row');
    dragRow.classList.add('is-dragging');
    grip.setPointerCapture(e.pointerId);
  });
  choicesList.addEventListener('pointermove', e => {
    if (!dragRow) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && el.closest('.choice-row');
    if (!over || over === dragRow || over.parentElement !== choicesList) return;
    const r = over.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    choicesList.insertBefore(dragRow, after ? over.nextElementSibling : over);
  });
  const endDrag = () => {
    if (!dragRow) return;
    dragRow.classList.remove('is-dragging');
    dragRow = null;
    syncOrderFromDom();
  };
  choicesList.addEventListener('pointerup', endDrag);
  choicesList.addEventListener('pointercancel', endDrag);

  /* ==========================================================
     Type de scrutin
     ========================================================== */
  $$('input[name="type"]').forEach(r =>
    r.addEventListener('change', () => {
      state.type = r.value;
      choicesList.dataset.type = state.type;
      maxField.hidden = state.type !== 'multiple';
      typeHint.textContent = t('hint.' + state.type);
      refresh();
    }));

  /* ==========================================================
     Validation
     ========================================================== */
  function validate() {
    const e = {};
    const total = state.choices.length;

    if (!titleInput.value.trim()) e.title = t('err.title');

    if (!dateInput.value) e.date = t('err.dateRequired');
    if (!timeInput.value) e.time = t('err.timeRequired');
    if (dateInput.value) {
      const end = timeInput.value
        ? new Date(`${dateInput.value}T${timeInput.value}`)
        : new Date(`${dateInput.value}T23:59:59`);
      if (!(end.getTime() > Date.now())) e.date = t('err.datePast');
    }

    const labels = state.choices.map(c => c.label.trim());
    const filled = labels.filter(Boolean);
    if (filled.length < CONFIG.MIN_CHOICES) e.choices = t('err.minChoices', { min: CONFIG.MIN_CHOICES });
    else if (filled.length < labels.length) e.choices = t('err.emptyChoice');
    else if (new Set(filled.map(l => l.toLowerCase())).size !== filled.length) e.choices = t('err.dupChoice');

    if (state.type === 'weighted') {
      const bad = state.choices.filter(c => !Number.isInteger(c.weight) || c.weight < 1);
      if (bad.length) { e.badWeights = bad.map(c => c.id); e.choices = e.choices || t('err.weight'); }
    }

    if (state.type === 'multiple') {
      const n = Math.max(total - 1, 1);
      const v = Number(maxInput.value);
      if (maxInput.value === '' || !Number.isInteger(v) || v < 1 || v > n) e.max = t('err.max', { n });
    }
    return e;
  }

  function showError(key, msg) {
    const p = $('#err-' + key);
    if (!p) return;
    const visible = Boolean(msg) && state.touched.has(key);
    p.hidden = !visible;
    $('span', p).textContent = visible ? msg : '';
    const field = p.closest('.field');
    $$('.control', field).forEach(c => { if (key !== 'choices') c.classList.toggle('is-invalid', visible); });
    if (key === 'title') titleInput.setAttribute('aria-invalid', String(visible));
  }

  function refresh() {
    const e = validate();
    state.errors = e;
    const hasErrors = Object.keys(e).length > 0;

    ['title', 'max', 'choices'].forEach(k => showError(k, e[k]));
    /* Date et heure : chaque message sous son propre champ */
    showError('date', e.date);
    showError('time', e.time);
    $('#err-date').closest('.field').querySelector('.control').classList.toggle('is-invalid', Boolean(e.date) && state.touched.has('date'));
    $('#err-time').closest('.field').querySelector('.control').classList.toggle('is-invalid', Boolean(e.time) && state.touched.has('time'));

    /* Lignes de choix en erreur (poids / choix vide) */
    const showChoicesErr = state.touched.has('choices');
    $$('.choice-row', choicesList).forEach(row => {
      const c = choiceById(row.dataset.id);
      const emptyBad = showChoicesErr && !c.label.trim() && state.choices.length > 0 && Boolean(e.choices) && e.choices !== t('err.minChoices', { min: CONFIG.MIN_CHOICES });
      $('.choice-input', row).closest('.control').classList.toggle('is-invalid', emptyBad);
      const wBad = showChoicesErr && (e.badWeights || []).includes(c.id);
      $('.weight-input', row).closest('.control').classList.toggle('is-invalid', wBad);
    });
    $('#choicesCount').classList.toggle('is-error', showChoicesErr && Boolean(e.choices));

    /* Compteurs */
    const n = state.choices.length;
    const pts = state.choices.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0);
    choicesCount.textContent = state.type === 'weighted'
    ? t('choices.countWeighted', { n, p: pts })
    : t('choices.count', { n, min: CONFIG.MIN_CHOICES });
    $('#hint-max').textContent = t('hint.max', { n: Math.max(n - 1, 1) });

    /* Barre d'actions */
    statusValid.hidden = hasErrors || state.loading;
    statusHint.hidden = !(hasErrors || state.loading);
    statusHint.textContent = state.loading ? t('status.saving') : t('status.incomplete');
    nextBtn.disabled = hasErrors || state.loading;
  }

  /* Champs « touchés » : l'erreur apparaît après la sortie du champ */
  [['title', titleInput], ['max', maxInput]].forEach(([k, el]) =>
    el.addEventListener('blur', () => { state.touched.add(k); refresh(); }));
  titleInput.addEventListener('input', refresh);
  descInput.addEventListener('input', refresh);
  maxInput.addEventListener('input', refresh);
  dateInput.addEventListener('input', () => { state.touched.add('date'); refresh(); });
  timeInput.addEventListener('input', () => { state.touched.add('time'); refresh(); });
  dateInput.addEventListener('blur', () => { state.touched.add('date'); refresh(); });
  timeInput.addEventListener('blur', () => { state.touched.add('time'); refresh(); });

  /* ==========================================================
     Soumission (bouton Suivant)
     ========================================================== */
  function setLoading(on) {
    state.loading = on;
    fields.disabled = on;
    cancelBtn.disabled = on;
    spinner.hidden = !on;
    nextArrow.hidden = on;
    nextBtn.classList.toggle('is-loading', on);
    nextBtn.setAttribute('aria-busy', String(on));
    nextLabel.textContent = t(on ? 'actions.loading' : 'actions.next');
    refresh();
    if (on) nextBtn.disabled = true;
  }

  function buildDraft() {
    const draft = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      type: state.type,
      endAt: new Date(`${dateInput.value}T${timeInput.value}`).toISOString(),
      choices: state.choices.map(c => state.type === 'weighted'
        ? { label: c.label.trim(), weight: c.weight }
        : { label: c.label.trim() }),
      savedAt: new Date().toISOString()
    };
    if (state.type === 'multiple') draft.maxChoices = Number(maxInput.value);
    return draft;
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    ['title', 'date', 'time', 'max', 'choices'].forEach(k => state.touched.add(k));
    refresh();
    if (Object.keys(state.errors).length) { focusFirstError(); return; }

    if (!navigator.onLine) { toast(t('toast.offline'), 'error'); return; }

    setLoading(true);
    await sleep(CONFIG.SAVE_DELAY);
    const ok = store.set(CONFIG.STORAGE_KEY, JSON.stringify(buildDraft()));
    setLoading(false);
    if (!ok) { toast(t('toast.saveError'), 'error'); return; }

    toast(t('toast.saved'), 'success');
    if (CONFIG.NEXT_PAGE) setTimeout(() => { location.href = CONFIG.NEXT_PAGE; }, 1200);
  });

  function focusFirstError() {
    const order = [['title', titleInput], ['max', maxInput], ['date', dateInput], ['time', timeInput]];
    const hit = order.find(([k]) => state.errors[k]);
    if (hit) { hit[1].focus(); return; }
    const first = $('.choice-input', choicesList);
    if (first) first.focus();
}

/* ==========================================================
    Annuler (avec confirmation si des données sont saisies)
     ========================================================== */
const isDirty = () =>
    titleInput.value.trim() || descInput.value.trim() || dateInput.value || timeInput.value ||
    state.choices.some(c => c.label.trim());

cancelBtn.addEventListener('click', () => {
    if (!isDirty()) { location.href = CONFIG.HOME_PAGE; return; }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else if (confirm(t('dlg.title') + ' ' + t('dlg.text'))) location.href = CONFIG.HOME_PAGE;
});
dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'leave') {
      try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch { /* ignoré */ }
    location.href = CONFIG.HOME_PAGE;
    }
});

/* ==========================================================
    Toasts
     ========================================================== */
function toast(message, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 4500);
}

/* ==========================================================
    Reprise du brouillon (retour depuis la page suivante)
     ========================================================== */
function loadDraft() {
    try {
    const d = JSON.parse(store.get(CONFIG.STORAGE_KEY) || 'null');
    if (!d || !Array.isArray(d.choices)) return false;
    titleInput.value = d.title || '';
    descInput.value = d.description || '';
    const radio = $(`input[name="type"][value="${d.type}"]`);
    if (radio) { radio.checked = true; state.type = d.type; }
    maxField.hidden = state.type !== 'multiple';
    if (d.maxChoices) maxInput.value = d.maxChoices;
    if (d.endAt) {
        const end = new Date(d.endAt);
        const p = n => String(n).padStart(2, '0');
        dateInput.value = `${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
        timeInput.value = `${p(end.getHours())}:${p(end.getMinutes())}`;
    }
    state.choices = d.choices.map(c => newChoice(c.label || '', c.weight ?? 1));
    while (state.choices.length < CONFIG.MIN_CHOICES) state.choices.push(newChoice());
    typeHint.textContent = t('hint.' + state.type);
    return true;
    } catch { return false; }
}

/* ==========================================================
    Initialisation
     ========================================================== */
(function init() {
    const saved = store.get(CONFIG.THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'), false);

    /* Date minimale = aujourd'hui (heure locale) */
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    dateInput.min = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

    if (!loadDraft()) {
    state.choices = [newChoice(), newChoice()];
    typeHint.textContent = t('hint.single');
    }
    applyI18n();
})();
})();