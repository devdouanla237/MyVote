let appels = 0;
function joinSession(sessionId, token) {
 appels++;
 console.log("joinSession appel :", sessionId, token, "| appels =", appels);
}
function valider(sessionId, token) {
 const errors = {};
 if (sessionId === "") {
 errors.sessionId = "Le Session ID est obligatoire.";
 } else if (sessionId.length !== 8) {
 errors.sessionId = "Le Session ID doit faire exactement 8 caractères.";
 } else if (!/^[A-Z0-9]+$/.test(sessionId)) {
 errors.sessionId = "Seuls les lettres A-Z et chiffres sont autorisés.";
 }
 if (token === "") {
 errors.token = "Le jeton est obligatoire.";
 } else if (token.length < 6 || token.length > 20) {
 errors.token = "Le jeton doit faire entre 6 et 20 caractères.";
 } else if (!/^[A-Z0-9-]+$/.test(token)) {
 errors.token = "Seuls les lettres, chiffres ou tirets sont autorisés.";
 }
 return errors;
}
document.getElementById("rejoindre").addEventListener("click", function () {
 const sessionId = document.getElementById("sessionId").value.trim().toUpperCase();
 const token = document.getElementById("jeton").value.trim().toUpperCase();
 const errors = valider(sessionId, token);
 if (Object.keys(errors).length > 0) {
 document.getElementById("sessionIdError").textContent = errors.sessionId || "";
 document.getElementById("jetonError").textContent = errors.token || "";
 return;
 }
 document.getElementById("sessionIdError").textContent = "";
 document.getElementById("jetonError").textContent = "";
 joinSession(sessionId, token);
});