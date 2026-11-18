
const parametreRSA= {
  name: "RSA-OAEP",                           
  modulusLength: 2048,                        
  publicExponent: new Uint8Array([1, 0, 1]),  
  hash: "SHA-256"                             
};

const parametreImport = {
  name: "RSA-OAEP",
  hash: "SHA-256"
};


 export async function generateKeyPair() {

  const paire = await crypto.subtle.generateKey(
    parametreRSA,
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("jwk", paire.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", paire.privateKey);

  return { publicKey: publicKey, privateKey: privateKey };
}

export async function importPublicKey(jwk) {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    parametreImport,
    true,
    ["encrypt"]      
  );
}

export async function importPrivateKey(jwk) {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    parametreImport,
    true,
    ["decrypt"]      
  );
}