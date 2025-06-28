(() => {
  const audioInput = document.getElementById('audio');
  const titleInput = document.getElementById('title');
  const genreInput = document.getElementById('genre');
  const artistInput = document.getElementById('artist');
  const commentInput = document.getElementById('comment');
  const dateInput = document.getElementById('date');
  const bgmSelect = document.getElementById('bgm');
  const archiveLink = document.getElementById('archiveDownload');

  archiveLink.addEventListener('click', async e => {
    e.preventDefault();
    if (!audioInput.files.length) return;
    const file = audioInput.files[0];
    const fd = new FormData();
    fd.append('audio', file);
    fd.append('title', titleInput.value);
    fd.append('genre', genreInput.value);
    fd.append('artist', artistInput.value);
    fd.append('comment', commentInput.value);
    fd.append('date', dateInput.value);
    fd.append('bgm', bgmSelect.value);
    fd.append('last_modified', file.lastModified);
    const res = await fetch('/archive', { method: 'POST', body: fd });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disp = res.headers.get('Content-Disposition');
    if (disp) {
      const m = disp.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/);
      if (m) {
        a.download = m[1];
      }
    }
    if (!a.download) {
      a.download = 'archive.mp3';
    }
    a.click();
  });
})();
