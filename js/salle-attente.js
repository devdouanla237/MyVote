/* salle-attente.js — Page 7 « Connexion et salle d’attente » (espace électeur)
 *
 * Utilisation : salle-attente.html?session=ABCD1234
 *   (la page 6 « Rejoindre une session » redirige ici avec le Session ID dans l’URL ;
 *    ne jamais mettre le jeton dans l’URL.)
 *
 * ─── CONTRAT DE L’ADAPTATEUR (à fournir par M1 / M3 via window.WAITING_ROOM_ADAPTER) ───
 *   connectToHost(sessionId, { signal })  → Promise<any>
 *       rejette avec { code: 'SESSION_NOT_FOUND' | 'TIMEOUT' | 'NETWORK_ERROR' } (ou une erreur PeerJS avec .type)
 *   meshWithPeers({ signal, retryOnly, onProgress({connected,total}) })
 *       → Promise<{ connected:number, total:number, failed:string[] }>   (failed = IDs des pairs injoignables)
 *   syncLedger({ signal, onProgress({received,total}) }) → Promise<{ blocks:number }>
 *   onNetworkStatus(cb)  (facultatif) → cb({ status:'connected'|'connecting'|'offline', peerCount:number })
 *   leave()              (facultatif) → ferme proprement les connexions
 *   Chaque méthode doit respecter `signal` (AbortSignal) : l’annulation arrête le travail en cours.
 *
 * Sans adaptateur, un réseau SIMULÉ est utilisé (panneau « Mode démonstration »).
 * Aucune couleur ici : tout passe par les variables CSS.
 */
(() => {
  'use strict';

  /* ───────────── Configuration ───────────── */
  const CONFIG = {
    hostTimeoutMs: 10000,                 // délai max de l’hôte (code TIMEOUT)
    nextUrl: 'voter.html#bulletin',       // page 8 : bulletin de vote (à adapter)
    joinUrl: 'voter.html',                // page 6 : rejoindre une session (à adapter)
    themeKey: 'theme',
    sessionIdPattern: /^[A-Z0-9]{8}$/,    // Session ID : 8 caractères alphanumériques
    maxFailedShown: 5,
  };

  /* ───────────── Textes (prêts pour une version anglaise) ───────────── */
  const ERROR_MESSAGES = {
    INVALID_SESSION_ID: 'Le Session ID est invalide.',
    SESSION_NOT_FOUND: 'Session introuvable : vérifiez l’ID ou demandez à l’organisateur s’il a démarré.',
    TIMEOUT: 'L’organisateur ne répond pas (délai de 10 secondes dépassé).',
    NETWORK_ERROR: 'Problème de connexion : vérifiez votre Internet puis réessayez.',
    SYNC_FAILED: 'La synchronisation du registre a échoué. Réessayez.',
    UNKNOWN: 'Une erreur inattendue est survenue. Réessayez.',
  };

  const STEP_ORDER = ['host', 'mesh', 'sync'];

  const BADGES = {
    pending: 'En attente',
    active: 'En cours',
    done: 'Terminé',
    failed: 'Échec',
    warning: 'Partiel',
  };

  const ICONS = {
    pending: '#i-clock',
    active: '#i-spinner',
    done: '#i-check',
    failed: '#i-cross',
    warning: '#i-alert',
  };

  /* ───────────── Utilitaires ───────────── */
  const $ = (id) => document.getElementById(id);

  const plural = (n, one, many) => (n > 1 ? many : one);

  const clampInt = (value, min = 0) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(min, n) : min;
  };

  function makeError(code) {
    const err = new Error(code);
    err.code = code;
    return err;
  }

  const isAbort = (err) => Boolean(err) && err.code === 'ABORTED';

  /** Transforme n’importe quelle erreur (projet ou PeerJS) en code d’erreur du projet. */
  function toCode(err, stepId) {
    if (err) {
      switch (err.type) { // types d’erreur PeerJS
        case 'peer-unavailable': return 'SESSION_NOT_FOUND';
        case 'network':
        case 'server-error':
        case 'socket-error':
        case 'socket-closed':
        case 'disconnected':
        case 'webrtc':
          return 'NETWORK_ERROR';
        default: break;
      }
      const raw = err.code || err.message;
      if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, raw)) return raw;
    }
    return stepId === 'sync' ? 'SYNC_FAILED' : 'UNKNOWN';
  }

  /** Rejette avec TIMEOUT après `ms`, ou ABORTED si `signal` est annulé. */
  function withTimeout(promise, ms, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        fn(value);
      };
      const onAbort = () => finish(reject, makeError('ABORTED'));
      const timer = setTimeout(() => finish(reject, makeError('TIMEOUT')), ms);
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(promise).then(
        (value) => finish(resolve, value),
        (err) => finish(reject, err)
      );
    });
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) { reject(makeError('ABORTED')); return; }
      const onAbort = () => { clearTimeout(timer); reject(makeError('ABORTED')); };
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /* ───────────── Réseau simulé (démonstration) ───────────── */
  function createMockAdapter(scenario) {
    let hostAttempt = 0;
    let meshAttempt = 0;
    let syncAttempt = 0;
    const FAKE_PEERS = ['peer-3f9a', 'peer-81c2', 'peer-b407', 'peer-d55e'];

    return {
      async connectToHost(sessionId, { signal }) {
        hostAttempt += 1;
        await sleep(1200, signal);
        if (hostAttempt === 1) {
          if (scenario === 'notfound') throw makeError('SESSION_NOT_FOUND');
          if (scenario === 'network') throw makeError('NETWORK_ERROR');
          if (scenario === 'timeout') {
            // L’hôte ne répond jamais : seul le délai de 10 s ou l’annulation met fin à l’attente.
            await new Promise((_, reject) => {
              signal.addEventListener('abort', () => reject(makeError('ABORTED')), { once: true });
            });
          }
        }
        return { hostId: sessionId };
      },

      async meshWithPeers({ signal, retryOnly, onProgress }) {
        meshAttempt += 1;
        const total = scenario === 'alone' ? 0 : FAKE_PEERS.length;
        if (total === 0) { await sleep(600, signal); return { connected: 0, total: 0, failed: [] }; }

        const isRetry = Array.isArray(retryOnly) && retryOnly.length > 0;
        const willFail = scenario === 'partial' && meshAttempt === 1;
        const reachable = willFail ? 2 : total;
        const startAt = isRetry ? total - retryOnly.length : 0;

        let connected = startAt;
        onProgress({ connected, total });
        for (let i = startAt; i < reachable; i += 1) {
          await sleep(500, signal);
          connected += 1;
          onProgress({ connected, total });
        }
        if (willFail) await sleep(500, signal);
        return { connected, total, failed: FAKE_PEERS.slice(reachable) };
      },

      async syncLedger({ signal, onProgress }) {
        syncAttempt += 1;
        const total = scenario === 'empty' ? 0 : 24;
        await sleep(400, signal);
        onProgress({ received: 0, total });
        if (total === 0) return { blocks: 0 };
        const failAt = scenario === 'syncfail' && syncAttempt === 1 ? 10 : Infinity;
        for (let received = 4; received <= total; received += 4) {
          await sleep(300, signal);
          if (received >= failAt) throw makeError('SYNC_FAILED');
          onProgress({ received, total });
        }
        return { blocks: total };
      },
    };
  }

  /* ───────────── État ───────────── */
  const state = {
    sessionId: '',
    steps: { host: 'pending', mesh: 'pending', sync: 'pending' },
    peers: { connected: 0, total: 0, failed: [] },
    sync: { received: 0, total: null },
    phase: 'idle',            // idle | running | partial | failed | ready | leaving
    error: null,              // { step, code }
    runId: 0,
    controller: null,
    adapterNet: null,         // dernier état fourni par adapter.onNetworkStatus
  };

  const params = new URLSearchParams(window.location.search);
  const demoScenario = params.get('demo') || 'ok';
  const adapter = window.WAITING_ROOM_ADAPTER || null;
  const isMock = !adapter;
  const net = adapter || createMockAdapter(demoScenario);

  /* ───────────── Éléments du DOM ───────────── */
  const el = {
    net: $('net'),
    netLabel: $('net-label'),
    themeToggle: $('theme-toggle'),
    sessionId: $('session-id'),
    statusText: $('status-text'),
    bannerRegion: $('banner-region'),
    peerCount: $('peer-count'),
    peerOf: $('peer-of'),
    peerLabel: $('peer-label'),
    failedBlock: $('failed-block'),
    failedList: $('failed-list'),
    progress: $('progress'),
    progressBar: $('progress-bar'),
    syncText: $('sync-text'),
    btnVote: $('btn-vote'),
    btnRetry: $('btn-retry'),
    btnContinue: $('btn-continue'),
    btnLeave: $('btn-leave'),
    dialog: $('leave-dialog'),
    leaveStay: $('leave-stay'),
    leaveConfirm: $('leave-confirm'),
    demoPanel: $('demo-panel'),
    demoSelect: $('demo-select'),
    steps: {},
  };
  STEP_ORDER.forEach((id) => {
    const li = document.querySelector('.step[data-step="' + id + '"]');
    el.steps[id] = {
      li,
      use: li.querySelector('use'),
      badge: li.querySelector('.step__badge'),
      detail: li.querySelector('.step__detail'),
    };
  });

  /* ───────────── Textes dynamiques ───────────── */
  function stepDetail(id, status) {
    const { peers, sync } = state;
    const failedCount = peers.failed.length;

    if (status === 'failed') return 'Cette étape a échoué : voir le message ci-dessous.';

    if (id === 'host') {
      if (status === 'active') return 'Contact de l’organisateur (délai maximum : 10 secondes)…';
      if (status === 'done') return 'Connecté à l’organisateur de la session.';
      return 'Premier contact avec l’organisateur du scrutin.';
    }
    if (id === 'mesh') {
      if (status === 'active') {
        return peers.total > 0
          ? peers.connected + ' sur ' + peers.total + ' ' + plural(peers.total, 'pair connecté', 'pairs connectés') + '…'
          : 'Recherche des autres électeurs connectés…';
      }
      if (status === 'warning') {
        return failedCount + ' ' + plural(failedCount, 'pair injoignable', 'pairs injoignables') +
          ' sur ' + peers.total + '.';
      }
      if (status === 'done') {
        return peers.total > 0
          ? peers.connected + ' ' + plural(peers.connected, 'pair connecté', 'pairs connectés') + '.'
          : 'Aucun autre pair pour l’instant : les prochains arrivants se relieront à vous.';
      }
      return 'Liaison directe avec les autres électeurs.';
    }
    // sync
    if (status === 'active') {
      return sync.total
        ? sync.received + ' sur ' + sync.total + ' ' + plural(sync.total, 'bloc reçu', 'blocs reçus') + '…'
        : 'Réception du registre des votes…';
    }
    if (status === 'done') {
      return sync.total
        ? 'Registre à jour (' + sync.total + ' ' + plural(sync.total, 'bloc', 'blocs') + ').'
        : 'Registre vide : aucun vote enregistré pour l’instant.';
    }
    return 'Réception du registre des votes.';
  }

  function headline() {
    switch (state.phase) {
      case 'ready': return 'Prêt à voter.';
      case 'partial': return 'Maillage partiel : certains pairs sont injoignables.';
      case 'failed': return 'La connexion a échoué.';
      case 'leaving': return 'Sortie de la session…';
      case 'running': {
        const active = STEP_ORDER.find((id) => state.steps[id] === 'active');
        if (active === 'host') return 'Connexion à l’organisateur…';
        if (active === 'mesh') return 'Liaison avec les autres pairs…';
        if (active === 'sync') return 'Synchronisation du registre…';
        return 'Connexion en cours…';
      }
      default: return 'Préparation de la connexion…';
    }
  }

  function currentBanner() {
    const failedCount = state.peers.failed.length;
    if (state.phase === 'failed' && state.error) {
      return { kind: 'error', text: ERROR_MESSAGES[state.error.code] || ERROR_MESSAGES.UNKNOWN };
    }
    if (!navigator.onLine) return { kind: 'error', text: ERROR_MESSAGES.NETWORK_ERROR };
    if (state.phase === 'partial') {
      return {
        kind: 'warning',
        text: failedCount + ' ' + plural(failedCount, 'pair est injoignable', 'pairs sont injoignables') +
          '. Réessayez, ou continuez sans ' + plural(failedCount, 'lui', 'eux') + ' : votre vote reste valide.',
      };
    }
    if (state.phase === 'ready') {
      return failedCount > 0
        ? { kind: 'warning', text: 'Vous pouvez voter, mais ' + failedCount + ' ' +
            plural(failedCount, 'pair reste injoignable', 'pairs restent injoignables') + '.' }
        : { kind: 'success', text: 'Registre synchronisé. Vous pouvez accéder au bulletin.' };
    }
    return null;
  }

  /* ───────────── Rendu ───────────── */
  let lastBannerKey = '';

  function renderStepper() {
    STEP_ORDER.forEach((id) => {
      const status = state.steps[id];
      const s = el.steps[id];
      s.li.dataset.status = status;
      s.use.setAttribute('href', ICONS[status]);
      s.badge.textContent = BADGES[status];
      s.detail.textContent = stepDetail(id, status);
      if (status === 'active') s.li.setAttribute('aria-current', 'step');
      else s.li.removeAttribute('aria-current');
    });
  }

  function renderPeers() {
    const { connected, total, failed } = state.peers;
    el.peerCount.textContent = String(connected);
    el.peerOf.textContent = total > 0 ? 'sur ' + total : '';
    el.peerLabel.textContent = plural(connected, 'pair connecté', 'pairs connectés');

    el.failedList.textContent = '';
    if (failed.length > 0) {
      failed.slice(0, CONFIG.maxFailedShown).forEach((id) => {
        const li = document.createElement('li');
        li.textContent = id;
        el.failedList.appendChild(li);
      });
      if (failed.length > CONFIG.maxFailedShown) {
        const li = document.createElement('li');
        const more = failed.length - CONFIG.maxFailedShown;
        li.textContent = '+ ' + more + ' ' + plural(more, 'autre', 'autres');
        el.failedList.appendChild(li);
      }
      el.failedBlock.hidden = false;
    } else {
      el.failedBlock.hidden = true;
    }
  }

  function renderSync() {
    const status = state.steps.sync;
    const { received, total } = state.sync;
    let pct = 0;
    let text = 'En attente';
    let indeterminate = false;

    if (status === 'done') {
      pct = 100;
      text = total ? total + ' / ' + total + ' ' + plural(total, 'bloc', 'blocs') : 'Registre vide : rien à synchroniser';
    } else if (status === 'active' || status === 'failed') {
      if (total === null) {
        indeterminate = status === 'active';
        text = status === 'active' ? 'Démarrage de la synchronisation…' : 'Synchronisation interrompue';
      } else {
        pct = total > 0 ? Math.round((received / total) * 100) : 100;
        text = received + ' / ' + total + ' ' + plural(total, 'bloc', 'blocs') +
          (status === 'failed' ? ' (interrompue)' : '');
      }
    }

    pct = Math.min(100, Math.max(0, pct));
    el.progress.dataset.status = status;
    el.progress.classList.toggle('is-indeterminate', indeterminate);
    el.progressBar.style.width = indeterminate ? '' : pct + '%';
    if (indeterminate) el.progress.removeAttribute('aria-valuenow');
    else el.progress.setAttribute('aria-valuenow', String(pct));
    el.progress.setAttribute('aria-valuetext', text);
    el.syncText.textContent = text;
  }

  function computeNet() {
    if (!navigator.onLine) return { status: 'offline', label: 'Hors ligne' };
    if (state.adapterNet) {
      const count = state.adapterNet.peerCount;
      const label = state.adapterNet.status === 'connected' ? 'Connecté'
        : state.adapterNet.status === 'offline' ? 'Hors ligne' : 'Connexion en cours';
      return {
        status: state.adapterNet.status,
        label: state.adapterNet.status === 'offline' ? label : label + ' · ' + count + ' ' + plural(count, 'pair', 'pairs'),
      };
    }
    const count = state.peers.connected;
    const suffix = ' · ' + count + ' ' + plural(count, 'pair', 'pairs');
    const degraded = state.peers.failed.length > 0 && (state.phase === 'partial' || state.phase === 'ready');
    if (state.phase === 'failed' && state.error &&
        (state.error.code === 'NETWORK_ERROR' || state.error.code === 'TIMEOUT')) {
      return { status: 'offline', label: 'Hors ligne' };
    }
    if (degraded) return { status: 'connecting', label: 'Réseau dégradé' + suffix };
    if (state.steps.host === 'done' && state.phase !== 'failed') return { status: 'connected', label: 'Connecté' + suffix };
    return { status: 'connecting', label: 'Connexion en cours' };
  }

  function renderNet() {
    const n = computeNet();
    el.net.dataset.status = n.status;
    if (el.netLabel.textContent !== n.label) el.netLabel.textContent = n.label;
  }

  function renderBanner() {
    const banner = currentBanner();
    const key = banner ? banner.kind + '|' + banner.text : '';
    if (key === lastBannerKey) return;
    lastBannerKey = key;
    el.bannerRegion.textContent = '';
    if (!banner) return;

    const box = document.createElement('div');
    box.className = 'banner banner--' + banner.kind;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', banner.kind === 'success' ? '#i-check' : banner.kind === 'warning' ? '#i-alert' : '#i-cross');
    svg.appendChild(use);
    const text = document.createElement('p');
    text.className = 'banner__text';
    text.textContent = banner.text;
    box.appendChild(svg);
    box.appendChild(text);
    el.bannerRegion.appendChild(box);
  }

  function renderActions() {
    const p = state.phase;
    const canRetry = p === 'partial' ||
      (p === 'failed' && state.error && state.error.code !== 'INVALID_SESSION_ID');
    el.btnRetry.hidden = !canRetry;
    el.btnContinue.hidden = p !== 'partial';
    el.btnVote.hidden = p !== 'ready';
    el.btnLeave.textContent = p === 'ready' ? 'Quitter' : 'Annuler';
  }

  let lastStatusText = '';
  function render() {
    renderStepper();
    renderPeers();
    renderSync();
    renderNet();
    renderBanner();
    const text = headline();
    if (text !== lastStatusText) { lastStatusText = text; el.statusText.textContent = text; }
    renderActions();
  }

  /* ───────────── Déroulement ───────────── */
  function abortCurrent() {
    if (state.controller) state.controller.abort();
    state.controller = null;
  }

  /** Marque l’étape active (ou la première non terminée) en échec. */
  function failActive(code) {
    const id = STEP_ORDER.find((s) => state.steps[s] === 'active') ||
      STEP_ORDER.find((s) => state.steps[s] === 'pending') || 'host';
    state.steps[id] = 'failed';
    state.error = { step: id, code };
    state.phase = 'failed';
  }

  async function run(from) {
    abortCurrent();
    state.runId += 1;
    const runId = state.runId;
    const controller = new AbortController();
    state.controller = controller;
    const { signal } = controller;
    const alive = () => runId === state.runId && !signal.aborted;

    const startIndex = STEP_ORDER.indexOf(from);
    const retryOnly = from === 'mesh' ? state.peers.failed.slice() : [];

    // Remise à zéro des étapes à (re)faire
    STEP_ORDER.forEach((id, i) => { if (i >= startIndex) state.steps[id] = 'pending'; });
    if (startIndex <= 0) state.peers = { connected: 0, total: 0, failed: [] };
    if (startIndex === 1) state.peers.failed = [];
    if (startIndex <= 2) state.sync = { received: 0, total: null };
    state.error = null;
    state.phase = 'running';
    render();

    const runners = {
      async host() {
        const stepCtl = new AbortController();
        const link = () => stepCtl.abort();
        signal.addEventListener('abort', link, { once: true });
        try {
          await withTimeout(net.connectToHost(state.sessionId, { signal: stepCtl.signal }), CONFIG.hostTimeoutMs, signal);
        } catch (err) {
          stepCtl.abort(); // annule aussi la tentative côté adaptateur (ex. après TIMEOUT)
          throw err;
        } finally {
          signal.removeEventListener('abort', link);
        }
      },

      async mesh() {
        const res = await net.meshWithPeers({
          signal,
          retryOnly,
          onProgress: (p) => {
            if (!alive() || !p) return;
            state.peers.connected = clampInt(p.connected);
            state.peers.total = Math.max(clampInt(p.total), state.peers.connected);
            render();
          },
        }) || {};
        if (!alive()) return;
        const failed = Array.isArray(res.failed) ? res.failed.map(String) : [];
        const connected = clampInt(res.connected);
        state.peers = { connected, total: Math.max(clampInt(res.total), connected + failed.length), failed };
      },

      async sync() {
        const res = await net.syncLedger({
          signal,
          onProgress: (p) => {
            if (!alive() || !p) return;
            const total = clampInt(p.total);
            state.sync.total = total;
            state.sync.received = Math.min(clampInt(p.received), total);
            render();
          },
        }) || {};
        if (!alive()) return;
        const blocks = res.blocks === undefined ? (state.sync.total || 0) : clampInt(res.blocks);
        state.sync = { received: blocks, total: blocks };
      },
    };

    try {
      if (!navigator.onLine) throw makeError('NETWORK_ERROR');

      for (let i = startIndex; i < STEP_ORDER.length; i += 1) {
        const id = STEP_ORDER[i];
        state.steps[id] = 'active';
        render();
        await runners[id]();
        if (!alive()) return;

        if (id === 'mesh' && state.peers.failed.length > 0) {
          state.steps.mesh = 'warning';
          state.phase = 'partial';
          render();
          return; // pause : l’électeur choisit Réessayer ou Continuer
        }
        state.steps[id] = 'done';
        render();
      }

      state.phase = 'ready';
      render();
      el.btnVote.focus({ preventScroll: false });
      document.dispatchEvent(new CustomEvent('waitingroom:ready', {
        detail: { sessionId: state.sessionId, peers: state.peers.connected },
      }));
    } catch (err) {
      if (!alive()) return; // annulé ou remplacé par une autre tentative
      const stepId = STEP_ORDER.find((s) => state.steps[s] === 'active') || from;
      failActive(toCode(err, stepId));
      render();
    }
  }

  function retry() {
    if (state.phase === 'partial') run('mesh');
    else if (state.phase === 'failed' && state.error) run(state.error.step);
  }

  /* ───────────── Quitter ───────────── */
  function openLeave() {
    if (typeof el.dialog.showModal === 'function') {
      if (!el.dialog.open) el.dialog.showModal();
    } else {
      el.dialog.setAttribute('open', '');
    }
  }

  function closeLeave() {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
  }

  function leave() {
    closeLeave();
    state.runId += 1;       // invalide toute tentative en cours
    abortCurrent();
    state.phase = 'leaving';
    render();
    try { if (typeof net.leave === 'function') net.leave(); } catch (e) { /* on quitte quand même */ }
    window.location.assign(CONFIG.joinUrl);
  }

  /* ───────────── Thème clair / sombre ───────────── */
  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
    if (persist) {
      try { localStorage.setItem(CONFIG.themeKey, theme); } catch (e) { /* stockage indisponible */ }
    }
  }

  function initTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
    el.themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
    // Suit le système tant que l’électeur n’a pas choisi lui-même
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (e) => {
        let saved = null;
        try { saved = localStorage.getItem(CONFIG.themeKey); } catch (err) { /* ignoré */ }
        if (saved !== 'light' && saved !== 'dark') applyTheme(e.matches ? 'dark' : 'light', false);
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
  }

  /* ───────────── Initialisation ───────────── */
  function init() {
    initTheme();

    // Session ID (majuscules automatiques)
    let sessionId = (params.get('session') || '').trim().toUpperCase();
    if (!sessionId && isMock) sessionId = 'DEMO2026';
    state.sessionId = sessionId;
    el.sessionId.textContent = sessionId || '—';

    // Panneau de démonstration
    if (isMock) {
      el.demoPanel.hidden = false;
      el.demoSelect.value = Array.from(el.demoSelect.options).some((o) => o.value === demoScenario) ? demoScenario : 'ok';
      el.demoSelect.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('demo', el.demoSelect.value);
        window.location.assign(url.toString());
      });
    }

    // Boutons
    el.btnLeave.addEventListener('click', openLeave);
    el.leaveStay.addEventListener('click', closeLeave);
    el.leaveConfirm.addEventListener('click', leave);
    el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) closeLeave(); }); // clic sur le fond
    el.btnRetry.addEventListener('click', retry);
    el.btnContinue.addEventListener('click', () => { if (state.phase === 'partial') run('sync'); });
    el.btnVote.addEventListener('click', () => {
      if (state.phase === 'ready') window.location.assign(CONFIG.nextUrl);
    });

    // Réseau du navigateur
    window.addEventListener('offline', () => {
      if (state.phase === 'running') {
        state.runId += 1;
        abortCurrent();
        failActive('NETWORK_ERROR');
      }
      render();
    });
    window.addEventListener('online', render);
    window.addEventListener('pagehide', abortCurrent);

    // État réseau fourni par M1 (T1.8)
    if (typeof net.onNetworkStatus === 'function') {
      net.onNetworkStatus((s) => {
        if (s && ['connected', 'connecting', 'offline'].indexOf(s.status) !== -1) {
          state.adapterNet = { status: s.status, peerCount: clampInt(s.peerCount) };
          renderNet();
        }
      });
    }

    // Session ID absent ou mal formé : on ne tente aucune connexion
    if (!CONFIG.sessionIdPattern.test(sessionId)) {
      state.steps.host = 'failed';
      state.error = { step: 'host', code: 'INVALID_SESSION_ID' };
      state.phase = 'failed';
      render();
      return;
    }

    run('host');
  }

  init();
})();
