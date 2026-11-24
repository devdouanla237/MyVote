/**
 * reconnect.js — T1.6 : Reconnexion automatique des peers
 *
 * S'appuie sur PeerMesh (mesh.js, T1.4) sans le modifier :
 *   - le heartbeat (PING toutes les 5 s) et la détection des voisins morts sont déjà
 *     faits par mesh.js, qui émet "peer-left" ;
 *   - ce module écoute "peer-left" et tente de se reconnecter : 3 tentatives espacées
 *     (2 s, 5 s, 10 s par défaut), puis abandonne.
 *
 * Événements émis :
 *   "reconnecting"     { peerId, attempt, max }   avant chaque tentative
 *   "reconnected"      { peerId, attempt, incoming }  le voisin est de retour
 *                       (incoming = true si c'est lui qui nous a reconnectés)
 *   "reconnect-failed" { peerId, attempts }       les 3 tentatives ont échoué
 *
 * Utilisation :
 *   const mesh = startMesh(network, { hostId });
 *   const reconnector = startReconnect(mesh);
 *   reconnector.on("reconnected", ({ peerId }) => {
 *       // T1.7 : demander les blocs manquants
 *       // router.sendTo(peerId, router.create("LEDGER_REQUEST", { fromIndex: ledger.length }));
 *   });
 *
 * Remarque importante : PeerJS donne un NOUVEL identifiant à un onglet rechargé
 * (sauf à l'hôte, dont l'identifiant est le Session ID). Reconnecter l'ancien
 * identifiant sert donc surtout à l'hôte et aux coupures réseau brèves. Un électeur
 * rechargé revient dans le réseau par le chemin normal : joinSession -> JOIN -> PEER_LIST.
 */

import { MESSAGE_TYPES } from "./router.js";

export const RECONNECT_EVENTS = ["reconnecting", "reconnected", "reconnect-failed"];

// Délai d'attente avant chacune des 3 tentatives (millisecondes)
const DEFAULT_DELAYS_MS = [2000, 5000, 10000];

// Délai maximal pour ouvrir une connexion lors d'une tentative
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;


export class PeerReconnector {

    /**
     * @param {object}   mesh                      Instance de PeerMesh déjà démarrée
     * @param {object}   [options]
     * @param {number[]} [options.delaysMs]        Délais avant chaque tentative (3 par défaut)
     * @param {number}   [options.connectTimeoutMs] Délai maximal d'une tentative de connexion
     */
    constructor(mesh, options = {}) {

        if (!mesh) {
            throw new Error("PeerMesh requis.");
        }

        this.mesh = mesh;

        this.network = mesh.network;

        this.router = mesh.router;

        this.delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;

        this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

        this.listeners = {};

        RECONNECT_EVENTS.forEach(event => {
            this.listeners[event] = [];
        });

        // peerId -> { finished, timer, wake }  (une seule reconnexion en cours par voisin)
        this.jobs = new Map();

        this.started = false;

        this.unsubscribes = [];
    }


    // ------------------------------------------------------------------
    // Événements
    // ------------------------------------------------------------------

    on(event, callback) {

        if (!RECONNECT_EVENTS.includes(event)) {
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
            this.mesh.on("peer-left", peerId => this._onPeerLeft(peerId)),
            this.mesh.on("peer-joined", peerId => this._onPeerJoined(peerId))
        ];

        return this;
    }


    stop() {

        if (!this.started) {
            return;
        }

        this.started = false;

        this.unsubscribes.forEach(unsubscribe => unsubscribe());

        this.unsubscribes = [];

        [...this.jobs.keys()].forEach(peerId => this._cancel(peerId));
    }


    // Voisins pour lesquels une reconnexion est en cours
    getPending() {

        return [...this.jobs.keys()];
    }


    // ------------------------------------------------------------------
    // Réactions au maillage
    // ------------------------------------------------------------------

    // Un voisin est parti (close ou silence de plus de 15 s) : on tente de le retrouver
    _onPeerLeft(peerId) {

        if (!this.started || this.jobs.has(peerId)) {
            return;
        }

        this._run(peerId);
    }


    // Un voisin vient de se connecter : s'il était en cours de reconnexion, c'est gagné
    _onPeerJoined(peerId) {

        const job = this.jobs.get(peerId);

        if (job) {
            this._succeed(peerId, job, { incoming: !job.connecting });
        }
    }


    // ------------------------------------------------------------------
    // Boucle de reconnexion
    // ------------------------------------------------------------------

    async _run(peerId) {

        const job = { finished: false, attempt: 0, timer: null, wake: null, connecting: false };

        this.jobs.set(peerId, job);

        const max = this.delaysMs.length;

        for (let attempt = 1; attempt <= max; attempt++) {

            job.attempt = attempt;

            await this._sleep(job, this.delaysMs[attempt - 1]);

            if (job.finished) {
                return;
            }

            this._emit("reconnecting", { peerId, attempt, max });

            try {

                await this._connectAndWait(peerId, job);

                this._succeed(peerId, job, { incoming: false });

                return;

            } catch (error) {

                console.warn(
                    `[reconnect] tentative ${attempt}/${max} vers ${peerId} échouée : ${error.message}`
                );

                if (job.finished) {
                    return;
                }

            }

        }

        job.finished = true;

        this.jobs.delete(peerId);

        this._emit("reconnect-failed", { peerId, attempts: max });
    }


    // Attendre un délai, en pouvant être réveillé par _cancel / _succeed
    _sleep(job, ms) {

        return new Promise(resolve => {

            job.wake = resolve;

            job.timer = setTimeout(resolve, ms);

        });
    }


    // Se connecter à un pair et attendre l'ouverture de la connexion
    _connectAndWait(peerId, job) {

        return new Promise((resolve, reject) => {

            if (this.mesh.getPeers().includes(peerId)) {
                resolve();
                return;
            }

            let conn = null;

            // Pendant cette tentative, une connexion qui s'ouvre vient de nous (pas de lui)
            job.connecting = true;

            let timeout = null;

            const cleanup = () => {

                job.connecting = false;

                clearTimeout(timeout);

                this.network.off("connection", onConnection);

            };

            const onConnection = openedId => {

                if (openedId === peerId) {

                    cleanup();

                    resolve();

                }

            };

            timeout = setTimeout(() => {

                cleanup();

                // Ne pas laisser une connexion à moitié ouverte dans network.connections
                try {

                    if (conn && !conn.open) {
                        conn.close();
                    }

                } catch (error) {

                    console.error(error);

                }

                reject(new Error(`Délai dépassé (${this.connectTimeoutMs} ms)`));

            }, this.connectTimeoutMs);

            // On écoute AVANT de se connecter pour ne pas rater un événement rapide
            try {

                this.network.on("connection", onConnection);

                conn = this.network.connectTo(peerId);

            } catch (error) {

                cleanup();

                reject(error);

            }

        });
    }


    // Reconnexion réussie (une seule fois par job, quel que soit le chemin)
    _succeed(peerId, job, { incoming }) {

        if (job.finished) {
            return;
        }

        job.finished = true;

        clearTimeout(job.timer);

        if (job.wake) {
            job.wake();
        }

        this.jobs.delete(peerId);

        // Invité qui retrouve l'hôte : se ré-annoncer pour que l'hôte nous réinscrive
        // (members) et renvoie PEER_LIST, ce qui répare aussi le maillage.
        if (!this.mesh.isHost && peerId === this.mesh.hostId) {
            this._sendJoin(peerId);
        }

        this._emit("reconnected", { peerId, attempt: job.attempt, incoming });
    }


    _sendJoin(hostId) {

        try {

            const message = this.router.create(MESSAGE_TYPES.JOIN, {
                sessionId: this.mesh.hostId,
                role: this.mesh.role
            });

            this.router.sendTo(hostId, message);

        } catch (error) {

            console.warn(`[reconnect] JOIN impossible vers ${hostId} : ${error.message}`);

        }
    }


    // Annuler une reconnexion en cours (sans événement)
    _cancel(peerId) {

        const job = this.jobs.get(peerId);

        if (!job) {
            return;
        }

        job.finished = true;

        clearTimeout(job.timer);

        if (job.wake) {
            job.wake();
        }

        this.jobs.delete(peerId);
    }
}


// ----------------------------------------------------------------------
// Instance partagée (même principe que startMesh dans mesh.js)
// ----------------------------------------------------------------------

let currentReconnector = null;


// Démarrer la reconnexion automatique ; remplace l'éventuelle instance précédente
export function startReconnect(mesh, options = {}) {

    if (currentReconnector) {
        currentReconnector.stop();
    }

    currentReconnector = new PeerReconnector(mesh, options).start();

    return currentReconnector;
}


export function getReconnector() {

    return currentReconnector;
}


export function stopReconnect() {

    if (currentReconnector) {

        currentReconnector.stop();

        currentReconnector = null;

    }
}


export default PeerReconnector;