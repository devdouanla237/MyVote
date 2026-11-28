/* ==========================================================
   P2P-VoteEngine · Code partagé par les pages électeur
   (thème clair/sombre, indicateur réseau, notifications)
   ========================================================== */
'use strict';

const P2P = (() => {
  const KEYS = {
    theme: 'p2pve.theme',
    draft: 'p2pve.ballotDraft',     // brouillon créé à la page 2
    receipt: 'p2pve.receipt'        // reçu affiché une seule fois
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* Protège le HTML quand on insère du texte venant de l'extérieur */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); return true; } catch { return false; } },
    remove(area, k) { try { window[area].removeItem(k); } catch { /* ignoré */ } }
  };

  /* ---------- Thème ---------- */
  function setTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    $$('[data-theme-btn]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.themeBtn === theme)));
    if (persist) store.set('localStorage', KEYS.theme, theme);
  }
  function initTheme() {
    const saved = store.get('localStorage', KEYS.theme);
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (dark ? 'dark' : 'light'), false);
    $$('[data-theme-btn]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeBtn)));
  }

  /* ---------- Indicateur réseau : vert / orange / rouge ---------- */
  let forced = null;
  function renderNetwork(peers) {
    const net = $('#net');
    if (!net) return;
    const conn = navigator.connection;
    let s = 'online';
    if (forced === 'offline' || !navigator.onLine) s = 'offline';
    else if (conn && ['slow-2g', '2g'].includes(conn.effectiveType)) s = 'degraded';
    net.dataset.state = s;
    $('#netLabel').textContent =
      s === 'offline' ? 'Déconnecté'
      : s === 'degraded' ? 'Réseau dégradé'
      : `Connecté · ${peers} pair${peers > 1 ? 's' : ''}`;
  }
  function initNetwork(peers = 4, force = null) {
    forced = force;
    const update = () => renderNetwork(peers);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (navigator.connection) navigator.connection.addEventListener('change', update);
    update();
  }

  /* ---------- Notifications ---------- */
  function toast(message, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 4500);
  }

  return { KEYS, $, $$, sleep, esc, store, initTheme, initNetwork, toast };
})();