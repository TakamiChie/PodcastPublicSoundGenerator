const audioInput = document.getElementById('audio');
const templateSelect = document.getElementById('template');
const titleInput = document.getElementById('title');
const dateInput = document.getElementById('date');
const categoryInput = document.getElementById('category');
const generateBtn = document.getElementById('generateBtn');
const previewArea = document.getElementById('previewArea');
const downloadLink = document.getElementById('downloadLink');

let loadedFile = null;

function parseTitle(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
        const size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];
        let pos = 10;
        while (pos + 10 <= size + 10) {
          const id = String.fromCharCode(...data.slice(pos, pos + 4));
          const fsize = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
          if (id === 'TIT2') {
            const encoding = data[pos + 10];
            const txt = data.slice(pos + 11, pos + 10 + fsize);
            const dec = new TextDecoder(encoding === 1 ? 'utf-16' : 'iso-8859-1');
            resolve(dec.decode(txt).replace(/\0/g, ''));
            return;
          }
          pos += 10 + fsize;
        }
      }
      if (data.length >= 128) {
        const start = data.length - 128;
        if (String.fromCharCode(...data.slice(start, start + 3)) === 'TAG') {
          const dec = new TextDecoder('iso-8859-1');
          const bytes = data.slice(start + 3, start + 33);
          resolve(dec.decode(bytes).replace(/\0/g, '').trim());
          return;
        }
      }
      resolve('');
    };
    reader.readAsArrayBuffer(file);
  });
}

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;
  loadedFile = file;
  const title = await parseTitle(file);
  if (title && !titleInput.value) titleInput.value = title;
  if (!dateInput.value) {
    const m = file.name.match(/\d{4}-\d{2}-\d{2}/);
    let d;
    if (m) {
      d = m[0];
    } else {
      const dt = new Date(file.lastModified);
      d = dt.toISOString().slice(0, 10);
    }
    dateInput.value = d;
  }
});

function replacePlaceholders(tmpl, data) {
  return tmpl
    .replace(/{{\s*title\s*}}/g, data.title)
    .replace(/{{\s*date\s*}}/g, data.date)
    .replace(/{{\s*weekday\s*}}/g, data.weekday)
    .replace(/{{\s*category\s*}}/g, data.category);
}

function toWeekday(dateStr) {
  const d = new Date(dateStr);
  return '日月火水木金土'.charAt(d.getDay());
}

generateBtn.addEventListener('click', async () => {
  if (!templateSelect.value) return;
  const res = await fetch(`/cover_template/${templateSelect.value}`);
  const text = await res.text();
  const data = {
    title: titleInput.value || 'タイトル未設定',
    date: dateInput.value || new Date().toISOString().slice(0, 10),
    weekday: toWeekday(dateInput.value || new Date()),
    category: categoryInput.value || ''
  };
  const html = replacePlaceholders(text, data);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'cover.png';
      downloadLink.textContent = 'ダウンロード';
    });
    previewArea.innerHTML = '';
    previewArea.appendChild(img.cloneNode());
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
