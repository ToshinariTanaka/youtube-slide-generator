# プロジェクト状況

## 現在の状態

- 初期版の静的Webアプリを実装済みです。
- 説明文の段落分割、画像アップロード、3テンプレートのスライド生成、PNG保存に対応しています。
- スライド生成処理は、クリックイベントから `createSlideDataList`、`renderSlides` へ1回ずつ流れる構成に整理済みです。
- スライドごとのツールバー生成は `createSlideToolbar` に集約済みです。
- `index.html`、`style.css`、`script.js` が同じ階層にある場合、`index.html` を直接開いてもCSSとアプリ本体のJavaScriptが読み込まれるように、相対パスを `./style.css` と `./script.js` で明示しています。

## 動作方法

ブラウザで `index.html` を直接開くか、以下のようにローカルサーバーを起動して確認します。直接開く場合も、CSSとアプリ本体のJavaScriptは同階層のローカルファイルから読み込まれます。

```bash
python3 -m http.server 4173
```

その後、`http://127.0.0.1:4173/` を開きます。

## 既知の注意点

- CSSとアプリ本体のJavaScriptはローカル同階層ファイルから読み込みます。
- PNG保存には `html2canvas` のCDN読み込みが必要です。オフラインで `index.html` を直接開いた場合、スライド生成はできますがPNG保存は動かない可能性があります。
- 段落分割は単純な空行区切りです。
- 一括保存はブラウザのダウンロード制限を受ける場合があります。

## 最新の整理内容

- 今回の整理で、`renderSlides` 内のツールバー生成を `createSlideToolbar` に一本化しました。
- `createSlideDataList` 内に到達不能な旧 `return` が残っていないことを確認しました。
- READMEのファイル構成は、現行リポジトリに存在する主要ファイルに合わせて整理済みです。
