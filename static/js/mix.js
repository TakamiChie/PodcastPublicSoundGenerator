(() => {
  // ミックス処理を自動化
  const form = document.querySelector('form');
  const audioInput = document.getElementById('audio');
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
    const name = audioInput.files[0].name;
    if (selectBgmByName(name)) return;
    const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return;
    const date = new Date(m[1]);
    selectBgmByDate(date);
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
      const fd = new FormData(form);
      if (audioInput.files.length) {
        fd.append('last_modified', audioInput.files[0].lastModified);
      }
      const res = await fetch(form.action, {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      mixedAudio.src = url;
      mixedAudio.playbackRate = parseFloat(mixedRate.value);
      mixedDownload.href = url;
      const disp = res.headers.get('Content-Disposition');
      if (disp) {
        // ヘッダからファイル名を取得（引用符があってもなくても対応）
        const m = disp.match(/filename\\*?=(?:UTF-8''|\"?)([^\";]+)/);
        if (m) {
          mixedDownload.download = m[1];
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
      }
    } finally {
      mixProgress.style.display = 'none';
      controller = null;
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    mix();
  });

  audioInput.addEventListener('change', () => {
    autoSelectBgm();
    mix();
  });
})();

