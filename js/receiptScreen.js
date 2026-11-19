/*
 * T5.5 : Écran de confirmation et reçu
 * Fichier : /js/voter/receiptScreen.js
 *
 * Entrée  : le reçu (string) fourni par M2 (un faux en Phase 1).
 * Sorties : l'affichage à l'écran, le texte copié dans le presse-papiers
 *           et le fichier recu.txt. Les trois contiennent EXACTEMENT le reçu
 *           (aucun espace ajouté, aucun retrait, aucune transformation).
 *
 * Utilisation (depuis un autre écran, ex. après le vote) :
 *     showReceiptScreen(receipt);
 *
 * Script classique (pas de module) : pas besoin de type="module" dans voter.html.
 */
(function () {
  'use strict';

  const COPIED_DURATION_MS = 2000; // durée d'affichage de « Copié »
  const FILE_NAME = 'recu.txt';

  // --- Variables du cahier des charges ---
  let receipt = '';     // string : le reçu de M2
  let fileContent = ''; // string : texte écrit dans le fichier, égal au reçu
  let blob = null;      // Blob   : fichier en mémoire, type text/plain

  let messageTimer = null;
  let bound = false;

  // --- Accès aux éléments HTML ---
  function el(id) {
    return document.getElementById(id);
  }

  // Un reçu valide est une chaîne non vide (les espaces seuls ne comptent pas).
  function isValidReceipt(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  // --- Message « Copié » ---
  function showMessage(text, isError) {
    const p = el('receipt-message');
    if (!p) return;
    clearTimeout(messageTimer); // un nouveau clic relance les 2 secondes
    p.textContent = text;
    p.classList.toggle('is-error', Boolean(isError));
    messageTimer = setTimeout(function () {
      p.textContent = '';
      p.classList.remove('is-error');
    }, COPIED_DURATION_MS);
  }

  // Plan B si l'API moderne est indisponible (page ni en localhost ni en HTTPS).
  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  // --- Copier ---
  async function copyReceipt() {
    if (!isValidReceipt(receipt)) return;
    let ok = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(receipt);
        ok = true;
      } catch (e) {
        ok = legacyCopy(receipt);
      }
    } else {
      ok = legacyCopy(receipt);
    }
    if (ok) {
      showMessage('Copié', false);
    } else {
      showMessage('Copie impossible : sélectionne le reçu et copie-le à la main.', true);
    }
  }

  // --- Télécharger (.txt) ---
  function downloadReceipt() {
    if (!isValidReceipt(receipt)) return;
    fileContent = receipt;                                   // égal au reçu
    blob = new Blob([fileContent], { type: 'text/plain' });  // fichier en mémoire
    const url = URL.createObjectURL(blob);                   // URL temporaire
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();                                            // clic simulé
    document.body.removeChild(link);
    // Libération de l'URL (léger délai pour laisser le navigateur lancer le téléchargement).
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --- Liaison des boutons (une seule fois) ---
  function bindButtons() {
    if (bound) return;
    const copyBtn = el('receipt-copy');
    const downloadBtn = el('receipt-download');
    if (copyBtn) copyBtn.addEventListener('click', copyReceipt);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadReceipt);
    bound = true;
  }

  // --- Affichage de l'écran ---
  function showReceiptScreen(newReceipt) {
    bindButtons();

    const screen = el('screen-receipt');
    const text = el('receipt-text');
    const copyBtn = el('receipt-copy');
    const downloadBtn = el('receipt-download');

    clearTimeout(messageTimer);
    const message = el('receipt-message');
    if (message) {
      message.textContent = '';
      message.classList.remove('is-error');
    }

    if (isValidReceipt(newReceipt)) {
      receipt = newReceipt;
      fileContent = newReceipt;
      blob = null;
      // textContent : le reçu est affiché tel quel, jamais interprété comme du HTML.
      if (text) text.textContent = receipt;
      if (copyBtn) copyBtn.disabled = false;
      if (downloadBtn) downloadBtn.disabled = false;
    } else {
      // Reçu absent ou invalide : on le dit clairement et on bloque les boutons.
      receipt = '';
      fileContent = '';
      blob = null;
      if (text) text.textContent = 'Reçu indisponible.';
      if (copyBtn) copyBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
      console.error('receiptScreen : reçu invalide ou vide', newReceipt);
    }

    if (screen) screen.hidden = false;
  }

  // --- API publique (pour voter.html, les autres écrans et les tests console) ---
  window.showReceiptScreen = showReceiptScreen;
  window.receiptScreen = {
    show: showReceiptScreen,
    copy: copyReceipt,
    download: downloadReceipt,
    getReceipt: function () { return receipt; },
    getFileContent: function () { return fileContent; },
    getBlob: function () { return blob; }
  };
})();