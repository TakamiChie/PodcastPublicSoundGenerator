window.Mp3Helper = {
  runWorker(operation, audioBuffer, options = {}) {
    const { signal, ...workerOptions } = options;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('音声処理が中断されました', 'AbortError'));
        return;
      }

      const worker = new Worker('js/audio-processing-worker.js');
      const channelBuffers = [];
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        channelBuffers.push(audioBuffer.getChannelData(channel).slice().buffer);
      }

      const cleanup = () => {
        worker.terminate();
        signal?.removeEventListener('abort', handleAbort);
      };
      const handleAbort = () => {
        cleanup();
        reject(new DOMException('音声処理が中断されました', 'AbortError'));
      };

      signal?.addEventListener('abort', handleAbort, { once: true });
      worker.addEventListener('message', event => {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      }, { once: true });
      worker.addEventListener('error', event => {
        cleanup();
        reject(new Error(event.message || '音声処理Workerでエラーが発生しました'));
      }, { once: true });
      worker.postMessage({
        operation,
        channelBuffers,
        sampleRate: audioBuffer.sampleRate,
        ...workerOptions
      }, channelBuffers);
    });
  },

  async normalizeAudioBuffer(audioBuffer, targetAmplitude, signal) {
    const { buffers } = await this.runWorker('normalize', audioBuffer, {
      targetAmplitude,
      signal
    });
    const normalized = Tone.context.rawContext.createBuffer(
      buffers.length,
      new Float32Array(buffers[0]).length,
      audioBuffer.sampleRate
    );
    buffers.forEach((buffer, channel) => {
      normalized.copyToChannel(new Float32Array(buffer), channel);
    });
    return normalized;
  },

  async audioBufferToMp3Async(audioBuffer, kbps = 192, signal) {
    const { buffer } = await this.runWorker('encodeMp3', audioBuffer, { kbps, signal });
    return buffer;
  },

  /**
   * プレビューiframeのカバーアートをレンダリングし、ArrayBufferとして取得する
   * @returns {Promise<ArrayBuffer|null>}
   */
  async getCoverArrayBuffer() {
    const coverFrame = document.getElementById('coverFrame');
    if (!coverFrame || !coverFrame.contentDocument || !coverFrame.contentDocument.body) {
      return null;
    }
    const body = coverFrame.contentDocument.body;
    // カバーアートのID3埋め込み用サイズは1000px四方で十分高画質かつ軽量
    const scale = 1000 / body.clientWidth;
    
    // html2canvasでiframeの中身を描画
    const canvas = await html2canvas(body, { scale });
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  },

  /**
   * MP3のArrayBufferにID3タグ（タイトル、アーティスト、ジャンル、年、アルバム、カバーアート）を書き込み、Blobを返す
   * @param {ArrayBuffer} mp3ArrayBuffer 
   * @returns {Promise<Blob>}
   */
  async writeId3Tags(mp3ArrayBuffer) {
    const { ID3Writer } = await import('https://unpkg.com/browser-id3-writer@6.3.1/dist/browser-id3-writer.mjs');
    const writer = new ID3Writer(mp3ArrayBuffer);

    // フォームから値を取得
    const title = document.getElementById('title').value || '';
    const artist = document.getElementById('artist').value || '';
    const genre = document.getElementById('genre').value || '';
    const dateVal = document.getElementById('date').value || '';

    // 選択中のBGMのグループ名（optgroupのlabel）をアルバム名として取得
    // ルート以外のグループに属する場合のみ書き込む
    let album = '';
    const bgmSelect = document.getElementById('bgm');
    if (bgmSelect && bgmSelect.selectedIndex >= 0) {
      const selectedOption = bgmSelect.options[bgmSelect.selectedIndex];
      const parentGroup = selectedOption.parentElement;
      if (parentGroup && parentGroup.tagName === 'OPTGROUP') {
        const groupLabel = parentGroup.label || '';
        if (groupLabel && groupLabel !== 'ルート') {
          album = groupLabel;
        }
      }
    }

    if (title) {
      writer.setFrame('TIT2', title);
    }
    if (artist) {
      writer.setFrame('TPE1', [artist]);
    }
    if (genre) {
      writer.setFrame('TCON', [genre]);
    }
    if (dateVal) {
      const year = dateVal.split('-')[0];
      if (year && !isNaN(year)) {
        writer.setFrame('TYER', year);
      }
    }
    // BGMのグループ名（ルート以外）をアルバム名として書き込む
    if (album) {
      writer.setFrame('TALB', album);
    }

    // カバーアートの埋め込み
    try {
      const coverBuffer = await this.getCoverArrayBuffer();
      if (coverBuffer) {
        writer.setFrame('APIC', {
          type: 3, // Front cover
          data: coverBuffer,
          description: 'Front cover',
          useUnicodeEncoding: false
        });
      }
    } catch (err) {
      console.error('ID3タグへのカバーアート追加中にエラーが発生しました:', err);
    }

    writer.addTag();
    return writer.getBlob();
  }
};
