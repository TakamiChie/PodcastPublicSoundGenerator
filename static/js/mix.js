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

  audioInput.addEventListener('change', mix);
})();

