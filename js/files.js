// ファイル取得
async function loadFiles() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  let bgmFiles = [];
  let templateFiles = [];
  let bgmBaseUrl = '';
  let templateBaseUrl = '';

  if (isLocal) {
    bgmBaseUrl = 'bgm/';
    templateBaseUrl = 'static/templates/';
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
  bgmFiles.forEach(file => {
    if (file.endsWith('.mp3') || file.endsWith('.wav')) {
      const option = document.createElement('option');
      option.value = bgmBaseUrl + file;
      option.textContent = file;
      bgmSelect.appendChild(option);
    }
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