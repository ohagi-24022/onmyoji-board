export const BOARD_SIZE = 7;

export const GAME_CONFIG = {
  MP_REWARD: { move: 1, risk_zone: 1, turn_end: 0, line_push: 1, leader_hit: 1 },
  DAMAGE: { weak_multiplier: 1.5, resist_multiplier: 0.5, collision: 2 },
  BUFF: { atk_boost: 3 },
  STATUS: { poison_damage: 1, bind_turns: 1, bind_immunity_turns: 2 },
  TERRAIN: { heal: 2, damage: 1, mp: 1 }
};

export const ELEMENT_WEAK = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
export const ELEMENT_BOOST = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

export const SHIKIGAMI_MASTER = [
  { id: "z_onibi", name: "鬼火", element: "火", hp: 4, atk: 2, reach: 1, move: 1, cost: 1, isTensho: false, desc: "基本アタッカー" },
  { id: "z_kodama", name: "木霊", element: "木", hp: 5, atk: 1, reach: 1, move: 1, cost: 1, isTensho: false, desc: "陣取り要員" },
  { id: "z_dorotabo", name: "泥田坊", element: "土", hp: 8, atk: 1, reach: 1, move: 1, cost: 1, isTensho: false, desc: "高HPの壁役" },
  { id: "z_kappa", name: "河童", element: "水", hp: 6, atk: 2, reach: 1, move: 1, cost: 2, isTensho: false, desc: "標準" },
  { id: "z_yukionna", name: "雪女", element: "水", hp: 5, atk: 2, reach: 2, move: 1, cost: 2, isTensho: false, desc: "遠距離攻撃" },
  { id: "z_wanyudo", name: "輪入道", element: "火", hp: 4, atk: 4, reach: 1, move: 1, cost: 2, isTensho: false, desc: "近接火力" },
  { id: "z_kyoki", name: "狂骨", element: "金", hp: 4, atk: 5, reach: 1, move: 1, cost: 2, isTensho: false, desc: "捨て身の火力" },
  { id: "z_nurikabe", name: "塗壁", element: "土", hp: 12, atk: 1, reach: 1, move: 0, cost: 2, isTensho: false, desc: "移動不可のタンク" },
  { id: "z_chin", name: "鴆", element: "木", hp: 4, atk: 1, reach: 2, move: 1, cost: 2, isTensho: false, statusEffect: "poison", desc: "術命中で猛毒" },
  { id: "z_kamaitachi", name: "鎌鼬", element: "金", hp: 2, atk: 2, reach: 2, move: 2, cost: 2, isTensho: false, desc: "高機動の奇襲" },
  { id: "z_tengu", name: "烏天狗", element: "木", hp: 6, atk: 3, reach: 1, move: 2, cost: 3, isTensho: false, desc: "高機動の遊撃手" },
  { id: "z_jorogumo", name: "絡新婦", element: "水", hp: 3, atk: 0, reach: 3, move: 1, cost: 3, isTensho: false, statusEffect: "bind", desc: "術命中で拘束" },
  { id: "z_raiju", name: "雷獣", element: "火", hp: 2, atk: 0, reach: 0, move: 4, cost: 0, isTensho: false, desc: "衝突判定のみで戦う高速式神" },
  { id: "s_genbu", name: "玄武", element: "水", hp: 15, atk: 2, reach: 1, move: 0, cost: 6, isTensho: true, tenshoAbility: "hp", ougi: "絶海防壁", desc: "憑依:HP+10" },
  { id: "s_taijo", name: "太常", element: "土", hp: 12, atk: 4, reach: 2, move: 1, cost: 6, isTensho: true, tenshoAbility: "regen", ougi: "聖域化", desc: "憑依:毎ターンHP+3" },
  { id: "s_tenko", name: "天后", element: "水", hp: 6, atk: 2, reach: 3, move: 1, cost: 6, isTensho: true, tenshoAbility: "knockback", ougi: "幻惑の乗っ取り", desc: "憑依:術命中で後退" },
  { id: "s_seiryu", name: "青龍", element: "木", hp: 12, atk: 5, reach: 2, move: 1, cost: 7, isTensho: true, tenshoAbility: "reach", ougi: "蒼天の雷撃", desc: "憑依:射程+1" },
  { id: "s_sujaku", name: "朱雀", element: "火", hp: 7, atk: 4, reach: 2, move: 2, cost: 7, isTensho: true, tenshoAbility: "balance", ougi: "煉獄の業火", desc: "憑依:攻+2/HP+5" },
  { id: "s_byakko", name: "白虎", element: "金", hp: 10, atk: 7, reach: 1, move: 1, cost: 7, isTensho: true, tenshoAbility: "bruiser", ougi: "迅雷風烈", desc: "憑依:攻+3/HP+6" },
  { id: "s_kochin", name: "勾陣", element: "土", hp: 15, atk: 3, reach: 2, move: 1, cost: 7, isTensho: true, tenshoAbility: "guard", ougi: "地殻変動", desc: "憑依:ダメージ1軽減" },
  { id: "s_touda", name: "騰蛇", element: "火", hp: 8, atk: 6, reach: 3, move: 1, cost: 8, isTensho: true, tenshoAbility: "atk_max", ougi: "焦熱地獄", desc: "憑依:攻+5" },
  { id: "s_kijin", name: "貴人", element: "土", hp: 12, atk: 6, reach: 2, move: 1, cost: 8, isTensho: true, tenshoAbility: "kijin", ougi: "神域展開", desc: "憑依:攻+3/HP+5" }
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
