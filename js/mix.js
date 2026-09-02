(() => {
  // ミックス処理を自動化
  const form = document.querySelector('form');
  const audioInput = document.getElementById('audio');
  const customBgmInput = document.getElementById('customBgm');
  const mixedAudio = document.getElementById('mixedAudio');
  const mixedDownload = document.getElementById('mixedDownload');
  const mixProgress = document.getElementById('mixProgress');
  const mixedRate = document.getElementById('mixedRate');

  function applyMixedPlaybackRate() {
    mixedAudio.playbackRate = parseFloat(mixedRate.value);
  }

  // 再生速度変更
  mixedRate.addEventListener('change', applyMixedPlaybackRate);
  mixedAudio.addEventListener('loadedmetadata', applyMixedPlaybackRate);
  applyMixedPlaybackRate();

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
    const currentController = controller;
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
      processedBuffer = await Mp3Helper.normalizeAudioBuffer(
        processedBuffer,
        targetDb / 100,
        currentController.signal
      );

      // BGMミックス
      const mixedBuffer = await setBgm(processedBuffer, bgmBuffer);

      // MP3エンコード & ID3タグ書き込み
      const mp3ArrayBuffer = await Mp3Helper.audioBufferToMp3Async(
        mixedBuffer,
        192,
        currentController.signal
      );
      const mp3Blob = await Mp3Helper.writeId3Tags(mp3ArrayBuffer);
      if (currentController.signal.aborted) {
        throw new DOMException('音声処理が中断されました', 'AbortError');
      }
      const url = URL.createObjectURL(mp3Blob);
      const uid = window.currentAudioId || Date.now();
      mixedAudio.src = url;
      applyMixedPlaybackRate();
      mixedDownload.href = url;
      mixedDownload.download = `mixed_${uid}.mp3`;

    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      if (controller === currentController) {
        mixProgress.style.display = 'none';
      }
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    mix();
  });

  // オーディオが設定（選択）されたら自動でミックスを開始する
  audioInput.addEventListener('change', () => {
    if (audioInput.files && audioInput.files.length) {
      mix();
    }
  });

})();
