export const BOARD_SIZE = 7;

export const GAME_CONFIG = {
  MP_REWARD: { move: 1, risk_zone: 1, turn_end: 0 },
  DAMAGE: { weak_multiplier: 1.5, resist_multiplier: 0.5, collision: 2 },
  BUFF: { atk_boost: 3 }
};

export const ELEMENT_WEAK = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
export const ELEMENT_BOOST = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

export const SHIKIGAMI_MASTER = [
  { id: "z_onibi", name: "鬼火", element: "火", hp: 4, atk: 2, reach: 1, cost: 1, isTensho: false, desc: "低コスト" },
  { id: "z_dorotabo", name: "泥田坊", element: "土", hp: 8, atk: 1, reach: 1, cost: 1, isTensho: false, desc: "低コスト・耐久" },
  { id: "z_kodama", name: "木霊", element: "木", hp: 5, atk: 1, reach: 1, cost: 1, isTensho: false, desc: "低コスト" },
  { id: "z_kappa", name: "河童", element: "水", hp: 6, atk: 2, reach: 1, cost: 2, isTensho: false, desc: "標準" },
  { id: "z_kamaitachi", name: "鎌鼬", element: "金", hp: 4, atk: 3, reach: 2, cost: 2, isTensho: false, desc: "射程2" },
  { id: "z_nurikabe", name: "塗壁", element: "土", hp: 12, atk: 1, reach: 1, cost: 2, isTensho: false, desc: "高耐久の壁" },
  { id: "z_yukionna", name: "雪女", element: "水", hp: 5, atk: 2, reach: 2, cost: 2, isTensho: false, desc: "遠距離攻撃" },
  { id: "z_wanyudo", name: "輪入道", element: "火", hp: 4, atk: 4, reach: 1, cost: 2, isTensho: false, desc: "攻撃特化" },
  { id: "z_tengu", name: "烏天狗", element: "木", hp: 6, atk: 3, reach: 2, cost: 3, isTensho: false, desc: "高機動・射程2" },
  { id: "z_kyoki", name: "狂骨", element: "金", hp: 4, atk: 5, reach: 1, cost: 2, isTensho: false, desc: "捨て身の火力" },
  { id: "s_seiryu", name: "青龍", element: "木", hp: 12, atk: 5, reach: 2, cost: 3, isTensho: true, tenshoAbility: "reach", desc: "憑依:射程+1" },
  { id: "s_genbu", name: "玄武", element: "水", hp: 15, atk: 2, reach: 1, cost: 3, isTensho: true, tenshoAbility: "hp", desc: "憑依:HP+10" },
  { id: "s_touda", name: "騰蛇", element: "火", hp: 8, atk: 6, reach: 3, cost: 4, isTensho: true, tenshoAbility: "atk_max", desc: "憑依:攻+5" },
  { id: "s_byakko", name: "白虎", element: "金", hp: 10, atk: 7, reach: 1, cost: 4, isTensho: true, tenshoAbility: "bruiser", desc: "憑依:攻+3/HP+6" },
  { id: "s_sujaku", name: "朱雀", element: "火", hp: 10, atk: 5, reach: 2, cost: 4, isTensho: true, tenshoAbility: "balance", desc: "憑依:攻+2/HP+5" },
  { id: "s_kijin", name: "貴人", element: "土", hp: 12, atk: 6, reach: 2, cost: 4, isTensho: true, tenshoAbility: "kijin", desc: "憑依:攻+3/HP+5" }
];

export const INITIAL_UNITS = [
  { id: "p_leader", name: "陰陽師", owner: "player", element: "無", hp: 20, atk: 2, buffAtk: 0, x: 3, y: 6, reach: 1, isLeader: true },
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
    isLeader: true,
    ai: { pattern: "summoner", predictionAccuracy: 0.8, summonPool: ["z_onibi", "z_dorotabo"], summonLimit: 3 }
  },
  { id: "u1", name: "前鬼", owner: "player", element: "木", hp: 10, atk: 4, buffAtk: 0, x: 2, y: 5, reach: 1, isTensho: false },
  { id: "u2", name: "後鬼", owner: "enemy", element: "水", hp: 10, atk: 4, buffAtk: 0, x: 4, y: 1, reach: 2, isTensho: false, ai: { pattern: "hunter", predictionAccuracy: 0.55 } }
];
