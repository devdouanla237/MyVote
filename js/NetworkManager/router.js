/**
 * router.js — T1.5 : Diffusion et routage des messages
 *
 * S'appuie sur NetworkManager (T1.1) sans le modifier : événement "data",
 * méthode send(), propriété connections.
 *
 * Rôle :
 *   - valider chaque message reçu selon CONTRACTS.md (section « Messages »)
 *   - ignorer sans planter les messages inconnus, mal formés ou déjà vus
 *   - appeler le(s) gestionnaire(s) enregistré(s) pour message.type
 *   - envoyer : broadcast(msg) à tous les voisins, sendTo(peerId, msg) à un seul
 *
 * Utilisation :
 *   import { router, registerHandler, broadcast, sendTo, createMessage } from "./router.js";
 *
 *   router.attach(network);                     // une fois, après hostSession / joinSession
 *
 *   registerHandler("BALLOT_BLOCK", (message, { from }) => {
 *       // message = enveloppe complète validée
 *       // from    = peerId de la connexion qui a livré le message (fiable)
 *       //           message.from = auteur déclaré (peut différer si le message est relayé)
 *   });
 *
 *   broadcast(router.create("BALLOT_BLOCK", { block }));
 *   sendTo(peerId, router.create("LEDGER_REQUEST", { fromIndex: 0 }));
 *
 * Les gestionnaires peuvent être enregistrés AVANT attach() : ils sont conservés.
 *
 * Un message ne déclenche ses gestionnaires qu'UNE seule fois : son `id` est mémorisé.
 * Cela permet la rediffusion décrite dans le contrat (BALLOT_BLOCK : « l'ajoute puis
 * le rediffuse une seule fois ») sans boucle ni doublon.
 */

// ----------------------------------------------------------------------
// Types de messages (CONTRACTS.md, section 5)
// ----------------------------------------------------------------------

export const MESSAGE_TYPES = Object.freeze({
    JOIN: "JOIN",
    PEER_LIST: "PEER_LIST",
    BALLOT_BLOCK: "BALLOT_BLOCK",
    LEDGER_REQUEST: "LEDGER_REQUEST",
    LEDGER_SYNC: "LEDGER_SYNC",
    CLOSE_ELECTION: "CLOSE_ELECTION",
    KEY_REVEAL: "KEY_REVEAL",
    REJECT: "REJECT",
    PING: "PING",
    RESULT_HASH: "RESULT_HASH"
});

const TYPE_LIST = Object.values(MESSAGE_TYPES);

// Formats (CONTRACTS.md, sections 2 et 3)
const MESSAGE_ID_PATTERN = /^[0-9a-f]{12}$/;
const SESSION_ID_PATTERN = /^[A-Z0-9]{8}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

const JOIN_ROLES = ["voter", "organizer"];
const REJECT_REASONS = [
    "BAD_FORMAT",
    "BAD_PREV_HASH",
    "BAD_INDEX",
    "DUPLICATE_TOKEN",
    "ELECTION_CLOSED"
];

// Taille maximale d'un lot LEDGER_SYNC
const MAX_LEDGER_BATCH = 20;

// Nombre d'identifiants de messages mémorisés (les plus anciens sont oubliés)
const DEFAULT_MAX_SEEN = 5000;


// ----------------------------------------------------------------------
// Création et validation des messages
// ----------------------------------------------------------------------

const isObject = value =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isCount = value => Number.isInteger(value) && value >= 0;

const matches = (pattern, value) =>
    typeof value === "string" && pattern.test(value);


// Identifiant de message : 12 caractères hexadécimaux minuscules (crypto.getRandomValues)
export function generateMessageId() {

    const bytes = new Uint8Array(6);

    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}


// Construire un message complet (enveloppe + payload)
export function createMessage(type, payload = {}, from) {

    return {
        id: generateMessageId(),
        type,
        from,
        timestamp: Date.now(),
        payload
    };
}


// Contrôle du payload selon le type. Retourne un texte d'erreur, ou null si valide.
// Pour BALLOT_BLOCK et LEDGER_SYNC, on vérifie seulement la structure du message ;
// le contenu des blocs est contrôlé par validateBlock (T3.2), qui peut répondre REJECT.
const PAYLOAD_CHECKS = {

    JOIN: p =>
        !matches(SESSION_ID_PATTERN, p.sessionId) ? "payload.sessionId invalide" :
        !JOIN_ROLES.includes(p.role) ? "payload.role invalide" :
        null,

    PEER_LIST: p =>
        !Array.isArray(p.peers) || !p.peers.every(id => typeof id === "string" && id !== "")
            ? "payload.peers doit être un tableau d'identifiants" : null,

    BALLOT_BLOCK: p =>
        !isObject(p.block) ? "payload.block doit être un objet" : null,

    LEDGER_REQUEST: p =>
        !isCount(p.fromIndex) ? "payload.fromIndex invalide" : null,

    LEDGER_SYNC: p =>
        !isCount(p.fromIndex) ? "payload.fromIndex invalide" :
        !Array.isArray(p.blocks) || p.blocks.length > MAX_LEDGER_BATCH || !p.blocks.every(isObject)
            ? `payload.blocks doit être un tableau de ${MAX_LEDGER_BATCH} objets au plus` :
        typeof p.isLast !== "boolean" ? "payload.isLast doit être un booléen" :
        null,

    CLOSE_ELECTION: p =>
        !isCount(p.closedAt) ? "payload.closedAt invalide" :
        !isCount(p.finalLength) ? "payload.finalLength invalide" :
        null,

    KEY_REVEAL: p =>
        !isObject(p.privateKey) ||
        !["kty", "n", "e", "d"].every(key => typeof p.privateKey[key] === "string")
            ? "payload.privateKey doit être une clé JWK (kty, n, e, d)" : null,

    REJECT: p =>
        !REJECT_REASONS.includes(p.reason) ? "payload.reason invalide" :
        !matches(HASH_PATTERN, p.tokenHash) ? "payload.tokenHash invalide" :
        !isCount(p.blockIndex) ? "payload.blockIndex invalide" :
        null,

    PING: () => null,

    RESULT_HASH: p =>
        !matches(HASH_PATTERN, p.resultHash) ? "payload.resultHash invalide" :
        !isCount(p.ledgerLength) ? "payload.ledgerLength invalide" :
        null
};


// Valider un message. Retourne { valid: true } ou { valid: false, reason }.
export function validateMessage(message) {

    const fail = reason => ({ valid: false, reason });

    if (!isObject(message)) {
        return fail("le message n'est pas un objet");
    }

    if (!matches(MESSAGE_ID_PATTERN, message.id)) {
        return fail("id invalide (12 caractères hexadécimaux minuscules attendus)");
    }

    if (typeof message.type !== "string") {
        return fail("type manquant");
    }

    if (!TYPE_LIST.includes(message.type)) {
        return fail(`type inconnu : ${message.type.slice(0, 40)}`);
    }

    if (typeof message.from !== "string" || message.from === "") {
        return fail("from manquant");
    }

    if (!isCount(message.timestamp)) {
        return fail("timestamp invalide");
    }

    if (!isObject(message.payload)) {
        return fail("payload manquant ou invalide");
    }

    const error = PAYLOAD_CHECKS[message.type](message.payload);

    return error ? fail(error) : { valid: true };
}


// ----------------------------------------------------------------------
// Routeur
// ----------------------------------------------------------------------

export class MessageRouter {

    /**
     * @param {object} [options]
     * @param {number} [options.maxSeen]  Nombre d'identifiants de messages mémorisés
     */
    constructor(options = {}) {

        this.maxSeen = options.maxSeen ?? DEFAULT_MAX_SEEN;

        this.network = null;

        // type -> liste de gestionnaires (conservés même sans réseau attaché)
        this.handlers = new Map();

        // Identifiants déjà vus (ordre d'insertion = ordre d'ancienneté)
        this.seen = new Set();

        this._onData = this._onData.bind(this);
    }


    // ------------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------------

    // Brancher le routeur sur un NetworkManager initialisé
    attach(network) {

        if (!network) {
            throw new Error("NetworkManager requis.");
        }

        if (this.network === network) {
            return this;
        }

        this.detach();

        network.on("data", this._onData);

        this.network = network;

        return this;
    }


    // Débrancher le routeur (les gestionnaires sont conservés)
    detach() {

        if (this.network) {

            this.network.off("data", this._onData);

            this.network = null;

        }

        this.seen.clear();
    }


    // ------------------------------------------------------------------
    // Gestionnaires
    // ------------------------------------------------------------------

    /**
     * Enregistrer un gestionnaire pour un type de message.
     * Le gestionnaire reçoit (message, { from }) ; il est appelé une seule fois par message.
     * Retourne une fonction qui retire le gestionnaire.
     */
    registerHandler(type, handler) {

        if (!TYPE_LIST.includes(type)) {
            throw new Error(`Type de message inconnu : ${type}`);
        }

        if (typeof handler !== "function") {
            throw new Error("Le gestionnaire doit être une fonction.");
        }

        const list = this.handlers.get(type) ?? [];

        if (!list.includes(handler)) {
            list.push(handler);
        }

        this.handlers.set(type, list);

        return () => this.unregisterHandler(type, handler);
    }


    // Retirer un gestionnaire
    unregisterHandler(type, handler) {

        const list = this.handlers.get(type);

        if (!list) {
            return;
        }

        this.handlers.set(type, list.filter(item => item !== handler));
    }


    // ------------------------------------------------------------------
    // Envoi
    // ------------------------------------------------------------------

    // Créer un message dont l'expéditeur (from) est ce nœud
    create(type, payload = {}) {

        return createMessage(type, payload, this._requireNetwork().getPeerId());
    }


    // Voisins connectés (connexions ouvertes), sans soi-même, triés
    getPeers() {

        const network = this._requireNetwork();

        const selfId = network.getPeerId();

        return Object.keys(network.connections)
            .filter(peerId => peerId !== selfId && network.connections[peerId].open)
            .sort();
    }


    /**
     * Envoyer un message à tous les voisins connectés.
     * @param {object} message              Message complet au format CONTRACTS.md
     * @param {object} [options]
     * @param {string[]} [options.exclude]  Voisins à ne pas servir (ex. celui qui vient de nous le livrer)
     * @returns {number} Nombre de voisins auxquels le message a été envoyé
     * @throws  Si le message est invalide (erreur de programmation)
     */
    broadcast(message, options = {}) {

        this._checkOutgoing(message);

        const exclude = new Set(options.exclude ?? []);

        let count = 0;

        this.getPeers().forEach(peerId => {

            if (!exclude.has(peerId) && this._deliver(peerId, message)) {
                count++;
            }

        });

        return count;
    }


    /**
     * Envoyer un message à un seul voisin.
     * @returns {boolean} true si le message est parti, false si la connexion n'est pas ouverte
     * @throws  Si le message est invalide (erreur de programmation)
     */
    sendTo(peerId, message) {

        this._checkOutgoing(message);

        return this._deliver(peerId, message);
    }


    _checkOutgoing(message) {

        this._requireNetwork();

        const check = validateMessage(message);

        if (!check.valid) {
            throw new Error(`Message à envoyer invalide : ${check.reason}`);
        }

        // Notre propre message ne doit pas être traité s'il nous revient par un relais
        this._markSeen(message.id);
    }


    _deliver(peerId, message) {

        try {

            this.network.send(peerId, message);

            return true;

        } catch (error) {

            console.warn(`[router] envoi impossible vers ${peerId} : ${error.message}`);

            return false;

        }
    }


    _requireNetwork() {

        if (!this.network) {
            throw new Error("Routeur non attaché : appelez router.attach(network) d'abord.");
        }

        return this.network;
    }


    // ------------------------------------------------------------------
    // Réception
    // ------------------------------------------------------------------

    // Un message est arrivé du réseau (jamais d'exception : tout est ignoré proprement)
    _onData({ from, data }) {

        let message = data;

        // Un texte doit être du JSON valide
        if (typeof data === "string") {

            try {

                message = JSON.parse(data);

            } catch (error) {

                console.warn(`[router] message rejeté de ${from} : JSON invalide`);

                return;
            }

        }

        const check = validateMessage(message);

        if (!check.valid) {

            console.warn(`[router] message rejeté de ${from} : ${check.reason}`);

            return;
        }

        // Déjà traité (relais, écho, doublon) : ignoré en silence
        if (this._markSeen(message.id)) {
            return;
        }

        this._dispatch(message, { from });
    }


    // Mémoriser un identifiant ; retourne true s'il était déjà connu
    _markSeen(id) {

        if (this.seen.has(id)) {
            return true;
        }

        this.seen.add(id);

        if (this.seen.size > this.maxSeen) {
            this.seen.delete(this.seen.values().next().value);
        }

        return false;
    }


    // Appeler les gestionnaires du type ; l'échec de l'un n'empêche pas les autres
    _dispatch(message, meta) {

        const list = this.handlers.get(message.type);

        if (!list || list.length === 0) {
            return;
        }

        [...list].forEach(handler => {

            try {

                const result = handler(message, meta);

                if (result && typeof result.then === "function") {

                    result.catch(error => {
                        console.error(`[router] erreur dans le gestionnaire de ${message.type} :`, error);
                    });

                }

            } catch (error) {

                console.error(`[router] erreur dans le gestionnaire de ${message.type} :`, error);

            }

        });
    }
}


// ----------------------------------------------------------------------
// Instance partagée par toute l'application
// (même principe que `network` dans host.js)
// ----------------------------------------------------------------------

export const router = new MessageRouter();

export const registerHandler = (type, handler) => router.registerHandler(type, handler);

export const broadcast = (message, options) => router.broadcast(message, options);

export const sendTo = (peerId, message) => router.sendTo(peerId, message);

export default router;