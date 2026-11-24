export const I18N = {
  fr: {
    index_valide:{
    badge: "Sans serveur central · Chiffrement RSA-OAEP",
    title: "Votez en toute confiance, directement entre navigateurs.",
    text: "Plateforme de vote électronique en temps réel : bulletins chiffrés, un jeton = un seul vote, résultats vérifiables par tous. Aucune base de données centrale.",
    orgTag: "1 · Gestion du scrutin", 
    orgTitle: "Je suis organisateur",
    orgText: "Créez un scrutin, chargez les jetons autorisés, générez les clés RSA et pilotez le vote en direct.",
    orgList: ["Créer le scrutin et ses choix", "Charger le registre des jetons", "Générer les clés et lancer la session"],
    orgBtn: "Créer un scrutin",
    voterTag: "2 · Espace électeur", 
    voterTitle: "Je suis électeur",
    voterText: "Rejoignez une session avec son Session ID et votre jeton, votez en toute confidentialité et conservez votre reçu.",
    voterList: ["Saisir le Session ID et votre jeton", "Voter : bulletin chiffré dans votre navigateur", "Recevoir une empreinte de vérification"],
    voterBtn: "Rejoindre une session",
    g: [["Anonymat", "Bulletin chiffré en RSA-OAEP avant tout envoi."], ["Vote unique", "Un jeton autorisé = un seul vote."], ["Transparence", "Registre partagé, résultats vérifiables."]],
    footer: "ISI3195 · Technologies Web et Programmation 1 · Saint Jean Ingénieur",
    net: { online: "Réseau prêt · 0 pair", offline: "Hors ligne" }.offline,
  },
  admin: {
 ph: {
        desc: "Décrivez votre scrutin...",
        title:"Ex. Élection du délégué de classe",
    },    // Accessibilité
    a11y: {
        skip: 'Aller au contenu'
    },

    // Thème
    theme: {
        aria: 'Thème',
        light: 'Clair',
        dark: 'Sombre'
    },

    // Réseau
    net: {
        online: 'Connecté · {n} pair',
        onlineMany: 'Connecté · {n} pairs',
        degraded: 'Réseau dégradé',
        offline: 'Déconnecté'
    },

    // Navigation
    nav: {
        aria: 'Fil d’Ariane',
        home: 'Accueil',
        organizer: 'Espace organisateur'
    },

    // En-tête
    title: 'Création du scrutin',
    lead: 'Définissez le scrutin, puis chargez le registre des électeurs autorisés.',

    // Progression
    step: {
        aria: 'Progression',
        1: 'Scrutin',
        2: 'Registre',
        3: 'Lancement',
        compact: 'Étape 1 sur 3 · Scrutin'
    },

    // Champs
    field: {
        title: 'Titre du scrutin',
        desc: 'Description',
        type: 'Type de scrutin',
        max: 'Nombre maximum de choix',
        date: 'Date de fin',
        time: 'Heure'
    },

    // Placeholders
    ph: {
        title: 'Ex. Élection du délégué de classe',
        desc: 'Précisez l’objet du vote pour les électeurs'
    },

    optional: '(facultatif)',

    // Types de scrutin
    type: {
        single: 'Unique',
        singleSub: '1 choix',

        multiple: 'Multiple',
        multipleSub: 'Plusieurs',

        weighted: 'Pondéré',
        weightedSub: 'Points'
    },

    // Indications
    hint: {
        single: 'Un seul choix par électeur.',
        multiple: 'Chaque électeur peut cocher plusieurs choix, dans la limite fixée.',
        weighted: 'Chaque choix a un poids ; l’électeur répartit ses points.',
        max: 'Entre 1 et {n}.'
    },

    // Choix du scrutin
    choices: {
        label: 'Choix du scrutin',
        count: '{n} choix · min. {min}',
        countWeighted: '{n} choix · total {p} pts',
        add: 'Ajouter un choix',
        dragHint: 'Glissez la poignée pour réordonner les choix.'
    },

    // Choix individuels
    choice: {
        placeholder: 'Choix {n}',
        weight: 'Poids du choix {n}',
        unit: 'pts',
        delete: 'Supprimer le choix {n}',
        move: 'Déplacer le choix {n} (glisser, ou flèches haut et bas)'
    },

    // Actions
    actions: {
        cancel: 'Annuler',
        next: 'Suivant',
        loading: 'Vérification…'
    },

    // Statuts
    status: {
        valid: 'Formulaire valide',
        incomplete: 'Complétez les champs obligatoires (*) pour continuer.',
        saving: 'Enregistrement du scrutin…'
    },

    // Erreurs
    err: {
        title: 'Le titre est obligatoire.',
        dateRequired: 'La date de fin est obligatoire.',
        datePast: 'La date de fin doit être dans le futur.',
        timeRequired: 'L’heure est obligatoire.',
        minChoices: 'Ajoutez au moins {min} choix pour continuer.',
        emptyChoice: 'Remplissez ou supprimez les choix vides.',
        dupChoice: 'Les choix doivent être différents.',
        weight: 'Le poids doit être un entier supérieur ou égal à 1.',
        max: 'Saisissez un nombre entier entre 1 et {n}.'
    },

    // Notifications
    toast: {
        saved: 'Scrutin enregistré. Étape suivante : le registre des électeurs.',
        saveError: 'Impossible d’enregistrer le brouillon sur cet appareil.',
        offline: 'Problème de connexion : vérifiez votre Internet puis réessayez.'
    },

    // Dialogue
    dlg: {
        title: 'Abandonner la création ?',
        text: 'Les informations saisies seront perdues.',
        stay: 'Continuer la saisie',
        leave: 'Quitter'
    }

}
},
  en: {
   
     index_valide: {
    badge: "No central server · RSA-OAEP encryption",
    title: "Vote with confidence, directly between browsers.",
    text: "Real-time electronic voting platform: encrypted ballots, one token = one vote, results verifiable by everyone. No central database.",
    orgTag: "1 · Election management", orgTitle: "I'm an organizer",
    orgText: "Create an election, load the authorized tokens, generate RSA keys and run the vote live.",
    orgList: ["Create the election and its choices", "Load the token register", "Generate keys and start the session"],
    orgBtn: "Create an election",
    voterTag: "2 · Voter area", voterTitle: "I'm a voter",
    voterText: "Join a session with its Session ID and your token, vote confidentially and keep your receipt.",
    voterList: ["Enter the Session ID and your token", "Vote: ballot encrypted in your browser", "Get a verification fingerprint"],
    voterBtn: "Join a session",
    g: [["Anonymity", "Ballot encrypted with RSA-OAEP before sending."], ["One vote", "One authorized token = one vote."], ["Transparency", "Shared ledger, verifiable results."]],
    footer: "ISI3195 · Web Technologies and Programming 1 · Saint Jean Ingénieur",
    net: { online: "Network ready · 0 peers", offline: "Offline" },
    },

      

     admin: {
  ph: {
        desc: "Describe your election...",

        title:"Ex. Election of the class representative"
    },
    // Navigation
    nav: {
        aria: 'Breadcrumb',
        home: 'Home',
        organizer: 'Organizer area'
    },

    // En-tête
    title: 'Create the ballot',
    lead: 'Define the ballot, then load the register of authorized voters.',

    // Progression
    step: {
        aria: 'Progress',
        1: 'Ballot',
        2: 'Register',
        3: 'Launch',
        compact: 'Step 1 of 3 · Ballot'
    },

    // Champs
    field: {
        title: 'Ballot title',
        desc: 'Description',
        type: 'Ballot type',
        max: 'Maximum number of choices',
        date: 'End date',
        time: 'Time'
    },

    // Placeholders
    ph: {
        title: 'e.g. Class representative election',
        desc: 'Explain what the vote is about'
    },

    optional: '(optional)',

    // Types de scrutin
    type: {
        single: 'Single',
        singleSub: '1 choice',

        multiple: 'Multiple',
        multipleSub: 'Several',

        weighted: 'Weighted',
        weightedSub: 'Points'
    },

    // Indications
    hint: {
        single: 'One choice per voter.',
        multiple: 'Each voter can tick several choices, up to the set limit.',
        weighted: 'Each choice has a weight; voters spread their points.',
        max: 'Between 1 and {n}.'
    },

    // Choix du scrutin
    choices: {
        label: 'Ballot choices',
        count: '{n} choices · min. {min}',
        countWeighted: '{n} choices · total {p} pts',
        add: 'Add a choice',
        dragHint: 'Drag the handle to reorder the choices.'
    },

    // Choix individuels
    choice: {
        placeholder: 'Choice {n}',
        weight: 'Weight of choice {n}',
        unit: 'pts',
        delete: 'Delete choice {n}',
        move: 'Move choice {n} (drag, or up and down arrows)'
    },

    // Actions
    actions: {
        cancel: 'Cancel',
        next: 'Next',
        loading: 'Checking…'
    },

    // Statuts
    status: {
        valid: 'Form is valid',
        incomplete: 'Fill in the required fields (*) to continue.',
        saving: 'Saving the ballot…'
    },

    // Erreurs
    err: {
        title: 'The title is required.',
        dateRequired: 'The end date is required.',
        datePast: 'The end date must be in the future.',
        timeRequired: 'The time is required.',
        minChoices: 'Add at least {min} choices to continue.',
        emptyChoice: 'Fill in or remove the empty choices.',
        dupChoice: 'Choices must be different.',
        weight: 'The weight must be a whole number of 1 or more.',
        max: 'Enter a whole number between 1 and {n}.'
    },

    // Notifications
    toast: {
        saved: 'Ballot saved. Next step: the voter register.',
        saveError: 'The draft could not be saved on this device.',
        offline: 'Connection problem: check your Internet and try again.'
    },

    // Dialogue de confirmation
    dlg: {
        title: 'Discard this ballot?',
        text: 'The information entered will be lost.',
        stay: 'Keep editing',
        leave: 'Leave'
    }

}
    }, 






















































  }
