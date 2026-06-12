import { DIFFICULTY_CONFIG, FIELD_TILES, INITIAL_UNITS } from "./data.js";

export const game = {
  playerDeckIds: [],
  difficulty: "normal",
  units: [],
  terrain: [],
  mp: { player: 0, enemy: 0 },
  uiState: "IDLE",
  activeUnitId: null,
  planned: {},
  plannedSummons: [],
  selectedSummonTemplate: null,
  unitCounter: INITIAL_UNITS.length,
  turn: 1,
  isResolving: false,
  skipResolution: false,
  resolutionPhase: "",
  turnFlags: { leaderDamagedEnemy: { player: false, enemy: false } }
};

export function resetBattleState() {
  const difficulty = DIFFICULTY_CONFIG[game.difficulty] ?? DIFFICULTY_CONFIG.normal;
  game.units = structuredClone(INITIAL_UNITS).map((unit) => ({
    ...unit,
    maxHp: unit.maxHp ?? unit.hp,
    baseStats: unit.isLeader
      ? { hp: unit.maxHp ?? unit.hp, atk: unit.atk, reach: unit.reach, move: unit.move ?? 1, statusEffect: unit.statusEffect }
      : undefined
  }));
  game.units.forEach((unit) => {
    if (unit.owner !== "enemy") return;
    const stats = unit.isLeader ? difficulty.enemyLeader : difficulty.enemyUnit;
    unit.hp = stats.hp;
    unit.maxHp = stats.hp;
    unit.atk = stats.atk;
    unit.ai = {
      ...(unit.ai ?? {}),
      predictionAccuracy: difficulty.predictionAccuracy,
      targetMode: difficulty.targetMode,
      moveMode: difficulty.moveMode,
      moveAndAttack: difficulty.moveAndAttack,
      summonInterval: difficulty.summonInterval,
      summonLimit: difficulty.summonLimit,
      summonPool: difficulty.summonPool
    };
    if (unit.isLeader) unit.baseStats = { hp: stats.hp, atk: stats.atk, reach: unit.reach, move: unit.move ?? 1, statusEffect: unit.statusEffect };
  });
  game.terrain = structuredClone(FIELD_TILES);
  game.mp = { player: 2, enemy: difficulty.enemyStartMp };
  game.uiState = "IDLE";
  game.activeUnitId = null;
  game.planned = {};
  game.plannedSummons = [];
  game.selectedSummonTemplate = null;
  game.unitCounter = INITIAL_UNITS.length;
  game.turn = 1;
  game.isResolving = false;
  game.skipResolution = false;
  game.resolutionPhase = "";
  game.turnFlags = { leaderDamagedEnemy: { player: false, enemy: false } };
}

export function setDifficulty(difficultyId) {
  if (!DIFFICULTY_CONFIG[difficultyId]) return false;
  game.difficulty = difficultyId;
  return true;
}
