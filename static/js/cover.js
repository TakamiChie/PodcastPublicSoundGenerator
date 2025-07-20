(() => {
  // カバーアート関連要素
  const audioInput = document.getElementById('audio');
  const titleInput = document.getElementById('title');
  const genreInput = document.getElementById('genre');
  const dateInput = document.getElementById('date');
  const templateSelect = document.getElementById('template');
  const coverArea = document.getElementById('coverArea');
  const coverFrame = document.getElementById('coverFrame');
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

  // 入力値を送信してカバーアートを再生成
  function updateCover() {
    const files = audioInput.files;
    if (!files.length) return;
    const fd = new FormData();
    fd.append('audio', files[0]);
    fd.append('title', titleInput.value);
    fd.append('genre', genreInput.value);
    fd.append('date', dateInput.value);
    fd.append('template', templateSelect.value);
    fd.append('last_modified', files[0].lastModified);
    fetch('/cover_art', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        titleInput.value = data.title;
        genreInput.value = data.genre;
        dateInput.value = data.date;
        fetch(data.url)
          .then(r => r.text())
          .then(html => {
            coverFrame.srcdoc = html;
          });
        coverDownload.dataset.url = data.url;
        coverDownload.dataset.filename = `cover_${data.uuid}.png`;
      });
  }

  // 新しいファイルが選択されたらメタ情報をリセット
  audioInput.addEventListener('change', () => {
    titleInput.value = '';
    genreInput.value = '';
    dateInput.value = '';
    updateCover();
  });
  // テキストボックスからフォーカスが外れたときに更新
  titleInput.addEventListener('blur', updateCover);
  genreInput.addEventListener('blur', updateCover);
  templateSelect.addEventListener('change', updateCover);
  dateInput.addEventListener('change', updateCover);

  // PNG形式でダウンロード（3000px×3000px）
  coverDownload.addEventListener('click', e => {
    e.preventDefault();
    const body = coverFrame.contentDocument.body;
    const scale = 3000 / body.clientWidth;
    html2canvas(body, { scale }).then(canvas => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = coverDownload.dataset.filename || 'cover.png';
      a.click();
    });
  });

  document.addEventListener('DOMContentLoaded', loadTemplates);
})();
