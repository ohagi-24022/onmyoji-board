import { BOARD_SIZE, ELEMENT_BOOST, ELEMENT_WEAK, GAME_CONFIG, SHIKIGAMI_MASTER } from "./data.js";
import { game } from "./state.js";

export function getEffectiveStats(unit) {
  let effAtk = unit.atk + unit.buffAtk;
  let effReach = unit.reach;
  let effMove = unit.move ?? 1;

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

  return { effAtk, effReach, effMove };
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
  if (enemy.status?.actionSeal > 0) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "wait",
      move: null,
      attack: null,
      targetName: closestPlayer.name
    };
  }
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

  if (enemy.status?.bind > 0 || (enemy.move ?? 1) <= 0) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "wait",
      move: null,
      attack: null,
      targetName: closestPlayer.name
    };
  }

  const moveRange = enemy.move ?? 1;
  const targetX = enemy.x + Math.sign(closestPlayer.x - enemy.x) * Math.min(moveRange, Math.abs(closestPlayer.x - enemy.x));
  const targetY = enemy.y + Math.sign(closestPlayer.y - enemy.y) * Math.min(moveRange, Math.abs(closestPlayer.y - enemy.y));
  const isOccupied = game.units.find((u) => u.x === targetX && u.y === targetY);
  if (isOccupied || getTerrainAt(targetX, targetY)?.type === "blocked") {
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
      const blocked = getTerrainAt(x, y)?.type === "blocked";
      if (!occupied && !reserved && !blocked) {
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
  resolveOugiFixed(addLog);
  resolveSummons(addLog);
  resolveTerrainAndStatuses(addLog);

  const result = removeDefeatedUnits(addLog);
  game.planned = {};
  game.activeUnitId = null;
  game.uiState = "IDLE";
  game.turn++;
  return result;
}

export async function resolveTurnPhased(addLog, onPhase, delayMs = 550, shouldSkip = () => false) {
  addLog("=== ターン一斉解決 ===", "sys");
  game.units.forEach((u) => { u.buffAtk = 0; });

  onPhase("解決中: 激突判定");
  resolveCollisions(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 移動と呪力獲得");
  resolveMovementAndMana();
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 憑依");
  resolvePossession(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 術");
  resolveAttacks(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 奥義");
  resolveOugiFixed(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 召喚");
  resolveSummons(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 地形・状態異常");
  resolveTerrainAndStatuses(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 撃破確認");
  const result = removeDefeatedUnits(addLog);
  game.planned = {};
  game.activeUnitId = null;
  game.uiState = "IDLE";
  game.turn++;
  await wait(delayMs, shouldSkip);
  return result;
}

function wait(ms, shouldSkip = () => false) {
  if (shouldSkip()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (shouldSkip() || Date.now() - started >= ms) {
        resolve();
        return;
      }
      setTimeout(tick, 40);
    };
    tick();
  });
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

    game.units.forEach((unit) => {
      const move = game.planned[unit.id]?.move;
      if (!move) return;
      if (getTerrainAt(move.x, move.y)?.type !== "blocked") return;
      game.planned[unit.id].move = null;
      collidedUnitIds.add(unit.id);
      addLog(`【激突】${getUnitLogName(unit)} は進入不可マスに弾かれた！`, "atk");
      resolving = true;
    });

    loopCount++;
  }

  if (collidedUnitIds.size === 0) return;
  addLog("【激突】盤上で衝突発生！移動阻害！", "atk");
  collidedUnitIds.forEach((id) => {
    const unit = game.units.find((u) => u.id === id);
    if (!unit) return;
    unit.hp = Math.max(0, unit.hp - GAME_CONFIG.DAMAGE.collision);
    addLog(` ＞ ${getUnitLogName(unit)} に${GAME_CONFIG.DAMAGE.collision}の痛手!`, "atk");
  });
}

function resolveMovementAndMana() {
  const turnMpGain = { player: GAME_CONFIG.MP_REWARD.turn_end, enemy: GAME_CONFIG.MP_REWARD.turn_end };

  game.units.forEach((unit) => {
    if (unit.hp <= 0) return;
    const prevX = unit.x;
    const prevY = unit.y;
    if (game.planned[unit.id]?.move) {
      unit.x = game.planned[unit.id].move.x;
      unit.y = game.planned[unit.id].move.y;
    }
    turnMpGain[unit.owner] += calculateManaGain(unit, prevX, prevY);
  });

  game.units.forEach((unit) => {
    if (!unit.isLeader) return;
    const isPlayerPushed = unit.owner === "player" && unit.y <= Math.floor(BOARD_SIZE / 2);
    const isEnemyPushed = unit.owner === "enemy" && unit.y >= Math.floor(BOARD_SIZE / 2);
    if (isPlayerPushed || isEnemyPushed) turnMpGain[unit.owner] += GAME_CONFIG.MP_REWARD.line_push;
    if (game.turnFlags.leaderDamagedEnemy[unit.owner]) turnMpGain[unit.owner] += GAME_CONFIG.MP_REWARD.leader_hit;
  });

  game.mp.player += turnMpGain.player;
  game.mp.enemy += turnMpGain.enemy;
  game.turnFlags.leaderDamagedEnemy = { player: false, enemy: false };
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
    leader.ougi = unit.ougi;
    leader.ougiUsed = false;

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
  if (unit.tenshoAbility === "regen") {
    leader.regen = 3;
    return " 【太常の加護: 毎ターンHP+3】";
  }
  if (unit.tenshoAbility === "guard") {
    leader.damageReduction = 1;
    return " 【勾陣の加護: ダメージ1軽減】";
  }
  if (unit.tenshoAbility === "knockback") {
    leader.knockback = true;
    return " 【天后の加護: 術命中で後退】";
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
      if (target.damageReduction) dmg = Math.max(0, dmg - target.damageReduction);
      target.hp = Math.max(0, target.hp - dmg);
      if (unit.isLeader && dmg > 0) game.turnFlags.leaderDamagedEnemy[unit.owner] = true;
      applyStatusEffect(unit, target, addLog);
      if (unit.knockback) knockbackTarget(unit, target, addLog);
      addLog(`【攻撃】${getUnitLogName(unit)} → ${getUnitLogName(target)}に ${dmg}ダメージ ${msg}`, "atk");
      return;
    }

    if (ELEMENT_BOOST[unit.element] === target.element) {
      target.buffAtk += GAME_CONFIG.BUFF.atk_boost;
      addLog(`【支援】${getUnitLogName(unit)} → ${getUnitLogName(target)}に相生の気！(次ターン攻+${GAME_CONFIG.BUFF.atk_boost})`, "heal");
    }
  });
}

function applyStatusEffect(attacker, target, addLog) {
  if (!attacker.statusEffect || target.owner === attacker.owner) return;
  target.status ??= {};
  if (attacker.statusEffect === "poison") {
    target.status.poison = 3;
    addLog(`【猛毒】${getUnitLogName(target)} は毒に侵された。`, "sys");
  }
  if (attacker.statusEffect === "bind") {
    target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
    addLog(`【拘束】${getUnitLogName(target)} は次ターン移動できない。`, "sys");
  }
}

function knockbackTarget(attacker, target, addLog) {
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  const nx = target.x + dx;
  const ny = target.y + dy;
  if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) return;
  if (getTerrainAt(nx, ny)?.type === "blocked") return;
  if (game.units.some((unit) => unit.x === nx && unit.y === ny)) return;
  target.x = nx;
  target.y = ny;
  addLog(`【後退】${getUnitLogName(target)} は1マス押し戻された。`, "sys");
}

function resolveOugiFixed(addLog) {
  game.units.forEach((unit) => {
    const plot = game.planned[unit.id]?.ougi;
    if (!plot || !unit.isLeader || unit.ougiUsed || unit.hp <= 0) return;

    const ougiId = getOugiId(unit.ougi);
    const { x, y } = plot;
    unit.ougiUsed = true;

    if (ougiId === "s_genbu") {
      unit.invulnerable = 2;
      forArea(unit.x, unit.y, 1, (tx, ty) => {
        if (tx === unit.x && ty === unit.y) return;
        if (game.units.some((target) => target.x === tx && target.y === ty)) return;
        if (getTerrainAt(tx, ty)) return;
        game.terrain.push({ x: tx, y: ty, type: "blocked", label: "wall", temporary: 2 });
      });
      addLog("[奥義] 絶海防壁: 周囲の空きマスに一時的な岩を作りました。", "possess");
      return;
    }

    if (ougiId === "s_taijo") {
      forArea(x, y, 1, (tx, ty) => addOrReplaceTerrain({ x: tx, y: ty, type: "heal", label: "heal" }));
      addLog("[奥義] 聖域化: 指定範囲を竜脈に変えました。", "heal");
      return;
    }

    if (ougiId === "s_tenko") {
      const target = game.units.find((candidate) => candidate.x === x && candidate.y === y && candidate.owner !== unit.owner && !candidate.isLeader);
      if (target) {
        target.owner = unit.owner;
        target.ai = undefined;
        addLog(`[奥義] 幻惑の乗っ取り: ${target.name} を味方にしました。`, "possess");
      } else {
        addLog("[奥義] 幻惑の乗っ取り: 対象がいませんでした。", "sys");
      }
      return;
    }

    if (ougiId === "s_seiryu") {
      const targets = game.units.filter((target) => target.owner !== unit.owner && isOnSelectedLine(unit, target, x, y));
      targets.forEach((target) => {
        dealFixedDamage(target, 4, addLog, "青龍奥義");
        if (target.hp <= 0) return;
        target.status ??= {};
        target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
      });
      addLog(`[奥義] 蒼天の雷撃: 直線上の敵${targets.length}体を貫きました。`, "atk");
      return;
    }

    if (ougiId === "s_sujaku") {
      const target = game.units.find((candidate) => candidate.x === x && candidate.y === y && candidate.owner !== unit.owner);
      if (target) dealFixedDamage(target, 8, addLog, "朱雀奥義");
      addOrReplaceTerrain({ x, y, type: "damage", label: "fire" });
      addLog("[奥義] 煉獄の業火: 指定マスを瘴気地形にしました。", "atk");
      return;
    }

    if (ougiId === "s_byakko") {
      if (!game.units.some((target) => target.x === x && target.y === y) && getTerrainAt(x, y)?.type !== "blocked") {
        unit.x = x;
        unit.y = y;
      }
      forArea(unit.x, unit.y, 1, (tx, ty) => {
        game.units
          .filter((target) => target.owner !== unit.owner && target.x === tx && target.y === ty)
          .forEach((target) => dealFixedDamage(target, 3, addLog, "白虎奥義"));
      });
      addLog("[奥義] 迅雷風烈: 移動して周囲を攻撃しました。", "atk");
      return;
    }

    if (ougiId === "s_kochin") {
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        if (!isInsideBoard(tx, ty)) return;
        if (game.units.some((target) => target.x === tx && target.y === ty)) return;
        addOrReplaceTerrain({ x: tx, y: ty, type: "blocked", label: "rock" });
      });
      addLog("[奥義] 地殻変動: 指定地点と十字を岩にしました。", "sys");
      return;
    }

    if (ougiId === "s_touda") {
      const targets = game.units.filter((target) => target.owner !== unit.owner);
      targets.forEach((target) => dealFixedDamage(target, 4, addLog, "騰蛇奥義"));
      addLog(`[奥義] 焦熱地獄: 全敵${targets.length}体を攻撃しました。`, "atk");
      return;
    }

    if (ougiId === "s_kijin") {
      const targets = game.units.filter((target) => target.owner !== unit.owner && target.hp > 0);
      targets.forEach((target) => {
        target.status ??= {};
        target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
        target.status.actionSeal = 1;
      });
      addLog(`[奥義] 神域展開: 全敵${targets.length}体を拘束しました。`, "possess");
    }
  });
}

function resolveOugi(addLog) {
  game.units.forEach((unit) => {
    const plot = game.planned[unit.id]?.ougi;
    if (!plot || !unit.isLeader || unit.ougiUsed || unit.hp <= 0) return;
    const x = plot.x;
    const y = plot.y;
    const ougiId = getOugiId(unit.ougi);
    unit.ougiUsed = true;

    if (unit.ougi === "絶海防壁") {
      unit.invulnerable = 2;
      forArea(unit.x, unit.y, 1, (tx, ty) => {
        if (tx === unit.x && ty === unit.y) return;
        if (game.units.some((target) => target.x === tx && target.y === ty)) return;
        addOrReplaceTerrain({ x: tx, y: ty, type: "blocked", label: "壁", temporary: 2 });
      });
      addLog("【奥義】絶海防壁: 周囲を壁にし、陰陽師が1ターン無敵。", "possess");
      return;
    }

    if (unit.ougi === "聖域化") {
      forArea(x, y, 1, (tx, ty) => addOrReplaceTerrain({ x: tx, y: ty, type: "heal", label: "龍脈" }));
      addLog("【奥義】聖域化: 指定範囲を龍脈に変えた。", "heal");
      return;
    }

    if (unit.ougi === "幻惑の乗っ取り") {
      const target = game.units.find((candidate) => candidate.x === x && candidate.y === y && candidate.owner !== unit.owner && !candidate.isLeader);
      if (target) {
        target.owner = unit.owner;
        target.ai = undefined;
        addLog(`【奥義】幻惑の乗っ取り: ${target.name} の支配を奪った。`, "possess");
      } else {
        addLog("【奥義】幻惑の乗っ取り: 対象がいなかった。", "sys");
      }
      return;
    }

    if (unit.ougi === "蒼天の雷撃") {
      const targets = game.units.filter((target) => target.owner !== unit.owner && isSameLine(unit, target, x, y));
      targets.forEach((target) => {
        dealFixedDamage(target, 4, addLog, "蒼天の雷撃");
        target.status ??= {};
        target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
      });
      addLog(`【奥義】蒼天の雷撃: 直線上の敵${targets.length}体を貫いた。`, "atk");
      return;
    }

    if (unit.ougi === "煉獄の業火") {
      const target = game.units.find((candidate) => candidate.x === x && candidate.y === y && candidate.owner !== unit.owner);
      if (target) dealFixedDamage(target, 8, addLog, "煉獄の業火");
      addOrReplaceTerrain({ x, y, type: "damage", label: "炎上" });
      addLog("【奥義】煉獄の業火: 指定マスを炎上地形にした。", "atk");
      return;
    }

    if (unit.ougi === "迅雷風烈") {
      if (!game.units.some((target) => target.x === x && target.y === y) && getTerrainAt(x, y)?.type !== "blocked") {
        unit.x = x;
        unit.y = y;
      }
      forArea(unit.x, unit.y, 1, (tx, ty) => {
        game.units
          .filter((target) => target.owner !== unit.owner && target.x === tx && target.y === ty)
          .forEach((target) => dealFixedDamage(target, 3, addLog, "迅雷風烈"));
      });
      addLog("【奥義】迅雷風烈: ワープし周囲をなぎ払った。", "atk");
      return;
    }

    if (unit.ougi === "地殻変動") {
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        if (!isInsideBoard(tx, ty)) return;
        if (game.units.some((target) => target.x === tx && target.y === ty)) return;
        addOrReplaceTerrain({ x: tx, y: ty, type: "blocked", label: "岩" });
      });
      addLog("【奥義】地殻変動: 指定地点と十字を進入不可にした。", "sys");
      return;
    }

    if (unit.ougi === "焦熱地獄") {
      const targets = game.units.filter((target) => target.owner !== unit.owner);
      targets.forEach((target) => dealFixedDamage(target, 4, addLog, "焦熱地獄"));
      addLog(`【奥義】焦熱地獄: 全敵${targets.length}体を焼いた。`, "atk");
      return;
    }

    if (unit.ougi === "神域展開") {
      const targets = game.units.filter((target) => target.owner !== unit.owner);
      targets.forEach((target) => {
        target.status ??= {};
        target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
        target.status.actionSeal = 1;
      });
      addLog(`【奥義】神域展開: 全敵${targets.length}体を拘束した。`, "possess");
    }
  });
}

function dealFixedDamage(target, amount, addLog, source) {
  if (target.hp <= 0) return;
  if (target.invulnerable > 0) {
    addLog(`【${source}】${getUnitLogName(target)} は無敵で防いだ。`, "sys");
    return;
  }
  target.hp = Math.max(0, target.hp - amount);
  addLog(`【${source}】${getUnitLogName(target)} に${amount}ダメージ。`, "atk");
}

function getOugiId(ougiName) {
  return SHIKIGAMI_MASTER.find((template) => template.ougi === ougiName)?.id ?? "";
}

function isOnSelectedLine(unit, target, x, y) {
  if (unit.x === x && target.x === unit.x) return target.y !== unit.y;
  if (unit.y === y && target.y === unit.y) return target.x !== unit.x;
  return false;
}

function isSameLine(unit, target, x, y) {
  if (unit.x === x && target.x === unit.x) return isBetween(target.y, unit.y, y);
  if (unit.y === y && target.y === unit.y) return isBetween(target.x, unit.x, x);
  return false;
}

function isBetween(value, start, end) {
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

function forArea(cx, cy, radius, callback) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (isInsideBoard(x, y)) callback(x, y);
    }
  }
}

function isInsideBoard(x, y) {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function addOrReplaceTerrain(tile) {
  game.terrain = game.terrain.filter((current) => current.x !== tile.x || current.y !== tile.y);
  game.terrain.push(tile);
}

function resolveSummons(addLog) {
  game.plannedSummons.forEach((summon) => {
    const isOccupied = game.units.find((u) => u.x === summon.x && u.y === summon.y);
    const isBlocked = getTerrainAt(summon.x, summon.y)?.type === "blocked";
    const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
    const owner = summon.owner ?? "player";
    const leaderAlive = game.units.some((unit) => unit.owner === owner && unit.isLeader && unit.hp > 0);
    if (!leaderAlive) return;
    if (isOccupied || isBlocked) {
      addLog("【召喚失敗】その場所には既に者がおり召喚できなかった", "sys");
      return;
    }

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
      move: template.move,
      isTensho: template.isTensho,
      tenshoAbility: template.tenshoAbility,
      statusEffect: template.statusEffect,
      ougi: template.ougi,
      ai: owner === "enemy" ? { pattern: "hunter", predictionAccuracy: 0.5 } : undefined,
      x: summon.x,
      y: summon.y
    });
    addLog(`【召喚】${owner === "player" ? "味方" : "敵"}の${template.name} が戦場に顕現した！`, owner === "player" ? "heal" : "atk");
  });
  game.plannedSummons = [];
}

function resolveTerrainAndStatuses(addLog) {
  game.units.forEach((unit) => {
    if (unit.hp <= 0) return;
    const tile = getTerrainAt(unit.x, unit.y);
    if (tile?.type === "heal") {
      unit.hp += GAME_CONFIG.TERRAIN.heal;
      game.mp[unit.owner] += GAME_CONFIG.TERRAIN.mp;
      addLog(`【龍脈】${getUnitLogName(unit)} がHP+${GAME_CONFIG.TERRAIN.heal}、呪力+${GAME_CONFIG.TERRAIN.mp}`, "heal");
    }
    if (tile?.type === "damage") {
      unit.hp = Math.max(0, unit.hp - GAME_CONFIG.TERRAIN.damage);
      addLog(`【瘴気】${getUnitLogName(unit)} に${GAME_CONFIG.TERRAIN.damage}ダメージ。`, "atk");
    }
    if (unit.regen) {
      unit.hp += unit.regen;
      addLog(`【加護】${getUnitLogName(unit)} がHP+${unit.regen}回復。`, "heal");
    }
    if (unit.status?.poison > 0) {
      unit.hp = Math.max(0, unit.hp - GAME_CONFIG.STATUS.poison_damage);
      unit.status.poison--;
      addLog(`【猛毒】${getUnitLogName(unit)} に${GAME_CONFIG.STATUS.poison_damage}ダメージ。`, "atk");
    }
    if (unit.status?.bind > 0) unit.status.bind--;
    if (unit.status?.actionSeal > 0) unit.status.actionSeal--;
    if (unit.invulnerable > 0) unit.invulnerable--;
  });
  game.terrain = game.terrain
    .map((tile) => tile.temporary ? { ...tile, temporary: tile.temporary - 1 } : tile)
    .filter((tile) => tile.temporary === undefined || tile.temporary > 0);
}

export function getTerrainAt(x, y) {
  return game.terrain.find((tile) => tile.x === x && tile.y === y);
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
