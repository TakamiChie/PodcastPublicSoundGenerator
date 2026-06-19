window.Mp3Helper = {
  /**
   * AudioBufferをlamejsを使ってMP3のArrayBufferに変換する
   * @param {AudioBuffer} audioBuffer 
   * @param {number} kbps 
   * @returns {ArrayBuffer}
   */
  audioBufferToMp3(audioBuffer, kbps = 192) {
    const channels = Math.min(2, audioBuffer.numberOfChannels); // 最大2チャンネル（ステレオ）
    const sampleRate = audioBuffer.sampleRate;
    const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data = [];

    const left = audioBuffer.getChannelData(0);
    const right = channels > 1 ? audioBuffer.getChannelData(1) : null;

    const sampleBlockSize = 1152; // LAMEの標準的なブロックサイズ

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right ? right.subarray(i, i + sampleBlockSize) : null;

      const left16 = new Int16Array(leftChunk.length);
      const right16 = right ? new Int16Array(rightChunk.length) : null;

      for (let j = 0; j < leftChunk.length; j++) {
        // -1.0〜1.0 の Float を 16-bit 整数値 (-32768〜32767) に変換してクランプする
        left16[j] = Math.max(-32768, Math.min(32767, leftChunk[j] * 32768));
        if (right16) {
          right16[j] = Math.max(-32768, Math.min(32767, rightChunk[j] * 32768));
        }
      }

      let mp3buf;
      if (right16) {
        mp3buf = mp3Encoder.encodeBuffer(left16, right16);
      } else {
        mp3buf = mp3Encoder.encodeBuffer(left16);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // エンコーダーのフラッシュ（残存データの書き出し）
    const flushBuf = mp3Encoder.flush();
    if (flushBuf.length > 0) {
      mp3Data.push(flushBuf);
    }

    // すべてのバッファチャンクを1つのUint8Arrayに結合
    let totalLength = 0;
    for (let i = 0; i < mp3Data.length; i++) {
      totalLength += mp3Data[i].length;
    }
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (let i = 0; i < mp3Data.length; i++) {
      combinedBuffer.set(mp3Data[i], offset);
      offset += mp3Data[i].length;
    }

    return combinedBuffer.buffer;
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
