import { INITIAL_UNITS } from "./data.js";

export const game = {
  playerDeckIds: [],
  units: [],
  mp: { player: 0, enemy: 0 },
  uiState: "IDLE",
  activeUnitId: null,
  planned: {},
  plannedSummons: [],
  selectedSummonTemplate: null,
  unitCounter: INITIAL_UNITS.length,
  turn: 1
};

export function resetBattleState() {
  game.units = structuredClone(INITIAL_UNITS);
  game.mp = { player: 5, enemy: 5 };
  game.uiState = "IDLE";
  game.activeUnitId = null;
  game.planned = {};
  game.plannedSummons = [];
  game.selectedSummonTemplate = null;
  game.unitCounter = INITIAL_UNITS.length;
  game.turn = 1;
}
