# Podcast Public Sound Generator

このアプリケーションは、ポッドキャスト音源にBGMを重ねてダウンロードできる簡易Flaskアプリです。

## 使い方
1. `bgm/` フォルダーにBGMのMP3ファイルを入れてください。ドロップダウンにはID3のタイトルやコメントが表示されます。
2. `pip install -r requirements.txt` で依存ライブラリをインストールします（`pydub`の利用にはffmpegが必要です）。
3. `npm install` を実行してフロントエンドの依存ライブラリをインストールします。
4. `python app.py` を実行し、ブラウザで `http://localhost:5000` にアクセスします。
5. ポッドキャスト音声をアップロードし、BGMを選択すると、合成されたMP3をダウンロードできます。
