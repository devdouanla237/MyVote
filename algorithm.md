# RHE-128 — Algorithme maison d'empreinte de reçu

**Projet :** P2P-VoteEngine  
**Version :** 1.0  
**Fichier d'implémentation :** `js/crypto/receiptHash.js`  
**Sortie :** 24 caractères alphanumériques en base 36.

## 1. Objectif

RHE-128 (*Receipt Hash Engine*) transforme une chaîne de caractères en une empreinte courte et déterministe destinée à identifier un reçu de vote. Une même entrée produit toujours la même empreinte. Une modification de l'entrée doit provoquer une forte modification de l'empreinte.

L'algorithme est conçu spécifiquement pour ce projet. Il ne fait appel à aucune fonction de hachage standard (SHA, MD5, FNV, Murmur, etc.). Il construit son propre mélange à partir d'opérations sur des entiers de 64 bits : XOR, rotations circulaires, décalages et multiplications avec débordement contrôlé modulo 2^64.

> **Limite importante :** RHE-128 est un algorithme expérimental pédagogique. Il n'a pas fait l'objet d'une analyse cryptographique indépendante et ne doit pas être présenté comme une fonction cryptographique sûre pour protéger des bulletins ou des secrets. Son usage actuel est la production d'une empreinte de reçu et d'un QR code de démonstration. Pour un scrutin réel, une primitive cryptographique éprouvée et auditée est nécessaire si le sujet l'autorise.

## 2. Entrée et normalisation

L'entrée est une chaîne JavaScript quelconque. Elle est convertie en octets UTF-8 avec `TextEncoder`. Aucune suppression d'espace, conversion en minuscules ou normalisation Unicode n'est effectuée : deux chaînes dont les caractères ou les espaces diffèrent sont donc deux entrées distinctes.

Exemple : `"Vote 42"` et `"vote 42"` ne sont pas la même entrée.

## 3. État interne

L'algorithme maintient deux registres non signés de 64 bits, notés **A** et **B**. Ils sont initialisés avec deux constantes différentes :

- A = `0x243F6A8885A308D3`
- B = `0x13198A2E03707344`

Toutes les opérations sur ces registres sont ramenées sur 64 bits avec le masque `2^64 - 1`. Cela simule un débordement modulo 2^64. JavaScript `BigInt` est utilisé pour conserver exactement les valeurs entières.

## 4. Étape 1 — Absorption des octets

Pour chaque octet `x[i]` du texte UTF-8, à l'indice `i` (commençant à zéro), les opérations suivantes sont réalisées dans cet ordre :

1. Ajouter à l'octet sa position (i + 1) multipliée par `0x9E3779B1`, puis combiner le résultat avec A par XOR.
2. Faire une rotation circulaire de A de 11 bits vers la gauche.
3. Multiplier A par `0xD6E8FEB86659FD93`, en conservant les 64 bits de poids faible.
4. Combiner B par XOR avec A et l'octet décalé de `(i modulo 7) + 1` bits.
5. Faire une rotation circulaire de B de 17 bits vers la gauche, puis multiplier B par `0xA5A3564E27FEC1A5` modulo 2^64.
6. Mélanger à nouveau A avec les bits de B décalés de 7 positions.

Les deux registres évoluent donc ensemble : un octet modifie A, puis B, puis de nouveau A.

## 5. Étape 2 — Injection de la longueur

Après le dernier octet, la longueur du message en octets est mélangée dans les deux registres. La longueur est combinée à deux constantes distinctes, puis passée dans la fonction interne `mix64`.

`mix64` est une petite fonction de diffusion propre à RHE-128 : XOR avec un décalage, multiplication modulo 2^64, nouveau XOR avec décalage, seconde multiplication, puis dernier XOR. Cette étape permet notamment de distinguer les entrées de longueurs différentes.

## 6. Étape 3 — Finalisation croisée

Six tours de finalisation sont exécutés. À chaque tour :

1. A absorbe une rotation de B et passe dans `mix64`.
2. B absorbe une rotation de A et passe dans `mix64`.
3. A et B sont multipliés par deux constantes différentes, puis additionnés à un petit compteur de tour.

Les rotations changent à chaque tour. Les échanges croisés font diffuser une modification locale dans les deux registres.

## 7. Étape 4 — Production de l'empreinte

Les deux registres de 64 bits sont concaténés pour former une valeur de 128 bits :

`H = (A << 64) OR B`

Cette valeur est convertie en base 36 (chiffres `0–9` et lettres `A–Z`), puis complétée à gauche par des zéros pour obtenir exactement **24 caractères**. L'empreinte finale est donc compacte et peut être affichée sur un reçu ou encodée dans un QR code.

## 8. Propriétés attendues et validation

- **Déterminisme :** les mêmes octets UTF-8, les mêmes constantes et les mêmes opérations donnent toujours le même résultat.
- **Sensibilité :** modifier un caractère change l'état absorbé et doit normalement modifier une grande partie de l'empreinte.
- **Longueur fixe :** la sortie fait toujours 24 caractères en alphabet base 36.
- **Pas de collision observée :** le test empirique prévu compare au moins 1 000 entrées distinctes. L'absence de collision dans cet échantillon ne prouve pas l'absence de collision en général.

Une distance de Hamming d'au moins 12 caractères pour chaque paire de tests modifiés peut être mesurée dans le jeu d'essai. Ce seuil est un critère expérimental du cahier des charges, pas une garantie mathématique de l'algorithme.

## 9. QR code de signature

La page `signature.html` demande un texte, calcule son empreinte avec `receiptHash`, puis encode **l'empreinte produite** dans un QR code. Le QR code ne calcule pas le hachage : il représente visuellement le résultat de RHE-128 afin qu'il puisse être scanné et vérifié.

La bibliothèque QR utilisée par la page ne sert qu'à dessiner le QR code. Elle ne participe pas au calcul de l'empreinte maison.

## 10. Reproductibilité

Le code source de référence est `js/crypto/receiptHash.js`. Il expose la fonction globale `receiptHash(texte)`. La page de démonstration et les autres écrans doivent appeler cette même fonction, plutôt que réécrire l'algorithme séparément.
