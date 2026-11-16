/**
 * mesh.js — T1.4 : Maillage des peers (full mesh)
 *
 * S'appuie sur NetworkManager (T1.1) sans le modifier :
 *   - événements utilisés : "connection", "data", "close"
 *   - méthodes utilisées  : connectTo(), send(), getPeerId(), connections
 *
 * Principe :
 *   1. L'hôte (host.js) a pour peerId le Session ID.
 *   2. Un invité (join.js) se connecte à l'hôte, puis lui envoie JOIN.
 *   3. L'hôte répond PEER_LIST : les peers DÉJÀ inscrits (sans l'arrivant).
 *   4. L'invité se connecte directement à chacun d'eux.
 *   => chaque nœud est relié à tous les autres. L'hôte n'est plus indispensable
 *      une fois le maillage établi : si on le ferme, les autres restent reliés.
 *
 * Pas de connexions en double : seul l'ARRIVANT ouvre des connexions vers les
 * anciens, qui ne font qu'accepter. L'hôte inscrit l'arrivant au moment du JOIN
 * (messages traités un par un) : deux arrivants simultanés se retrouvent donc
 * toujours, le second voyant le premier dans sa liste.
 *
 * Utilisation :
 *   // Organisateur
 *   await hostSession(sessionId);
 *   const mesh = startMesh(network, { isHost: true });
 *
 *   // Électeur
 *   const hostId = await joinSession(sessionId);
 *   const mesh = startMesh(network, { hostId });
 *
 *   mesh.getPeers();                      // voisins connectés (sans soi-même)
 *   mesh.on("peer-joined", id => {...});  // un voisin vient de se connecter
 *   mesh.on("peer-left",   id => {...});  // un voisin est parti
 *   mesh.on("mesh-ready",  info => {...}); // invité : relié à toute la PEER_LIST
 *   mesh.broadcast(message);              // envoi à tous les voisins
 */

// Types de messages gérés par le maillage (les autres messages sont ignorés ici)
export const MESH_MESSAGES = Object.freeze({
    JOIN: "JOIN",
    PEER_LIST: "PEER_LIST",
    PING: "PING"
});

// Événements émis par le maillage
export const MESH_EVENTS = ["peer-joined", "peer-left", "mesh-ready"];

// Délai maximal pour ouvrir une connexion vers un voisin : 10 secondes
const CONNECT_TIMEOUT_MS = 10000;

// Nombre de tentatives de connexion vers un voisin
const CONNECT_ATTEMPTS = 2;


export class PeerMesh {

    /**
     * @param {object}  network               Instance de NetworkManager déjà initialisée
     * @param {object}  [options]
     * @param {boolean} [options.isHost]      true pour l'organisateur
     * @param {string}  [options.hostId]      Session ID de l'hôte (obligatoire pour un invité)
     * @param {number}  [options.heartbeatMs] Période des PING (3 s par défaut)
     * @param {number}  [options.timeoutMs]   Silence maximal avant de considérer un voisin parti (10 s)
     */
    constructor(network, options = {}) {

        if (!network) {
            throw new Error("NetworkManager requis.");
        }

        this.network = network;

        this.isHost = options.isHost === true;

        this.hostId = options.hostId ?? null;

        this.heartbeatMs = options.heartbeatMs ?? 3000;

        this.timeoutMs = options.timeoutMs ?? 10000;

        this.listeners = {};

        MESH_EVENTS.forEach(event => {
            this.listeners[event] = [];
        });

        // Voisins déjà annoncés via "peer-joined"
        this.knownPeers = new Set();

        // Hôte uniquement : peers ayant envoyé JOIN
        this.members = new Set();

        // Dernier message reçu de chaque voisin (pour détecter les départs brutaux)
        this.lastSeen = new Map();

        this.timer = null;

        this.started = false;

        this.joinSent = false;

        // Fonctions liées, pour pouvoir les retirer avec network.off()
        this._onConnection = this._onConnection.bind(this);
        this._onData = this._onData.bind(this);
        this._onClose = this._onClose.bind(this);
    }


    // ------------------------------------------------------------------
    // Événements
    // ------------------------------------------------------------------

    // Ajouter un écouteur ; retourne une fonction pour le retirer
    on(event, callback) {

        if (!MESH_EVENTS.includes(event)) {
            throw new Error(`Événement non autorisé : ${event}`);
        }

        if (typeof callback !== "function") {
            throw new Error("Le callback doit être une fonction.");
        }

        this.listeners[event].push(callback);

        return () => this.off(event, callback);
    }


    // Supprimer un écouteur
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

    // Démarrer le maillage (le réseau doit déjà être initialisé)
    start() {

        if (this.started) {
            return this;
        }

        const selfId = this.network.getPeerId();

        if (!selfId) {

            throw new Error(
                "Le réseau n'est pas initialisé : appelez hostSession() ou joinSession() d'abord."
            );

        }

        if (this.isHost) {

            this.hostId = selfId;

        } else if (!this.hostId) {

            throw new Error("hostId requis pour un invité.");

        }

        this.started = true;

        this.network.on("connection", this._onConnection);
        this.network.on("data", this._onData);
        this.network.on("close", this._onClose);

        // Connexions déjà ouvertes avant le démarrage (ex. l'hôte pour un invité)
        this.getPeers().forEach(peerId => this._markJoined(peerId));

        this.timer = setInterval(() => this._heartbeat(), this.heartbeatMs);

        if (!this.isHost) {
            this._sendJoinIfReady();
        }

        return this;
    }


    // Arrêter le maillage (sans fermer le réseau)
    stop() {

        if (!this.started) {
            return;
        }

        this.started = false;

        clearInterval(this.timer);

        this.timer = null;

        this.network.off("connection", this._onConnection);
        this.network.off("data", this._onData);
        this.network.off("close", this._onClose);

        this.knownPeers.clear();
        this.members.clear();
        this.lastSeen.clear();
    }


    // ------------------------------------------------------------------
    // API publique
    // ------------------------------------------------------------------

    // Voisins connectés (connexions ouvertes), sans soi-même, triés
    getPeers() {

        const selfId = this.network.getPeerId();

        return Object.keys(this.network.connections)
            .filter(peerId => peerId !== selfId && this._isOpen(peerId))
            .sort();
    }


    // Envoyer un message à tous les voisins ; retourne le nombre de destinataires
    broadcast(message) {

        let count = 0;

        this.getPeers().forEach(peerId => {

            try {

                this.network.send(peerId, message);

                count++;

            } catch (error) {

                console.error(error);

            }

        });

        return count;
    }


    // ------------------------------------------------------------------
    // Réactions aux événements du réseau
    // ------------------------------------------------------------------

    // Une connexion vient de s'ouvrir
    _onConnection(peerId) {

        if (this._isOpen(peerId)) {
            this._markJoined(peerId);
        }

        if (!this.isHost && peerId === this.hostId) {
            this._sendJoinIfReady();
        }
    }


    // Une connexion vient de se fermer
    _onClose(peerId) {

        // Si une autre connexion ouverte existe encore avec ce pair, il n'est pas parti
        if (!this._isOpen(peerId)) {
            this._markLeft(peerId);
        }
    }


    // Un message est arrivé
    _onData({ from, data }) {

        if (!data || typeof data !== "object") {
            return;
        }

        if (this._isOpen(from)) {
            this.lastSeen.set(from, Date.now());
        }

        switch (data.type) {

            case MESH_MESSAGES.JOIN:
                this._handleJoin(from);
                break;

            case MESH_MESSAGES.PEER_LIST:
                this._handlePeerList(from, data.peers);
                break;

            case MESH_MESSAGES.PING:
                // Rien à faire : lastSeen est déjà mis à jour
                break;

            default:
                // Message d'un autre module (vote, registre...) : ignoré ici
                break;
        }
    }


    // ------------------------------------------------------------------
    // Protocole JOIN / PEER_LIST
    // ------------------------------------------------------------------

    // Invité : annoncer son arrivée à l'hôte (une seule fois)
    _sendJoinIfReady() {

        if (this.joinSent || !this._isOpen(this.hostId)) {
            return;
        }

        this.joinSent = true;

        try {

            this.network.send(this.hostId, { type: MESH_MESSAGES.JOIN });

        } catch (error) {

            this.joinSent = false;

            console.error(error);

        }
    }


    // Hôte : répondre avec la liste des peers déjà inscrits
    _handleJoin(from) {

        if (!this.isHost) {
            return;
        }

        this._markJoined(from);

        // Liste AVANT d'inscrire l'arrivant : il ne figure pas dans sa propre liste
        const peers = [...this.members].filter(
            peerId => peerId !== from && this._isOpen(peerId)
        );

        this.members.add(from);

        try {

            this.network.send(from, {
                type: MESH_MESSAGES.PEER_LIST,
                peers
            });

        } catch (error) {

            this.members.delete(from);

            console.error(error);

        }
    }


    // Invité : se connecter à tous les peers de la liste
    _handlePeerList(from, peers) {

        if (this.isHost || from !== this.hostId || !Array.isArray(peers)) {
            return;
        }

        this._connectToPeers(peers);
    }


    async _connectToPeers(peers) {

        const selfId = this.network.getPeerId();

        const targets = peers.filter(peerId =>
            typeof peerId === "string" &&
            peerId !== selfId &&
            peerId !== this.hostId &&
            !this._isOpen(peerId)
        );

        const results = await Promise.allSettled(
            targets.map(peerId => this._connectWithRetry(peerId))
        );

        if (!this.started) {
            return;
        }

        const failed = targets.filter(
            (_, index) => results[index].status === "rejected"
        );

        this._emit("mesh-ready", {
            peers: this.getPeers(),
            failed
        });
    }


    async _connectWithRetry(peerId) {

        let lastError;

        for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {

            try {

                await this._connectAndWait(peerId);

                return;

            } catch (error) {

                lastError = error;

            }

        }

        throw lastError;
    }


    // Se connecter à un pair et attendre l'ouverture de la connexion
    _connectAndWait(peerId) {

        return new Promise((resolve, reject) => {

            if (this._isOpen(peerId)) {
                resolve();
                return;
            }

            let timeout;

            const onConnection = openedId => {

                if (openedId === peerId) {

                    clearTimeout(timeout);

                    this.network.off("connection", onConnection);

                    resolve();

                }

            };

            timeout = setTimeout(() => {

                this.network.off("connection", onConnection);

                reject(new Error(`Délai dépassé pour se connecter à ${peerId}`));

            }, CONNECT_TIMEOUT_MS);

            // On écoute AVANT de se connecter pour ne pas rater un événement rapide
            try {

                this.network.on("connection", onConnection);

                this.network.connectTo(peerId);

            } catch (error) {

                clearTimeout(timeout);

                this.network.off("connection", onConnection);

                reject(error);

            }

        });
    }


    // ------------------------------------------------------------------
    // Suivi des voisins
    // ------------------------------------------------------------------

    _isOpen(peerId) {

        const conn = this.network.connections[peerId];

        return Boolean(conn && conn.open);
    }


    _markJoined(peerId) {

        if (this.knownPeers.has(peerId)) {
            return;
        }

        this.knownPeers.add(peerId);

        this.lastSeen.set(peerId, Date.now());

        this._emit("peer-joined", peerId);
    }


    _markLeft(peerId) {

        this.members.delete(peerId);

        this.lastSeen.delete(peerId);

        if (this.knownPeers.delete(peerId)) {

            this._emit("peer-left", peerId);

        }
    }


    // PING régulier + détection des voisins silencieux
    // (WebRTC signale parfois très tard la fermeture d'un onglet)
    _heartbeat() {

        const now = Date.now();

        [...this.knownPeers].forEach(peerId => {

            const conn = this.network.connections[peerId];

            if (!conn || !conn.open) {

                this._markLeft(peerId);

                return;
            }

            if (now - (this.lastSeen.get(peerId) || 0) > this.timeoutMs) {

                try {

                    conn.close();

                } catch (error) {

                    console.error(error);

                }

                this._markLeft(peerId);

                return;
            }

            try {

                this.network.send(peerId, { type: MESH_MESSAGES.PING });

            } catch (error) {

                // Connexion en cours de fermeture : le prochain tour la retirera

            }

        });
    }
}


// ----------------------------------------------------------------------
// Instance partagée (même principe que setNetworkManager dans join.js)
// ----------------------------------------------------------------------

let currentMesh = null;


// Démarrer le maillage ; remplace l'éventuel maillage précédent
export function startMesh(network, options = {}) {

    const mesh = new PeerMesh(network, options);

    mesh.start();

    if (currentMesh) {
        currentMesh.stop();
    }

    currentMesh = mesh;

    return mesh;
}


// Récupérer le maillage en cours (null s'il n'a pas démarré)
export function getMesh() {

    return currentMesh;
}


// Arrêter le maillage en cours
export function stopMesh() {

    if (currentMesh) {

        currentMesh.stop();

        currentMesh = null;

    }
}


export default PeerMesh;