import { importPublicKey, importPrivateKey } from "./keys.js";


const TAILLE_MAX = 190;


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

export async function encryptBallot(publicKey, choice) {

  let texte = choice;
  if (typeof choice !== "string") {
    texte = JSON.stringify(choice);
  }

  const octets = texteVersOctets(texte);
  if (octets.length > TAILLE_MAX) {
    const erreur = new Error(
      "Choix trop long : " + octets.length 
    );
    erreur.code = "BALLOT_TOO_LONG";
    throw erreur;
  }

  const cle = await importPublicKey(publicKey);
  const chiffre = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cle, octets);

  return octetsVersBase(new Uint8Array(chiffre));
}


export async function decryptBallot(privateKey, result) {
  try {
    const octets = baseVersOctets(result);
    const cle = await importPrivateKey(privateKey);
    const clair = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, cle, octets);
    return octetsVersTexte(new Uint8Array(clair));
  } catch (e) {
    const erreur = new Error("Déchiffrement impossible : clé incorrecte ou bulletin altéré.");
    erreur.code = "DECRYPT_FAILED";
    throw erreur;
  }
}