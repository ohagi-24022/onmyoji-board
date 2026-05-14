import { startBattle } from "./battle.js";
import { initDeckScreen } from "./deck.js";
import { showScreen } from "./ui.js";

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    const screenId = button.dataset.screen;
    showScreen(screenId);
    if (screenId === "screen-deck") initDeckScreen();
  });
});

document.getElementById("btn-start-battle").addEventListener("click", startBattle);
showScreen("screen-title");
