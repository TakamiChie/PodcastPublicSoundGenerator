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
  coverDownload.addEventListener('click', async e => {
    e.preventDefault();
    const node = coverFrame.contentDocument.documentElement;
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(true);
    const links = clone.querySelectorAll('link[rel="stylesheet"]');
    for (const link of links) {
      const css = await fetch(link.href).then(r => r.text());
      const style = document.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    }
    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 3000;
      canvas.height = 3000;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (err) {
          console.error('クリップボードへのコピーに失敗しました', err);
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = coverDownload.dataset.filename || 'cover.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  document.addEventListener('DOMContentLoaded', loadTemplates);
})();
