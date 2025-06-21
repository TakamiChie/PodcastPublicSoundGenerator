const audioInput = document.getElementById('audio');
const titleInput = document.getElementById('title');
const genreInput = document.getElementById('genre');
const templateSelect = document.getElementById('template');
const coverArea = document.getElementById('coverArea');
const coverDownload = document.getElementById('coverDownload');

function loadTemplates() {
  fetch('/cover_templates')
    .then(r => r.json())
    .then(tmpls => {
      tmpls.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        templateSelect.appendChild(opt);
      });
    });
}

function updateCover() {
  const files = audioInput.files;
  if (!files.length) return;
  const fd = new FormData();
  fd.append('audio', files[0]);
  fd.append('title', titleInput.value);
  fd.append('genre', genreInput.value);
  fd.append('template', templateSelect.value);
  fd.append('last_modified', files[0].lastModified);
  fetch('/cover_art', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      titleInput.value = data.title;
      genreInput.value = data.genre;
      coverArea.innerHTML = `<iframe src="${data.url}" width="500" height="500"></iframe>`;
      coverDownload.href = data.url;
    });
}

audioInput.addEventListener('change', updateCover);
titleInput.addEventListener('input', updateCover);
genreInput.addEventListener('input', updateCover);
templateSelect.addEventListener('change', updateCover);

document.addEventListener('DOMContentLoaded', loadTemplates);
