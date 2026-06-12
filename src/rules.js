import { BOARD_SIZE, DIFFICULTY_CONFIG, ELEMENT_BOOST, ELEMENT_WEAK, GAME_CONFIG, SHIKIGAMI_MASTER } from "./data.js";
import { game } from "./state.js";

export function getEffectiveStats(unit) {
  let effAtk = unit.atk + unit.buffAtk;
  let effReach = unit.reach;
  let effMove = unit.move ?? 1;

  if (unit.templateId === "z_komainu") {
    const alliedKomainu = game.units.filter((ally) =>
      ally.owner === unit.owner && ally.templateId === "z_komainu" && ally.hp > 0
    ).length;
    if (alliedKomainu >= 2) {
      effAtk += 3;
      effMove += 1;
    }
  }

  if (unit.isLeader) {
    const plannedPossession = game.units.find((ally) => ally.owner === unit.owner && game.planned[ally.id]?.possess);
    if (plannedPossession) {
      const base = getLeaderBaseStats(unit);
      const bonus = plannedPossession.possessionBonus ?? {};
      effAtk = base.atk + (bonus.atk ?? 0) + unit.buffAtk;
      effReach = base.reach + (bonus.reach ?? 0);
      effMove = bonus.moveSet ?? base.move + (bonus.move ?? 0);
    }
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
  const stats = getEffectiveStats(enemy);
  const closestPlayer = selectEnemyTarget(enemy, players);
  const minDistance = closestPlayer ? boardDistance(enemy, closestPlayer) : Infinity;

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

  if (minDistance <= stats.effReach) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "attack",
      move: null,
      attack: { x: closestPlayer.x, y: closestPlayer.y },
      targetName: closestPlayer.name
    };
  }

  if (enemy.status?.bind > 0 || stats.effMove <= 0) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "wait",
      move: null,
      attack: null,
      targetName: closestPlayer.name
    };
  }

  const move = findEnemyMove(enemy, closestPlayer, stats.effMove);
  if (!move) {
    return {
      unitId: enemy.id,
      unitName: enemy.name,
      type: "wait",
      move: null,
      attack: null,
      targetName: closestPlayer.name
    };
  }

  const distanceAfterMove = Math.max(Math.abs(closestPlayer.x - move.x), Math.abs(closestPlayer.y - move.y));
  return {
    unitId: enemy.id,
    unitName: enemy.name,
    type: enemy.ai?.moveAndAttack && distanceAfterMove <= stats.effReach ? "move_attack" : "move",
    move,
    attack: enemy.ai?.moveAndAttack && distanceAfterMove <= stats.effReach
      ? { x: closestPlayer.x, y: closestPlayer.y }
      : null,
    targetName: closestPlayer.name
  };
}

function selectEnemyTarget(enemy, players) {
  if (players.length === 0) return null;
  if (enemy.ai?.targetMode !== "tactical") {
    return [...players].sort((a, b) => boardDistance(enemy, a) - boardDistance(enemy, b))[0];
  }

  return [...players].sort((a, b) => tacticalTargetScore(enemy, a) - tacticalTargetScore(enemy, b))[0];
}

function tacticalTargetScore(enemy, target) {
  const distance = boardDistance(enemy, target);
  const hpRatio = target.hp / Math.max(1, target.maxHp ?? target.hp);
  const leaderPriority = target.isLeader ? -2 : 0;
  return distance * 2 + hpRatio * 4 + leaderPriority;
}

function boardDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function findEnemyMove(enemy, target, moveRange) {
  if (enemy.ai?.moveMode === "direct") {
    const x = enemy.x + Math.sign(target.x - enemy.x) * Math.min(moveRange, Math.abs(target.x - enemy.x));
    const y = enemy.y + Math.sign(target.y - enemy.y) * Math.min(moveRange, Math.abs(target.y - enemy.y));
    return isEnemyMoveCellOpen(enemy, x, y) ? { x, y } : null;
  }

  const candidates = [];
  for (let y = Math.max(0, enemy.y - moveRange); y <= Math.min(BOARD_SIZE - 1, enemy.y + moveRange); y++) {
    for (let x = Math.max(0, enemy.x - moveRange); x <= Math.min(BOARD_SIZE - 1, enemy.x + moveRange); x++) {
      if (x === enemy.x && y === enemy.y) continue;
      if (!isEnemyMoveCellOpen(enemy, x, y)) continue;
      const distance = Math.max(Math.abs(target.x - x), Math.abs(target.y - y));
      const alignmentBonus = enemy.ai?.moveMode === "tactical" && (x === target.x || y === target.y) ? -0.25 : 0;
      candidates.push({ x, y, score: distance + alignmentBonus });
    }
  }
  candidates.sort((a, b) => a.score - b.score || Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
}

function isEnemyMoveCellOpen(enemy, x, y) {
  if (getBlockerAt(x, y)) return false;
  return !game.units.some((unit) => unit.id !== enemy.id && unit.x === x && unit.y === y);
}

function buildEnemySummonPlan(enemy, closestPlayer) {
  const summonInterval = Math.max(1, enemy.ai?.summonInterval ?? 1);
  if ((game.turn - 1) % summonInterval !== 0) return null;
  const enemyCount = game.units.filter((unit) =>
    unit.owner === "enemy" && !unit.isLeader && unit.templateId !== "z_raiju" && unit.hp > 0
  ).length;
  const summonLimit = Math.min(enemy.ai?.summonLimit ?? GAME_CONFIG.SUMMON.max_on_board, GAME_CONFIG.SUMMON.max_on_board);
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
      const blocked = Boolean(getBlockerAt(x, y));
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
  return unit?.ai?.predictionAccuracy ?? DIFFICULTY_CONFIG[game.difficulty]?.predictionAccuracy ?? 0.7;
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
  resolveSummons(addLog);
  resolveAttacks(addLog);
  resolveOugiFixed(addLog);
  resolveTerrainAndStatuses(addLog);
  updateStanceAttackLocks();

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

  onPhase("解決中: 召喚");
  resolveSummons(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 術");
  resolveAttacks(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 奥義");
  resolveOugiFixed(addLog);
  await wait(delayMs, shouldSkip);

  onPhase("解決中: 地形・状態異常");
  resolveTerrainAndStatuses(addLog);
  updateStanceAttackLocks();
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
      if (!getBlockerAt(move.x, move.y)) return;
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
    if (isStanceInvulnerable(unit)) {
      addLog(` ＞ ${getUnitLogName(unit)} は静と動の構えで激突ダメージを無効化！`, "possess");
      return;
    }
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

    applyPossessionStats(leader, unit);
    leader.element = unit.element;
    if (unit.ougi) {
      leader.ougi = unit.ougi;
      leader.usedOugiNames ??= [];
      leader.ougiUsed = Boolean(leader.ougiUsedEver);
    }

    const bonusText = unit.possessionBonus?.label ?? "ボーナスなし";
    addLog(`【憑依】${getUnitLogName(unit)} が陰陽師と一体化した！ (属性:${unit.element} / ${bonusText})`, "possess");
    unit.hp = 0;
  });
}

function applyPossessionStats(leader, unit) {
  const base = getLeaderBaseStats(leader);
  const bonus = unit.possessionBonus ?? {};

  clearPossessionEffects(leader);
  leader.maxHp = Math.max(1, base.hp + (bonus.maxHp ?? 0));
  leader.hp = clamp((leader.hp ?? base.hp) + (bonus.currentHp ?? 0), 1, leader.maxHp);
  leader.atk = base.atk + (bonus.atk ?? 0);
  leader.reach = base.reach + (bonus.reach ?? 0);
  leader.move = bonus.moveSet ?? base.move + (bonus.move ?? 0);
  leader.statusEffect = bonus.statusEffect ?? base.statusEffect;
  leader.regen = bonus.regen ?? 0;
  leader.damageReduction = bonus.damageReduction ?? 0;
  leader.damageVulnerability = bonus.damageVulnerability ?? 0;
  leader.knockback = Boolean(bonus.knockback);
  leader.burnOnHit = Boolean(bonus.burnOnHit);
  leader.ignoreResist = Boolean(bonus.ignoreResist);
  leader.terrainImmune = Boolean(bonus.terrainImmune);
  leader.piercing = Boolean(bonus.piercing);
  leader.adjacentSpellImmunity = Boolean(bonus.adjacentSpellImmunity);
  leader.possessionSourceId = unit.id;
}

function getLeaderBaseStats(leader) {
  leader.baseStats ??= {
    hp: leader.maxHp ?? leader.hp,
    atk: leader.atk,
    reach: leader.reach,
    move: leader.move ?? 1,
    statusEffect: leader.statusEffect
  };
  return leader.baseStats;
}

function clearPossessionEffects(leader) {
  leader.regen = 0;
  leader.damageReduction = 0;
  leader.damageVulnerability = 0;
  leader.knockback = false;
  leader.burnOnHit = false;
  leader.ignoreResist = false;
  leader.terrainImmune = false;
  leader.piercing = false;
  leader.adjacentSpellImmunity = false;
  leader.statusEffect = leader.baseStats?.statusEffect;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveAttacks(addLog) {
  game.units.forEach((unit) => {
    const atkPlot = game.planned[unit.id]?.attack;
    if (!atkPlot || unit.hp <= 0 || game.planned[unit.id]?.possess || unit.attackLocked) return;
    if (unit.piercing) {
      resolvePiercingAttack(unit, atkPlot, addLog);
      return;
    }
    const target = game.units.find((t) => t.x === atkPlot.x && t.y === atkPlot.y);

    if (!target || target.id === unit.id) {
      addLog(`【空振り】${getUnitLogName(unit)}の術は空を切った...`);
      return;
    }

    if (target.owner !== unit.owner) {
      dealSpellDamage(unit, target, addLog);
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
  if (isStanceInvulnerable(target)) {
    addLog(`【無敵】${getUnitLogName(target)} は状態異常を無効化した。`, "possess");
    return;
  }
  target.status ??= {};
  if (attacker.statusEffect === "poison") {
    target.status.poison = 3;
    addLog(`【猛毒】${getUnitLogName(target)} は毒に侵された。`, "sys");
  }
  if (attacker.statusEffect === "bind") {
    if (target.status.bindImmunity > 0) {
      addLog(`【拘束耐性】${getUnitLogName(target)} は拘束を受け流した。`, "sys");
      return;
    }
    target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
    target.status.bindImmunity = GAME_CONFIG.STATUS.bind_turns + GAME_CONFIG.STATUS.bind_immunity_turns + 1;
    addLog(`【拘束】${getUnitLogName(target)} は次ターン移動できない。`, "sys");
  }
}

function applyBurn(target, addLog) {
  if (isStanceInvulnerable(target)) return;
  target.status ??= {};
  target.status.burn = 2;
  addLog(`【炎上】${getUnitLogName(target)} は炎に包まれた。`, "sys");
}

function knockbackTarget(attacker, target, addLog) {
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  const nx = target.x + dx;
  const ny = target.y + dy;
  if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) return;
  if (getBlockerAt(nx, ny)) return;
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
    unit.ougiUsedEver = true;
    unit.usedOugiNames ??= [];
    if (!unit.usedOugiNames.includes(unit.ougi)) unit.usedOugiNames.push(unit.ougi);

    if (ougiId === "s_genbu") {
      unit.invulnerable = 2;
      forArea(unit.x, unit.y, 1, (tx, ty) => {
        if (tx === unit.x && ty === unit.y) return;
        if (game.units.some((target) => target.x === tx && target.y === ty)) return;
        if (getBlockerAt(tx, ty)) return;
        game.terrain.push({ x: tx, y: ty, type: "blocked", layer: "blocker", label: "岩", temporary: 2 });
      });
      addLog("[奥義] 絶海防壁: 周囲の空きマスに一時的な岩を作りました。", "possess");
      return;
    }

    if (ougiId === "s_taijo") {
      forArea(x, y, 1, (tx, ty) => addOrReplaceArea({ x: tx, y: ty, type: "heal", layer: "area", label: "龍脈" }));
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
        applyBind(target, addLog, "青龍奥義");
      });
      addLog(`[奥義] 蒼天の雷撃: 直線上の敵${targets.length}体を貫きました。`, "atk");
      return;
    }

    if (ougiId === "s_sujaku") {
      const target = game.units.find((candidate) => candidate.x === x && candidate.y === y && candidate.owner !== unit.owner);
      if (target) dealFixedDamage(target, 8, addLog, "朱雀奥義");
      addOrReplaceArea({ x, y, type: "damage", layer: "area", label: "炎上" });
      addLog("[奥義] 煉獄の業火: 指定マスを瘴気地形にしました。", "atk");
      return;
    }

    if (ougiId === "s_byakko") {
      if (!game.units.some((target) => target.x === x && target.y === y) && !getBlockerAt(x, y)) {
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
        addBlocker({ x: tx, y: ty, type: "blocked", layer: "blocker", label: "岩" });
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
        if (isStanceInvulnerable(target)) return;
        target.status ??= {};
        applyBind(target, addLog, "神域展開");
        target.status.actionSeal = 1;
      });
      addLog(`[奥義] 神域展開: 全敵${targets.length}体を拘束しました。`, "possess");
      return;
    }

    if (ougiId === "s_taiin") {
      const target = game.units.find((candidate) =>
        candidate.x === x &&
        candidate.y === y &&
        candidate.owner !== unit.owner &&
        !candidate.isLeader &&
        !candidate.isTensho
      );
      if (target) {
        target.hp = 0;
        addLog(`[奥義] 月影の絶禍: ${target.name} を即死させました。`, "atk");
      } else {
        addLog("[奥義] 月影の絶禍: 対象となる敵の通常式神がいませんでした。", "sys");
      }
      return;
    }

    if (ougiId === "s_tenku") {
      const removedCount = game.terrain.length;
      game.terrain = [];
      addLog(`[奥義] 絶天地の陣: 地形効果を${removedCount}個消去しました。`, "possess");
      return;
    }

    if (ougiId === "s_rikugo") {
      unit.stanceActive = true;
      unit.stanceActivatedTurn = game.turn;
      unit.attackLocked = false;
      addLog("[奥義] 静と動の構え: 術使用ターンの無敵と、次ターンの術封印を得ました。", "possess");
      return;
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
      if (!game.units.some((target) => target.x === x && target.y === y) && !getBlockerAt(x, y)) {
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
  if (target.invulnerable > 0 || isStanceInvulnerable(target)) {
    addLog(`【${source}】${getUnitLogName(target)} は無敵で防いだ。`, "sys");
    return;
  }
  target.hp = Math.max(0, target.hp - amount);
  addLog(`【${source}】${getUnitLogName(target)} に${amount}ダメージ。`, "atk");
}

function applyBind(target, addLog, source = "拘束") {
  if (isStanceInvulnerable(target)) {
    addLog(`【${source}】${getUnitLogName(target)} は無敵で拘束を防いだ。`, "sys");
    return false;
  }
  target.status ??= {};
  if (target.status.bindImmunity > 0) {
    addLog(`【${source}】${getUnitLogName(target)} は拘束耐性で拘束を防いだ。`, "sys");
    return false;
  }
  target.status.bind = GAME_CONFIG.STATUS.bind_turns + 1;
  target.status.bindImmunity = GAME_CONFIG.STATUS.bind_turns + GAME_CONFIG.STATUS.bind_immunity_turns + 1;
  return true;
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

function addOrReplaceArea(tile) {
  if (getBlockerAt(tile.x, tile.y)) return;
  game.terrain = game.terrain.filter((current) => getTerrainLayer(current) === "blocker" || current.x !== tile.x || current.y !== tile.y);
  game.terrain.push({ ...tile, layer: "area" });
}

function addBlocker(tile) {
  if (getBlockerAt(tile.x, tile.y)) return;
  game.terrain.push(tile);
}

function addOrReplaceTerrain(tile) {
  if (tile.type === "blocked") addBlocker({ ...tile, layer: "blocker" });
  else addOrReplaceArea({ ...tile, layer: "area" });
}

function resolveSummons(addLog) {
  const difficulty = DIFFICULTY_CONFIG[game.difficulty] ?? DIFFICULTY_CONFIG.normal;
  const quickSummons = { player: 0, enemy: 0 };
  const regularSummons = { player: 0, enemy: 0 };
  game.plannedSummons.forEach((summon) => {
    const isOccupied = game.units.find((u) => u.x === summon.x && u.y === summon.y);
    const isBlocked = Boolean(getBlockerAt(summon.x, summon.y));
    const template = SHIKIGAMI_MASTER.find((m) => m.id === summon.templateId);
    const owner = summon.owner ?? "player";
    const leaderAlive = game.units.some((unit) => unit.owner === owner && unit.isLeader && unit.hp > 0);
    if (!leaderAlive) return;
    if (template?.summonCategory === "quick" && quickSummons[owner] >= GAME_CONFIG.SUMMON.quick_max_per_turn) {
      addLog(`【召喚失敗】速攻枠は1ターン最大${GAME_CONFIG.SUMMON.quick_max_per_turn}体までです。`, "sys");
      return;
    }
    if (template?.summonCategory !== "quick" && regularSummons[owner] >= GAME_CONFIG.SUMMON.max_per_turn) {
      addLog(`【召喚失敗】通常召喚は1ターン最大${GAME_CONFIG.SUMMON.max_per_turn}体までです。`, "sys");
      return;
    }
    const alliedShikigamiCount = game.units.filter((unit) =>
      unit.owner === owner && !unit.isLeader && unit.templateId !== "z_raiju" && unit.hp > 0
    ).length;
    if (template?.summonCategory !== "quick" && alliedShikigamiCount >= GAME_CONFIG.SUMMON.max_on_board) {
      addLog(`【召喚失敗】盤面上の式神は最大${GAME_CONFIG.SUMMON.max_on_board}体までです。`, "sys");
      return;
    }
    if (isOccupied || isBlocked) {
      addLog("【召喚失敗】その場所には既に者がおり召喚できなかった", "sys");
      return;
    }

    game.mp[owner] -= summon.cost;
    if (template.summonCategory === "quick") quickSummons[owner]++;
    else regularSummons[owner]++;
    game.unitCounter++;
    const hpBonus = owner === "enemy" ? difficulty.summonedHpBonus : 0;
    const atkBonus = owner === "enemy" ? difficulty.summonedAtkBonus : 0;
    game.units.push({
      id: `u_${game.unitCounter}`,
      templateId: template.id,
      name: template.name,
      owner,
      element: template.element,
      hp: template.hp + hpBonus,
      maxHp: template.hp + hpBonus,
      atk: template.atk + atkBonus,
      buffAtk: 0,
      reach: template.reach,
      move: template.move,
      isTensho: template.isTensho,
      tenshoAbility: template.tenshoAbility,
      ability: template.ability,
      statusEffect: template.statusEffect,
      possessionBonus: structuredClone(template.possessionBonus),
      ougi: template.ougi,
      ai: owner === "enemy"
        ? {
            pattern: "hunter",
            predictionAccuracy: difficulty.predictionAccuracy,
            targetMode: difficulty.targetMode,
            moveMode: difficulty.moveMode,
            moveAndAttack: difficulty.moveAndAttack
          }
        : undefined,
      summonedTurn: game.turn,
      prophecyTurns: 0,
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
    const tile = getAreaAt(unit.x, unit.y);
    if (tile?.type === "heal" && !unit.terrainImmune) {
      unit.hp = Math.min(unit.maxHp ?? unit.hp + GAME_CONFIG.TERRAIN.heal, unit.hp + GAME_CONFIG.TERRAIN.heal);
      game.mp[unit.owner] += GAME_CONFIG.TERRAIN.mp;
      addLog(`【龍脈】${getUnitLogName(unit)} がHP+${GAME_CONFIG.TERRAIN.heal}、呪力+${GAME_CONFIG.TERRAIN.mp}`, "heal");
    }
    if (tile?.type === "damage" && !unit.terrainImmune) {
      if (isStanceInvulnerable(unit)) {
        addLog(`【無敵】${getUnitLogName(unit)} は瘴気を無効化した。`, "possess");
      } else {
        unit.hp = Math.max(0, unit.hp - GAME_CONFIG.TERRAIN.damage);
        addLog(`【瘴気】${getUnitLogName(unit)} に${GAME_CONFIG.TERRAIN.damage}ダメージ。`, "atk");
      }
    }
    if (unit.regen) {
      unit.hp = Math.min(unit.maxHp ?? unit.hp + unit.regen, unit.hp + unit.regen);
      addLog(`【加護】${getUnitLogName(unit)} がHP+${unit.regen}回復。`, "heal");
    }
    if (unit.status?.burn > 0) {
      if (!isStanceInvulnerable(unit)) unit.hp = Math.max(0, unit.hp - 2);
      unit.status.burn--;
      addLog(isStanceInvulnerable(unit) ? `【無敵】${getUnitLogName(unit)} は炎上を無効化した。` : `【炎上】${getUnitLogName(unit)} に2ダメージ。`, isStanceInvulnerable(unit) ? "possess" : "atk");
    }
    if (unit.status?.poison > 0) {
      if (!isStanceInvulnerable(unit)) unit.hp = Math.max(0, unit.hp - GAME_CONFIG.STATUS.poison_damage);
      unit.status.poison--;
      addLog(isStanceInvulnerable(unit) ? `【無敵】${getUnitLogName(unit)} は猛毒を無効化した。` : `【猛毒】${getUnitLogName(unit)} に${GAME_CONFIG.STATUS.poison_damage}ダメージ。`, isStanceInvulnerable(unit) ? "possess" : "atk");
    }
    if (unit.status?.bind > 0) unit.status.bind--;
    if (unit.status?.bindImmunity > 0) unit.status.bindImmunity--;
    if (unit.status?.actionSeal > 0) unit.status.actionSeal--;
    if (unit.invulnerable > 0) unit.invulnerable--;
  });
  resolveKudanProphecies(addLog);
  game.terrain = game.terrain
    .map((tile) => tile.temporary ? { ...tile, temporary: tile.temporary - 1 } : tile)
    .filter((tile) => tile.temporary === undefined || tile.temporary > 0);
}

function resolveKudanProphecies(addLog) {
  game.units.forEach((unit) => {
    if (unit.templateId !== "z_kudan" || unit.hp <= 0) return;
    unit.prophecyTurns = (unit.prophecyTurns ?? 0) + 1;
    if (unit.prophecyTurns < 2) return;

    const targets = game.units.filter((target) => target.owner !== unit.owner && target.hp > 0);
    targets.forEach((target) => {
      if (isStanceInvulnerable(target)) {
        addLog(`【無敵】${getUnitLogName(target)} は凶事の予言を無効化した。`, "possess");
        return;
      }
      target.hp = Math.max(0, target.hp - 3);
      addLog(`【凶事の予言】${getUnitLogName(target)}に防御無視の3ダメージ。`, "atk");
    });
    unit.hp = 0;
    addLog(`【凶事の予言】${getUnitLogName(unit)}は予言を成就し、消滅した。`, "sys");
  });
}

function resolvePiercingAttack(unit, atkPlot, addLog) {
  const dx = Math.sign(atkPlot.x - unit.x);
  const dy = Math.sign(atkPlot.y - unit.y);
  if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) {
    addLog(`【空振り】${getUnitLogName(unit)}の貫通術は直線を捉えられなかった...`);
    return;
  }

  const targets = game.units
    .filter((target) => target.owner !== unit.owner && target.hp > 0)
    .filter((target) => {
      const tx = target.x - unit.x;
      const ty = target.y - unit.y;
      if (dx === 0) return tx === 0 && Math.sign(ty) === dy;
      return ty === 0 && Math.sign(tx) === dx;
    })
    .sort((a, b) => Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y) - Math.abs(b.x - unit.x) - Math.abs(b.y - unit.y));

  if (targets.length === 0) {
    addLog(`【空振り】${getUnitLogName(unit)}の貫通術は敵を捉えられなかった...`);
    return;
  }
  targets.forEach((target) => dealSpellDamage(unit, target, addLog));
}

function dealSpellDamage(unit, target, addLog) {
  const distance = Math.max(Math.abs(unit.x - target.x), Math.abs(unit.y - target.y));
  let dmg = getEffectiveStats(unit).effAtk;
  let msg = "";
  if (isStanceInvulnerable(target)) {
    dmg = 0;
    msg = "(静と動の構え)";
  } else if (target.adjacentSpellImmunity && distance <= 1) {
    dmg = 0;
    msg = "(絶対領域)";
  } else {
    if (ELEMENT_WEAK[unit.element] === target.element) {
      dmg = Math.floor(dmg * GAME_CONFIG.DAMAGE.weak_multiplier);
      msg = "(弱点!)";
    } else if (ELEMENT_BOOST[unit.element] === target.element && !unit.ignoreResist) {
      dmg = Math.floor(dmg * GAME_CONFIG.DAMAGE.resist_multiplier);
      msg = "(軽減...)";
    }
    dmg = applyDamageReduction(target, dmg);
    if (target.damageVulnerability) dmg += target.damageVulnerability;
  }

  target.hp = Math.max(0, target.hp - dmg);
  if (unit.isLeader && dmg > 0) game.turnFlags.leaderDamagedEnemy[unit.owner] = true;
  if (dmg > 0 || unit.statusEffect) applyStatusEffect(unit, target, addLog);
  if (dmg > 0) {
    if (unit.burnOnHit) applyBurn(target, addLog);
    if (unit.knockback) knockbackTarget(unit, target, addLog);
  }
  addLog(`【攻撃】${getUnitLogName(unit)} → ${getUnitLogName(target)}に ${dmg}ダメージ ${msg}`, "atk");
}

function isStanceInvulnerable(unit) {
  return Boolean(unit.stanceActive && game.planned[unit.id]?.attack && !unit.attackLocked);
}

function updateStanceAttackLocks() {
  game.units.forEach((unit) => {
    if (!unit.stanceActive) return;
    if (unit.attackLocked) {
      unit.attackLocked = false;
      return;
    }
    if (game.turn > (unit.stanceActivatedTurn ?? 0) && game.planned[unit.id]?.attack) {
      unit.attackLocked = true;
    }
  });
}

function applyDamageReduction(target, amount) {
  let reduction = target.damageReduction ?? 0;
  const guardedByKarakasa = game.units.some((unit) =>
    unit.owner === target.owner &&
    unit.templateId === "z_karakasa" &&
    unit.hp > 0 &&
    unit.summonedTurn === game.turn &&
    Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y) === 1
  );
  if (guardedByKarakasa) reduction += 2;
  return Math.max(0, amount - reduction);
}

export function getTerrainAt(x, y) {
  return getBlockerAt(x, y) ?? getAreaAt(x, y);
}

export function getBlockerAt(x, y) {
  return game.terrain.find((tile) => tile.x === x && tile.y === y && getTerrainLayer(tile) === "blocker");
}

export function getAreaAt(x, y) {
  return game.terrain.find((tile) => tile.x === x && tile.y === y && getTerrainLayer(tile) === "area");
}

function getTerrainLayer(tile) {
  if (tile.layer) return tile.layer;
  return tile.type === "blocked" ? "blocker" : "area";
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
