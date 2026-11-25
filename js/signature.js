(function () {
  'use strict';
  const input = document.getElementById('signature-input');
  const generateButton = document.getElementById('signature-generate');
  const copyButton = document.getElementById('signature-copy');
  const downloadButton = document.getElementById('signature-download');
  const result = document.getElementById('signature-result');
  const hashOutput = document.getElementById('signature-hash');
  const qrContainer = document.getElementById('signature-qr');
  const status = document.getElementById('signature-status');
  let currentHash = '';

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function generate() {
    const value = input.value;
    if (!value.length) {
      currentHash = '';
      result.hidden = true;
      copyButton.disabled = true;
      downloadButton.disabled = true;
      setStatus('Saisissez un texte avant de générer une signature.', true);
      input.focus();
      return;
    }
    if (typeof window.receiptHash !== 'function') {
      setStatus('Le module RHE-128 n’a pas été chargé.', true);
      return;
    }
    if (typeof window.QRCode !== 'function') {
      setStatus('Le générateur QR n’est pas disponible. Vérifiez votre connexion Internet.', true);
      return;
    }

    try {
      currentHash = window.receiptHash(value);
      hashOutput.textContent = currentHash;
      qrContainer.replaceChildren();
      new window.QRCode(qrContainer, {
        text: currentHash,
        width: 220,
        height: 220,
        colorDark: '#111827',
        colorLight: '#FFFFFF',
        correctLevel: window.QRCode.CorrectLevel.H
      });
      result.hidden = false;
      copyButton.disabled = false;
      downloadButton.disabled = false;
      setStatus('Signature générée : 24 caractères. Le QR code contient cette empreinte.');
    } catch (error) {
      currentHash = '';
      result.hidden = true;
      copyButton.disabled = true;
      downloadButton.disabled = true;
      setStatus('Erreur lors de la génération : ' + error.message, true);
    }
  }

  async function copyHash() {
    if (!currentHash) return;
    try {
      await navigator.clipboard.writeText(currentHash);
      setStatus('Empreinte copiée dans le presse-papiers.');
    } catch (_) {
      setStatus('Copie impossible dans ce contexte. Sélectionnez l’empreinte pour la copier.', true);
    }
  }

  function downloadQr() {
    const image = qrContainer.querySelector('img');
    const canvas = qrContainer.querySelector('canvas');
    const dataUrl = image ? image.src : (canvas ? canvas.toDataURL('image/png') : '');
    if (!dataUrl) {
      setStatus('Le QR code n’est pas encore disponible.', true);
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'signature-' + currentHash + '.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus('QR code téléchargé.');
  }

  generateButton.addEventListener('click', generate);
  copyButton.addEventListener('click', copyHash);
  downloadButton.addEventListener('click', downloadQr);
  input.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generate();
  });
})();
