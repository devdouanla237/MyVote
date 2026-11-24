import { network } from './NetworkManager/host.js';
import { joinSession, JOIN_ERRORS } from './NetworkManager/join.js';

const $ = id => document.getElementById(id);

const form = $('join-form');
const session = $('session-id');
const token = $('token');
const button = $('join-button');
const spinner = button.querySelector('.spinner');
const label = button.querySelector('.button-label');

function message(text, kind = 'info') {
  const box = $('join-message');
  box.textContent = text;
  box.dataset.kind = kind;
}

function busy(value) {
  button.disabled = value;
  spinner.hidden = !value;
  label.textContent = value ? 'Connexion…' : 'Rejoindre';
}

session.addEventListener('input', () => {
  const start = session.selectionStart;
  session.value = session.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  session.setSelectionRange(Math.min(start, 8), Math.min(start, 8));
  $('session-error').textContent = '';
});

$('toggle-token').addEventListener('click', () => {
  const visible = token.type === 'text';
  token.type = visible ? 'password' : 'text';
  $('toggle-token').textContent = visible ? 'Afficher' : 'Masquer';
  $('toggle-token').setAttribute('aria-pressed', String(!visible));
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  $('session-error').textContent = '';
  $('token-error').textContent = '';
  message('');

  const id = session.value.trim();
  const accessToken = token.value.trim();
  let valid = true;

  if (!/^[A-Z0-9]{8}$/.test(id)) {
    $('session-error').textContent =
      'Session ID invalide : 8 caractères alphanumériques sont requis.';
    valid = false;
  }

  if (!accessToken) {
    $('token-error').textContent = 'Le jeton est obligatoire.';
    valid = false;
  }

  if (!valid) return;

  busy(true);
  message('Connexion à l’organisateur…');

  try {
    await joinSession(id, network);
    sessionStorage.setItem('myvote:pending-session', id);
    message(
      'Connexion réseau à l’hôte établie. Le jeton a été saisi, mais sa validation (jeton invalide ou déjà utilisé) nécessite encore le protocole d’authentification côté hôte. Vous ne pouvez pas encore accéder au vote.',
      'success'
    );
  } catch (error) {
    const code = error?.code;
    let text = 'Une erreur inattendue est survenue.';

    if (code === JOIN_ERRORS.INVALID_SESSION_ID) {
      text = 'Session ID invalide.';
    } else if (code === JOIN_ERRORS.SESSION_NOT_FOUND) {
      text = 'Session introuvable. Vérifiez le code communiqué par l’organisateur.';
    } else if (code === JOIN_ERRORS.TIMEOUT) {
      text = 'L’organisateur ne répond pas après 10 secondes. Réessayez.';
    } else if (code === JOIN_ERRORS.NETWORK_ERROR) {
      text = 'Problème réseau. Vérifiez votre connexion puis réessayez.';
    } else if (code === 'INVALID_TOKEN') {
      text = 'Jeton invalide. Vérifiez le jeton communiqué par l’organisateur.';
    } else if (code === 'TOKEN_ALREADY_USED') {
      text = 'Ce jeton a déjà été utilisé.';
    }

    message(text, 'error');
  } finally {
    busy(false);
  }
});