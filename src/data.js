export const BOARD_SIZE = 7;

export const GAME_CONFIG = {
  MP_REWARD: { move: 1, risk_zone: 1, turn_end: 0, line_push: 1, leader_hit: 1 },
  DAMAGE: { weak_multiplier: 1.5, resist_multiplier: 0.5, collision: 2 },
  BUFF: { atk_boost: 3 },
  STATUS: { poison_damage: 1, bind_turns: 1, bind_immunity_turns: 2 },
  TERRAIN: { heal: 2, damage: 1, mp: 1 },
  SUMMON: { max_per_turn: 2, cooldown_turns: 1 }
};

export const ELEMENT_WEAK = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
export const ELEMENT_BOOST = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

export const OUGI_EFFECTS = {
  絶海防壁: "周囲の空きマスに一時的な岩を作り、自身に短時間の無敵を付与。",
  聖域化: "指定地点の周囲を龍脈地形に変える。",
  幻惑の乗っ取り: "敵の通常式神1体を味方にする。",
  蒼天の雷撃: "自身から指定方向の直線上にいる敵へ固定ダメージを与え、拘束を狙う。",
  煉獄の業火: "指定した敵へ大ダメージを与え、そのマスを瘴気地形に変える。",
  迅雷風烈: "指定した空きマスへ移動し、周囲の敵へ固定ダメージを与える。",
  地殻変動: "指定地点と十字方向の空きマスを岩に変える。",
  焦熱地獄: "敵全体へ固定ダメージを与える。",
  神域展開: "敵全体に拘束と行動封印を付与する。"
};

export const SHIKIGAMI_MASTER = [
  { id: "z_onibi", name: "鬼火", element: "火", hp: 4, atk: 2, reach: 1, move: 1, cost: 1, isTensho: false, desc: "基本アタッカー", possessionBonus: { atk: 1, label: "攻撃力+1" } },
  { id: "z_kodama", name: "木霊", element: "木", hp: 5, atk: 1, reach: 1, move: 1, cost: 1, isTensho: false, desc: "陣取り要員", possessionBonus: { regen: 1, label: "ターン終了時HP+1回復" } },
  { id: "z_dorotabo", name: "泥田坊", element: "土", hp: 8, atk: 1, reach: 1, move: 1, cost: 1, isTensho: false, desc: "高HPの壁役", possessionBonus: { maxHp: 3, currentHp: 3, label: "最大HP+3 / 現在HP+3" } },
  { id: "z_kappa", name: "河童", element: "水", hp: 6, atk: 2, reach: 1, move: 1, cost: 2, isTensho: false, desc: "標準", possessionBonus: { atk: 1, maxHp: 1, label: "攻撃力+1 / 最大HP+1" } },
  { id: "z_yukionna", name: "雪女", element: "水", hp: 5, atk: 2, reach: 2, move: 1, cost: 2, isTensho: false, desc: "遠距離攻撃", possessionBonus: { reach: 1, label: "射程+1" } },
  { id: "z_wanyudo", name: "輪入道", element: "火", hp: 4, atk: 4, reach: 1, move: 1, cost: 2, isTensho: false, desc: "近接火力", possessionBonus: { atk: 2, damageVulnerability: 1, label: "攻撃力+2 / 受けるダメージ+1" } },
  { id: "z_kyoki", name: "狂骨", element: "金", hp: 4, atk: 5, reach: 1, move: 1, cost: 2, isTensho: false, desc: "捨て身の火力", possessionBonus: { atk: 3, currentHp: -2, label: "攻撃力+3 / 現在HP-2" } },
  { id: "z_nurikabe", name: "塗壁", element: "土", hp: 12, atk: 1, reach: 1, move: 0, cost: 2, isTensho: false, desc: "移動不可のタンク", possessionBonus: { damageReduction: 1, moveSet: 0, label: "受けるダメージ-1 / 機動力0" } },
  { id: "z_chin", name: "鴆", element: "木", hp: 4, atk: 1, reach: 2, move: 1, cost: 2, isTensho: false, statusEffect: "poison", desc: "術命中で猛毒", possessionBonus: { statusEffect: "poison", label: "術ダメージ時に猛毒付与" } },
  { id: "z_kamaitachi", name: "鎌鼬", element: "金", hp: 2, atk: 2, reach: 2, move: 2, cost: 2, isTensho: false, desc: "高機動の奇襲", possessionBonus: { move: 1, currentHp: -1, label: "機動力+1 / 現在HP-1" } },
  { id: "z_tengu", name: "烏天狗", element: "木", hp: 6, atk: 3, reach: 1, move: 2, cost: 3, isTensho: false, desc: "高機動の遊撃手", possessionBonus: { move: 1, label: "機動力+1" } },
  { id: "z_jorogumo", name: "絡新婦", element: "水", hp: 3, atk: 0, reach: 3, move: 1, cost: 3, isTensho: false, statusEffect: "bind", desc: "術命中で拘束", possessionBonus: { statusEffect: "bind", label: "術ダメージ時に拘束付与" } },
  { id: "z_raiju", name: "雷獣", element: "火", hp: 2, atk: 0, reach: 0, move: 4, cost: 0, isTensho: false, desc: "衝突判定のみで戦う高速式神", possessionBonus: { label: "ボーナスなし" } },
  { id: "s_genbu", name: "玄武", element: "水", hp: 15, atk: 2, reach: 1, move: 0, cost: 6, isTensho: true, tenshoAbility: "hp", ougi: "絶海防壁", desc: "憑依:防御とHP強化", possessionBonus: { damageReduction: 1, maxHp: 5, currentHp: 5, label: "受けるダメージ-1 / 最大HP+5 / 現在HP+5" } },
  { id: "s_taijo", name: "太常", element: "土", hp: 12, atk: 4, reach: 2, move: 1, cost: 6, isTensho: true, tenshoAbility: "regen", ougi: "聖域化", desc: "憑依:継続回復とHP強化", possessionBonus: { regen: 3, maxHp: 5, label: "ターン終了時HP+3回復 / 最大HP+5" } },
  { id: "s_tenko", name: "天后", element: "水", hp: 6, atk: 2, reach: 3, move: 1, cost: 6, isTensho: true, tenshoAbility: "knockback", ougi: "幻惑の乗っ取り", desc: "憑依:攻撃とノックバック", possessionBonus: { atk: 1, knockback: true, label: "攻撃力+1 / 術ダメージ時に1マスノックバック" } },
  { id: "s_seiryu", name: "青龍", element: "木", hp: 12, atk: 5, reach: 2, move: 1, cost: 7, isTensho: true, tenshoAbility: "reach", ougi: "蒼天の雷撃", desc: "憑依:攻撃と射程強化", possessionBonus: { atk: 2, reach: 1, label: "攻撃力+2 / 射程+1" } },
  { id: "s_sujaku", name: "朱雀", element: "火", hp: 7, atk: 4, reach: 2, move: 2, cost: 7, isTensho: true, tenshoAbility: "balance", ougi: "煉獄の業火", desc: "憑依:攻撃と炎上付与", possessionBonus: { atk: 3, burnOnHit: true, label: "攻撃力+3 / 術ダメージ時に炎上付与" } },
  { id: "s_byakko", name: "白虎", element: "金", hp: 10, atk: 7, reach: 1, move: 1, cost: 7, isTensho: true, tenshoAbility: "bruiser", ougi: "迅雷風烈", desc: "憑依:攻撃と機動強化", possessionBonus: { atk: 3, move: 1, label: "攻撃力+3 / 機動力+1" } },
  { id: "s_kochin", name: "勾陣", element: "土", hp: 15, atk: 3, reach: 2, move: 1, cost: 7, isTensho: true, tenshoAbility: "guard", ougi: "地殻変動", desc: "憑依:HP強化と地形無効", possessionBonus: { maxHp: 10, currentHp: 10, terrainImmune: true, label: "最大HP+10 / 現在HP+10 / 地形効果を受けない" } },
  { id: "s_touda", name: "騰蛇", element: "火", hp: 8, atk: 6, reach: 3, move: 1, cost: 8, isTensho: true, tenshoAbility: "atk_max", ougi: "焦熱地獄", desc: "憑依:大火力と不利軽減無視", possessionBonus: { atk: 5, ignoreResist: true, label: "攻撃力+5 / 属性不利のダメージ減衰を無視" } },
  { id: "s_kijin", name: "貴人", element: "土", hp: 12, atk: 6, reach: 2, move: 1, cost: 8, isTensho: true, tenshoAbility: "kijin", ougi: "神域展開", desc: "憑依:攻撃と拘束付与", possessionBonus: { atk: 3, statusEffect: "bind", label: "攻撃力+3 / 術ダメージ時に拘束付与" } }
];

export const FIELD_TILES = [
  { x: 1, y: 3, type: "blocked", label: "岩" },
  { x: 5, y: 3, type: "blocked", label: "岩" },
  { x: 3, y: 3, type: "heal", label: "龍脈" },
  { x: 0, y: 2, type: "damage", label: "瘴気" },
  { x: 6, y: 4, type: "damage", label: "瘴気" }
];

export const INITIAL_UNITS = [
  { id: "p_leader", name: "陰陽師", owner: "player", element: "無", hp: 20, atk: 2, buffAtk: 0, x: 3, y: 6, reach: 1, move: 1, isLeader: true },
  {
    id: "e_leader",
    name: "ケガレ",
    owner: "enemy",
    element: "無",
    hp: 25,
    atk: 3,
    buffAtk: 0,
    x: 3,
    y: 0,
    reach: 1,
    move: 1,
    isLeader: true,
    ai: { pattern: "summoner", predictionAccuracy: 0.8, summonPool: ["z_onibi", "z_dorotabo"], summonLimit: 3 }
  },
  { id: "u1", name: "前鬼", owner: "player", element: "木", hp: 10, atk: 4, buffAtk: 0, x: 2, y: 5, reach: 1, move: 1, isTensho: false },
  { id: "u2", name: "後鬼", owner: "enemy", element: "水", hp: 10, atk: 4, buffAtk: 0, x: 4, y: 1, reach: 2, move: 1, isTensho: false, ai: { pattern: "hunter", predictionAccuracy: 0.55 } }
];
