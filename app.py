import os
import uuid
from flask import Flask, render_template, request, redirect, url_for, send_file, send_from_directory
import datetime
import re
from mutagen.easyid3 import EasyID3
from mutagen import File as MutagenFile
from pydub import AudioSegment
from work import set_bgm

app = Flask(__name__)
BGM_FOLDER = os.path.join(os.path.dirname(__file__), 'bgm')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), 'output')
COVER_TEMPLATE_FOLDER = os.path.join(os.path.dirname(__file__), 'templates', 'cover_templates')

os.makedirs(BGM_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def get_bgm_options():
  grouped_options = {}  # キー: 表示用ディレクトリ名, 値: option辞書のリスト
  for root, _, files in os.walk(BGM_FOLDER):
    # BGM_FOLDERからの相対ディレクトリパス
    relative_dir_path = os.path.relpath(root, BGM_FOLDER)

    # 表示用のグループラベル
    if relative_dir_path == ".":
      group_label = "ルート"  # BGM_FOLDER直下のファイル用
    else:
      # Windowsのパス区切り文字 '\' を '/' に置換して表示
      group_label = relative_dir_path.replace(os.sep, " / ")

    for fname_leaf in files:  # fname_leaf はファイル名のみ (例: "song.mp3")
      if not fname_leaf.lower().endswith('.mp3'):
        continue

      full_path = os.path.join(root, fname_leaf)
      # BGM_FOLDERからの相対パス (例: "song.mp3" や "subdir/song.mp3")
      # この値がフォームで送信され、mix関数でパスの再構築に使用されます。
      file_value = os.path.relpath(full_path, BGM_FOLDER)

      try:
        tags = EasyID3(full_path)
        id3_title = tags.get('title', [None])[0]
        # ID3タイトルがあればそれをラベルに、なければファイル名（拡張子なし）をラベルにする
        label = id3_title if id3_title else os.path.splitext(fname_leaf)[0]
      except Exception:
        # EasyID3の処理でエラーが発生した場合は、ファイル名（拡張子なし）をラベルとして使用
        label = os.path.splitext(fname_leaf)[0]

      if group_label not in grouped_options:
        grouped_options[group_label] = []
      grouped_options[group_label].append({'file': file_value, 'label': label, 'stem': fname_leaf})

  # テンプレートで使いやすいように整形し、ソートする
  options_for_template = []
  # まずグループ名（ディレクトリ名）でソート
  for group_label_key in sorted(grouped_options.keys()):
    options_in_group = grouped_options[group_label_key]
    # 次に各グループ内の曲名（ラベル）でソート
    options_in_group.sort(key=lambda x: x['label'])
    options_for_template.append({'group_label': group_label_key, 'options': options_in_group})
  return options_for_template


def get_cover_templates():
  templates = []
  for fname in os.listdir(COVER_TEMPLATE_FOLDER):
    if fname.lower().endswith('.html'):
      templates.append(fname)
  templates.sort()
  return templates


@app.route('/')
def index():
  options = get_bgm_options()
  templates = get_cover_templates()
  return render_template('index.html', options=options, templates=templates)



@app.route('/cover_template/<path:tmpl>')
def cover_template(tmpl):
  return send_from_directory(COVER_TEMPLATE_FOLDER, tmpl)


@app.route('/bgm/<path:filename>')
def bgm(filename):
  """BGMファイルを返す。"""
  return send_from_directory(BGM_FOLDER, filename)


@app.route('/mix', methods=['POST'])
def mix():
  file = request.files.get('audio')
  bgm_name = request.form.get('bgm')
  if not file or not bgm_name:
    return redirect(url_for('index'))

  # 入力音声のID3タグを取得
  try:
    file.stream.seek(0)
    meta = MutagenFile(file.stream, easy=True)
    orig_tags = dict(meta.tags) if meta and meta.tags else None
  except Exception:
    orig_tags = None

  file.stream.seek(0)
  podcast = AudioSegment.from_file(file)

  final_mix = set_bgm(podcast, bgm_name)

  output_name = f"{uuid.uuid4().hex}.mp3"
  output_path = os.path.join(OUTPUT_FOLDER, output_name)
  final_mix.export(output_path, format='mp3')

  # 取得したID3タグを出力ファイルに設定
  if orig_tags:
    tags = EasyID3()
    for k, v in orig_tags.items():
      tags[k] = v
    tags.save(output_path)

  return send_file(output_path, as_attachment=True, download_name='mixed.mp3')


if __name__ == '__main__':
  app.run(debug=True)
