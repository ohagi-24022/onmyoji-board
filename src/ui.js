import { BOARD_SIZE, GAME_CONFIG, OUGI_EFFECTS, SHIKIGAMI_MASTER } from "./data.js";
import { getBlockerAt, getEffectiveStats, getEnemyActionPredictions } from "./rules.js";
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
  turnIndicator: document.getElementById("turn-indicator"),
  planList: document.getElementById("plan-list"),
  resultOverlay: document.getElementById("result-overlay"),
  resultTitle: document.getElementById("result-title"),
  resultDesc: document.getElementById("result-desc"),
  shikigamiCatalog: document.getElementById("shikigami-catalog"),
  helpOverlay: document.getElementById("battle-help-overlay"),
  btnHelp: document.getElementById("btn-help"),
  btnHelpClose: document.getElementById("btn-help-close")
};

export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  document.getElementById("app-container").dataset.screen = screenId;
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
      <div class="deck-card-head">
        <div class="attr-badge attr-${shikigami.element}">${shikigami.element}</div>
        <div>
          <div class="dc-name">${shikigami.name}</div>
          <div class="dc-type ${shikigami.isTensho ? "tensho" : ""}">${shikigami.isTensho ? "十二天将" : "通常式神"}</div>
        </div>
        <div class="dc-cost">呪${shikigami.cost}</div>
      </div>
      <div class="dc-stats">
        <span>HP${shikigami.hp}</span>
        <span>攻${shikigami.atk}</span>
        <span>射${shikigami.reach}</span>
        <span>機${shikigami.move}</span>
      </div>
      <div class="dc-desc">${shikigami.desc}</div>
      <div class="dc-bonus">憑依:${shikigami.possessionBonus?.label ?? "ボーナスなし"}</div>
      ${shikigami.ougi ? `<div class="dc-ougi">奥義:${shikigami.ougi} / ${OUGI_EFFECTS[shikigami.ougi] ?? ""}</div>` : ""}
    `;
    card.onclick = () => onSelectCard(card, shikigami.id);
    el.deckList.appendChild(card);
  });

  updateDeckStatus();
}

export function updateDeckStatus() {
  const count = game.playerDeckIds.length;
  const normalCount = game.playerDeckIds.filter((id) => !SHIKIGAMI_MASTER.find((m) => m.id === id).isTensho).length;
  const tenshoCount = game.playerDeckIds.filter((id) => SHIKIGAMI_MASTER.find((m) => m.id === id).isTensho).length;
  el.deckStatus.innerText = `選択中: 通常${normalCount} / 3・十二天将${tenshoCount} / 1`;
  el.btnStartBattle.disabled = normalCount !== 3 || tenshoCount !== 1;

  const hasTensho = game.playerDeckIds.some((id) => SHIKIGAMI_MASTER.find((m) => m.id === id).isTensho);
  document.querySelectorAll(".deck-card").forEach((card) => {
    const shikigami = SHIKIGAMI_MASTER.find((m) => m.id === card.dataset.id);
    const normalFull = normalCount >= 3;
    card.classList.toggle("disabled", (shikigami.isTensho && hasTensho && !card.classList.contains("selected")) || (!shikigami.isTensho && normalFull && !card.classList.contains("selected")));
  });
}

export function renderRulesExtras() {
  if (!el.shikigamiCatalog || el.shikigamiCatalog.dataset.rendered === "true") return;
  el.shikigamiCatalog.innerHTML = SHIKIGAMI_MASTER
    .map((shikigami) => {
      const ougi = shikigami.ougi ? `奥義:${shikigami.ougi}` : "奥義:-";
      const ability = shikigami.possessionBonus?.label ?? "ボーナスなし";
      const ougiEffect = shikigami.ougi ? OUGI_EFFECTS[shikigami.ougi] : "";
      return `
        <article class="catalog-card ${shikigami.isTensho ? "catalog-tensho" : ""}">
          <div class="catalog-card-head">
            <span class="attr-badge attr-${shikigami.element}">${shikigami.element}</span>
            <strong>${escapeHtml(shikigami.name)}</strong>
            <span>${shikigami.isTensho ? "十二天将" : "通常"}</span>
          </div>
          <div class="catalog-stats">
            <span>呪力${shikigami.cost}</span>
            <span>HP${shikigami.hp}</span>
            <span>攻${shikigami.atk}</span>
            <span>射${shikigami.reach}</span>
            <span>機${shikigami.move}</span>
          </div>
          <p>${escapeHtml(shikigami.desc)}</p>
          <small>憑依:${escapeHtml(ability)}</small>
          <small>${escapeHtml(ougi)}${ougiEffect ? ` / ${escapeHtml(ougiEffect)}` : ""}</small>
        </article>
      `;
    })
    .join("");
  el.shikigamiCatalog.dataset.rendered = "true";
}

export function bindHelpDialog() {
  if (!el.helpOverlay || !el.btnHelp || el.helpOverlay.dataset.bound === "true") return;
  const close = () => {
    el.helpOverlay.classList.remove("active");
    el.helpOverlay.setAttribute("aria-hidden", "true");
  };
  el.btnHelp.addEventListener("click", () => {
    el.helpOverlay.classList.add("active");
    el.helpOverlay.setAttribute("aria-hidden", "false");
  });
  el.btnHelpClose?.addEventListener("click", close);
  el.helpOverlay.addEventListener("click", (event) => {
    if (event.target === el.helpOverlay) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.helpOverlay.classList.contains("active")) close();
  });
  el.helpOverlay.dataset.bound = "true";
}

export function renderBattle() {
  const cells = document.querySelectorAll(".cell");
  el.board.classList.toggle("resolving", game.isResolving);
  cells.forEach((cell) => {
    cell.innerHTML = "";
    cell.className = "cell";
  });

  const currentReservedMP = game.plannedSummons
    .filter((summon) => summon.owner === "player")
    .reduce((sum, s) => sum + s.cost, 0);
  document.getElementById("val-mp-player").innerText = game.mp.player - currentReservedMP;
  document.getElementById("val-mp-enemy").innerText = game.mp.enemy;
  el.turnIndicator.innerText = `第${game.turn}ターン`;
  updateSummonCommandState();
  updateAttackCommandState();

  updateUnitInfo();
  updatePlanListV2();
  if (!game.isResolving) {
    addEnemyPredictions(cells);
    addActionHints(cells);
  }

  game.plannedSummons.forEach((summon) => {
    if (summon.owner !== "player") return;
    cells[summon.y * BOARD_SIZE + summon.x].classList.add("summon-target");
  });

  addPlayerPlanMarkers(cells);
  addTerrainMarkers(cells);

  game.units.forEach((unit) => {
    const cell = cells[unit.y * BOARD_SIZE + unit.x];
    const div = document.createElement("div");
    let classes = `shikigami ${unit.owner}`;
    if (unit.id === game.activeUnitId) classes += " selected";
    if (unit.isLeader) classes += " leader";
    if (unit.buffAtk > 0) classes += " buffed";
    if (game.planned[unit.id]?.possess) classes += " possessing";
    div.className = classes;

    const dispAtk = getEffectiveStats(unit).effAtk;
    const hpText = unit.maxHp ? `${unit.hp}/${unit.maxHp}` : unit.hp;
    div.innerHTML = `
      <div class="attr-badge attr-${unit.element}">${unit.element}</div>
      <div class="u-name">${unit.name}</div>
      <div class="u-stats">攻${dispAtk} HP${hpText}</div>
    `;
    if (unit.status?.poison > 0 || unit.status?.bind > 0 || unit.status?.burn > 0) {
      div.innerHTML += `<div class="status-row">${unit.status?.poison > 0 ? "毒" : ""}${unit.status?.bind > 0 ? "縛" : ""}${unit.status?.burn > 0 ? "炎" : ""}</div>`;
    }
    cell.appendChild(div);

    if (game.planned[unit.id]?.move) cells[game.planned[unit.id].move.y * BOARD_SIZE + game.planned[unit.id].move.x].classList.add("move-target");
    if (game.planned[unit.id]?.attack) cells[game.planned[unit.id].attack.y * BOARD_SIZE + game.planned[unit.id].attack.x].classList.add("attack-target");
  });
}

function updateSummonCommandState() {
  const button = document.getElementById("btn-summon");
  const plannedCount = game.plannedSummons.filter((summon) => {
    if (summon.owner !== "player") return false;
    return SHIKIGAMI_MASTER.find((template) => template.id === summon.templateId)?.summonCategory !== "quick";
  }).length;
  const isFull = plannedCount >= GAME_CONFIG.SUMMON.max_per_turn;
  const boardCount = game.units.filter((unit) =>
    unit.owner === "player" &&
    !unit.isLeader &&
    unit.templateId !== "z_raiju" &&
    unit.hp > 0 &&
    !game.planned[unit.id]?.possess
  ).length + plannedCount;
  const isBoardFull = boardCount >= GAME_CONFIG.SUMMON.max_on_board;
  button.disabled = false;
  button.classList.remove("locked");
  button.title = isFull
    ? `通常召喚は1ターン最大${GAME_CONFIG.SUMMON.max_per_turn}体です（雷獣は含みません）`
    : isBoardFull
      ? `盤面上の味方式神は最大${GAME_CONFIG.SUMMON.max_on_board}体です（雷獣は含みません）`
      : "";
}

function updateAttackCommandState() {
  const button = document.getElementById("btn-attack");
  const activeUnit = game.units.find((unit) => unit.id === game.activeUnitId);
  const isLocked = Boolean(activeUnit?.attackLocked);
  button.disabled = isLocked;
  button.classList.toggle("locked", isLocked);
  button.title = isLocked ? "静と動の構えにより、このターンは術を使用できません" : "";
}

function addTerrainMarkers(cells) {
  game.terrain.forEach((tile) => {
    const cell = cells[tile.y * BOARD_SIZE + tile.x];
    cell.classList.add(`terrain-${tile.type}`);
    const marker = document.createElement("div");
    marker.className = `terrain-label terrain-label-${terrainLayer(tile)}`;
    marker.innerText = tile.label;
    cell.appendChild(marker);
  });
}

function terrainLayer(tile) {
  if (tile.layer) return tile.layer;
  return tile.type === "blocked" ? "blocker" : "area";
}

function updatePlanList() {
  const rows = [];

  game.units
    .filter((unit) => unit.owner === "player")
    .forEach((unit) => {
      const plan = game.planned[unit.id];
      if (!plan) return;
      const actions = [];
      if (plan.move) actions.push(`移動(${plan.move.x + 1},${plan.move.y + 1})`);
      if (plan.attack) actions.push(`術(${plan.attack.x + 1},${plan.attack.y + 1})`);
      if (plan.possess) actions.push("憑依");
      if (plan.ougi) actions.push(`奥義:${plan.ougi.name}(${plan.ougi.x + 1},${plan.ougi.y + 1})`);
      if (actions.length > 0) rows.push({ name: unit.name, actions });
    });

  game.plannedSummons
    .filter((summon) => summon.owner === "player")
    .forEach((summon) => {
      const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
      rows.push({ name: template?.name ?? "式神", actions: [`召喚(${summon.x + 1},${summon.y + 1})`] });
    });

  if (rows.length === 0) {
    el.planList.innerHTML = '<div class="plan-empty">予約なし</div>';
    return;
  }

  el.planList.innerHTML = rows
    .map((row) => `
      <div class="plan-row">
        <span class="plan-unit">${row.name}</span>
        <span class="plan-actions">${row.actions.join(" / ")}</span>
      </div>
    `)
    .join("");
}

function updatePlanListV2() {
  const rows = [];

  game.units
    .filter((unit) => unit.owner === "player")
    .forEach((unit) => {
      const plan = game.planned[unit.id];
      if (!plan) return;
      if (plan.move) rows.push({ unit: unit.name, label: `移動(${plan.move.x + 1},${plan.move.y + 1})`, action: "move", unitId: unit.id });
      if (plan.attack) rows.push({ unit: unit.name, label: `術(${plan.attack.x + 1},${plan.attack.y + 1})`, action: "attack", unitId: unit.id });
      if (plan.possess) rows.push({ unit: unit.name, label: "憑依", action: "possess", unitId: unit.id });
      if (plan.ougi) rows.push({ unit: unit.name, label: `奥義(${plan.ougi.x + 1},${plan.ougi.y + 1})`, action: "ougi", unitId: unit.id });
    });

  game.plannedSummons.forEach((summon, index) => {
    if (summon.owner !== "player") return;
    const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
    rows.push({ unit: template?.name ?? "式神", label: `召喚(${summon.x + 1},${summon.y + 1})`, action: "summon", index });
  });

  if (rows.length === 0) {
    el.planList.innerHTML = '<div class="plan-empty">予約なし</div>';
    return;
  }

  el.planList.innerHTML = rows
    .map((row) => `
      <div class="plan-row">
        <span class="plan-unit">${escapeHtml(row.unit)}</span>
        <span class="plan-actions">${escapeHtml(row.label)}</span>
        <button class="plan-cancel" data-action="${row.action}" data-unit-id="${row.unitId ?? ""}" data-index="${row.index ?? ""}" title="この予約を取り消す">×</button>
      </div>
    `)
    .join("");

  el.planList.querySelectorAll(".plan-cancel").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = button.dataset.index === "" ? undefined : Number(button.dataset.index);
      window.dispatchEvent(new CustomEvent("cancel-plan-action", {
        detail: { action: button.dataset.action, unitId: button.dataset.unitId, index }
      }));
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
      if (plan.ougi) {
        addPlanMarker(cells[plan.ougi.y * BOARD_SIZE + plan.ougi.x], "ougi", `奥:${unit.name}`);
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
    if (prediction.type === "move_attack") {
      addEnemyPredictionMarker(cells, prediction.move, "move", prediction.accuracy, "敵移動");
      addEnemyPredictionMarker(cells, prediction.attack, "attack", prediction.accuracy, "敵術");
      return;
    }
    const target = prediction.move || prediction.attack || prediction.summon || (prediction.type === "unknown" ? { x: prediction.x, y: prediction.y } : null);
    if (!target) return;

    const label = {
      attack: "敵術",
      move: "敵移動",
      summon: "敵召喚",
      unknown: "敵?"
    }[prediction.type];
    addEnemyPredictionMarker(cells, target, prediction.type, prediction.accuracy, label);
  });
}

function addEnemyPredictionMarker(cells, target, type, accuracy, label) {
  if (!target) return;
  const cell = cells[target.y * BOARD_SIZE + target.x];
  cell.classList.add({
    attack: "enemy-attack-prediction",
    move: "enemy-move-prediction",
    summon: "enemy-summon-prediction",
    unknown: "enemy-unknown-prediction"
  }[type]);
  const marker = document.createElement("div");
  marker.className = "enemy-prediction-label";
  marker.innerText = label;
  marker.title = `予測精度 ${Math.round((accuracy ?? 0) * 100)}%`;
  cell.appendChild(marker);
}

function addActionHints(cells) {
  if (game.uiState === "SELECTING_MOVE") {
    const unit = game.units.find((u) => u.id === game.activeUnitId);
    if (!unit) return;
    const stats = getEffectiveStats(unit);
    if (stats.effMove <= 0 || unit.status?.bind > 0) return;
    forEachBoardCell((x, y) => {
      if (unit.x === x && unit.y === y) return;
      const moveRange = stats.effMove;
      if (getBlockerAt(x, y)) return;
      if (Math.abs(unit.x - x) <= moveRange && Math.abs(unit.y - y) <= moveRange) {
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
      const inRange = Math.abs(origin.x - x) <= stats.effReach && Math.abs(origin.y - y) <= stats.effReach;
      const validLine = !unit.piercing || origin.x === x || origin.y === y;
      if (inRange && validLine) {
        cells[y * BOARD_SIZE + x].classList.add("attack-option");
      }
    });
  }

  if (game.uiState === "SELECTING_OUGI_TARGET") {
    const leader = game.units.find((u) => u.id === game.activeUnitId && u.isLeader);
    if (!leader) return;
    forEachBoardCell((x, y) => {
      if (!isOugiTargetOption(leader, x, y)) return;
      cells[y * BOARD_SIZE + x].classList.add("ougi-option");
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
      if (getBlockerAt(x, y)) return;
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

function getOugiId(ougiName) {
  return SHIKIGAMI_MASTER.find((template) => template.ougi === ougiName)?.id ?? "";
}

function isOugiTargetOption(leader, x, y) {
  const id = getOugiId(leader.ougi);
  if (id === "s_seiryu") return (x === leader.x || y === leader.y) && !(x === leader.x && y === leader.y);
  if (id === "s_byakko") return !isProjectedOccupied(x, y) && !getBlockerAt(x, y);
  if (id === "s_tenko") return game.units.some((unit) => unit.x === x && unit.y === y && unit.owner !== leader.owner && !unit.isLeader);
  if (id === "s_taiin") return game.units.some((unit) => unit.x === x && unit.y === y && unit.owner !== leader.owner && !unit.isLeader && !unit.isTensho);
  if (id === "s_sujaku") return !getBlockerAt(x, y);
  return true;
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
    const moveText = activeUnit.status?.bind > 0 ? "拘束中" : `移動${stats.effMove}`;
    el.unitInfo.innerText = `移動先を選択: ${activeUnit.name} (${moveText})`;
    document.getElementById("btn-move").classList.add("active");
    return;
  }

  if (game.uiState === "SELECTING_ATTACK") {
    if (activeUnit.attackLocked) {
      el.unitInfo.innerText = "静と動の構え: このターンは術を使用できません";
      return;
    }
    el.unitInfo.innerText = `術の対象マスを選択: ${activeUnit.name} (射程${reachText})`;
    document.getElementById("btn-attack").classList.add("active");
    return;
  }

  if (game.uiState === "SELECTING_OUGI_TARGET") {
    el.unitInfo.innerText = `奥義の対象マスを選択: ${activeUnit.ougi}`;
    document.getElementById("btn-ougi").classList.add("active");
    return;
  }

  const ougiText = activeUnit.ougi ? ` / 奥義:${activeUnit.ougi}${activeUnit.ougiUsed ? "(使用済)" : ""}` : "";
  el.unitInfo.innerText = `選択中: ${activeUnit.name} (HP${activeUnit.hp} / 攻${atkText} / 射${reachText} / 移${stats.effMove} / 属:${activeUnit.element}${ougiText})`;
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
