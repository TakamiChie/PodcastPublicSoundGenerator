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
    // files.jsでロード済み
  }

  // 入力値を送信してカバーアートを再生成
  function updateCover() {
    const files = audioInput.files;
    if (!files.length || !templateSelect.value) return;
    // テンプレートHTMLをfetch
    fetch(templateSelect.value)
      .then(r => r.text())
      .then(html => {
        // HTMLを置き換え
        let modifiedHtml = html;
        const title = titleInput.value || 'タイトル';
        const genre = genreInput.value || 'ジャンル';
        const dateStr = dateInput.value || '日付';
        const artist = document.getElementById('artist').value || 'アーティスト';
        modifiedHtml = modifiedHtml.replace(/\{\{\s*title\s*\}\}/g, title);
        modifiedHtml = modifiedHtml.replace(/\{\{\s*genre\s*\}\}/g, genre);
        modifiedHtml = modifiedHtml.replace(/\{\{\s*date\s*\}\}/g, dateStr);
        modifiedHtml = modifiedHtml.replace(/\{\{\s*artist\s*\}\}/g, artist);
        // dayを計算
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const date = new Date(dateStr);
          const days = ['日', '月', '火', '水', '木', '金', '土'];
          const day = days[date.getDay()];
          modifiedHtml = modifiedHtml.replace(/\{\{\s*day\s*\}\}/g, day);
        }
        coverFrame.srcdoc = modifiedHtml;
        // download filename
        const uid = window.currentAudioId || Date.now();
        coverDownload.dataset.filename = `cover_${uid}.png`;
      });
  }
  window.updateCover = updateCover; // グローバルに公開

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

  document.addEventListener('DOMContentLoaded', () => {
    // templates loaded by files.js
  });
})();
