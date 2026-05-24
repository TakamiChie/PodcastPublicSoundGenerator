(() => {
  // ミックス処理を自動化
  const form = document.querySelector('form');
  const audioInput = document.getElementById('audio');
  const customBgmInput = document.getElementById('customBgm');
  const mixedAudio = document.getElementById('mixedAudio');
  const mixedDownload = document.getElementById('mixedDownload');
  const mixProgress = document.getElementById('mixProgress');
  const mixedRate = document.getElementById('mixedRate');

  // 再生速度変更
  mixedRate.addEventListener('change', () => {
    mixedAudio.playbackRate = parseFloat(mixedRate.value);
  });

  // 音声ファイルをロード
  async function loadAudio(file) {
    // FileReaderの代わりにfile.arrayBuffer()を使用
    const arrayBuffer = await file.arrayBuffer();
    return await Tone.context.decodeAudioData(arrayBuffer);
  }

  // URLから音声ファイルをロード
  function loadAudioUrl(url) {
    return fetch(url)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => Tone.context.decodeAudioData(arrayBuffer));
  }

  // 音量を正規化 (簡易)
  function normalizeVolume(buffer, targetDb) {
    // targetDbを0.0〜1.0の振幅比率として解釈します (例: 80.0 -> 0.8)
    const targetAmplitude = targetDb / 100;
    let maxVal = 0;

    // 1. 全チャンネルをスキャンして最大振幅（ピーク）を見つける
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i]);
        if (v > maxVal) maxVal = v;
      }
    }

    // 2. ピーク値に基づいて全サンプルのゲインを調整する
    if (maxVal > 0) {
      const ratio = targetAmplitude / maxVal;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
          data[i] *= ratio;
        }
      }
    }
    return buffer;
  }

  // ハイパスフィルタ (簡易)
  async function applyHighpass(buffer) {
    // 100Hz以下の低域（環境ノイズなど）をカットします
    return await Tone.Offline(() => {
      const player = new Tone.Player(buffer);
      const filter = new Tone.Filter(100, "highpass").toDestination();
      player.connect(filter);
      player.start(0);
    }, buffer.duration, buffer.numberOfChannels, buffer.sampleRate);
  }

  // ノイズゲート (最初の一秒をリファレンスにし、かつカットする)
  async function applyNoiseGateFromFirstSecond(buffer) {
    const sampleRate = buffer.sampleRate;
    const trimTime = 1; // 1秒分をノイズ解析＆削除対象とする
    const firstSecondFrames = Math.min(sampleRate * trimTime, buffer.length);
    let maxNoisePeak = 0;

    // 1. 最初の一秒をスキャンして最大振幅を計測
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < firstSecondFrames; i++) {
        const v = Math.abs(data[i]);
        if (v > maxNoisePeak) maxNoisePeak = v;
      }
    }
    // 2. 閾値を決定 (振幅をデシベルに変換)
    const thresholdDb = maxNoisePeak > 0 ? 20 * Math.log10(maxNoisePeak) : -100;

    // 3. ゲートを適用しつつ、最初の一秒を除去してレンダリング
    const newDuration = Math.max(0, buffer.duration - trimTime);
    return await Tone.Offline(() => {
      const player = new Tone.Player(buffer);
      const gate = new Tone.Gate(thresholdDb, 0.1).toDestination();
      player.connect(gate);
      // offsetにtrimTime(1s)を指定して再生開始
      player.start(0, trimTime);
    }, newDuration, buffer.numberOfChannels, buffer.sampleRate);
  }

  // BGMをセット
  async function setBgm(podcastBuffer, bgmBuffer) {
    const introDuration = 5; // 5s
    const outroDuration = 5; // 5s
    const podcastDuration = podcastBuffer.duration;
    const totalDuration = introDuration + podcastDuration + outroDuration;

    // BGMをループして必要な長さに
    const bgmDuration = bgmBuffer.duration;
    const numLoops = Math.ceil(totalDuration / bgmDuration);
    // 簡易的にTone.Offlineでミックス
    const buffer = await Tone.Offline(async () => {
      const bgmPlayer = new Tone.Player(bgmBuffer);
      const podcastPlayer = new Tone.Player(podcastBuffer).toDestination();
      // BGM duck
      const gainNode = new Tone.Gain().toDestination();
      bgmPlayer.connect(gainNode);
      bgmPlayer.loop = true;
      bgmPlayer.start(0);
      podcastPlayer.start(introDuration);
      // duck during podcast
      gainNode.gain.setValueAtTime(1, 0);
      gainNode.gain.setValueAtTime(0.1, introDuration); // -20dB
      gainNode.gain.setValueAtTime(0.1, introDuration + podcastDuration);
      gainNode.gain.setValueAtTime(1, totalDuration);
    }, totalDuration);
    return buffer;
  }

  let controller = null;

  async function mix() {
    if (!audioInput.files.length) return;
    if (controller) {
      controller.abort();
    }
    controller = new AbortController();
    mixProgress.style.display = 'inline-block';
    try {
      await Tone.start();

      const audioBuffer = await loadAudio(audioInput.files[0]);
      let bgmBuffer;
      if (customBgmInput.files.length) {
        bgmBuffer = await loadAudio(customBgmInput.files[0]);
      } else {
        const bgmUrl = document.getElementById('bgm').value;
        bgmBuffer = await loadAudioUrl(bgmUrl);
      }

      // ノイズ除去
      const noiseReduction = document.getElementById('noise_reduction').value;
      let processedBuffer = audioBuffer;
      if (noiseReduction === 'highpass') {
        processedBuffer = await applyHighpass(processedBuffer);
      } else if (noiseReduction === '1stOne') {
        processedBuffer = await applyNoiseGateFromFirstSecond(processedBuffer);
      }

      // 正規化
      const targetDb = parseFloat(document.getElementById('target_db').value);
      processedBuffer = normalizeVolume(processedBuffer, targetDb);

      // BGMミックス
      const mixedBuffer = await setBgm(processedBuffer, bgmBuffer);

      // Blob作成
      const wavBlob = audioBufferToWav(mixedBuffer);
      const url = URL.createObjectURL(wavBlob);
      mixedAudio.src = url;
      mixedDownload.href = url;
      mixedDownload.download = 'mixed.wav';

      mixProgress.style.display = 'none';
    } catch (e) {
      console.error(e);
      mixProgress.style.display = 'none';
    }
  }

  // AudioBuffer to WAV Blob
  function audioBufferToWav(buffer) {
    const length = buffer.length;
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * 2, true);

    // Data
    // パフォーマンス向上のため、チャンネルデータをループの外で取得
    const channels = [];
    for (let channel = 0; channel < numChannels; channel++) {
      channels.push(buffer.getChannelData(channel));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    mix();
  });

})();
