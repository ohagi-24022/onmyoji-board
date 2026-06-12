import { startBattle } from "./battle.js";
import { initDeckScreen } from "./deck.js";
import { DIFFICULTY_CONFIG } from "./data.js";
import { game, setDifficulty } from "./state.js";
import { bindHelpDialog, renderRulesExtras, showScreen } from "./ui.js";

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    const screenId = button.dataset.screen;
    showScreen(screenId);
    if (screenId === "screen-deck") initDeckScreen();
    if (screenId === "screen-rules") renderRulesExtras();
  });
});

document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!setDifficulty(button.dataset.difficulty)) return;
    document.querySelectorAll("[data-difficulty]").forEach((card) => {
      card.classList.toggle("selected", card.dataset.difficulty === game.difficulty);
    });
    document.getElementById("difficulty-indicator").innerText = `難易度: ${DIFFICULTY_CONFIG[game.difficulty].label}`;
    showScreen("screen-deck");
    initDeckScreen();
  });
});

document.getElementById("btn-start-battle").addEventListener("click", startBattle);
bindHelpDialog();
showScreen("screen-title");
