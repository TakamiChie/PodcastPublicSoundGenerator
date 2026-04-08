// ファイル取得
async function loadFiles() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  let bgmFiles = [];
  let templateFiles = [];
  let bgmBaseUrl = '';
  let templateBaseUrl = '';

  if (isLocal) {
    bgmBaseUrl = 'static/bgm/';
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
    bgmBaseUrl = `https://raw.githubusercontent.com/${repo}/master/static/bgm/`;
    templateBaseUrl = `https://raw.githubusercontent.com/${repo}/master/static/templates/`;
    try {
      const [bgmRes, templateRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/contents/static/bgm`),
        fetch(`https://api.github.com/repos/${repo}/contents/static/templates/`)
      ]);
      const bgmData = await bgmRes.json();
      const templateData = await templateRes.json();
      bgmFiles = bgmData.filter(item => item.type === 'file').map(item => item.name);
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