**justification du choix: RSA-OAEP**

+RSA est un chiffrement à clé publique : tout le monde chiffre avec la clé publique , mais seule la clé privée déchiffre.Cela correspond au scrutin : les électeurs chiffrent leur bulletin, et la clé privée n'est révélée qu'à la clôture.
+OAEP est le mode de remplissage sûr de RSA. Il ajoute du hasard au chiffrement, ce qui évite les attaques sur les messages courts et prévisibles.
+Hachage utilisé par OAEP : SHA-256. Clés échangées au format JWK (du JSON, facile à envoyer par PeerJS).

**Taille de clé : 2048 bits**

+2048 bits est le minimum recommandé aujourd'hui (niveau de sécurité d'environ 112 bits). 1024 est trop faible ; 4096 est plus lent à générer, sans réel gain pour un vote d'assemblée.
+Exposant public : 65537, valeur standard.
+**Conséquence** : taille maximale d'un message = 256 − 2 × 32 − 190 octets (256 octets de clé, moins le hachage SHA-256 compté deux fois, moins 2).

**Le nonce (sel aléatoire de 16 octets)**

+Avant le chiffrement, on colle 16 octets aléatoires (crypto.getRandomValues) devant le choix : [nonce][choix].
+Effet : deux votes identiques donnent deux chiffrés différents (testé : 10 chiffrements du même choix = 10 chaînes différentes, toutes déchiffrées en la même valeur).

  Personne ne peut deviner un vote en comparant deux bulletins.
+Au déchiffrement, les 16 premiers octets sont retirés : on récupère le choix seul.
+De manière plus simple, la nonce sert à faire un ramdom lors du chiffrement si plusieur votants font le mm choix
+l occupe 16 octets, donc le choix est limité à 190 − 16 = 174 octets.

**L'empreinte maison (reçu de vote)**

**Limites**

+**Choix limité à 174 octets** : suffisant pour un nom ou un petit objet JSON, pas pour un long texte.
+**Pas de signature** : RSA-OAEP garantit la confidentialité, pas l'authenticité. L'unicité du vote repose sur le jeton et le registre P2P, pas sur la cryptographie des bulletins.
+**Clé privée unique** : à la clôture, quiconque la reçoit peut tout déchiffrer. Avant la clôture, le secret dépend de la personne (ou du navigateur) qui la garde.
+**Pas de vote vérifiable de bout en bout** : le reçu prouve qu'un bulletin est dans le registre, pas qu'il a été compté comme voulu.
+**Empreinte maison** : non auditée, donc moins fiable qu'un SHA-256 standard.
+**Contexte sécurisé obligatoire** : la Web Crypto API ne fonctionne qu'en HTTPS ou sur `localhost` / `127.0.0.1`. Pas en `file://`.