// ファイル取得
async function loadFiles() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  let bgmFiles = [];
  let templateFiles = [];
  let bgmBaseUrl = '';
  let templateBaseUrl = '';

  if (isLocal) {
    // jsmediatagsがパスを正しく認識できるよう、相対パスではなく絶対URLを生成する
    bgmBaseUrl = new URL('bgm/', window.location.href).href;
    templateBaseUrl = new URL('static/templates/', window.location.href).href;
    // ローカルではfiles.jsonを読み込む（fileget.pyで生成）
    try {
      const response = await fetch('files.json');
      const data = await response.json();
      bgmFiles = data.bgm;
      templateFiles = data.templates;
    } catch (e) {
      console.error('ローカルファイル読み込みエラー:', e);
    }
  } else {
    // GitHub PagesではGitHub APIを使用
    const repo = 'TakamiChie/PodcastPublicSoundGenerator';
    bgmBaseUrl = `https://raw.githubusercontent.com/${repo}/master/bgm/`;
    templateBaseUrl = `https://raw.githubusercontent.com/${repo}/master/static/templates/`;

    // サブディレクトリを再帰的に検索する関数
    async function getFilesRecursively(path, extension) {
      const files = [];
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`);
        const data = await response.json();

        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.type === 'file' && item.name.endsWith(extension)) {
              files.push(item.path.replace(path + '/', ''));
            } else if (item.type === 'dir') {
              // サブディレクトリを再帰的に検索
              const subFiles = await getFilesRecursively(item.path, extension);
              files.push(...subFiles);
            }
          }
        }
      } catch (e) {
        console.error(`GitHub API エラー (${path}):`, e);
      }
      return files;
    }

    try {
      const [bgmRes, templateRes] = await Promise.all([
        getFilesRecursively('bgm', '.mp3'),
        fetch(`https://api.github.com/repos/${repo}/contents/static/templates/`)
      ]);
      bgmFiles = bgmRes;
      const templateData = await templateRes.json();
      templateFiles = templateData.filter(item => item.type === 'file').map(item => item.name);
    } catch (e) {
      console.error('GitHub APIエラー:', e);
    }
  }

  // BGMセレクトボックスを更新
  const bgmSelect = document.getElementById('bgm');
  bgmSelect.innerHTML = '';

  const bgmGroups = {};
  const metadataPromises = [];

  bgmFiles.forEach(file => {
    if (file.endsWith('.mp3') || file.endsWith('.wav')) {
      const parts = file.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : 'ルート';
      const fileName = parts[parts.length - 1];
      if (!bgmGroups[groupName]) bgmGroups[groupName] = [];

      const item = { fullPath: file, fileName, displayName: fileName };
      bgmGroups[groupName].push(item);

      // MP3の場合はID3タグのタイトル取得を試みる (jsmediatagsライブラリが必要)
      if (file.endsWith('.mp3') && typeof jsmediatags !== 'undefined') {
        metadataPromises.push(new Promise(resolve => {
          try {
            jsmediatags.read(bgmBaseUrl + file, {
              onSuccess: (tag) => {
                if (tag.tags && tag.tags.title) {
                  item.displayName = `${tag.tags.title}(${fileName})`;
                }
                resolve();
              },
              onError: () => resolve() // 読み込みエラー時はファイル名のまま続行
            });
          } catch (e) {
            // ライブラリのReader初期化失敗などの例外をキャッチ
            console.error('jsmediatags read error:', e, bgmBaseUrl + file);
            resolve();
          }
        }));
      }
    }
  });

  // 全てのメタデータ取得完了を待機
  if (metadataPromises.length > 0) {
    await Promise.all(metadataPromises);
  }

  Object.keys(bgmGroups).sort((a, b) => {
    if (a === 'ルート') return -1;
    if (b === 'ルート') return 1;
    return a.localeCompare(b);
  }).forEach(groupName => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    bgmGroups[groupName].forEach(item => {
      const option = document.createElement('option');
      option.value = bgmBaseUrl + item.fullPath;
      option.textContent = item.displayName;
      // mix.jsの自動選択機能で使用するベースネームをセット
      option.dataset.basename = item.fileName.replace(/\.[^/.]+$/, '');
      optgroup.appendChild(option);
    });
    bgmSelect.appendChild(optgroup);
  });

  // テンプレートセレクトボックスを更新
  const templateSelect = document.getElementById('template');
  templateSelect.innerHTML = '';
  templateFiles.forEach(file => {
    if (file.endsWith('.html')) {
      const option = document.createElement('option');
      option.value = templateBaseUrl + file;
      option.textContent = file.replace('.html', '');
      templateSelect.appendChild(option);
    }
  });

  // グローバル変数に設定
  window.bgmBaseUrl = bgmBaseUrl;
  window.templateBaseUrl = templateBaseUrl;
}

loadFiles();