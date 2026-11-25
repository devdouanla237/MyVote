import { network, hostSession } from "./NetworkManager/host.js";
import { setNetworkManager, joinSession } from "./NetworkManager/join.js";
import { startMesh, stopMesh } from "./NetworkManager/mesh.js";

const $ = (id) => document.getElementById(id);
const form = $("connection-form");
const roleInput = $("role");
const sessionInput = $("session-id");
const connectButton = $("connect-button");
const retryButton = $("retry-button");
const cancelButton = $("cancel-button");
const quitButton = $("quit-button");
const messageBox = $("global-message");
const stepIds = ["step-host", "step-mesh", "step-ledger"];
let mesh = null;
let active = false;
let meshTimer = null;
let peerCount = 0;
let role = "voter";

function setMessage(message, kind = "info") {
  messageBox.textContent = message;
  messageBox.dataset.kind = kind;
}

function setStep(index, state, label) {
  const step = $(stepIds[index]);
  step.dataset.state = state;
  step.querySelector(".step-status").textContent = label;
  const icon = step.querySelector(".step-icon span");
  icon.textContent = state === "done" ? "✓" : state === "error" ? "!" : String(index + 1);
}

function updatePeerCount() {
  peerCount = mesh ? mesh.getPeers().length : 0;
  $("peer-count").textContent = String(peerCount);
}

function setSyncProgress(value, label) {
  const percentage = Math.max(0, Math.min(100, Number(value) || 0));
  $("sync-progress").style.width = `${percentage}%`;
  $("sync-percent").textContent = `${percentage} %`;
  $("sync-label").textContent = label;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percentage));
}

function cleanupNetwork() {
  clearTimeout(meshTimer);
  meshTimer = null;
  stopMesh();
  mesh = null;
  if (network && !network.destroyed) network.destroy();
  active = false;
  retryButton.hidden = true;
  $("ready-banner").hidden = true;
  $("session-strip").hidden = true;
  $("peer-count").textContent = "0";
  setSyncProgress(0, "En attente du registre…");
  stepIds.forEach((_, index) => setStep(index, "pending", "En attente"));
}

function onMeshReady() {
  clearTimeout(meshTimer);
  setStep(1, "done", "Terminée");
  updatePeerCount();
  setStep(2, "active", "En cours");
  setSyncProgress(0, "En attente du module de registre distribué…");
  setMessage("Le réseau P2P est établi. La synchronisation du registre sera finalisée lorsque le module Ledger sera connecté à cette page.");
}

function startPeerMesh(sessionId) {
  stopMesh();
  mesh = startMesh(network, role === "host" ? { isHost: true } : { hostId: sessionId, role: "voter" });
  mesh.on("peer-joined", () => {
    updatePeerCount();
    if (role === "host" && peerCount > 0) {
      setStep(1, "done", "Terminée");
      setStep(2, "active", "En cours");
      $("mesh-note").textContent = `${peerCount} participant(s) relié(s) au maillage.`;
    }
  });
  mesh.on("peer-left", () => {
    updatePeerCount();
    if (role === "host" && peerCount === 0) {
      setStep(1, "active", "En attente");
      $("mesh-note").textContent = "En attente de participants dans la salle.";
    }
  });
  mesh.on("mesh-ready", onMeshReady);
  updatePeerCount();

  if (role === "host") {
    setStep(1, "active", "En attente");
    $("mesh-note").textContent = "Hôte actif : en attente des connexions des autres participants.";
    setMessage("La salle est créée. Les électeurs peuvent maintenant rejoindre la session.", "success");
  } else {
    $("mesh-note").textContent = "Découverte des pairs annoncés par l’hôte…";
    meshTimer = setTimeout(() => {
      if (!active) return;
      setStep(1, "error", "Maillage partiel");
      $("mesh-note").textContent = "Certains pairs peuvent être injoignables. Vous pouvez réessayer.";
      retryButton.hidden = false;
      setMessage("La connexion à l’hôte est établie, mais le maillage complet n’a pas été confirmé.", "error");
    }, 15000);
  }
}

async function connect(event) {
  event.preventDefault();
  if (active) return;
  const sessionId = sessionInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(sessionId)) {
    setMessage("L’identifiant de session doit contenir exactement 8 lettres majuscules ou chiffres.", "error");
    sessionInput.focus();
    return;
  }

  role = roleInput.value;
  active = true;
  connectButton.disabled = true;
  connectButton.textContent = "Connexion…";
  retryButton.hidden = true;
  $("session-strip").hidden = false;
  $("session-value").textContent = sessionId;
  $("peer-value").textContent = "Initialisation…";
  stepIds.forEach((_, index) => setStep(index, index === 0 ? "active" : "pending", index === 0 ? "En cours" : "En attente"));
  setMessage(role === "host" ? "Création de la salle et connexion au serveur de signalisation…" : "Connexion à l’organisateur…");

  try {
    if (role === "host") {
      await hostSession(sessionId);
    } else {
      setNetworkManager(network);
      await joinSession(sessionId, network);
    }
    $("peer-value").textContent = network.getPeerId() || "Connecté";
    setStep(0, "done", "Terminée");
    setStep(1, "active", "En cours");
    setMessage("Connexion à l’hôte réussie. Préparation du maillage…", "success");
    startPeerMesh(sessionId);
  } catch (error) {
    active = false;
    setStep(0, "error", "Échec");
    const explanation = error?.message || "Une erreur inconnue est survenue.";
    setMessage(explanation, "error");
    retryButton.hidden = role !== "voter";
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = "Se connecter";
  }
}

retryButton.addEventListener("click", () => {
  if (!active) return;
  retryButton.hidden = true;
  setStep(1, "active", "Nouvel essai");
  setMessage("Nouvelle tentative de découverte des pairs…");
  startPeerMesh(sessionInput.value.trim().toUpperCase());
});

// Le module Ledger pourra notifier cette page sans dépendance directe à son implémentation.
window.addEventListener("myvote:ledger-sync-progress", (event) => {
  const { progress = 0, message = "Synchronisation du registre…" } = event.detail || {};
  setStep(2, "active", "En cours");
  setSyncProgress(progress, message);
});
window.addEventListener("myvote:ledger-sync-complete", () => {
  setSyncProgress(100, "Registre synchronisé");
  setStep(2, "done", "Terminée");
  $("ready-banner").hidden = false;
  setMessage("Toutes les étapes sont terminées. Vous pouvez poursuivre vers le vote.", "success");
});
window.addEventListener("myvote:ledger-sync-error", (event) => {
  setStep(2, "error", "Échec");
  setMessage(event.detail?.message || "La synchronisation du registre a échoué.", "error");
});

form.addEventListener("submit", connect);
cancelButton.addEventListener("click", () => {
  window.location.reload();
});
quitButton.addEventListener("click", () => {
  window.location.href = "index.html";
});
window.addEventListener("beforeunload", () => {
  clearTimeout(meshTimer);
  stopMesh();
});
