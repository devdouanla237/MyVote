# 🗳️ P2P-VoteEngine

### Plateforme de vote électronique décentralisée et sécurisée

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)
![PeerJS](https://img.shields.io/badge/PeerJS-P2P-0D9488?style=flat)
![Web Crypto API](https://img.shields.io/badge/Web%20Crypto-Encryption-2563EB?style=flat)

---

## 1. Présentation du projet

**P2P-VoteEngine** est une application web de vote électronique décentralisée permettant d'organiser et de participer à des scrutins à travers un réseau Peer-to-Peer (P2P).

Le système repose sur une architecture distribuée dans laquelle les différents navigateurs communiquent directement entre eux, sans utiliser de serveur central de base de données.

L'application vise à garantir :

- La confidentialité des votes grâce au chiffrement.
- L'intégrité des données grâce à une empreinte cryptographique et au chaînage des blocs.
- La transparence du processus électoral.
- La détection et le rejet des doubles votes.
- La synchronisation du registre entre les différents participants.
- Le fonctionnement décentralisé grâce au réseau P2P.

## 2. Objectifs du projet

Les principaux objectifs sont :

1. Permettre la création et la gestion de scrutins électroniques.
2. Permettre aux électeurs de participer à un scrutin.
3. Sécuriser les votes à l'aide de mécanismes cryptographiques.
4. Assurer la communication entre les participants via PeerJS.
5. Maintenir un registre distribué des votes.
6. Empêcher qu'un même électeur vote plusieurs fois.
7. Permettre le dépouillement et la visualisation des résultats.
8. Exporter les résultats des scrutins.

## 3. Technologies utilisées

Le projet respecte les contraintes technologiques imposées par le sujet.

| Technologie    | Utilisation                                 |
| -------------- | ------------------------------------------- |
| HTML5          | Structure des pages web                     |
| CSS3           | Mise en forme et interface utilisateur      |
| JavaScript pur | Logique et fonctionnalités de l'application |
| PeerJS         | Communication Peer-to-Peer                  |
| Web Crypto API | Chiffrement et opérations cryptographiques  |
| IndexedDB      | Stockage local du registre distribué        |
| LocalStorage   | Conservation des préférences et paramètres  |
| Git            | Gestion des versions                        |
| GitHub         | Collaboration et hébergement du code        |

**Important :** aucun framework JavaScript et aucun serveur de base de données ne sont utilisés.

## 4. Architecture générale

L'application repose sur une architecture décentralisée.

Chaque navigateur participant constitue un nœud du réseau P2P.

Les communications entre les différents nœuds sont assurées par PeerJS.

Chaque participant dispose de son propre stockage local pour conserver les informations nécessaires au fonctionnement de l'application.

### Principaux composants

- **Interface utilisateur :** permet aux organisateurs et aux électeurs d'interagir avec le système.
- **Module P2P :** assure la connexion, la communication et la synchronisation entre les nœuds.
- **Module cryptographique :** assure le chiffrement et la vérification de l'intégrité des données.
- **Registre distribué :** conserve les blocs et les informations relatives aux votes.
- **Module de dépouillement :** traite les votes et présente les résultats.

## 6. Organisation du développement

Le développement est organisé en plusieurs phases.

### Phase 1 : Développement indépendant

Chaque membre développe son module individuellement à l'aide de fausses données (mocks).

Les interfaces entre les modules doivent respecter les signatures et les conventions définies dans `CONTRACTS.md`.

### Phase 2 : Intégration

Les différents modules sont progressivement intégrés dans l'application principale.

Les échanges entre les composants sont vérifiés afin de garantir leur compatibilité.

### Phase 3 : Tests et validation

Chaque membre réalise les tests manuels de son module à l'aide de sa fiche de test.

Chaque module dispose également d'une page de démonstration :

- `demo-reseau.html`
- `demo-crypto.html`
- `demo-ledger.html`
- `demo-organisateur.html`
- `demo-electeur.html`
- `demo-depouillement.html`

### Phase 4 : Finalisation

- Correction des anomalies.
- Vérification de la synchronisation P2P.
- Vérification des mécanismes de sécurité.
- Validation du processus électoral.
- Préparation de la soutenance.

## 7. Conventions de développement

### 7.1. Gestion des branches Git

La branche `main` est protégée.



Toute modification doit passer par une Pull Request (PR).

Chaque Pull Request doit être relue par au moins un autre membre avant sa fusion dans `main`.

### 7.2. Organisation du code

Le code doit être organisé en modules indépendants afin de faciliter :

- La maintenance.
- La réutilisation.
- L'intégration.
- La collaboration.
- La compréhension du projet.

### 7.3. Gestion des couleurs

Toutes les couleurs doivent être définies dans le fichier `variables.css`.

Les couleurs ne doivent jamais être écrites directement dans les autres fichiers CSS.

Les variables permettent de gérer les thèmes clair et sombre.

## 8. Identité visuelle

La palette graphique repose principalement sur deux couleurs :

- **Bleu profond :** confiance, neutralité et fiabilité.
- **Turquoise :** sécurité et technologie.

Les couleurs secondaires servent à représenter les états et les informations.

### Palette principale

| Variable       | Utilisation                 |
| -------------- | --------------------------- |
| `--primary`    | Boutons principaux et liens |
| `--accent`     | Éléments de sécurité        |
| `--bg`         | Arrière-plan                |
| `--surface`    | Cartes et modales           |
| `--text`       | Texte principal             |
| `--text-muted` | Texte secondaire            |
| `--border`     | Bordures et séparateurs     |

### Palette des états

| Variable    | Utilisation                       |
| ----------- | --------------------------------- |
| `--success` | Confirmation et connexion réussie |
| `--warning` | Avertissement et reconnexion      |
| `--danger`  | Erreur et rejet d'un double vote  |
| `--info`    | Informations générales            |

Les graphiques utilisent une palette adaptée aux personnes daltoniennes.

## 9. Installation et exécution

### Prérequis

- Un navigateur web moderne.
- Un éditeur de code (Visual Studio Code recommandé).
- Git.
- Une connexion Internet pour les dépendances et la signalisation PeerJS.

### Cloner le projet

```bash
git clone <URL_DU_DEPOT>
```

Accéder au répertoire :

```bash
cd P2P-VoteEngine
```

### Lancer l'application

Le projet utilise HTML, CSS et JavaScript natifs.

Il peut être exécuté avec un serveur HTTP local, par exemple avec l'extension Live Server de Visual Studio Code.

Ouvrir ensuite la page principale dans le navigateur.

**Remarque :** l'accès aux fonctionnalités cryptographiques de Web Crypto API nécessite un contexte sécurisé (HTTPS ou localhost).

## 10. Structure indicative du projet

```text
P2P-VoteEngine/
│
├── index.html
├── README.md
├── CONTRACTS.md
│
├── css/
│   ├── variables.css
│   ├── style.css
│   └── components.css
│
├── js/
│   ├── main.js
│   │
│   ├── network/
│   ├── crypto/
│   ├── ledger/
│   ├── organizer/
│   ├── voter/
│   └── results/
│
├── assets/
│   ├── images/
│   └── icons/
│
└── demos/
    ├── demo-reseau.html
    ├── demo-crypto.html
    ├── demo-ledger.html
    ├── demo-organisateur.html
    ├── demo-electeur.html
    └── demo-depouillement.html
```

Cette structure est indicative et peut évoluer selon les décisions prises par l'équipe.

## 11. Planning et échéance

Le projet est développé selon un calendrier collectif.

- Développement des modules.
- Intégration progressive.
- Tests manuels.
- Corrections et validation.
- Préparation de la documentation et de la présentation.

**Date de soutenance : semaine du 18 janvier 2027.**

Une réunion hebdomadaire de 30 minutes est organisée sous la coordination de M1 afin de suivre l'avancement et de résoudre les problèmes d'intégration.

## 12. Sécurité et limites

Le projet utilise plusieurs mécanismes de sécurité :

- Chiffrement RSA-OAEP.
- Vérification des empreintes cryptographiques.
- Chaînage des blocs.
- Détection des doubles votes.
- Synchronisation du registre distribué.

La décentralisation du registre ne garantit pas, à elle seule, l'impossibilité de falsifier un scrutin. La sécurité réelle dépend également de la gestion des identités, de l'authentification des électeurs, du protocole de consensus, de la protection des clés et de la vérification du dépouillement.

## 13. Équipe de développement

**Projet :** P2P-VoteEngine  
**Équipe :** 6 membres

- [@devdouanla237](https://github.com/devdouanla237)

- [@claire-mveng](https://github.com/Claire-Mveng)
- [@cedricfotsa-web](https://github.com/cedricfotsa-web)
- [@EBIGUITE-Theresa](https://github.com/EBIGUITE-Theresa)
- [@nkamolga-alt](https://github.com/nkamolga-alt)
- [@TCHOUAMANI](https://github.com/TCHOUAMANI)

- **Type :** Application web de vote électronique décentralisée  
  **Encadrement :** Projet académique sous l'encadrement de @davart87 (https://github.com/davart87)
 

---

### Licence

Projet réalisé dans un cadre académique.
feat(network): implémenter la création de session hôte avec un identifiant personnalisé