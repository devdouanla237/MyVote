# CONTRACTS.md : Section « Messages » (T0.4)

Version 1.0 · rédigée le 12/11/2026 par M1, à relire par M2, M3 et les 6 membres avant approbation.

## 1. Règles générales

- Tous les messages sont des objets JSON envoyés par PeerJS (`conn.send(objet)`).
- Tout message possède la même **enveloppe** (section 2). Seul le champ `payload` change selon le type.
- Aucun champ n'est facultatif, sauf mention explicite « facultatif ». Un champ absent rend le message invalide (il est ignoré et un avertissement est écrit dans la console).
- Les noms de champs sont en anglais, en `camelCase`. Les valeurs textuelles sont en UTF-8.
- Un message de `type` inconnu ou mal formé est ignoré sans planter l'application (T1.5).

## 2. Enveloppe commune

| Champ | Type | Règle | Exemple |
|---|---|---|---|
| `id` | string | identifiant unique du message : 12 caractères hexadécimaux en minuscules, tirés avec `crypto.getRandomValues` ; sert à ignorer un message déjà vu | `"3f9a1c07b2d4"` |
| `type` | string | l'une des valeurs listées en section 3 | `"JOIN"` |
| `from` | string | identifiant PeerJS de l'expéditeur | `"AB12CD34"` |
| `timestamp` | number | millisecondes depuis le 1er janvier 1970, `Date.now()` à l'envoi | `1763000000000` |
| `payload` | object | contenu propre au type ; `{}` si le type n'a aucune donnée | `{}` |

## 3. Types communs aux formats

| Nom | Type | Règle |
|---|---|---|
| `sessionId` | string | 8 caractères parmi A à Z et 0 à 9 |
| `peerId` | string | identifiant PeerJS (pour l'hôte, égal au `sessionId`) |
| `tokenHash` | string | SHA-256 en hexadécimal minuscule, exactement 64 caractères |
| `base64` | string | texte base64 standard (alphabet A–Z a–z 0–9 + /, avec `=` de remplissage) |
| `timestamp` | number | entier, millisecondes depuis 1970 |
| `Bloc` | object | `{index, tokenHash, encryptedBallot, prevHash, timestamp, receiptHash}` (voir T0.5) |

**Format d'un bloc (rappel de T0.5)**

| Champ | Type | Règle |
|---|---|---|
| `index` | number | entier à partir de 0, +1 à chaque bloc |
| `tokenHash` | string | 64 caractères hexadécimaux : hash du jeton avec le sel de session |
| `encryptedBallot` | base64 | bulletin chiffré avec la clé publique (RSA-OAEP) |
| `prevHash` | string | 64 caractères hexadécimaux ; pour le bloc 0, la valeur vaut `"GENESIS"` |
| `timestamp` | number | millisecondes depuis 1970, au moment du vote |
| `receiptHash` | string | reçu de l'électeur (alphanumérique, longueur fixe 16 à 24) |

Le hash d'un bloc n'est pas stocké dans le bloc : le `prevHash` du bloc suivant vaut `computeBlockHash(prevHash du bloc, les 5 autres champs)`.

## 4. Messages

### 4.1 JOIN : un électeur arrive

- **Sens :** nouveau nœud → hôte (puis réutilisé vers les autres nœuds lors du maillage).
- **Quand :** juste après l'ouverture de la connexion.
- **Réponse attendue :** `PEER_LIST`, puis `LEDGER_SYNC`.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `sessionId` | string | session que le nœud veut rejoindre |
| `role` | string | `"voter"` ou `"organizer"` |

```json
{
  "id": "3f9a1c07b2d4",
  "type": "JOIN",
  "from": "k8x2m5qw",
  "timestamp": 1763000000000,
  "payload": { "sessionId": "AB12CD34", "role": "voter" }
}
```

Le jeton de l'électeur n'est **jamais** envoyé dans ce message.

### 4.2 PEER_LIST : liste des voisins

- **Sens :** hôte → nouveau nœud.
- **Quand :** en réponse à `JOIN`.
- **Effet :** le nouveau nœud se connecte à chaque `peerId` de la liste (T1.4).

| Champ du `payload` | Type | Règle |
|---|---|---|
| `peers` | array de string | identifiants des nœuds déjà présents, sans le destinataire |

```json
{
  "id": "a07de1c5b932",
  "type": "PEER_LIST",
  "from": "AB12CD34",
  "timestamp": 1763000000450,
  "payload": { "peers": ["AB12CD34", "p9r3t7xy", "z4n8v2bc"] }
}
```

### 4.3 BALLOT_BLOCK : un nouveau bloc de vote

- **Sens :** diffusion (broadcast) de l'électeur à tous les nœuds.
- **Quand :** juste après un vote validé localement.
- **Effet :** chaque nœud valide le bloc (`validateBlock`), l'ajoute puis le rediffuse une seule fois.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `block` | Bloc | bloc complet au format de la section 3 |

```json
{
  "id": "5c2e8f10a4b7",
  "type": "BALLOT_BLOCK",
  "from": "k8x2m5qw",
  "timestamp": 1763000120000,
  "payload": {
    "block": {
      "index": 4,
      "tokenHash": "9b74c9897bac770ffc029102a200c5de0a5f0a8b8e8e2a1f3c7d9e6b5a4c3d2e",
      "encryptedBallot": "Qk1Wb3RlRXhhbXBsZUNpcGhlcnRleHQ=",
      "prevHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "timestamp": 1763000120000,
      "receiptHash": "R7K2M9QX4TB8WZ31"
    }
  }
}
```

### 4.4 LEDGER_REQUEST : demande de blocs (ajout proposé)

- **Sens :** nœud en retard → un voisin.
- **Quand :** à l'arrivée, ou après une reconnexion.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `fromIndex` | number | premier index manquant (la longueur du registre local) |

```json
{
  "id": "b81f3a6d0c29",
  "type": "LEDGER_REQUEST",
  "from": "k8x2m5qw",
  "timestamp": 1763000001000,
  "payload": { "fromIndex": 0 }
}
```

### 4.5 LEDGER_SYNC : envoi de blocs

- **Sens :** voisin → nœud en retard.
- **Quand :** en réponse à `LEDGER_REQUEST`, ou spontanément à l'arrivée d'un nœud (T1.7).
- **Découpage :** par lots de 20 blocs au maximum ; `isLast` vaut `true` sur le dernier lot.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `fromIndex` | number | index du premier bloc du lot |
| `blocks` | array de Bloc | de 0 à 20 blocs, dans l'ordre croissant des `index` |
| `isLast` | boolean | `true` si ce lot est le dernier |

```json
{
  "id": "6d0a4e93f1c8",
  "type": "LEDGER_SYNC",
  "from": "AB12CD34",
  "timestamp": 1763000001200,
  "payload": {
    "fromIndex": 0,
    "blocks": [
      {
        "index": 0,
        "tokenHash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        "encryptedBallot": "Qk1Wb3RlRXhhbXBsZUNpcGhlcnRleHQ=",
        "prevHash": "GENESIS",
        "timestamp": 1763000050000,
        "receiptHash": "A1B2C3D4E5F6G7H8"
      }
    ],
    "isLast": true
  }
}
```

### 4.6 CLOSE_ELECTION : fin du scrutin

- **Sens :** organisateur → tous les nœuds (broadcast).
- **Quand :** clôture manuelle ou à la date de fin (T4.9).
- **Effet :** chaque nœud passe à « scrutin clos » et refuse tout nouveau `BALLOT_BLOCK`.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `closedAt` | number | millisecondes depuis 1970 |
| `finalLength` | number | nombre de blocs que l'organisateur voit au moment de la clôture |

```json
{
  "id": "c93b7a21e5d0",
  "type": "CLOSE_ELECTION",
  "from": "AB12CD34",
  "timestamp": 1763003600000,
  "payload": { "closedAt": 1763003600000, "finalLength": 42 }
}
```

### 4.7 KEY_REVEAL : révélation de la clé privée

- **Sens :** organisateur → tous les nœuds (broadcast).
- **Quand :** juste après `CLOSE_ELECTION`.
- **Effet :** chaque nœud peut déchiffrer et compter (T6.1).

| Champ du `payload` | Type | Règle |
|---|---|---|
| `privateKey` | object | clé privée RSA-OAEP au format JWK (champs `kty`, `n`, `e`, `d`, `p`, `q`, `dp`, `dq`, `qi`, `alg`, `ext`, `key_ops`) |

```json
{
  "id": "e12c5b88a7f3",
  "type": "KEY_REVEAL",
  "from": "AB12CD34",
  "timestamp": 1763003601000,
  "payload": {
    "privateKey": {
      "kty": "RSA",
      "alg": "RSA-OAEP-256",
      "ext": true,
      "key_ops": ["decrypt"],
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4...",
      "e": "AQAB",
      "d": "X4cTteJY_gn4FYPsXB8rdXix5vwsg1FLN5E3EaG6RJoVH-HLLKD9...",
      "p": "83i-7IvMGXoMXCskv73TKr8637FiO7Z27zv8oj6pbWUQyLPQcQ...",
      "q": "3dfOR9cuYq-0S-mkFLzgItgMEfFzB2q3hWehMuG0oCuqnb3vob...",
      "dp": "G4sPXkc6Ya9y_oJF_l-amfv5Ob8nYM2oPQ...",
      "dq": "s9lAH9fggBsoFR8Oac2R_E2gw282rT2kGOAhvIllETE1efrA6h...",
      "qi": "GyM_p6JrXySiz1toFgKbWV-JdI3jQ4ypu9rbMWx3rQJBfmt0F..."
    }
  }
}
```

(Les valeurs longues sont abrégées ici ; en réalité chaque champ est une chaîne base64url complète.)

### 4.8 REJECT : un bloc est refusé

- **Sens :** nœud qui refuse → l'expéditeur du bloc (et, pour un double vote, tous les nœuds).
- **Quand :** `validateBlock` échoue ou le jeton a déjà voté (T3.2, T3.3).

| Champ du `payload` | Type | Règle |
|---|---|---|
| `reason` | string | une valeur parmi `BAD_FORMAT`, `BAD_PREV_HASH`, `BAD_INDEX`, `DUPLICATE_TOKEN`, `ELECTION_CLOSED` |
| `tokenHash` | string | 64 caractères hexadécimaux du bloc refusé |
| `blockIndex` | number | `index` du bloc refusé |

```json
{
  "id": "f4a60d19b3e2",
  "type": "REJECT",
  "from": "p9r3t7xy",
  "timestamp": 1763000125000,
  "payload": {
    "reason": "DUPLICATE_TOKEN",
    "tokenHash": "9b74c9897bac770ffc029102a200c5de0a5f0a8b8e8e2a1f3c7d9e6b5a4c3d2e",
    "blockIndex": 4
  }
}
```

### 4.9 PING (ajout proposé)

- **Sens :** chaque nœud → chacun de ses voisins, toutes les 5 secondes (T1.6).
- **Règle :** un voisin sans `PING` depuis 15 secondes est considéré comme mort.

| Champ du `payload` | Type | Règle |
|---|---|---|
| aucun | | `payload` vaut `{}` |

```json
{
  "id": "07b9e2c4d1a8",
  "type": "PING",
  "from": "k8x2m5qw",
  "timestamp": 1763000005000,
  "payload": {}
}
```

### 4.10 RESULT_HASH (ajout proposé)

- **Sens :** broadcast, après le comptage local (T6.3).
- **But :** vérifier que tous les nœuds trouvent le même résultat.

| Champ du `payload` | Type | Règle |
|---|---|---|
| `resultHash` | string | SHA-256 hexadécimal (64 caractères) du JSON du résultat, clés triées |
| `ledgerLength` | number | nombre de blocs utilisés pour le calcul |

```json
{
  "id": "2a8d5f60c7b1",
  "type": "RESULT_HASH",
  "from": "p9r3t7xy",
  "timestamp": 1763003700000,
  "payload": {
    "resultHash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "ledgerLength": 42
  }
}
```

## 5. Récapitulatif

| Type | Sens | Diffusion | Champs du `payload` |
|---|---|---|---|
| `JOIN` | nœud → hôte | un destinataire | `sessionId`, `role` |
| `PEER_LIST` | hôte → nœud | un destinataire | `peers` |
| `BALLOT_BLOCK` | électeur → tous | broadcast | `block` |
| `LEDGER_REQUEST` | nœud → voisin | un destinataire | `fromIndex` |
| `LEDGER_SYNC` | voisin → nœud | un destinataire | `fromIndex`, `blocks`, `isLast` |
| `CLOSE_ELECTION` | organisateur → tous | broadcast | `closedAt`, `finalLength` |
| `KEY_REVEAL` | organisateur → tous | broadcast | `privateKey` |
| `REJECT` | nœud → expéditeur | un destinataire ou broadcast | `reason`, `tokenHash`, `blockIndex` |
| `PING` | nœud → voisins | chaque voisin | aucun |
| `RESULT_HASH` | nœud → tous | broadcast | `resultHash`, `ledgerLength` |

## 6. Points à valider en équipe

1. L'enveloppe commune (`id`, `type`, `from`, `timestamp`, `payload`) convient-elle à tous ?
2. Les 3 ajouts (`LEDGER_REQUEST`, `PING`, `RESULT_HASH`) sont-ils acceptés ?
3. La liste des raisons de `REJECT` : M3 confirme les 4 raisons de T3.2, plus `ELECTION_CLOSED`.
4. La taille maximum d'un lot de `LEDGER_SYNC` : 20 blocs est-il adapté ?
5. M2 confirme que la clé privée au format JWK est bien celle qu'attend `decryptBallot`.
6. T5.2 : l'électeur doit pouvoir vérifier son jeton. Il faut donc un message de l'organisateur contenant la liste des `tokenHash` autorisés, ou bien un champ dans `JOIN`/`PEER_LIST`. Décision à prendre avant T5.2 (02/12).

Approuvé par : M1 ☐  M2 ☐  M3 ☐  M4 ☐  M5 ☐  M6 ☐
