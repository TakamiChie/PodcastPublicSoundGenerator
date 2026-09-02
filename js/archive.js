(() => {
  const audioInput = document.getElementById('audio');
  const archiveLink = document.getElementById('archiveDownload');

  archiveLink.addEventListener('click', async e => {
    e.preventDefault();
    if (!audioInput.files.length) return;
    const file = audioInput.files[0];

    // ローディング状態をUIに反映
    const originalText = archiveLink.textContent;
    archiveLink.style.pointerEvents = 'none';
    archiveLink.style.opacity = '0.6';
    archiveLink.textContent = 'アーカイブ処理中...';

    try {
      let mp3Blob;
      const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');

      if (isMp3) {
        // すでにMP3の場合は、音質劣化を防ぐためデコードせず直接ID3タグを書き込む
        const arrayBuffer = await file.arrayBuffer();
        mp3Blob = await Mp3Helper.writeId3Tags(arrayBuffer);
      } else {
        // MP3以外（WAV等）の場合はデコードしてMP3に変換し、ID3タグを書き込む
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        const mp3ArrayBuffer = await Mp3Helper.audioBufferToMp3Async(audioBuffer);
        mp3Blob = await Mp3Helper.writeId3Tags(mp3ArrayBuffer);
      }

      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      // 拡張子を.mp3に変更
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      a.download = `${baseName}_archive.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('アーカイブダウンロードでエラーが発生しました:', err);
      alert('アーカイブ音声の処理中にエラーが発生しました。');
    } finally {
      // リンクの状態を元に戻す
      archiveLink.style.pointerEvents = 'auto';
      archiveLink.style.opacity = '1';
      archiveLink.textContent = originalText;
    }
  });
})();
