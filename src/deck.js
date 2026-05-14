import { SHIKIGAMI_MASTER } from "./data.js";
import { game } from "./state.js";
import { el, renderDeckScreen, updateDeckStatus } from "./ui.js";

export function initDeckScreen() {
  renderDeckScreen(toggleDeckSelection);
}

function toggleDeckSelection(cardEl, id) {
  el.deckWarning.innerText = "";
  const index = game.playerDeckIds.indexOf(id);
  const target = SHIKIGAMI_MASTER.find((s) => s.id === id);

  if (index > -1) {
    game.playerDeckIds.splice(index, 1);
    cardEl.classList.remove("selected");
    updateDeckStatus();
    return;
  }

  if (game.playerDeckIds.length >= 3) {
    el.deckWarning.innerText = "※デッキは最大3体までです。";
    return;
  }

  if (target.isTensho) {
    const currentTenshoCount = game.playerDeckIds.filter((deckId) => SHIKIGAMI_MASTER.find((m) => m.id === deckId).isTensho).length;
    if (currentTenshoCount >= 1) {
      el.deckWarning.innerText = "※十二天将はデッキに1体までしか編成できません！";
      return;
    }
  }

  game.playerDeckIds.push(id);
  cardEl.classList.add("selected");
  updateDeckStatus();
}
