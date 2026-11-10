# Chrome ウェブストアの掲載内容

デベロッパーダッシュボードの各欄に貼る文面をまとめています。

## パッケージ

- アップロードするファイルは`dist/select-mosaic-<version>.zip`です。`scripts/build.sh`で作ります。

## ストアの掲載情報

### 共通

| 欄 | 値 |
|---|---|
| カテゴリ | 仕事効率化（Productivity）の中のツール（Tools） |
| 言語 | 英語（既定）、日本語 |
| ホームページのURL | https://github.com/konaito/select-mosaic |
| サポートのURL | https://github.com/konaito/select-mosaic/issues |
| アイコン | `icons/icon128.png` |

### 英語（既定）

名前と概要は`_locales/en/messages.json`から自動で入ります。

説明:

```
Blur anything on a web page before you take a screenshot or share your screen.

• Text mode: select text by dragging, double-clicking, or selecting all, and it gets blurred right away.
• Element mode: hover to highlight an element, click to blur it, click again to remove the blur.
• Always blur: save words such as your email address, name, or API key. Every match on the page is blurred, including content that loads later. Click a saved word to turn it on or off, or remove it from the list.

Blur you add by hand disappears when you reload the page. Press Esc or Stop to end a mode.

Privacy: no data collection and no network requests. Your saved words stay in your browser. The source code is on GitHub under the MIT license.
```

スクリーンショット（1280×800）: `store/en-1-text.png`、`store/en-2-words.png`、`store/en-3-element.png`
小さいプロモーション タイル（440×280）: `store/en-tile-440x280.png`

### 日本語

名前と概要は`_locales/ja/messages.json`から自動で入ります。

説明:

```
スクリーンショットや画面共有の前に、ページの文字をその場でぼかします。

・文字モード：ドラッグ、ダブルクリック、全選択で選んだ文字がすぐにぼけます。
・要素モード：マウスを乗せた要素が枠で囲まれ、クリックするとぼけます。もう一度クリックすると外れます。
・常にぼかす文字：メールアドレス、名前、APIキーなどを登録すると、ページ内で見つかった場所がすべてぼけます。後から表示された部分にも当たります。一覧の文字を押すとオンとオフが切り替わり、×で消せます。

手でかけたぼかしは、ページを更新すると消えます。Esc か「停止」でモードを終えます。

プライバシー：データを集めず、通信もしません。登録した文字はお使いのブラウザの中だけに残ります。ソースコードは MIT ライセンスで GitHub に公開しています。
```

スクリーンショット（1280×800）: `store/ja-1-text.png`、`store/ja-2-words.png`、`store/ja-3-element.png`
小さいプロモーション タイル（440×280）: `store/ja-tile-440x280.png`

## プライバシーへの取り組み

### 単一用途の説明

```
Blur text and elements on web pages so users can hide personal information before taking screenshots or sharing their screen.
```

### 権限が必要な理由

| 権限 | 説明（英語で貼る） |
|---|---|
| activeTab | Injects the blurring script into the current tab only when the user opens the popup or uses the context menu. |
| scripting | Runs the content script that wraps selected text or clicked elements and applies a CSS blur. |
| storage | Saves the user's "Always blur" word list and its on/off states locally in chrome.storage.local. |
| contextMenus | Adds an "Always blur" item to the right-click menu for selected text. |

### リモートコード

いいえ。リモートコードは使っていません。

### データの使用

収集するデータの項目には、どれにもチェックを入れません。
3つの宣言（第三者への販売や譲渡をしない、単一用途と関係のない目的に使わない、信用力の判断や融資の目的に使わない）にはチェックを入れます。

### プライバシーポリシーのURL

```
https://konaito.github.io/select-mosaic/privacy.html
```
