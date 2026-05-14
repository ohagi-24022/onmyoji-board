import { BOARD_SIZE, ELEMENT_BOOST, ELEMENT_WEAK, GAME_CONFIG, SHIKIGAMI_MASTER } from "./data.js";
import { game } from "./state.js";

export function getEffectiveStats(unit) {
  let effAtk = unit.atk + unit.buffAtk;
  let effReach = unit.reach;

  if (unit.isLeader) {
    game.units.forEach((ally) => {
      if (ally.owner === unit.owner && game.planned[ally.id]?.possess) {
        effAtk += Math.max(1, Math.ceil(ally.atk * 0.5));
        if (ally.isTensho) {
          if (ally.tenshoAbility === "atk_max") effAtk += 5;
          if (ally.tenshoAbility === "reach") effReach += 1;
          if (ally.tenshoAbility === "balance") effAtk += 2;
          if (ally.tenshoAbility === "bruiser") effAtk += 3;
          if (ally.tenshoAbility === "kijin") effAtk += 3;
        }
      }
    });
  }

  return { effAtk, effReach };
}

export function getUnitLogName(unit) {
  return `${unit.owner === "player" ? "味方の" : "敵の"}${unit.name}`;
}

export function calculateManaGain(unit, prevX, prevY) {
  let gainedMP = 0;
  if (unit.x !== prevX || unit.y !== prevY) gainedMP += GAME_CONFIG.MP_REWARD.move;
  const isNearEnemy = game.units.some((other) =>
    other.owner !== unit.owner && Math.abs(other.x - unit.x) <= 1 && Math.abs(other.y - unit.y) <= 1
  );
  if (isNearEnemy) gainedMP += GAME_CONFIG.MP_REWARD.risk_zone;
  return gainedMP;
}

export function planEnemyActionsAI() {
  getEnemyActionPlans().forEach((plan) => {
    if (!game.planned[plan.unitId]) game.planned[plan.unitId] = { move: null, attack: null };
    game.planned[plan.unitId].move = plan.move;
    game.planned[plan.unitId].attack = plan.attack;
    if (plan.summon) game.plannedSummons.push(plan.summon);
  });
}

export function getEnemyActionPredictions() {
  return getEnemyActionPlans().map(applyPredictionAccuracy);
}

function getEnemyActionPlans() {
  const enemies = game.units.filter((u) => u.owner === "enemy");
  const players = game.units.filter((u) => u.owner === "player");

  return enemies
    .map((enemy) => buildEnemyPlan(enemy, players))
    .filter(Boolean);
}

function buildEnemyPlan(enemy, players) {
  let closestPlayer = null;
  let minDistance = Infinity;

  players.forEach((player) => {
    const dist = Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y));
    if (dist < minDistance) {
      minDistance = dist;
      closestPlayer = player;
    }
  });

  if (!closestPlayer) return null;
  if (enemy.ai?.pattern === "summoner") {
    const summonPlan = buildEnemySummonPlan(enemy, closestPlayer);
    if (summonPlan) return summonPlan;
  }

  if (minDistance <= enemy.reach) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "attack",
      move: null,
      attack: { x: closestPlayer.x, y: closestPlayer.y },
      targetName: closestPlayer.name
    };
  }

  const targetX = enemy.x + Math.sign(closestPlayer.x - enemy.x);
  const targetY = enemy.y + Math.sign(closestPlayer.y - enemy.y);
  const isOccupied = game.units.find((u) => u.x === targetX && u.y === targetY);
  if (isOccupied) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "wait",
      move: null,
      attack: null,
      targetName: closestPlayer.name
    };
  }

  return {
    unitId: enemy.id,
    unitName: enemy.name,
    type: "move",
    move: { x: targetX, y: targetY },
    attack: null,
    targetName: closestPlayer.name
  };
}

function buildEnemySummonPlan(enemy, closestPlayer) {
  const enemyCount = game.units.filter((unit) => unit.owner === "enemy").length;
  const summonLimit = enemy.ai?.summonLimit ?? 3;
  if (enemyCount >= summonLimit) return null;

  const summonPool = enemy.ai?.summonPool ?? ["z_onibi"];
  const templateId = summonPool[(game.turn - 1) % summonPool.length];
  const template = SHIKIGAMI_MASTER.find((m) => m.id === templateId);
  if (!template || game.mp.enemy < template.cost) return null;

  const target = findEnemySummonCell(enemy, closestPlayer);
  if (!target) return null;

  return {
    unitId: enemy.id,
    unitName: enemy.name,
    type: "summon",
    move: null,
    attack: null,
    summon: { owner: "enemy", templateId, x: target.x, y: target.y, cost: template.cost },
    summonName: template.name,
    targetName: closestPlayer.name
  };
}

function findEnemySummonCell(enemy, closestPlayer) {
  const candidates = [];
  for (let y = enemy.y - 1; y <= enemy.y + 1; y++) {
    for (let x = enemy.x - 1; x <= enemy.x + 1; x++) {
      if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) continue;
      if (x === enemy.x && y === enemy.y) continue;
      const occupied = game.units.some((unit) => unit.x === x && unit.y === y);
      const reserved = game.plannedSummons.some((summon) => summon.x === x && summon.y === y);
      if (!occupied && !reserved) {
        candidates.push({ x, y, distance: Math.max(Math.abs(closestPlayer.x - x), Math.abs(closestPlayer.y - y)) });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || b.y - a.y);
  return candidates[0] ?? null;
}

function applyPredictionAccuracy(plan) {
  const accuracy = planAccuracy(plan);
  const roll = stableRoll(`${game.turn}:${plan.unitId}`);
  if (roll <= accuracy) return { ...plan, predictionState: "clear", accuracy };

  return {
    unitId: plan.unitId,
    unitName: plan.unitName,
    type: "unknown",
    move: null,
    attack: null,
    x: getUnitCurrentX(plan.unitId),
    y: getUnitCurrentY(plan.unitId),
    predictionState: "uncertain",
    accuracy
  };
}

function planAccuracy(plan) {
  const unit = game.units.find((u) => u.id === plan.unitId);
  return unit?.ai?.predictionAccuracy ?? 0.7;
}

function stableRoll(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) / 100;
}

function getUnitCurrentX(unitId) {
  return game.units.find((unit) => unit.id === unitId)?.x ?? 0;
}

function getUnitCurrentY(unitId) {
  return game.units.find((unit) => unit.id === unitId)?.y ?? 0;
}

export function resolveTurn(addLog) {
  addLog("=== ターン一斉解決 ===", "sys");
  game.units.forEach((u) => { u.buffAtk = 0; });

  resolveCollisions(addLog);
  resolveMovementAndMana();
  resolvePossession(addLog);
  resolveAttacks(addLog);
  resolveSummons(addLog);

  const result = removeDefeatedUnits(addLog);
  game.planned = {};
  game.activeUnitId = null;
  game.uiState = "IDLE";
  game.turn++;
  return result;
}

export async function resolveTurnPhased(addLog, onPhase, delayMs = 550) {
  addLog("=== ターン一斉解決 ===", "sys");
  game.units.forEach((u) => { u.buffAtk = 0; });

  onPhase("解決中: 激突判定");
  resolveCollisions(addLog);
  await wait(delayMs);

  onPhase("解決中: 移動と呪力獲得");
  resolveMovementAndMana();
  await wait(delayMs);

  onPhase("解決中: 憑依");
  resolvePossession(addLog);
  await wait(delayMs);

  onPhase("解決中: 術");
  resolveAttacks(addLog);
  await wait(delayMs);

  onPhase("解決中: 召喚");
  resolveSummons(addLog);
  await wait(delayMs);

  onPhase("解決中: 撃破確認");
  const result = removeDefeatedUnits(addLog);
  game.planned = {};
  game.activeUnitId = null;
  game.uiState = "IDLE";
  game.turn++;
  await wait(delayMs);
  return result;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCollisions(addLog) {
  const collidedUnitIds = new Set();
  let resolving = true;
  let loopCount = 0;

  while (resolving && loopCount < 10) {
    resolving = false;
    const projected = {};

    game.units.forEach((unit) => {
      const px = game.planned[unit.id]?.move ? game.planned[unit.id].move.x : unit.x;
      const py = game.planned[unit.id]?.move ? game.planned[unit.id].move.y : unit.y;
      const key = `${px},${py}`;
      projected[key] ??= [];
      projected[key].push(unit.id);
    });

    Object.values(projected).forEach((unitIds) => {
      if (unitIds.length <= 1) return;
      unitIds.forEach((id) => {
        if (game.planned[id]?.move) {
          game.planned[id].move = null;
          resolving = true;
        }
        collidedUnitIds.add(id);
      });
    });

    game.units.forEach((u1) => {
      if (!game.planned[u1.id]?.move) return;
      const { x: destX, y: destY } = game.planned[u1.id].move;
      const u2 = game.units.find((u) => u.x === destX && u.y === destY);
      if (u2 && game.planned[u2.id]?.move?.x === u1.x && game.planned[u2.id]?.move?.y === u1.y) {
        game.planned[u1.id].move = null;
        game.planned[u2.id].move = null;
        collidedUnitIds.add(u1.id);
        collidedUnitIds.add(u2.id);
        resolving = true;
      }
    });

    loopCount++;
  }

  if (collidedUnitIds.size === 0) return;
  addLog("【激突】盤上で衝突発生！移動阻害！", "atk");
  collidedUnitIds.forEach((id) => {
    const unit = game.units.find((u) => u.id === id);
    if (!unit) return;
    unit.hp -= GAME_CONFIG.DAMAGE.collision;
    addLog(` ＞ ${getUnitLogName(unit)} に${GAME_CONFIG.DAMAGE.collision}の痛手!`, "atk");
  });
}

function resolveMovementAndMana() {
  const turnMpGain = { player: GAME_CONFIG.MP_REWARD.turn_end, enemy: GAME_CONFIG.MP_REWARD.turn_end };

  game.units.forEach((unit) => {
    const prevX = unit.x;
    const prevY = unit.y;
    if (game.planned[unit.id]?.move) {
      unit.x = game.planned[unit.id].move.x;
      unit.y = game.planned[unit.id].move.y;
    }
    turnMpGain[unit.owner] += calculateManaGain(unit, prevX, prevY);
  });

  game.mp.player += turnMpGain.player;
  game.mp.enemy += turnMpGain.enemy;
}

function resolvePossession(addLog) {
  game.units.forEach((unit) => {
    if (!game.planned[unit.id]?.possess || unit.hp <= 0) return;
    const leader = game.units.find((l) => l.isLeader && l.owner === unit.owner);
    if (!leader || leader.hp <= 0) return;

    const hpBonus = Math.max(1, Math.ceil(unit.hp * 0.5));
    const atkBonus = Math.max(1, Math.ceil(unit.atk * 0.5));
    leader.hp += hpBonus;
    leader.atk += atkBonus;
    leader.element = unit.element;

    const extra = applyTenshoPossessionBonus(leader, unit);
    addLog(`【憑依】${getUnitLogName(unit)} が陰陽師と一体化した！ (HP+${hpBonus} / 攻+${atkBonus} / 属性:${unit.element})${extra}`, "possess");
    unit.hp = 0;
  });
}

function applyTenshoPossessionBonus(leader, unit) {
  if (!unit.isTensho) return "";
  if (unit.tenshoAbility === "reach") {
    leader.reach += 1;
    return " 【青龍の加護: 射程+1】";
  }
  if (unit.tenshoAbility === "atk_max") {
    leader.atk += 5;
    return " 【騰蛇の加護: 攻+5】";
  }
  if (unit.tenshoAbility === "hp") {
    leader.hp += 10;
    return " 【玄武の加護: HP+10】";
  }
  if (unit.tenshoAbility === "balance") {
    leader.atk += 2;
    leader.hp += 5;
    return " 【朱雀の加護: 攻+2/HP+5】";
  }
  if (unit.tenshoAbility === "bruiser") {
    leader.atk += 3;
    leader.hp += 6;
    return " 【白虎の加護: 攻+3/HP+6】";
  }
  if (unit.tenshoAbility === "kijin") {
    leader.atk += 3;
    leader.hp += 5;
    return " 【貴人の加護: 攻+3/HP+5】";
  }
  return "";
}

function resolveAttacks(addLog) {
  game.units.forEach((unit) => {
    const atkPlot = game.planned[unit.id]?.attack;
    if (!atkPlot || unit.hp <= 0 || game.planned[unit.id]?.possess) return;
    const target = game.units.find((t) => t.x === atkPlot.x && t.y === atkPlot.y);

    if (!target || target.id === unit.id) {
      addLog(`【空振り】${getUnitLogName(unit)}の術は空を切った...`);
      return;
    }

    if (target.owner !== unit.owner) {
      let dmg = unit.atk + unit.buffAtk;
      let msg = "";
      if (ELEMENT_WEAK[unit.element] === target.element) {
        dmg = Math.floor(dmg * GAME_CONFIG.DAMAGE.weak_multiplier);
        msg = "(弱点!)";
      } else if (ELEMENT_BOOST[unit.element] === target.element) {
        dmg = Math.floor(dmg * GAME_CONFIG.DAMAGE.resist_multiplier);
        msg = "(軽減...)";
      }
      target.hp -= dmg;
      addLog(`【攻撃】${getUnitLogName(unit)} → ${getUnitLogName(target)}に ${dmg}ダメージ ${msg}`, "atk");
      return;
    }

    if (ELEMENT_BOOST[unit.element] === target.element) {
      target.buffAtk += GAME_CONFIG.BUFF.atk_boost;
      addLog(`【支援】${getUnitLogName(unit)} → ${getUnitLogName(target)}に相生の気！(次ターン攻+${GAME_CONFIG.BUFF.atk_boost})`, "heal");
    }
  });
}

function resolveSummons(addLog) {
  game.plannedSummons.forEach((summon) => {
    const isOccupied = game.units.find((u) => u.x === summon.x && u.y === summon.y);
    const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
    if (isOccupied) {
      addLog("【召喚失敗】その場所には既に者がおり召喚できなかった", "sys");
      return;
    }

    const owner = summon.owner ?? "player";
    game.mp[owner] -= summon.cost;
    game.unitCounter++;
    game.units.push({
      id: `u_${game.unitCounter}`,
      name: template.name,
      owner,
      element: template.element,
      hp: template.hp,
      atk: template.atk,
      buffAtk: 0,
      reach: template.reach,
      isTensho: template.isTensho,
      tenshoAbility: template.tenshoAbility,
      ai: owner === "enemy" ? { pattern: "hunter", predictionAccuracy: 0.5 } : undefined,
      x: summon.x,
      y: summon.y
    });
    addLog(`【召喚】${owner === "player" ? "味方" : "敵"}の${template.name} が戦場に顕現した！`, owner === "player" ? "heal" : "atk");
  });
  game.plannedSummons = [];
}

function removeDefeatedUnits(addLog) {
  let playerLeaderDead = false;
  let enemyLeaderDead = false;

  game.units = game.units.filter((unit) => {
    if (unit.hp > 0) return true;
    if (!game.planned[unit.id]?.possess) addLog(`【撃破】${getUnitLogName(unit)} が倒れた！`, "atk");
    if (unit.isLeader && unit.owner === "player") playerLeaderDead = true;
    if (unit.isLeader && unit.owner === "enemy") enemyLeaderDead = true;
    return false;
  });

  return { playerLeaderDead, enemyLeaderDead };
}
