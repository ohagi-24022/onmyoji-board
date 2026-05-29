import { FIELD_TILES, INITIAL_UNITS } from "./data.js";

export const game = {
  playerDeckIds: [],
  units: [],
  terrain: [],
  mp: { player: 0, enemy: 0 },
  uiState: "IDLE",
  activeUnitId: null,
  planned: {},
  plannedSummons: [],
  selectedSummonTemplate: null,
  summonCooldown: { player: 0, enemy: 0 },
  unitCounter: INITIAL_UNITS.length,
  turn: 1,
  isResolving: false,
  skipResolution: false,
  resolutionPhase: "",
  turnFlags: { leaderDamagedEnemy: { player: false, enemy: false } }
};

export function resetBattleState() {
  game.units = structuredClone(INITIAL_UNITS).map((unit) => ({
    ...unit,
    maxHp: unit.maxHp ?? unit.hp,
    baseStats: unit.isLeader
      ? { hp: unit.maxHp ?? unit.hp, atk: unit.atk, reach: unit.reach, move: unit.move ?? 1, statusEffect: unit.statusEffect }
      : undefined
  }));
  game.terrain = structuredClone(FIELD_TILES);
  game.mp = { player: 5, enemy: 5 };
  game.uiState = "IDLE";
  game.activeUnitId = null;
  game.planned = {};
  game.plannedSummons = [];
  game.selectedSummonTemplate = null;
  game.summonCooldown = { player: 0, enemy: 0 };
  game.unitCounter = INITIAL_UNITS.length;
  game.turn = 1;
  game.isResolving = false;
  game.skipResolution = false;
  game.resolutionPhase = "";
  game.turnFlags = { leaderDamagedEnemy: { player: false, enemy: false } };
}
