import os
import uuid
from flask import Flask, render_template, request, redirect, url_for, send_file
from mutagen.easyid3 import EasyID3
from pydub import AudioSegment

app = Flask(__name__)
BGM_FOLDER = os.path.join(os.path.dirname(__file__), 'bgm')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), 'output')

os.makedirs(BGM_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def get_bgm_options():
  options = []
  for fname in os.listdir(BGM_FOLDER):
    if not fname.lower().endswith('.mp3'):
      continue
    path = os.path.join(BGM_FOLDER, fname)
    try:
      tags = EasyID3(path)
      title = tags.get('title', [fname])[0]
      comment = tags.get('comment', [''])[0]
      label = f"{title} - {comment}" if comment else title
    except Exception:
      label = fname
    options.append({'file': fname, 'label': label})
  return options


@app.route('/')
def index():
  options = get_bgm_options()
  return render_template('index.html', options=options)


@app.route('/mix', methods=['POST'])
def mix():
  file = request.files.get('audio')
  bgm_name = request.form.get('bgm')
  if not file or not bgm_name:
    return redirect(url_for('index'))

  podcast = AudioSegment.from_file(file)
  bgm_path = os.path.join(BGM_FOLDER, bgm_name)
  bgm_audio = AudioSegment.from_file(bgm_path)
  mixed = podcast.overlay(bgm_audio, loop=True)

  output_name = f"{uuid.uuid4().hex}.mp3"
  output_path = os.path.join(OUTPUT_FOLDER, output_name)
  intro_duration_ms = 5000
  outro_duration_ms = 5000
  podcast_duration_ms = len(podcast)

  # BGMをポッドキャスト再生中に10%の音量にする（約-20dB）
  # 20 * log10(0.1) = -20 dB
  bgm_duck_db = -20.0

  # 最終的なミックスファイルの総再生時間
  total_mixed_duration_ms = intro_duration_ms + podcast_duration_ms + outro_duration_ms

  # 1. BGM全体を作成（ループとトリミング）
  #    必要な長さに応じてBGMをループさせ、総再生時間に合わせる
  full_bgm = bgm_audio
  if len(full_bgm) < total_mixed_duration_ms:
    # math.ceilの整数版: (分子 + 分母 - 1) // 分母
    num_loops = (total_mixed_duration_ms + len(full_bgm) - 1) // len(full_bgm)
    full_bgm = full_bgm * num_loops
  full_bgm = full_bgm[:total_mixed_duration_ms]

  # 2. BGMの各パートを抽出
  intro_bgm_part = full_bgm[:intro_duration_ms]

  body_bgm_start_ms = intro_duration_ms
  body_bgm_end_ms = intro_duration_ms + podcast_duration_ms
  body_bgm_part = full_bgm[body_bgm_start_ms:body_bgm_end_ms]

  outro_bgm_start_ms = body_bgm_end_ms
  outro_bgm_part = full_bgm[outro_bgm_start_ms:total_mixed_duration_ms]

  # アウトロBGMの最後の1秒をフェードアウト
  fade_out_duration_ms = 1000
  if len(outro_bgm_part) >= fade_out_duration_ms:
    outro_bgm_part = outro_bgm_part.fade_out(fade_out_duration_ms)
  elif len(outro_bgm_part) > 0: # フェードアウト期間より短い場合は、全期間でフェードアウト
    outro_bgm_part = outro_bgm_part.fade_out(len(outro_bgm_part))

  # 3. ポッドキャスト部分を作成（BGMをダッキングしてポッドキャストをオーバーレイ）
  #    body_bgm_partの音量を下げつつ、podcastを重ねる
  #    podcastとbody_bgm_partの長さは同じはず
  body_with_podcast_ducked_bgm = body_bgm_part.overlay(podcast, gain_during_overlay=bgm_duck_db)

  # 4. 全てのパートを結合
  final_mix = intro_bgm_part + body_with_podcast_ducked_bgm + outro_bgm_part

  output_name = f"{uuid.uuid4().hex}.mp3"
  output_path = os.path.join(OUTPUT_FOLDER, output_name)
  mixed.export(output_path, format='mp3')
  final_mix.export(output_path, format='mp3')

  return send_file(output_path, as_attachment=True, download_name='mixed.mp3')


if __name__ == '__main__':
  app.run(debug=True)
