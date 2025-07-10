#!/bin/bash

# ログファイル設定
LOGFILE="/home/LogFiles/startup.log"

# デバッグログを有効化 & すべての出力をログに記録
exec > >(tee -a "$LOGFILE") 2>&1
set -x

ROOTDIR="/home/site/wwwroot"
BINDIR="$ROOTDIR/bin"

# binディレクトリ作成
mkdir -p "$BINDIR"

# output.tar.gz が存在するか確認
if [ -f "$ROOTDIR/output.tar.gz" ]; then
  # 必要なファイルだけを bin ディレクトリに展開
  tar -xzf "$ROOTDIR/output.tar.gz" -C "$BINDIR" bin/ffmpeg bin/ffprobe --strip-components=1

  # 実行権限付与
  chmod +x "$BINDIR/ffmpeg"
  chmod +x "$BINDIR/ffprobe"

  echo "✔️ ffmpeg / ffprobe 展開＆実行権限付与完了"
else
  echo "⚠️ $ROOTDIR/output.tar.gz が見つかりません"
fi

# アプリケーションの起動
exec gunicorn \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --access-logfile /home/LogFiles/gunicorn-access.log \
  --error-logfile /home/LogFiles/gunicorn-error.log \
  app:app
