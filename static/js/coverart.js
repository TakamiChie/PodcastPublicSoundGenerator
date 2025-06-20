const audioInput = document.getElementById('audio');
const templateSelect = document.getElementById('template');
const titleInput = document.getElementById('title');
const dateInput = document.getElementById('date');
const genreInput = document.getElementById('genre');
const generateBtn = document.getElementById('generateBtn');
const previewArea = document.getElementById('previewArea');
const downloadLink = document.getElementById('downloadLink');

let loadedFile = null;

// MP3からタイトルとジャンルを取得する
function parseTags(file) {
  return new Promise((resolve) => {
    const genres = [
      'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge',
      'Hip-Hop','Jazz','Metal','New Age','Oldies','Other','Pop','R&B',
      'Rap','Reggae','Rock','Techno','Industrial','Alternative','Ska',
      'Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient',
      'Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance','Classical',
      'Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
      'AlternRock','Bass','Soul','Punk','Space','Meditative',
      'Instrumental Pop','Instrumental Rock','Ethnic','Gothic','Darkwave',
      'Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream',
      'Southern Rock','Comedy','Cult','Gangsta','Top 40','Christian Rap',
      'Pop/Funk','Jungle','Native American','Cabaret','New Wave',
      'Psychadelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal',
      'Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll',
      'Hard Rock'
    ];
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      let title = '';
      let genre = '';
      if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
        const size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];
        let pos = 10;
        while (pos + 10 <= size + 10) {
          const id = String.fromCharCode(...data.slice(pos, pos + 4));
          const fsize = (data[pos + 4] << 24) | (data[pos + 5] << 16) |
            (data[pos + 6] << 8) | data[pos + 7];
          const encoding = data[pos + 10];
          const txt = data.slice(pos + 11, pos + 10 + fsize);
          const dec = new TextDecoder(encoding === 1 ? 'utf-16' : 'iso-8859-1');
          if (id === 'TIT2' && !title) {
            title = dec.decode(txt).replace(/\0/g, '');
          } else if (id === 'TCON' && !genre) {
            genre = dec.decode(txt).replace(/\0/g, '');
          }
          pos += 10 + fsize;
          if (title && genre) break;
        }
      }
      if (data.length >= 128) {
        const start = data.length - 128;
        if (String.fromCharCode(...data.slice(start, start + 3)) === 'TAG') {
          const dec = new TextDecoder('iso-8859-1');
          if (!title) {
            const bytes = data.slice(start + 3, start + 33);
            title = dec.decode(bytes).replace(/\0/g, '').trim();
          }
          const g = data[start + 127];
          if (!genre && g < genres.length) {
            genre = genres[g];
          }
        }
      }
      resolve({ title, genre });
    };
    reader.readAsArrayBuffer(file);
  });
}

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;
  loadedFile = file;
  const tags = await parseTags(file);
  if (tags.title && !titleInput.value) titleInput.value = tags.title;
  if (tags.genre && !genreInput.value) genreInput.value = tags.genre;
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
    .replace(/{{\s*genre\s*}}/g, data.genre);
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
    genre: genreInput.value || ''
  };
  const html = replacePlaceholders(text, data);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob2) => {
      const pngUrl = URL.createObjectURL(blob2);
      downloadLink.href = pngUrl;
      downloadLink.download = 'cover.png';
      downloadLink.textContent = 'ダウンロード';
    });
    previewArea.innerHTML = '';
    previewArea.appendChild(img.cloneNode());
    URL.revokeObjectURL(url);
  };
  img.src = url;
});
