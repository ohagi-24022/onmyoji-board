import { BOARD_SIZE, GAME_CONFIG, SHIKIGAMI_MASTER } from "./data.js";
import { getBlockerAt, getEffectiveStats, getUnitLogName, planEnemyActionsAI, resolveTurnPhased } from "./rules.js";
import { game, resetBattleState } from "./state.js";
import { addLog, createBoard, el, renderBattle, showResult, showScreen } from "./ui.js";

let planCancelListenerBound = false;

export function startBattle() {
  buildSummonPanel();
  bindBattleButtons();
  createBoard(handleCellClick);
  resetBattleState();
  el.resultOverlay.style.display = "none";
  el.log.innerHTML = "";
  addLog("システム: 結界が構築された。戦闘開始！", "sys");
  showScreen("screen-battle");
  renderBattle();
}

function buildSummonPanel() {
  el.summonPanel.innerHTML = "";
  game.playerDeckIds.forEach((id) => {
    const shikigami = SHIKIGAMI_MASTER.find((m) => m.id === id);
    const button = document.createElement("button");
    button.className = "summon-btn";
    button.innerText = `${shikigami.name} (呪${shikigami.cost})`;
    button.onclick = () => startSummon(shikigami.id);
    el.summonPanel.appendChild(button);
  });
}

function bindBattleButtons() {
  document.getElementById("btn-move").onclick = () => setMode("SELECTING_MOVE");
  document.getElementById("btn-attack").onclick = () => setMode("SELECTING_ATTACK");
  document.getElementById("btn-possess").onclick = startPossession;
  document.getElementById("btn-ougi").onclick = startOugi;
  document.getElementById("btn-summon").onclick = () => {
    if (game.summonCooldown.player > 0) {
      addLog("[警告] 召喚疲労中です。このターンは召喚できませぬ。", "sys");
      return;
    }
    game.uiState = "IDLE";
    el.summonPanel.style.display = "flex";
    renderBattle();
  };
  document.getElementById("btn-cancel").onclick = cancelActions;
  document.getElementById("execute-btn").onclick = executeTurn;
  if (!planCancelListenerBound) {
    window.addEventListener("cancel-plan-action", (event) => cancelPlannedAction(event.detail));
    planCancelListenerBound = true;
  }
}

function setMode(mode) {
  if (!game.activeUnitId) return;
  game.uiState = mode;
  el.summonPanel.style.display = "none";
  renderBattle();
}

function startPossession() {
  if (!game.activeUnitId) return;
  const unit = game.units.find((u) => u.id === game.activeUnitId);
  if (unit.isLeader) {
    addLog("[警告] 陰陽師自身は憑依できぬ。", "sys");
    return;
  }
  if (unit.owner !== "player") {
    addLog("[警告] 敵の式神は選べぬ。", "sys");
    return;
  }

  game.planned[game.activeUnitId] = { move: null, attack: null, possess: true };
  game.uiState = "IDLE";
  addLog(`【予約】${unit.name} を陰陽師に憑依させる。`, "possess");
  renderBattle();
}

function cancelActions() {
  if (game.activeUnitId && game.planned[game.activeUnitId]) {
    game.planned[game.activeUnitId] = { move: null, attack: null, possess: false };
  }
  game.plannedSummons = [];
  game.uiState = "IDLE";
  el.summonPanel.style.display = "none";
  renderBattle();
}

function cancelPlannedAction(detail) {
  if (game.isResolving) return;
  if (detail.action === "summon") {
    game.plannedSummons.splice(detail.index, 1);
    renderBattle();
    return;
  }

  const plan = game.planned[detail.unitId];
  if (!plan) return;
  if (detail.action === "move") plan.move = null;
  if (detail.action === "attack") plan.attack = null;
  if (detail.action === "possess") plan.possess = false;
  if (detail.action === "ougi") plan.ougi = null;
  if (!plan.move && !plan.attack && !plan.possess && !plan.ougi) delete game.planned[detail.unitId];
  renderBattle();
}

function getOugiId(ougiName) {
  return SHIKIGAMI_MASTER.find((template) => template.ougi === ougiName)?.id ?? "";
}

function isImmediateOugi(ougiName) {
  return ["s_genbu", "s_touda", "s_kijin"].includes(getOugiId(ougiName));
}

function isValidOugiTarget(leader, x, y) {
  const id = getOugiId(leader.ougi);
  if (id === "s_seiryu") return (x === leader.x || y === leader.y) && !(x === leader.x && y === leader.y);
  if (id === "s_byakko") return !game.units.some((unit) => unit.x === x && unit.y === y) && !getBlockerAt(x, y);
  if (id === "s_tenko") return game.units.some((unit) => unit.x === x && unit.y === y && unit.owner !== leader.owner && !unit.isLeader);
  if (id === "s_sujaku") return !getBlockerAt(x, y);
  return true;
}

function startSummon(templateId) {
  const template = SHIKIGAMI_MASTER.find((m) => m.id === templateId);
  const currentPlayerSummons = game.plannedSummons.filter((summon) => summon.owner === "player").length;
  if (game.summonCooldown.player > 0) {
    addLog("[警告] 召喚疲労中です。このターンは召喚できませぬ。", "sys");
    return;
  }
  if (currentPlayerSummons >= GAME_CONFIG.SUMMON.max_per_turn) {
    addLog(`[警告] 1ターンに予約できる召喚は最大${GAME_CONFIG.SUMMON.max_per_turn}体までです。`, "sys");
    return;
  }
  const currentReservedMP = game.plannedSummons
    .filter((summon) => summon.owner === "player")
    .reduce((sum, s) => sum + s.cost, 0);
  if (game.mp.player - currentReservedMP < template.cost) {
    addLog(`[警告] 呪力が足りませぬ。(必要: ${template.cost})`, "sys");
    return;
  }
  game.selectedSummonTemplate = templateId;
  game.uiState = "SELECTING_SUMMON_TARGET";
  el.unitInfo.innerText = `【召喚】${template.name} の配置マスを選択`;
  renderBattle();
}

function handleCellClick(x, y) {
  if (game.isResolving) return;
  const unit = game.units.find((u) => u.x === x && u.y === y);
  const currentState = game.uiState;

  if (currentState === "IDLE") handleIdleClick(unit);
  else if (currentState === "SELECTING_MOVE") {
    if (unit && unit.id === game.activeUnitId && game.planned[unit.id]?.move) {
      game.activeUnitId = unit.id;
      game.uiState = "SELECTING_ATTACK";
      el.summonPanel.style.display = "none";
    } else {
      selectMove(x, y);
    }
  }
  else if (currentState === "SELECTING_ATTACK") selectAttack(x, y);
  else if (currentState === "SELECTING_OUGI_TARGET") selectOugiTarget(x, y);
  else if (currentState === "SELECTING_SUMMON_TARGET") selectSummonTarget(x, y);

  renderBattle();
}

function startOugi() {
  const leader = game.units.find((u) => u.isLeader && u.owner === "player");
  if (!leader?.ougi) {
    addLog("[警告] 十二天将を憑依させると奥義が解放されます。", "sys");
    return;
  }
  if (leader.ougiUsed || leader.ougiUsedEver) {
    leader.ougiUsed = true;
    addLog("[警告] 奥義は1試合に1度のみです。", "sys");
    return;
  }
  game.activeUnitId = leader.id;
  game.planned[leader.id] ??= { move: null, attack: null, possess: false };
  if (isImmediateOugi(leader.ougi)) {
    game.planned[leader.id].ougi = { x: leader.x, y: leader.y, name: leader.ougi };
    game.uiState = "IDLE";
    el.summonPanel.style.display = "none";
    addLog(`【予約・奥義】${leader.ougi}`, "possess");
    renderBattle();
    return;
  }
  game.uiState = "SELECTING_OUGI_TARGET";
  el.summonPanel.style.display = "none";
  el.unitInfo.innerText = `【奥義】${leader.ougi} の対象マスを選択`;
  renderBattle();
}

function handleIdleClick(unit) {
  if (!unit) return;
  if (unit.owner === "enemy") {
    const stats = getEffectiveStats(unit);
    addLog(`※敵将の情報: ${unit.name} (HP:${unit.hp} / 攻:${stats.effAtk} / 射:${stats.effReach} / 属:${unit.element})`, "sys");
    return;
  }

  game.activeUnitId = unit.id;
  game.uiState = "SELECTING_MOVE";
  el.summonPanel.style.display = "none";
  game.planned[game.activeUnitId] ??= { move: null, attack: null, possess: false };
  if (game.planned[game.activeUnitId].move) game.uiState = "SELECTING_ATTACK";
}

function selectMove(x, y) {
  const unit = game.units.find((u) => u.id === game.activeUnitId);
  if (!unit) {
    game.uiState = "IDLE";
    return;
  }

  if ((unit.move ?? 1) <= 0) {
    addLog(`[警告] ${unit.name} は移動できませぬ。`, "sys");
    return;
  }

  if (unit.status?.bind > 0) {
    addLog(`[警告] ${unit.name} は拘束されており移動できませぬ。`, "sys");
    return;
  }

  if (unit.x === x && unit.y === y) {
    addLog("[警告] 現在地は移動先に選べませぬ。", "sys");
    return;
  }

  const moveRange = unit.move ?? 1;
  if (Math.abs(unit.x - x) > moveRange || Math.abs(unit.y - y) > moveRange) {
    addLog(`[警告] ${unit.name} の移動範囲は${moveRange}マスです。`, "sys");
    return;
  }

  if (getBlockerAt(x, y)) {
    addLog("[警告] 進入不可マスへは移動できませぬ。", "sys");
    return;
  }

  game.planned[game.activeUnitId].move = { x, y };
  game.planned[game.activeUnitId].possess = false;
  game.uiState = "IDLE";

  const attack = game.planned[game.activeUnitId].attack;
  if (attack) {
    const stats = getEffectiveStats(unit);
    if (Math.abs(x - attack.x) > stats.effReach || Math.abs(y - attack.y) > stats.effReach) {
      game.planned[game.activeUnitId].attack = null;
    }
  }

  if (unit.isLeader && unit.owner === "player") {
    game.plannedSummons = game.plannedSummons.filter((s) => s.owner !== "player" || (Math.abs(x - s.x) <= 1 && Math.abs(y - s.y) <= 1));
  }
}

function selectAttack(x, y) {
  const unit = game.units.find((u) => u.id === game.activeUnitId);
  if (!unit) {
    game.uiState = "IDLE";
    return;
  }

  const origin = game.planned[game.activeUnitId].move || { x: unit.x, y: unit.y };
  const stats = getEffectiveStats(unit);
  if (Math.abs(origin.x - x) <= stats.effReach && Math.abs(origin.y - y) <= stats.effReach) {
    game.planned[game.activeUnitId].attack = { x, y };
    game.planned[game.activeUnitId].possess = false;
    game.uiState = "IDLE";
    return;
  }

  addLog("[警告] 射程が届きませぬ。", "sys");
}

function selectOugiTarget(x, y) {
  const leader = game.units.find((u) => u.id === game.activeUnitId && u.isLeader);
  if (!leader?.ougi || leader.ougiUsed || leader.ougiUsedEver) {
    game.uiState = "IDLE";
    return;
  }
  if (!isValidOugiTarget(leader, x, y)) {
    addLog("[警告] その奥義では指定できないマスです。", "sys");
    return;
  }
  game.planned[leader.id] ??= { move: null, attack: null, possess: false };
  game.planned[leader.id].ougi = { x, y, name: leader.ougi };
  game.uiState = "IDLE";
  addLog(`【予約】奥義「${leader.ougi}」を構えた。`, "possess");
}

function selectSummonTarget(x, y) {
  const leader = game.units.find((u) => u.isLeader && u.owner === "player");
  const leaderOrigin = game.planned[leader.id]?.move || { x: leader.x, y: leader.y };
  const currentPlayerSummons = game.plannedSummons.filter((summon) => summon.owner === "player").length;

  if (game.summonCooldown.player > 0) {
    addLog("[警告] 召喚疲労中です。このターンは召喚できませぬ。", "sys");
    game.uiState = "IDLE";
    el.summonPanel.style.display = "none";
    return;
  }

  if (currentPlayerSummons >= GAME_CONFIG.SUMMON.max_per_turn) {
    addLog(`[警告] 1ターンに予約できる召喚は最大${GAME_CONFIG.SUMMON.max_per_turn}体までです。`, "sys");
    game.uiState = "IDLE";
    el.summonPanel.style.display = "none";
    return;
  }

  if (Math.abs(leaderOrigin.x - x) > 1 || Math.abs(leaderOrigin.y - y) > 1) {
    addLog("[警告] 召喚は陰陽師の周囲のみ可能です。", "sys");
    return;
  }

  const isProjectedOccupied = game.units.some((unit) => {
    const px = game.planned[unit.id]?.move ? game.planned[unit.id].move.x : unit.x;
    const py = game.planned[unit.id]?.move ? game.planned[unit.id].move.y : unit.y;
    return px === x && py === y && !game.planned[unit.id]?.possess;
  });
  const alreadySummoned = game.plannedSummons.find((s) => s.x === x && s.y === y);
  const isBlocked = Boolean(getBlockerAt(x, y));

  if (isProjectedOccupied || alreadySummoned || isBlocked) {
    addLog("[警告] そのマスは移動後のユニットで埋まるか、既に予約済です。", "sys");
    return;
  }

  const template = SHIKIGAMI_MASTER.find((m) => m.id === game.selectedSummonTemplate);
  game.plannedSummons.push({ owner: "player", templateId: game.selectedSummonTemplate, x, y, cost: template.cost });
  addLog(`【予約】${template.name} の召喚を命じた。`);
  game.uiState = "IDLE";
  el.summonPanel.style.display = "none";
}

async function executeTurn() {
  if (game.isResolving) {
    game.skipResolution = true;
    document.getElementById("execute-btn").innerText = "スキップ中...";
    return;
  }
  if (!hasPlayerPlannedActions() && !window.confirm("行動予約がありません。このままターンを確定しますか？")) {
    return;
  }
  game.isResolving = true;
  game.skipResolution = false;
  game.resolutionPhase = "解決準備中";
  document.getElementById("execute-btn").disabled = false;
  document.getElementById("execute-btn").innerText = "処理をスキップ";
  planEnemyActionsAI();
  const result = await resolveTurnPhased(addLog, (phaseLabel) => {
    game.resolutionPhase = phaseLabel;
    renderBattle();
  }, 900, () => game.skipResolution);
  game.isResolving = false;
  game.skipResolution = false;
  game.resolutionPhase = "";
  document.getElementById("execute-btn").disabled = false;
  document.getElementById("execute-btn").innerText = "ターン確定";
  renderBattle();
  showResult(result);
}

function hasPlayerPlannedActions() {
  const hasUnitPlan = game.units
    .filter((unit) => unit.owner === "player")
    .some((unit) => {
      const plan = game.planned[unit.id];
      return Boolean(plan?.move || plan?.attack || plan?.possess || plan?.ougi);
    });
  const hasSummonPlan = game.plannedSummons.some((summon) => summon.owner === "player");
  return hasUnitPlan || hasSummonPlan;
}
