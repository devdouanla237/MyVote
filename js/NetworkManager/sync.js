/**
 * sync.js — T1.7 : Synchronisation du registre à l'arrivée
 *
 * S'appuie sur router.js (T1.5) et mesh.js (T1.4) sans les modifier.
 *
 * Principe (CONTRACTS.md, sections 4.4 et 4.5) :
 *   1. Un nœud en retard envoie LEDGER_REQUEST { fromIndex } à un voisin
 *      (fromIndex = longueur de son registre local).
 *   2. Le voisin répond par un ou plusieurs LEDGER_SYNC, de 20 blocs au maximum,
 *      dans l'ordre croissant des index ; `isLast` vaut true sur le dernier lot.
 *      Un registre vide donne un seul LEDGER_SYNC { blocks: [], isLast: true }.
 *   3. Le nouveau nœud ajoute les blocs un par un à son registre.
 *
 * Le registre (ledger) est fourni par M3. En Phase 1 on utilise un tableau simulé :
 * createMockLedger(10). Un registre réel doit offrir la même interface :
 *   ledger.getBlocks()        -> tableau de blocs (ordre croissant des index)
 *   ledger.getLength()        -> nombre de blocs
 *   ledger.appendBlock(block) -> ajoute un bloc ; lève une erreur s'il est invalide
 *                                (peut être asynchrone)
 *
 * Utilisation :
 *   const ledger = createMockLedger(10);              // ou le vrai registre de M3
 *   const sync = startSync({ ledger, mesh });         // mesh : invité => synchro auto
 *   sync.on("synced", ({ from, length }) => {...});
 *   sync.on("sync-failed", ({ from, error }) => {...});
 *   await sync.requestSync(peerId);                   // synchro manuelle
 *
 *   // Après une reconnexion (T1.6) :
 *   reconnector.on("reconnected", ({ peerId }) => sync.requestSync(peerId).catch(() => {}));
 */

import { router as sharedRouter, MESSAGE_TYPES } from "./router.js";

// Taille maximale d'un lot (CONTRACTS.md : 20 blocs)
export const BATCH_SIZE = 20;

// Silence maximal d'un voisin pendant une synchronisation
const SYNC_TIMEOUT_MS = 10000;

export const SYNC_EVENTS = ["synced", "sync-failed"];


// ----------------------------------------------------------------------
// Registre simulé (Phase 1, en attendant celui de M3)
// ----------------------------------------------------------------------

const hex = length =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export function createMockLedger(count = 0) {

    const blocks = [];

    const ledger = {

        getBlocks: () => blocks,

        getLength: () => blocks.length,

        appendBlock(block) {

            if (!block || block.index !== blocks.length) {
                throw new Error(`Index inattendu : ${block && block.index}, attendu ${blocks.length}`);
            }

            blocks.push(block);
        }

    };

    // Blocs factices (le contenu n'est pas vérifié ici : c'est le rôle de validateBlock)
    for (let index = 0; index < count; index++) {

        blocks.push({
            index,
            tokenHash: hex(64),
            encryptedBallot: "Qk1Wb3RlRXhhbXBsZUNpcGhlcnRleHQ=",
            prevHash: index === 0 ? "GENESIS" : hex(64),
            timestamp: Date.now() + index,
            receiptHash: hex(16).toUpperCase()
        });

    }

    return ledger;
}


// ----------------------------------------------------------------------
// Synchronisation
// ----------------------------------------------------------------------

export class LedgerSync {

    /**
     * @param {object} options
     * @param {object} options.ledger         Registre (voir l'interface en en-tête)
     * @param {object} [options.mesh]         PeerMesh : si fourni et invité, synchro auto à "mesh-ready"
     * @param {object} [options.router]       Routeur (le routeur partagé par défaut)
     * @param {number} [options.timeoutMs]    Silence maximal d'un voisin (10 s)
     */
    constructor(options = {}) {

        if (!options.ledger) {
            throw new Error("ledger requis.");
        }

        this.ledger = options.ledger;

        this.mesh = options.mesh ?? null;

        this.router = options.router ?? sharedRouter;

        this.timeoutMs = options.timeoutMs ?? SYNC_TIMEOUT_MS;

        this.listeners = {};

        SYNC_EVENTS.forEach(event => {
            this.listeners[event] = [];
        });

        // Une seule synchronisation à la fois : { peerId, resolve, reject, timer }
        this.pending = null;

        // Les lots sont traités un par un, dans l'ordre d'arrivée
        this.queue = Promise.resolve();

        this.started = false;

        this.unsubscribes = [];
    }


    // ------------------------------------------------------------------
    // Événements
    // ------------------------------------------------------------------

    on(event, callback) {

        if (!SYNC_EVENTS.includes(event)) {
            throw new Error(`Événement non autorisé : ${event}`);
        }

        if (typeof callback !== "function") {
            throw new Error("Le callback doit être une fonction.");
        }

        this.listeners[event].push(callback);

        return () => this.off(event, callback);
    }


    off(event, callback) {

        if (!this.listeners[event]) {
            return;
        }

        this.listeners[event] =
            this.listeners[event].filter(listener => listener !== callback);
    }


    _emit(event, payload) {

        this.listeners[event].forEach(callback => {

            try {

                callback(payload);

            } catch (error) {

                console.error("Erreur dans un callback :", error);

            }

        });
    }


    // ------------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------------

    start() {

        if (this.started) {
            return this;
        }

        this.started = true;

        this.unsubscribes = [
            this.router.registerHandler(
                MESSAGE_TYPES.LEDGER_REQUEST,
                (message, meta) => this._handleRequest(message, meta.from)
            ),
            this.router.registerHandler(
                MESSAGE_TYPES.LEDGER_SYNC,
                (message, meta) => this._enqueue(() => this._handleSync(message, meta.from))
            )
        ];

        // Invité : une fois relié aux autres, récupérer le registre
        if (this.mesh && !this.mesh.isHost) {
            this.unsubscribes.push(this.mesh.on("mesh-ready", () => this._autoSync()));
        }

        return this;
    }


    stop() {

        if (!this.started) {
            return;
        }

        this.started = false;

        this.unsubscribes.forEach(unsubscribe => unsubscribe());

        this.unsubscribes = [];

        this._clearPending(new Error("Synchronisation arrêtée."));
    }


    // ------------------------------------------------------------------
    // Côté voisin : répondre à LEDGER_REQUEST
    // ------------------------------------------------------------------

    _handleRequest(message, from) {

        const start = message.payload.fromIndex;

        const rest = this.ledger.getBlocks().slice(start);

        // Registre vide (ou rien de nouveau) : un seul message pour dire « terminé »
        if (rest.length === 0) {

            this._sendBatch(from, start, [], true);

            return;
        }

        for (let offset = 0; offset < rest.length; offset += BATCH_SIZE) {

            const batch = rest.slice(offset, offset + BATCH_SIZE);

            const isLast = offset + BATCH_SIZE >= rest.length;

            if (!this._sendBatch(from, start + offset, batch, isLast)) {
                return;
            }

        }
    }


    _sendBatch(peerId, fromIndex, blocks, isLast) {

        const reply = this.router.create(MESSAGE_TYPES.LEDGER_SYNC, {
            fromIndex,
            blocks,
            isLast
        });

        return this.router.sendTo(peerId, reply);
    }


    // ------------------------------------------------------------------
    // Côté nouveau nœud : demander et recevoir
    // ------------------------------------------------------------------

    /**
     * Demander à un voisin les blocs qui nous manquent.
     * @returns {Promise<{from: string, length: number}>} résolue quand le dernier lot est ajouté
     */
    requestSync(peerId) {

        if (this.pending) {
            return Promise.reject(new Error("Une synchronisation est déjà en cours."));
        }

        return new Promise((resolve, reject) => {

            this.pending = { peerId, resolve, reject, timer: null };

            this._armTimer();

            if (!this._sendRequest(peerId, this.ledger.getLength())) {

                this._clearPending(new Error(`Aucune connexion ouverte avec ${peerId}`));

            }

        });
    }


    _sendRequest(peerId, fromIndex) {

        const message = this.router.create(MESSAGE_TYPES.LEDGER_REQUEST, { fromIndex });

        return this.router.sendTo(peerId, message);
    }


    _enqueue(task) {

        this.queue = this.queue.then(task).catch(error => {
            console.error("[sync] erreur :", error);
        });

        return this.queue;
    }


    async _handleSync(message, from) {

        const { fromIndex, blocks, isLast } = message.payload;

        // On ne traite que les lots du voisin interrogé
        if (!this.pending || this.pending.peerId !== from) {
            return;
        }

        const localLength = this.ledger.getLength();

        // Trou : le lot commence trop loin. On redemande à partir de notre longueur.
        if (fromIndex > localLength) {

            this._armTimer();

            if (!this._sendRequest(from, localLength)) {
                this._clearPending(new Error(`Aucune connexion ouverte avec ${from}`));
            }

            return;
        }

        // Chevauchement : on saute les blocs que l'on possède déjà
        const toAdd = blocks.slice(localLength - fromIndex);

        for (const block of toAdd) {

            try {

                await this.ledger.appendBlock(block);

            } catch (error) {

                this._clearPending(error);

                return;
            }

        }

        if (!this.pending) {
            return;
        }

        if (isLast) {

            const { resolve } = this.pending;

            const result = { from, length: this.ledger.getLength() };

            this._clearPending(null);

            this._emit("synced", result);

            resolve(result);

            return;
        }

        this._armTimer();
    }


    // Relancer le minuteur de silence (appelé à chaque lot reçu)
    _armTimer() {

        if (!this.pending) {
            return;
        }

        clearTimeout(this.pending.timer);

        const peerId = this.pending.peerId;

        this.pending.timer = setTimeout(() => {

            if (this.pending && this.pending.peerId === peerId) {
                this._clearPending(new Error(`Délai dépassé (${this.timeoutMs} ms)`));
            }

        }, this.timeoutMs);
    }


    // Terminer la synchronisation en cours. error = null : succès (déjà traité par l'appelant).
    _clearPending(error) {

        if (!this.pending) {
            return;
        }

        const { peerId, reject, timer } = this.pending;

        clearTimeout(timer);

        this.pending = null;

        if (error) {

            this._emit("sync-failed", { from: peerId, error });

            reject(error);

        }
    }


    // Invité : essayer l'hôte, puis chaque autre voisin, jusqu'à un succès
    async _autoSync() {

        const hostId = this.mesh.hostId;

        const candidates = [
            hostId,
            ...this.mesh.getPeers().filter(peerId => peerId !== hostId)
        ];

        for (const peerId of candidates) {

            if (!this.started) {
                return;
            }

            try {

                await this.requestSync(peerId);

                return;

            } catch (error) {

                console.warn(`[sync] ${peerId} : ${error.message}`);

            }

        }
    }
}


// ----------------------------------------------------------------------
// Instance partagée (même principe que startMesh)
// ----------------------------------------------------------------------

let currentSync = null;


export function startSync(options) {

    if (currentSync) {
        currentSync.stop();
    }

    currentSync = new LedgerSync(options).start();

    return currentSync;
}


export function getSync() {

    return currentSync;
}


export function stopSync() {

    if (currentSync) {

        currentSync.stop();

        currentSync = null;

    }
}


export default LedgerSync;