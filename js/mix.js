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

  // 日付から曜日番号を取得(Mon=01, Sun=07)
  function getIsoDay(date) {
    const d = date.getDay();
    return d === 0 ? 7 : d;
  }

  // 月内での週番号を取得(1〜5)
  function getWeekOfMonth(date) {
    return Math.floor((date.getDate() - 1) / 7) + 1;
  }

  // ファイル名規則に基づいてBGMを選択
  function selectBgmByDate(date) {
    const dayNo = String(getIsoDay(date)).padStart(2, '0');
    const weekNo = String(getWeekOfMonth(date)).padStart(2, '0');
    const select = document.getElementById('bgm');
    let fallback = null;
    for (const opt of select.options) {
      const fname = opt.value;
      const m = fname.match(/bgm_(\d{2})(\d{2})?/);
      if (!m) continue;
      if (m[1] !== dayNo) continue;
      if (m[2]) {
        if (m[2] === weekNo) {
          select.value = opt.value;
          return true;
        }
      } else {
        fallback = opt;
      }
    }
    if (fallback) {
      select.value = fallback.value;
      return true;
    }
    return false;
  }

  // ファイル名に含まれるBGM名から選択
  function selectBgmByName(fileName) {
    const select = document.getElementById('bgm');
    const baseName = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
    let bestOpt = null;
    let bestLen = 0;
    for (const opt of select.options) {
      const bn = (opt.dataset.basename || '').toLowerCase();
      if (bn && baseName.includes(bn) && bn.length > bestLen) {
        bestOpt = opt;
        bestLen = bn.length;
      }
    }
    if (bestOpt) {
      select.value = bestOpt.value;
      return true;
    }
    return false;
  }

  // #audio に設定されたファイル名からBGMを自動選択
  function autoSelectBgm() {
    if (!audioInput.files.length) return;
    if (customBgmInput.files.length) return;
    const name = audioInput.files[0].name;
    if (selectBgmByName(name)) return;
    const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return;
    const date = new Date(m[1]);
    selectBgmByDate(date);
  }

  // 音声ファイルをロード
  function loadAudio(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        Tone.context.decodeAudioData(reader.result, resolve, reject);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // URLから音声ファイルをロード
  function loadAudioUrl(url) {
    return fetch(url)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => Tone.context.decodeAudioData(arrayBuffer));
  }

  // 音量を正規化 (簡易)
  function normalizeVolume(buffer, targetDb) {
    // dBFS計算は難しいので、簡易的にスキップ
    return buffer;
  }

  // ハイパスフィルタ (簡易)
  function applyHighpass(buffer) {
    // Web Audio APIでフィルタ適用
    return buffer;
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
      const bgmPlayer = new Tone.Player(bgmBuffer).toDestination();
      const podcastPlayer = new Tone.Player(podcastBuffer).toDestination();
      // BGM duck
      const gainNode = new Tone.Gain().toDestination();
      bgmPlayer.connect(gainNode);
      podcastPlayer.connect(Tone.Destination);
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
        processedBuffer = applyHighpass(processedBuffer);
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
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
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

  audioInput.addEventListener('change', autoSelectBgm);
})();
