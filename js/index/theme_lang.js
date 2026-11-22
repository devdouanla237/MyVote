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

function applyLang(lang) {
  const t = I18N[lang];
  if (!t) return;
  currentLang = lang;
  root.lang = lang;

  const badge = document.querySelector(".badge");
  badge.lastChild.textContent = " " + t.badge;
  document.querySelector(".hero__title").textContent = t.title;
  document.querySelector(".hero__text").textContent = t.text;

  [["org", "org"], ["voter", "voter"]].forEach(([cls, key]) => {
    const card = document.querySelector(".card--" + cls);
    card.querySelector(".card__tag").textContent = t[key + "Tag"];
    card.querySelector(".card__title").textContent = t[key + "Title"];
    card.querySelector(".card__text").textContent = t[key + "Text"];
    card.querySelectorAll(".card__list li").forEach((li, i) => (li.textContent = t[key + "List"][i]));
    card.querySelector(".btn").firstChild.textContent = t[key + "Btn"] + " ";
  });

  document.querySelectorAll(".guarantee").forEach((el, i) => {
    el.querySelector("h3").textContent = t.g[i][0];
    el.querySelector("p").textContent = t.g[i][1];
  });
  document.querySelector(".footer").textContent = t.footer;

  document.querySelectorAll("[data-lang]").forEach(btn => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  safeSet(LANG_KEY, lang);
  updateNetwork();
}

document.querySelectorAll("[data-lang]").forEach(btn =>
  btn.addEventListener("click", () => applyLang(btn.dataset.lang))
);

/* ---------------- Indicateur réseau ----------------
   Sur l'accueil, aucun pair n'est connecté : on reflète seulement l'état
   de la connexion Internet. Les pages suivantes passeront data-state à
   "degraded" (pairs partis) ou "offline" et afficheront le vrai nombre de pairs. */
const net = document.getElementById("net");
const netLabel = document.getElementById("netLabel");

function updateNetwork() {
  const online = navigator.onLine;
  net.dataset.state = online ? "online" : "offline";
  const labels = I18N[currentLang].net;
  netLabel.textContent = online ? labels.online : labels.offline;
}
window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);

applyLang(safeGet(LANG_KEY) === "en" ? "en" : "fr");