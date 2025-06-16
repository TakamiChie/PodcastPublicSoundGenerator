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
    mixed.export(output_path, format='mp3')

    return send_file(output_path, as_attachment=True, download_name='mixed.mp3')


if __name__ == '__main__':
    app.run(debug=True)
