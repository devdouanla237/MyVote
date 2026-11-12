import Peer from "peerjs";

class NetworkManager {

    // Événements autorisés
    static EVENTS = [
        "open",
        "connection",
        "data",
        "close",
        "error"
    ];


    // Initialise les attributs
    constructor(options = {}) {

        this.options = options;

        this.peer = null;

        this.peerId = null;

        this.listeners = {};

        NetworkManager.EVENTS.forEach(event => {

            this.listeners[event] = [];

        });

        this.connections = {};

        this.destroyed = false;

        // Empêcher l'enregistrement multiple
        // d'une même connexion
        this.registeredConnections = new WeakSet();

        // Gestion de l'initialisation
        this.initSettled = false;

        this.initReject = null;
    }


    // Déclencher un événement

//Un callback (fonction de rappel) est une fonction que tu passes en paramètre à une autre fonction afin qu'elle puisse l'exécuter plus tard, généralement lorsqu'un événement se produit ou lorsqu'une opération est terminée.
//Le payload est une donnée qu'une fonction transporte et transmet à une autre fonction

    emit(event, payload) {

        if (!this.listeners[event]) {
            return;
        }

        this.listeners[event].forEach(callback => {

            try {

                callback(payload);

            } catch (error) {

                console.error(
                    "Erreur dans un callback :",
                    error
                );

            }

        });

    }


    // Ajouter un écouteur
    on(event, callback) {

        if (!NetworkManager.EVENTS.includes(event)) {

            throw new Error(
                `Événement non autorisé : ${event}`
            );

        }

        if (typeof callback !== "function") {

            throw new Error(
                "Le callback doit être une fonction."
            );

        }

        if (this.destroyed) {

            throw new Error(
                "NetworkManager a été détruit."
            );

        }

        this.listeners[event].push(callback);

    }


    // Supprimer un écouteur
    off(event, callback) {

        if (!this.listeners[event]) {
            return;
        }

        this.listeners[event] =
            this.listeners[event].filter(
                listener => listener !== callback
            );

    }


    // Initialiser PeerJS
    init(customId = null) {

        if (this.destroyed) {

            return Promise.reject(
                new Error("NetworkManager a été détruit.")
            );

        }

        if (this.peer) {

            return Promise.reject(
                new Error("Le réseau est déjà initialisé.")
            );

        }

        return new Promise((resolve, reject) => {

            try {

                this.initSettled = false;

                this.initReject = reject;

                // Création du participant
                if (customId) {

                    this.peer = new Peer(
                        customId,
                        this.options
                    );

                } else {

                    this.peer = new Peer(
                        this.options
                    );

                }


                // Connexion au serveur de signalisation
                this.peer.on("open", id => {

                    if (this.destroyed) {
                        return;
                    }

                    this.peerId = id;

                    this.initSettled = true;

                    this.initReject = null;

                    this.emit("open", id);

                    resolve(id);

                });


                // Connexion entrante
                this.peer.on("connection", conn => {

                    if (!this.destroyed) {

                        this.registerConnection(conn);

                    }

                });


                // Gestion des erreurs
                this.peer.on("error", error => {

                    this.emit("error", error);

                    if (!this.initSettled) {

                        this.initSettled = true;

                        this.initReject = null;

                        reject(error);

                    }

                });

            } catch (error) {

                this.initSettled = true;

                this.initReject = null;

                reject(error);

            }

        });

    }


    // Enregistrer une connexion
    registerConnection(conn) {

        if (this.destroyed) {
            return;
        }

        if (this.registeredConnections.has(conn)) {
            return;
        }

        this.registeredConnections.add(conn);

        this.connections[conn.peer] = conn;


        // Connexion ouverte
        conn.on("open", () => {

            if (!this.destroyed) {

                this.emit(
                    "connection",
                    conn.peer
                );

            }

        });


        // Réception des données
        conn.on("data", data => {

            if (!this.destroyed) {

                this.emit("data", {

                    from: conn.peer,

                    data: data

                });

            }

        });


        // Fermeture de la connexion
        conn.on("close", () => {

            if (this.connections[conn.peer] === conn) {

                delete this.connections[conn.peer];

            }

            if (!this.destroyed) {

                this.emit(
                    "close",
                    conn.peer
                );

            }

        });


        // Erreur de connexion
        conn.on("error", error => {

            if (!this.destroyed) {

                this.emit("error", error);

            }

        });

    }


    // Obtenir son identifiant
    getPeerId() {

        return this.peerId;

    }


    // Se connecter à un autre participant
    connectTo(peerId) {

        if (!this.peer || this.destroyed) {

            throw new Error(
                "Le réseau n'est pas initialisé."
            );

        }

        if (!peerId || typeof peerId !== "string") {

            throw new Error(
                "Identifiant du pair invalide."
            );

        }

        if (peerId === this.peerId) {

            throw new Error(
                "Impossible de se connecter à soi-même."
            );

        }

        const conn = this.peer.connect(peerId);

        this.registerConnection(conn);

        return conn;

    }


    // Envoyer un message
    send(peerId, message) {

        const conn = this.connections[peerId];

        if (!conn || !conn.open) {

            throw new Error(
                `Aucune connexion ouverte avec ${peerId}`
            );

        }

        conn.send(message);

    }


    // Détruire le gestionnaire
    destroy() {

        if (this.destroyed) {
            return;
        }

        this.destroyed = true;


        // Rejeter une initialisation encore en attente
        if (!this.initSettled && this.initReject) {

            this.initSettled = true;

            this.initReject(
                new Error("Initialisation annulée : réseau détruit.")
            );

            this.initReject = null;

        }


        // Fermer les connexions
        Object.values(this.connections).forEach(conn => {

            try {

                conn.close();

            } catch (error) {

                console.error(error);

            }

        });


        // Détruire PeerJS
        if (this.peer) {

            this.peer.destroy();

        }


        // Réinitialiser les attributs
        this.peer = null;

        this.peerId = null;

        this.connections = {};


        // Vider les écouteurs
        Object.keys(this.listeners).forEach(event => {

            this.listeners[event] = [];

        });

    }

}


// Exporter la classe
export default NetworkManager;
// Rendre la classe accessible dans les autres fichiers
