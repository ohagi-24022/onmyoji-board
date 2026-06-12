import { startBattle } from "./battle.js";
import { initDeckScreen } from "./deck.js";
import { DIFFICULTY_CONFIG } from "./data.js";
import { game, setDifficulty } from "./state.js";
import { bindHelpDialog, renderRulesExtras, showScreen } from "./ui.js";

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    const screenId = button.dataset.screen;
    showScreen(screenId);
    if (screenId === "screen-difficulty") renderDifficultySelection();
    if (screenId === "screen-deck") initDeckScreen();
    if (screenId === "screen-rules") renderRulesExtras();
  });
});

document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!setDifficulty(button.dataset.difficulty)) return;
    renderDifficultySelection();
  });
});

document.getElementById("btn-confirm-difficulty").addEventListener("click", () => {
  document.getElementById("difficulty-indicator").innerText = `難易度: ${DIFFICULTY_CONFIG[game.difficulty].label}`;
  showScreen("screen-deck");
  initDeckScreen();
});

function renderDifficultySelection() {
  const difficulty = DIFFICULTY_CONFIG[game.difficulty] ?? DIFFICULTY_CONFIG.normal;
  document.querySelectorAll("[data-difficulty]").forEach((card) => {
    const isSelected = card.dataset.difficulty === game.difficulty;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
    const check = card.querySelector(".difficulty-check");
    if (check) check.innerText = isSelected ? "選択中" : "この難易度を選ぶ";
  });
  document.getElementById("selected-difficulty-name").innerText = difficulty.label;
  document.getElementById("selected-difficulty-description").innerText = difficulty.description;
}

document.getElementById("btn-start-battle").addEventListener("click", startBattle);
bindHelpDialog();
renderDifficultySelection();
showScreen("screen-title");
