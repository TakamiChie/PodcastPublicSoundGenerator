// オーディオIDキャッシュ（ファイルキー => ユニークID）
window._audioIdCache = window._audioIdCache || {};

/**
 * ファイルオブジェクトに対応するユニークIDを生成・返却する。
 * 同じファイル（名前・サイズ・最終更新日時が一致）は常に同じIDを返す。
 * @param {File} file
 * @returns {string}
 */
function getOrCreateAudioId(file) {
  const key = `${file.name}|${file.size}|${file.lastModified}`;
  if (!window._audioIdCache[key]) {
    // ランダムなユニークIDを生成（crypto.randomUUID が使えない場合は手動生成）
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    window._audioIdCache[key] = id;
  }
  return window._audioIdCache[key];
}

document.getElementById('audio').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (!file) return;

  // ポッドキャスト音声を読み込んだ瞬間にユニークIDを生成（同一ファイルは同一ID）
  window.currentAudioId = getOrCreateAudioId(file);

  // ファイル名から日付 (yyyy-mm-dd) を抽出して反映
  const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const dateInput = document.getElementById('date');
    dateInput.value = dateMatch[1];
    // 他のスクリプト（cover.jsのプレビュー更新やsavecontrol.jsの保存処理）を動かすためにイベントを発火
    dateInput.dispatchEvent(new Event('change'));
  }

  // BGMの自動選択
  const customBgmInput = document.getElementById('customBgm');
  if (customBgmInput && !customBgmInput.files.length) {
    if (!selectBgmByName(file.name)) {
      if (dateMatch) {
        selectBgmByDate(new Date(dateMatch[1]));
      }
    }
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

// 日付から曜日番号を取得(Mon=01, Sun=07)
function getIsoDay(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// 月内での週番号を取得(1〜5)
function getWeekOfMonth(date) {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

// ファイル名規則に基づいてBGMを選択
function selectBgmByDate(date) {
  const dayNo = String(getIsoDay(date)).padStart(2, '0');
  const weekNo = String(getWeekOfMonth(date)).padStart(2, '0');
  const select = document.getElementById('bgm');
  if (!select) return false;
  let fallback = null;
  for (const opt of select.options) {
    const bn = opt.dataset.basename || '';
    const m = bn.match(/bgm_(\d{2})(\d{2})?/);
    if (!m) continue;
    if (m[1] !== dayNo) continue;
    if (m[2]) {
      if (m[2] === weekNo) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change'));
        return true;
      }
    } else {
      fallback = opt;
    }
  }
  if (fallback) {
    select.value = fallback.value;
    select.dispatchEvent(new Event('change'));
    return true;
  }
  return false;
}

// ファイル名に含まれるBGM名から選択
function selectBgmByName(fileName) {
  const select = document.getElementById('bgm');
  if (!select) return false;
  const baseName = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
  let bestOpt = null;
  let bestLen = 0;
  for (const opt of select.options) {
    const bn = (opt.dataset.basename || '').toLowerCase();
    if (bn && baseName.includes(bn) && bn.length > bestLen) {
      bestOpt = opt;
      bestLen = bn.length;
    }
  }
  if (bestOpt) {
    select.value = bestOpt.value;
    select.dispatchEvent(new Event('change'));
    return true;
  }
  return false;
}