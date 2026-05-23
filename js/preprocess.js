document.getElementById('audio').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (!file) return;

  // ファイル名から日付 (yyyy-mm-dd) を抽出して反映
  const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const dateInput = document.getElementById('date');
    dateInput.value = dateMatch[1];
    // 他のスクリプト（cover.jsのプレビュー更新やsavecontrol.jsの保存処理）を動かすためにイベントを発火
    dateInput.dispatchEvent(new Event('change'));
  }

  if (file.type === "audio/mpeg" || file.name.toLowerCase().endsWith('.mp3')) {
    jsmediatags.read(file, {
      onSuccess: function (tag) {
        const tags = tag.tags;
        if (tags.title) {
          const el = document.getElementById('title');
          el.value = tags.title;
          el.dispatchEvent(new Event('change'));
        }
        if (tags.genre) {
          const el = document.getElementById('genre');
          el.value = tags.genre;
          el.dispatchEvent(new Event('change'));
        }
        if (tags.artist) {
          const el = document.getElementById('artist');
          el.value = tags.artist;
          el.dispatchEvent(new Event('change'));
        }
      },
      onError: function (error) {
        console.error('ID3タグの読み取りに失敗しました:', error.type, error.info);
      }
    });
  }
});