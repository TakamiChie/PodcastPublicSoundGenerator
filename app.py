import os
import uuid
import re
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, send_file, send_from_directory, jsonify
from mutagen.easyid3 import EasyID3
from mutagen import File as MutagenFile
from pydub import AudioSegment
from work import set_bgm, normalize_volume, DEFAULT_TARGET_DB

app = Flask(__name__)
BGM_FOLDER = os.path.join(os.path.dirname(__file__), 'bgm')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), 'output')

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
  """カバーアート用テンプレート一覧を取得する"""
  tmpl_dir = os.path.join(app.template_folder, 'cover_templates')
  templates = []
  if os.path.isdir(tmpl_dir):
    for fname in os.listdir(tmpl_dir):
      if fname.endswith('.html'):
        templates.append(fname)
  templates.sort()
  return templates


@app.route('/')
def index():
  options = get_bgm_options()
  return render_template('index.html', options=options, target_db=DEFAULT_TARGET_DB)


@app.route('/cover_templates')
def cover_templates():
  """利用可能なカバーアートテンプレート一覧を返す"""
  return jsonify(get_cover_templates())


@app.route('/bgm/<path:filename>')
def bgm(filename):
  """BGMファイルを返す。"""
  return send_from_directory(BGM_FOLDER, filename)


@app.route('/mix', methods=['POST'])
def mix():
  file = request.files.get('audio')
  bgm_name = request.form.get('bgm')
  target_str = request.form.get('target_db', str(DEFAULT_TARGET_DB))
  try:
    target_db = float(target_str)
  except ValueError:
    target_db = DEFAULT_TARGET_DB
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
  podcast = normalize_volume(podcast, target_db)

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


@app.route('/cover_art', methods=['POST'])
def cover_art():
  """カバーアートを生成してHTMLとして返す"""
  file = request.files.get('audio')
  title = request.form.get('title') or ''
  genre = request.form.get('genre') or ''
  tmpl = request.form.get('template') or 'default.html'
  last_modified = request.form.get('last_modified')
  release_date = request.form.get('date') or None

  if not release_date and file:
    m = re.match(r"(\d{4}-\d{2}-\d{2})", file.filename)
    if m:
      release_date = m.group(1)
    elif last_modified:
      dt = datetime.fromtimestamp(int(last_modified) / 1000)
      release_date = dt.strftime('%Y-%m-%d')

  if file and (not title or not genre):
    try:
      file.stream.seek(0)
      meta = MutagenFile(file.stream, easy=True)
      if meta and meta.tags:
        if not title:
          title = meta.tags.get('title', [""])[0]
        if not genre:
          genre = meta.tags.get('genre', [""])[0]
    except Exception:
      pass

  if not release_date:
    release_date = datetime.now().strftime('%Y-%m-%d')
  dt = datetime.strptime(release_date, '%Y-%m-%d')
  days = ['月', '火', '水', '木', '金', '土', '日']
  day = days[dt.weekday()]

  html = render_template(f'cover_templates/{tmpl}', title=title, date=release_date, day=day, genre=genre)
  output_name = f"cover_{uuid.uuid4().hex}.html"
  output_path = os.path.join(OUTPUT_FOLDER, output_name)
  with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html)

  return jsonify({'title': title, 'genre': genre, 'date': release_date, 'day': day, 'url': url_for('output_file', filename=output_name)})


@app.route('/output/<path:filename>')
def output_file(filename):
  return send_from_directory(OUTPUT_FOLDER, filename)


if __name__ == '__main__':
  app.run(debug=True)
