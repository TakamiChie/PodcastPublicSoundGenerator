(() => {
  const previewBtn = document.getElementById('previewBtn');
  const bgmSelect = document.getElementById('bgm');
  const customBgmInput = document.getElementById('customBgm');
  const previewAudio = document.getElementById('previewAudio');
  let customPreviewUrl = null;

  function updateBgmControlState() {
    const hasCustomBgm = customBgmInput.files.length > 0;
    bgmSelect.disabled = hasCustomBgm;
    bgmSelect.required = !hasCustomBgm;
    if (!previewAudio.paused) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    previewBtn.textContent = 'BGM視聴';
  }

  previewBtn.addEventListener('click', () => {
    const hasCustomBgm = customBgmInput.files.length > 0;
    if (!hasCustomBgm && !bgmSelect.value) {
      return;
    }
    if (!previewAudio.paused) {
      // 再生中にボタンを押したら停止
      previewAudio.pause();
      previewAudio.currentTime = 0;
      previewBtn.textContent = 'BGM視聴';
      return;
    }
    if (hasCustomBgm) {
      if (customPreviewUrl) {
        URL.revokeObjectURL(customPreviewUrl);
      }
      customPreviewUrl = URL.createObjectURL(customBgmInput.files[0]);
      previewAudio.src = customPreviewUrl;
    } else {
      previewAudio.src = `/bgm/${bgmSelect.value}`;
    }
    previewAudio.play();
    previewBtn.textContent = '停止';
  });

  bgmSelect.addEventListener('change', () => {
    if (!previewAudio.paused) {
      previewBtn.click();
    }
  });

  previewAudio.addEventListener('ended', () => {
    previewBtn.textContent = 'BGM視聴';
  });

  customBgmInput.addEventListener('change', updateBgmControlState);
  updateBgmControlState();
})();
