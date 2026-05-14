import { BOARD_SIZE, SHIKIGAMI_MASTER } from "./data.js";
import { getEffectiveStats, getEnemyActionPredictions } from "./rules.js";
import { game } from "./state.js";

export const el = {
  log: document.getElementById("log"),
  board: document.getElementById("board"),
  deckList: document.getElementById("deck-list"),
  deckWarning: document.getElementById("deck-warning"),
  deckStatus: document.getElementById("deck-status"),
  btnStartBattle: document.getElementById("btn-start-battle"),
  summonPanel: document.getElementById("summon-panel"),
  unitInfo: document.getElementById("unit-info"),
  resultOverlay: document.getElementById("result-overlay"),
  resultTitle: document.getElementById("result-title"),
  resultDesc: document.getElementById("result-desc")
};

export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

export function addLog(msg, type = "") {
  const cssClass = type ? `log-${type}` : "";
  el.log.innerHTML += `<span class="${cssClass}">${msg}</span><br>`;
  el.log.scrollTop = el.log.scrollHeight;
}

export function createBoard(handleCellClick) {
  el.board.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.onclick = () => handleCellClick(x, y);
      el.board.appendChild(cell);
    }
  }
}

export function renderDeckScreen(onSelectCard) {
  game.playerDeckIds = [];
  el.deckWarning.innerText = "";
  el.deckList.innerHTML = "";

  SHIKIGAMI_MASTER.forEach((shikigami) => {
    const card = document.createElement("div");
    card.className = "deck-card";
    card.dataset.id = shikigami.id;
    card.innerHTML = `
      <div class="attr-badge attr-${shikigami.element}" style="position:static; margin: 0 auto 4px;">${shikigami.element}</div>
      <div class="dc-name">${shikigami.name}</div>
      <div class="dc-type ${shikigami.isTensho ? "tensho" : ""}">${shikigami.isTensho ? "【十二天将】" : "【通常式神】"}</div>
      <div class="dc-stats">攻${shikigami.atk} HP${shikigami.hp} 射${shikigami.reach}</div>
      <div class="dc-cost">呪力:${shikigami.cost}</div>
      <div style="font-size:9px; color:#888; margin-top:4px;">${shikigami.desc}</div>
    `;
    card.onclick = () => onSelectCard(card, shikigami.id);
    el.deckList.appendChild(card);
  });

  updateDeckStatus();
}

export function updateDeckStatus() {
  const count = game.playerDeckIds.length;
  el.deckStatus.innerText = `選択中: ${count} / 3`;
  el.btnStartBattle.disabled = count !== 3;

  const hasTensho = game.playerDeckIds.some((id) => SHIKIGAMI_MASTER.find((m) => m.id === id).isTensho);
  document.querySelectorAll(".deck-card").forEach((card) => {
    const shikigami = SHIKIGAMI_MASTER.find((m) => m.id === card.dataset.id);
    card.classList.toggle("disabled", shikigami.isTensho && hasTensho && !card.classList.contains("selected"));
  });
}

export function renderBattle() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    cell.innerHTML = "";
    cell.className = "cell";
  });

  const currentReservedMP = game.plannedSummons
    .filter((summon) => summon.owner === "player")
    .reduce((sum, s) => sum + s.cost, 0);
  document.getElementById("val-mp-player").innerText = game.mp.player - currentReservedMP;
  document.getElementById("val-mp-enemy").innerText = game.mp.enemy;

  updateUnitInfo();
  if (!game.isResolving) {
    addEnemyPredictions(cells);
    addActionHints(cells);
  }

  game.plannedSummons.forEach((summon) => {
    if (summon.owner !== "player") return;
    cells[summon.y * BOARD_SIZE + summon.x].classList.add("summon-target");
  });

  addPlayerPlanMarkers(cells);

  game.units.forEach((unit) => {
    const cell = cells[unit.y * BOARD_SIZE + unit.x];
    const div = document.createElement("div");
    let classes = `shikigami ${unit.owner}`;
    if (unit.id === game.activeUnitId) classes += " selected";
    if (unit.isLeader) classes += " leader";
    if (unit.buffAtk > 0) classes += " buffed";
    if (game.planned[unit.id]?.possess) classes += " possessing";
    div.className = classes;

    const dispAtk = unit.isLeader ? getEffectiveStats(unit).effAtk : unit.atk + unit.buffAtk;
    div.innerHTML = `
      <div class="attr-badge attr-${unit.element}">${unit.element}</div>
      <div class="u-name">${unit.name}</div>
      <div class="u-stats">攻${dispAtk} HP${unit.hp}</div>
    `;
    cell.appendChild(div);

    if (game.planned[unit.id]?.move) cells[game.planned[unit.id].move.y * BOARD_SIZE + game.planned[unit.id].move.x].classList.add("move-target");
    if (game.planned[unit.id]?.attack) cells[game.planned[unit.id].attack.y * BOARD_SIZE + game.planned[unit.id].attack.x].classList.add("attack-target");
  });
}

function addPlayerPlanMarkers(cells) {
  game.units
    .filter((unit) => unit.owner === "player")
    .forEach((unit) => {
      const plan = game.planned[unit.id];
      if (!plan) return;
      if (plan.move) {
        addPlanMarker(cells[plan.move.y * BOARD_SIZE + plan.move.x], "move", `移:${unit.name}`);
      }
      if (plan.attack) {
        addPlanMarker(cells[plan.attack.y * BOARD_SIZE + plan.attack.x], "attack", `術:${unit.name}`);
      }
      if (plan.possess) {
        addPlanMarker(cells[unit.y * BOARD_SIZE + unit.x], "possess", `憑:${unit.name}`);
      }
    });

  game.plannedSummons
    .filter((summon) => summon.owner === "player")
    .forEach((summon) => {
      const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
      addPlanMarker(cells[summon.y * BOARD_SIZE + summon.x], "summon", `召:${template?.name ?? "式神"}`);
    });
}

function addPlanMarker(cell, type, text) {
  const marker = document.createElement("div");
  marker.className = `planned-label planned-${type}-label`;
  marker.innerText = text;
  cell.appendChild(marker);
}

function addEnemyPredictions(cells) {
  getEnemyActionPredictions().forEach((prediction) => {
    const target = prediction.move || prediction.attack || prediction.summon || (prediction.type === "unknown" ? { x: prediction.x, y: prediction.y } : null);
    if (!target) return;

    const cell = cells[target.y * BOARD_SIZE + target.x];
    const className = {
      attack: "enemy-attack-prediction",
      move: "enemy-move-prediction",
      summon: "enemy-summon-prediction",
      unknown: "enemy-unknown-prediction"
    }[prediction.type];
    cell.classList.add(className);

    const marker = document.createElement("div");
    marker.className = "enemy-prediction-label";
    marker.innerText = {
      attack: "敵術",
      move: "敵移動",
      summon: "敵召喚",
      unknown: "敵?"
    }[prediction.type];
    marker.title = `予測精度 ${Math.round((prediction.accuracy ?? 0) * 100)}%`;
    cell.appendChild(marker);
  });
}

function addActionHints(cells) {
  if (game.uiState === "SELECTING_MOVE") {
    const unit = game.units.find((u) => u.id === game.activeUnitId);
    if (!unit) return;
    forEachBoardCell((x, y) => {
      if (Math.abs(unit.x - x) <= 1 && Math.abs(unit.y - y) <= 1) {
        cells[y * BOARD_SIZE + x].classList.add("move-option");
      }
    });
  }

  if (game.uiState === "SELECTING_ATTACK") {
    const unit = game.units.find((u) => u.id === game.activeUnitId);
    if (!unit) return;
    const origin = game.planned[unit.id]?.move || { x: unit.x, y: unit.y };
    const stats = getEffectiveStats(unit);
    forEachBoardCell((x, y) => {
      if (x === origin.x && y === origin.y) return;
      if (Math.abs(origin.x - x) <= stats.effReach && Math.abs(origin.y - y) <= stats.effReach) {
        cells[y * BOARD_SIZE + x].classList.add("attack-option");
      }
    });
  }

  if (game.uiState === "SELECTING_SUMMON_TARGET") {
    const leader = game.units.find((u) => u.isLeader && u.owner === "player");
    if (!leader) return;
    const origin = game.planned[leader.id]?.move || { x: leader.x, y: leader.y };
    forEachBoardCell((x, y) => {
      if (Math.abs(origin.x - x) > 1 || Math.abs(origin.y - y) > 1) return;
      if (isProjectedOccupied(x, y)) return;
      if (game.plannedSummons.some((summon) => summon.x === x && summon.y === y)) return;
      cells[y * BOARD_SIZE + x].classList.add("summon-option");
    });
  }
}

function forEachBoardCell(callback) {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) callback(x, y);
  }
}

function isProjectedOccupied(x, y) {
  return game.units.some((unit) => {
    const px = game.planned[unit.id]?.move ? game.planned[unit.id].move.x : unit.x;
    const py = game.planned[unit.id]?.move ? game.planned[unit.id].move.y : unit.y;
    return px === x && py === y && !game.planned[unit.id]?.possess;
  });
}

function updateUnitInfo() {
  if (game.isResolving) {
    el.unitInfo.innerText = game.resolutionPhase || "解決中...";
    return;
  }

  const activeUnit = game.units.find((u) => u.id === game.activeUnitId);
  document.querySelectorAll(".mode-btn").forEach((button) => button.classList.remove("active"));

  if (game.uiState === "SELECTING_SUMMON_TARGET") {
    document.getElementById("btn-summon").classList.add("active");
    return;
  }

  if (!activeUnit) {
    el.unitInfo.innerText = "采配を下す式神を選べ";
    return;
  }

  const stats = getEffectiveStats(activeUnit);
  const atkText = stats.effAtk > activeUnit.atk ? `${stats.effAtk}(予測)` : stats.effAtk;
  const reachText = stats.effReach > activeUnit.reach ? `${stats.effReach}(予測)` : stats.effReach;

  if (game.uiState === "SELECTING_MOVE") {
    el.unitInfo.innerText = `移動先を選択: ${activeUnit.name} (周囲1マス)`;
    document.getElementById("btn-move").classList.add("active");
    return;
  }

  if (game.uiState === "SELECTING_ATTACK") {
    el.unitInfo.innerText = `術の対象マスを選択: ${activeUnit.name} (射程${reachText})`;
    document.getElementById("btn-attack").classList.add("active");
    return;
  }

  el.unitInfo.innerText = `選択中: ${activeUnit.name} (攻${atkText} / 射${reachText} / 属:${activeUnit.element})`;
}

export function showResult(result) {
  if (!result.playerLeaderDead && !result.enemyLeaderDead) return;

  let title = "";
  let desc = "";
  let color = "";
  if (result.playerLeaderDead && result.enemyLeaderDead) {
    title = "引き分け";
    desc = "両陣営の陰陽師が同時に倒れました。";
    color = "#666";
  } else if (result.playerLeaderDead) {
    title = "敗北";
    desc = "味方の陰陽師が討ち取られました...";
    color = "#d32f2f";
  } else {
    title = "勝利";
    desc = "見事、ケガレを祓いました！";
    color = "#2e7d32";
  }

  el.resultTitle.innerText = title;
  el.resultTitle.style.color = color;
  el.resultDesc.innerText = desc;
  el.resultOverlay.style.display = "flex";
}
