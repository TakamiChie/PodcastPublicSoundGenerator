const previewBtn = document.getElementById('previewBtn');
const bgmSelect = document.getElementById('bgm');
const previewAudio = document.getElementById('previewAudio');

previewBtn.addEventListener('click', () => {
  const selected = bgmSelect.value;
  if (!selected) {
    return;
  }
  if (!previewAudio.paused) {
    // 再生中にボタンを押したら停止
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewBtn.textContent = 'BGM視聴';
    return;
  }
  previewAudio.src = `/bgm/${selected}`;
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
