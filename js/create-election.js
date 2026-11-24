// ============================================================
// MYVOTE - CREATION D'UN SCRUTIN
// ============================================================

// Récupération des éléments HTML
const $ = (id) => document.getElementById(id);

const form = $('election-form');
const choicesList = $('choices-list');
const addChoiceButton = $('add-choice');
const voteType = $('vote-type');

// ============================================================
// 1. INITIALISATION
// ============================================================

// Aucun choix n'est prérempli.
// L'organisateur construit lui-même sa liste.
let choices = [];

// ============================================================
// 2. GENERATION D'IDENTIFIANTS
// ============================================================

function generateId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return 'choice-' + Date.now() + '-' +
        Math.random().toString(36).substring(2, 10);
}

// ============================================================
// 3. CREATION D'UN BOUTON
// ============================================================

function createButton(symbol, label, disabled, action) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'icon-button';
    button.textContent = symbol;
    button.title = label;
    button.disabled = disabled;

    button.setAttribute('aria-label', label);

    button.addEventListener('click', action);

    return button;
}

// ============================================================
// 4. AFFICHAGE DES CHOIX
// ============================================================

function renderChoices() {

    choicesList.replaceChildren();

    // Aucun choix ajouté
    if (choices.length === 0) {

        const message = document.createElement('p');

        message.className = 'empty-choices';

        message.textContent =
            'Aucun choix ajouté. Cliquez sur « Ajouter un choix » pour commencer.';

        choicesList.appendChild(message);
    }

    // Affichage de chaque choix
    choices.forEach((choice, index) => {

        const row = document.createElement('div');

        row.className = 'choice-row';

        // Numéro du choix
        const number = document.createElement('span');

        number.className = 'choice-number';
        number.textContent = index + 1;

        row.appendChild(number);

        // Champ de saisie
        const input = document.createElement('input');

        input.type = 'text';
        input.maxLength = 100;
        input.placeholder = `Saisir le choix ${index + 1}`;
        input.value = choice.label;

        input.setAttribute(
            'aria-label',
            `Libellé du choix ${index + 1}`
        );

        input.addEventListener('input', () => {
            choice.label = input.value;
        });

        row.appendChild(input);

        // Champ poids pour un scrutin pondéré
        if (voteType.value === 'weighted') {

            const weight = document.createElement('input');

            weight.type = 'number';
            weight.className = 'weight';
            weight.min = '1';
            weight.step = '1';
            weight.value = choice.weight;

            weight.placeholder = 'Poids';

            weight.setAttribute(
                'aria-label',
                `Poids du choix ${index + 1}`
            );

            weight.addEventListener('input', () => {
                choice.weight = weight.value;
            });

            row.appendChild(weight);
        }

        // Boutons de gestion
        const tools = document.createElement('div');

        tools.className = 'choice-tools';

        // Monter
        const upButton = createButton(
            '↑',
            'Monter',
            index === 0,
            () => moveChoice(index, -1)
        );

        // Descendre
        const downButton = createButton(
            '↓',
            'Descendre',
            index === choices.length - 1,
            () => moveChoice(index, 1)
        );

        // Supprimer
        const deleteButton = createButton(
            '×',
            'Supprimer',
            false,
            () => deleteChoice(index)
        );

        tools.append(
            upButton,
            downButton,
            deleteButton
        );

        row.appendChild(tools);

        choicesList.appendChild(row);
    });

    // Mise à jour du compteur
    $('choice-counter').textContent =
        `${choices.length} choix`;

    // Paramètres du scrutin multiple
    $('multiple-settings').hidden =
        voteType.value !== 'multiple';
}

// ============================================================
// 5. AJOUTER UN CHOIX
// ============================================================

function addChoice() {

    const newChoice = {
        id: generateId(),
        label: '',
        weight: 1
    };

    choices.push(newChoice);

    renderChoices();

    // Placer automatiquement le curseur
    const inputs = choicesList.querySelectorAll(
        'input[type="text"]'
    );

    const lastInput = inputs[inputs.length - 1];

    if (lastInput) {
        lastInput.focus();
    }
}

// ============================================================
// 6. SUPPRIMER UN CHOIX
// ============================================================

function deleteChoice(index) {

    choices.splice(index, 1);

    renderChoices();
}

// ============================================================
// 7. REORDONNER LES CHOIX
// ============================================================

function moveChoice(index, direction) {

    const newIndex = index + direction;

    if (
        newIndex < 0 ||
        newIndex >= choices.length
    ) {
        return;
    }

    const temporary = choices[index];

    choices[index] = choices[newIndex];

    choices[newIndex] = temporary;

    renderChoices();
}

// ============================================================
// 8. GESTION DES EVENEMENTS
// ============================================================

// Ajouter un choix
addChoiceButton.addEventListener('click', addChoice);

// Changement du type de scrutin
voteType.addEventListener('change', renderChoices);

// ============================================================
// 9. AFFICHAGE DES ERREURS
// ============================================================

function showError(id, message) {

    const element = $(id);

    if (element) {
        element.textContent = message;
    }
}

// ============================================================
// 10. VALIDATION DU FORMULAIRE
// ============================================================

function validateForm() {

    // Réinitialiser les erreurs
    showError('title-error', '');
    showError('date-error', '');
    showError('choices-error', '');
    showError('max-error', '');

    $('form-message').textContent = '';
    $('form-message').className = 'form-message';

    let valid = true;

    // --------------------------------------------------------
    // TITRE
    // --------------------------------------------------------

    const title = $('title').value.trim();

    if (!title) {

        showError(
            'title-error',
            'Le titre du scrutin est obligatoire.'
        );

        valid = false;
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    const description = $('description').value.trim();

    // --------------------------------------------------------
    // DATE ET HEURE DE FIN
    // --------------------------------------------------------

    const dateValue = $('end-date').value;

    if (!dateValue) {

        showError(
            'date-error',
            'Veuillez renseigner la date et l’heure de fin.'
        );

        valid = false;

    } else {

        const endDate = new Date(dateValue);

        if (
            Number.isNaN(endDate.getTime()) ||
            endDate.getTime() <= Date.now()
        ) {

            showError(
                'date-error',
                'La date et l’heure de fin doivent être dans le futur.'
            );

            valid = false;
        }
    }

    // --------------------------------------------------------
    // TYPE DE SCRUTIN
    // --------------------------------------------------------

    const type = voteType.value;

    // --------------------------------------------------------
    // LISTE DES CHOIX
    // --------------------------------------------------------

    const normalizedChoices = choices.map(choice => ({
        ...choice,
        label: choice.label.trim()
    }));

    if (normalizedChoices.length < 2) {

        showError(
            'choices-error',
            'Vous devez ajouter au moins deux choix.'
        );

        valid = false;

    } else if (
        normalizedChoices.some(choice => !choice.label)
    ) {

        showError(
            'choices-error',
            'Tous les choix doivent être renseignés.'
        );

        valid = false;
    }

    // --------------------------------------------------------
    // SCRUTIN MULTIPLE
    // --------------------------------------------------------

    let maxChoices = null;

    if (type === 'multiple') {

        maxChoices = Number($('max-choices').value);

        if (
            !Number.isInteger(maxChoices) ||
            maxChoices < 1 ||
            maxChoices > normalizedChoices.length
        ) {

            showError(
                'max-error',
                'Le nombre maximum doit être compris entre 1 et le nombre total de choix.'
            );

            valid = false;
        }
    }

    // --------------------------------------------------------
    // SCRUTIN PONDERE
    // --------------------------------------------------------

    if (type === 'weighted') {

        const invalidWeight = normalizedChoices.some(choice => {

            const weight = Number(choice.weight);

            return (
                !Number.isInteger(weight) ||
                weight < 1
            );
        });

        if (invalidWeight) {

            showError(
                'choices-error',
                'Chaque choix doit avoir un poids entier supérieur ou égal à 1.'
            );

            valid = false;
        }
    }

    // --------------------------------------------------------
    // RESULTAT DE LA VALIDATION
    // --------------------------------------------------------

    if (!valid) {
        return null;
    }

    return {

        title: title,

        description: description,

        type: type,

        endAt: new Date(dateValue).toISOString(),

        maxChoices: maxChoices,

        choices: normalizedChoices.map((choice, index) => ({

            position: index + 1,

            label: choice.label,

            weight: type === 'weighted'
                ? Number(choice.weight)
                : null
        }))
    };
}

// ============================================================
// 11. GENERATION DE L'IDENTIFIANT DE SESSION
// ============================================================

function generateSessionId() {

    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let result = '';

    const bytes = new Uint8Array(8);

    if (window.crypto && crypto.getRandomValues) {

        crypto.getRandomValues(bytes);

        for (let i = 0; i < bytes.length; i++) {

            result += characters[
                bytes[i] % characters.length
            ];
        }

    } else {

        for (let i = 0; i < 8; i++) {

            result += characters[
                Math.floor(Math.random() * characters.length)
            ];
        }
    }

    return result;
}

// ============================================================
// 12. SOUMISSION DU FORMULAIRE
// ============================================================

form.addEventListener('submit', (event) => {

    event.preventDefault();

    const electionData = validateForm();

    if (!electionData) {

        $('form-message').textContent =
            'Veuillez corriger les erreurs du formulaire.';

        return;
    }

    // Sauvegarder les informations du scrutin
    sessionStorage.setItem(
        'myvote:election-draft',
        JSON.stringify(electionData)
    );

    // Générer un identifiant de session
    const sessionId = generateSessionId();

    sessionStorage.setItem(
        'myvote:session-id',
        sessionId
    );

    // Confirmation
    $('form-message').textContent =
        'Scrutin validé. Préparation de la salle d’attente...';

    $('form-message').classList.add('success');

    // Redirection
    window.location.href =
        `waiting-room.html?role=host&session=${sessionId}`;
});

// ============================================================
// 13. INITIALISATION DE LA PAGE
// ============================================================

// Afficher une liste vide au démarrage
renderChoices();

console.log(
    'MyVote : formulaire de création initialisé.'
);