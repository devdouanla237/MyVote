
/** Délai maximum d'attente d'une réponse de l'hôte, en millisecondes (10 s). */
export const JOIN_TIMEOUT_MS = 10000;

/**
 * Format valide d'un Session ID : exactement 8 caractères parmi A-Z et 0-9.
 * `^` = début du texte, `$` = fin du texte, `{8}` = exactement 8 fois.
 * @type {RegExp}
 */
const SESSION_ID_PATTERN = /^[A-Z0-9]{8}$/;

/**
 * Codes d'erreur renvoyés par `joinSession`. On compare toujours avec ces
 * constantes (jamais avec un texte écrit à la main) pour éviter les fautes de frappe.
 * `Object.freeze` interdit de modifier l'objet par erreur.
 */
export const JOIN_ERRORS = Object.freeze({
  /** Le Session ID n'a pas le bon format (ajout par rapport au sujet : évite un appel réseau inutile). */
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  /** Aucun hôte n'existe avec ce Session ID. */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** L'hôte n'a pas répondu avant la fin du délai. */
  TIMEOUT: 'TIMEOUT',
  /** Problème de réseau ou de serveur de signalisation. */
  NETWORK_ERROR: 'NETWORK_ERROR',
});

/**
 * Messages affichables à l'électeur pour chaque code d'erreur.
 * L'interface (M5) peut les afficher tels quels.
 */
const ERROR_MESSAGES = Object.freeze({
  [JOIN_ERRORS.INVALID_SESSION_ID]:
    'Le Session ID est invalide.',
  [JOIN_ERRORS.SESSION_NOT_FOUND]:
    "Session introuvable. Vérifiez le Session ID ou demandez à l'organisateur s'il a bien démarré.",
  [JOIN_ERRORS.TIMEOUT]:
    "L'organisateur ne répond pas (délai de 10 secondes dépassé). Réessayez dans un instant.",
  [JOIN_ERRORS.NETWORK_ERROR]:
    'Problème de connexion réseau. Vérifiez votre connexion Internet puis réessayez.',
});


export class JoinError extends Error {

  constructor(code, detail) {
    super(ERROR_MESSAGES[code] || 'Erreur inconnue.');
    /** @type {string} Nom de la classe, utile dans la console. */
    this.name = 'JoinError';
    /** @type {string} Code de l'erreur (valeur de `JOIN_ERRORS`). */
    this.code = code;
    /** @type {string|undefined} Détail technique, pour le débogage seulement. */
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// 3. INSTANCE DE NETWORKMANAGER PARTAGÉE
// ---------------------------------------------------------------------------


let sharedNetwork = null;

/**
 * Indique quelle instance de NetworkManager utiliser.
 * À appeler UNE FOIS au démarrage de l'application, avant `joinSession`.
 *
 * @param {object} manager  Instance de NetworkManager (T1.1).
 * @returns {void}
 */
export function setNetworkManager(manager) {
  sharedNetwork = manager;
}


export function joinSession(sessionId, network = sharedNetwork) {
  // `new Promise` : on décide nous-mêmes quand résoudre (resolve) ou rejeter (reject).
  return new Promise((resolve, reject) => {
    // --- Étape 1 : vérifications avant tout appel réseau -------------------
    if (!network) {
      // Erreur de programmation (oubli de setNetworkManager), pas une erreur d'électeur.
      reject(new Error("NetworkManager non défini : appelez setNetworkManager() d'abord."));
      return;
    }

    // `String(...)` protège si on reçoit autre chose qu'une chaîne ; `trim` retire les
    // espaces autour ; `toUpperCase` accepte « ab12cd34 » comme « AB12CD34 ».
    const id = String(sessionId ?? '').trim().toUpperCase();
    if (!SESSION_ID_PATTERN.test(id)) {
      reject(new JoinError(JOIN_ERRORS.INVALID_SESSION_ID));
      return;
    }

    // --- Étape 2 : état partagé entre les fonctions internes ----------------
    /** Vrai dès que la promesse est réglée : les événements tardifs sont alors ignorés. */
    let settled = false;
    /** Identifiant du minuteur, pour pouvoir l'annuler. */
    let timerId = null;

    /**
     * Arrête d'écouter les événements et le minuteur. Appelée à la fin, quel que soit le résultat.
     * `off` est facultatif dans NetworkManager : on vérifie qu'il existe avant de l'appeler.
     */
    function cleanup() {
      clearTimeout(timerId);
      if (typeof network.off === 'function') {
        network.off('connection', onConnection);
        network.off('error', onError);
      }
    }

    /** Termine avec succès (une seule fois). */
    function succeed() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(id);
    }

    /**
     * Termine avec une erreur typée (une seule fois).
     * @param {string} code    Valeur de `JOIN_ERRORS`.
     * @param {string} [detail] Détail technique.
     */
    function fail(code, detail) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new JoinError(code, detail));
    }

    // --- Étape 3 : réactions aux événements du réseau -----------------------

    /**
     * Événement `connection` : un pair vient de se connecter.
     * C'est un succès seulement si ce pair est bien l'hôte (son ID = le Session ID).
     * @param {string} peerId  ID du pair connecté.
     */
    function onConnection(peerId) {
      if (peerId === id) succeed();
    }

  
    function onError(err) {
      const type = err && err.type;
      const detail = err && err.message ? err.message : String(type || 'inconnue');
      if (type === 'peer-unavailable') {
        fail(JOIN_ERRORS.SESSION_NOT_FOUND, detail);
      } else {
        fail(JOIN_ERRORS.NETWORK_ERROR, detail);
      }
    }

    // --- Étape 4 : minuteur de 10 secondes (couvre l'ouverture du peer ET la connexion)
    timerId = setTimeout(() => fail(JOIN_ERRORS.TIMEOUT), JOIN_TIMEOUT_MS);

    // On écoute AVANT d'appeler connectTo, sinon on pourrait rater un événement rapide.
    network.on('connection', onConnection);
    network.on('error', onError);

    // --- Étape 5 : ouvrir le peer local si besoin, puis se connecter à l'hôte
    const peerAlreadyOpen = network.getPeerId() !== null;
    const ready = peerAlreadyOpen ? Promise.resolve() : network.init();

    ready
      .then(() => {
        if (settled) return; // le délai a pu expirer pendant l'ouverture du peer
        network.connectTo(id);
      })
      .catch((err) => {
        // init() ou connectTo() a échoué directement.
        fail(JOIN_ERRORS.NETWORK_ERROR, err && err.message ? err.message : String(err));
      });
  });
}