# 陰陽盤上戦記 プロトタイプ

大学サークルへの企画提出・人員募集に使うための、ブラウザ実行できるプロトタイプです。

## 現在の目的

- 同時プロット制の手触りを確認する
- 五行相性、召喚、憑依が戦術として機能するか検証する
- 移動・術・召喚の候補マスを表示し、初見でも操作しやすくする
- 敵の行動予測を表示し、読み合いを分かりやすくする
- 敵ごとの予測精度と行動パターンを持たせ、追跡型・召喚型などの差を検証する
- 予約表示に行動元のユニット名を出し、ターン解決を段階的に見せる
- Unityへ移行する前に、ゲームルールの核を固める

## 実行方法

Node.jsが入っている環境では、以下で起動できます。

```bash
npm run dev
```

起動後、ブラウザで `http://127.0.0.1:5173/` を開きます。

VS Codeを使う場合は、Live Server拡張で `index.html` を開いても開発できます。

## ファイル構成

```text
.
├── index.html
├── package.json
├── server.mjs
├── styles.css
└── src
    ├── main.js
    ├── data.js
    ├── state.js
    ├── deck.js
    ├── battle.js
    ├── rules.js
    └── ui.js
```

## 役割

- `data.js`: 式神、初期配置、盤面サイズ、五行相性などのマスターデータ
- `state.js`: 現在のゲーム状態
- `rules.js`: ターン解決、衝突、攻撃、憑依、召喚などのルール処理
- `ui.js`: 画面描画、ログ、結果表示
- `deck.js`: デッキ編成画面
- `battle.js`: バトル画面の入力処理
- `main.js`: 画面遷移と初期化

## Unity移行を見据えた考え方

今はブラウザで高速に検証し、ルールが固まったらUnityへ移植します。
そのため、表示処理とゲームルールを分けています。

Unity移行時の対応イメージ:

- `data.js` → ScriptableObject / JSON
- `state.js` → GameManager / BattleState
- `rules.js` → C#のTurnResolver
- `ui.js` → Unity UI / Canvas
- `battle.js` → InputController / BoardController
