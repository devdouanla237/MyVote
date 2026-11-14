import NetworkManager from "./network.js";

// Instance partagée dans toute l'application
export let network = new NetworkManager();


// État de l'organisateur
export let isHost = false;

let isStarting = false;


// Délai maximal : 10 secondes
const HOST_TIMEOUT = 10000;


// Création d'une erreur typée
function createHostError(code, message) {

    const error = new Error(message);

    error.code = code;

    return error;
}


// Fonction principale
export async function hostSession(sessionId) {

    // 1. Vérifier si un hôte existe déjà
    if (isHost || isStarting) {

        throw createHostError(
            "HOST_ALREADY_STARTED",
            "Hôte déjà démarré"
        );

    }


    // 2. Vérifier le format du Session ID
    if (
        typeof sessionId !== "string" ||
        !/^[A-Z0-9]{8}$/.test(sessionId)
    ) {

        throw createHostError(
            "INVALID_SESSION_ID",
            "Le Session ID doit contenir exactement 8 lettres majuscules ou chiffres."
        );

    }


    isStarting = true;

    let timeout;


    try {

        // 3. Écouter les nouvelles connexions
        const onConnection = (peerId) => {

            console.log(
                `Nouvel arrivant : ${peerId}`
            );

        };

        network.on("connection", onConnection);


        // 4. Initialiser PeerJS avec le Session ID
        const initialization = network.init(sessionId);


        // 5. Créer le délai maximum d'attente
        const timeoutPromise = new Promise((resolve, reject) => {

            timeout = setTimeout(() => {

                reject(
                    createHostError(
                        "TIMEOUT",
                        "Le délai de création de la session est dépassé."
                    )
                );

            }, HOST_TIMEOUT);

        });


        // 6. Attendre l'ouverture du peer ou le timeout
        await Promise.race([
            initialization,
            timeoutPromise
        ]);


        // 7. L'hôte est prêt
        clearTimeout(timeout);

        isHost = true;

        console.log(`Hôte prêt : ${sessionId}`);

        return sessionId;


    } catch (error) {

        clearTimeout(timeout);


        // 8. Identifier le type d'erreur
        let hostError;


        if (error.code === "TIMEOUT") {

            hostError = error;

        } else if (error.type === "unavailable-id") {

            hostError = createHostError(
                "SESSION_ID_TAKEN",
                "Ce Session ID est déjà utilisé"
            );

        } else {

            hostError = createHostError(
                "NETWORK_ERROR",
                error.message || "Une erreur réseau est survenue."
            );

        }


        // 9. Détruire le réseau en cas d'échec
        network.destroy();


        // Réinitialiser les états
        isHost = false;

        throw hostError;


    } finally {

        isStarting = false;

    }

}