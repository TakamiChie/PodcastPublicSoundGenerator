(() => {
  const audioInput = document.getElementById('audio');
  const archiveLink = document.getElementById('archiveDownload');

  archiveLink.addEventListener('click', async e => {
    e.preventDefault();
    if (!audioInput.files.length) return;
    const file = audioInput.files[0];
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  });
})();
