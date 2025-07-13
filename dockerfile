FROM python:3.12.11

# 作業ディレクトリを設定
WORKDIR /app

# 必要なパッケージをインストール（例：ffmpeg動作用）
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ffmpeg, ffprobe バイナリをコピー
COPY bin/ffmpeg /usr/local/bin/ffmpeg
COPY bin/ffprobe /usr/local/bin/ffprobe
RUN chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe

# アプリケーションのコードをコピー
COPY . /app

# Pythonライブラリをインストール
RUN pip install --no-cache-dir -r requirements.txt

# デフォルトポート（例：Flaskで8000番使用）
EXPOSE 8000

# アプリ起動（必要に応じて書き換え）
CMD ["python", "app.py"]

