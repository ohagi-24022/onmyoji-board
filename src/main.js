import { startBattle } from "./battle.js";
import { initDeckScreen } from "./deck.js";
import { bindHelpDialog, renderRulesExtras, showScreen } from "./ui.js";

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    const screenId = button.dataset.screen;
    showScreen(screenId);
    if (screenId === "screen-deck") initDeckScreen();
    if (screenId === "screen-rules") renderRulesExtras();
  });
});

document.getElementById("btn-start-battle").addEventListener("click", startBattle);
bindHelpDialog();
showScreen("screen-title");
