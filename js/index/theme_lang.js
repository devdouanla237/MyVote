// P2P-VoteEngine · Page Accueil
// Thème (sombre par défaut), langue (FR/EN) et indicateur réseau.
import { I18N } from "../../utils/I8n.js";
const root = document.documentElement;
const THEME_KEY = "p2pve.theme";
const LANG_KEY = "p2pve.lang";

/* ---------------- Thème ---------------- */
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  document.querySelectorAll("[data-theme-set]").forEach(btn => {
    const active = btn.dataset.themeSet === theme;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  safeSet(THEME_KEY, theme);
}

// Sombre par défaut ; on respecte le choix mémorisé s'il existe
applyTheme(safeGet(THEME_KEY) === "light" ? "light" : "dark");

document.querySelectorAll("[data-theme-set]").forEach(btn =>
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeSet))
);
document.getElementById("themeSingle").addEventListener("click", () =>
  applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark")
);

/* ---------------- Langue ---------------- */


let currentLang = "fr";


export function getTranslation(object, path) {

    return path.split(".").reduce(
        (current, key) => current?.[key],
        object,
        
    )

}

function applyLang(lang) {

    const translations = I18N[lang];

    if (!translations) {
        console.warn(`Langue non disponible1 : ${lang}`);
        return;
    }

    currentLang = lang;
    root.lang = lang;

    // Traduire tous les éléments
    document.querySelectorAll("[data-i18n]").forEach(element => {
        
        const key =getPageName()+"."+element.dataset.i18n;
        const translation = getTranslation(translations, key);
console.log(getTranslation(I18N.fr, "admin.actions.next"))
        if (translation === undefined) {
            console.warn(`Traduction manquante : ${key}`);
            return;
        }

        element.textContent = translation;

    });


    // Traduire les attributs HTML
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
const valeur = element.getAttribute("data-i18n-placeholder");
        const key1 =getPageName()+"."+valeur

        const translation = getTranslation(translations, key1);
        console.log(translation+"ddsd")
console.log(key1+"ugguih")
        if (translation === undefined) {
            console.warn(`Traduction manquante1 : ${key1}`);
            return;
        }

element.placeholder = translation;
    });
  
    ;

    // Actualiser les boutons de langue
    document.querySelectorAll("[data-lang]").forEach(button => {

        const active = button.dataset.lang === lang;

        button.classList.toggle("is-active", active);

        button.setAttribute("aria-pressed", String(active));

    });

    safeSet(LANG_KEY, lang);

   //< updateNetwork();
}




const langButtons = document.querySelectorAll(".lang__btn");

langButtons.forEach(button => {

    button.addEventListener("click", () => {

        // Récupérer la langue sélectionnée
        const lang = button.dataset.lang;

        // Mettre à jour l'apparence des boutons
        langButtons.forEach(btn => {
            const isActive = btn === button;

            btn.classList.toggle("is-active", isActive);
            btn.setAttribute("aria-pressed", isActive);
        });

 applyLang(lang)
        // Changer la langue de l'application
        console.log("Langue sélectionnée :", lang);

    });

});

/* ---------------- Indicateur réseau ----------------
   Sur l'accueil, aucun pair n'est connecté : on reflète seulement l'état
   de la connexion Internet. Les pages suivantes passeront data-state à
   "degraded" (pairs partis) ou "offline" et afficheront le vrai nombre de pairs. */
const net = document.getElementById("net");
const netLabel = document.getElementById("netLabel");

// function updateNetwork() {
//   const online = navigator.onLine;
//   net.dataset.state = online ? "online" : "offline";
//   const labels = I18N[currentLang].net;
//   netLabel.textContent = online ? labels.online : labels.offline;
// }
// window.addEventListener("online", updateNetwork);
// window.addEventListener("offline", updateNetwork);

applyLang(safeGet(LANG_KEY) === "en" ? "en" : "fr");

// recupere le nom de la page 
function getPageName() {
    return window.location.pathname
        .split("/")
        .pop()
        .replace(".html", "");
}

