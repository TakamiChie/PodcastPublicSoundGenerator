// ミックスした音声を取得して再生・ダウンロードリンクに設定
const form = document.querySelector('form');
const mixedAudio = document.getElementById('mixedAudio');
const mixedDownload = document.getElementById('mixedDownload');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const res = await fetch(form.action, {
    method: 'POST',
    body: fd
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  mixedAudio.src = url;
  mixedAudio.play();
  mixedDownload.href = url;
});
