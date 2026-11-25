import { importPublicKey, importPrivateKey } from "./keys.js";


const TAILLE_MAX = 190;
const TAILLE_NONCE = 16;
const TAILLE_MAX_CHOIX = TAILLE_MAX - TAILLE_NONCE;


function texteVersOctets(texte) {
  return new TextEncoder().encode(texte);
}

function octetsVersTexte(octets) {
  return new TextDecoder().decode(octets);
}

function octetsVersBase(octets) {
  let texte = "";
  for (let i = 0; i < octets.length; i++) {
    texte = texte + String.fromCharCode(octets[i]);
  }
  return btoa(texte);
}


function baseVersOctets(base) {
  const texte = atob(base);
  const octets = new Uint8Array(texte.length);
  for (let i = 0; i < texte.length; i++) {
    octets[i] = texte.charCodeAt(i);
  }
  return octets;
}

function creerNonce() {
  const nonce = new Uint8Array(TAILLE_NONCE);
  crypto.getRandomValues(nonce); 
  return nonce;
}

export async function encryptBallot(publicKey, choice) {

  let texte = choice;
  if (typeof choice !== "string") {
    texte = JSON.stringify(choice);
  }

  const octets = texteVersOctets(texte);
  if (octets.length > TAILLE_MAX_CHOIX) {
    const erreur = new Error(
      "Choix trop long : " + octets.length 
    );
    erreur.code = "BALLOT_TOO_LONG";
    throw erreur;
  }

  const nonce = creerNonce();
  const chiffrer = new Uint8Array(TAILLE_NONCE + octets.length);
    chiffrer.set(nonce, 0);              
    chiffrer.set(octets, TAILLE_NONCE);

  const cle = await importPublicKey(publicKey);
  const chiffre = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cle, chiffrer);

  return octetsVersBase(new Uint8Array(chiffre));
}


export async function decryptBallot(privateKey, result) {
  try {
    const octets = baseVersOctets(result);
    const cle = await importPrivateKey(privateKey);
    const clair = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, cle, octets);

    if (clair.byteLength < TAILLE_NONCE) {
      throw new Error("bulletin trop court");
    }

    const choix = new Uint8Array(clair).slice(TAILLE_NONCE);
    return octetsVersTexte(choix);
  } catch (e) {
    console.error("Détail réel :", e);
    const erreur = new Error("Déchiffrement impossible : clé incorrecte ou bulletin altéré.");
    erreur.code = "DECRYPT_FAILED";
    throw erreur;
  }
}