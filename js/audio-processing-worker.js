/* global lamejs */

function normalize(channels, targetAmplitude) {
  let maxValue = 0;

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      maxValue = Math.max(maxValue, Math.abs(channel[i]));
    }
  }

  if (maxValue > 0) {
    const ratio = targetAmplitude / maxValue;
    for (const channel of channels) {
      for (let i = 0; i < channel.length; i++) {
        channel[i] *= ratio;
      }
    }
  }

  return channels;
}

function encodeMp3(channels, sampleRate, kbps) {
  importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');

  const channelCount = Math.min(2, channels.length);
  const encoder = new lamejs.Mp3Encoder(channelCount, sampleRate, kbps);
  const left = channels[0];
  const right = channelCount > 1 ? channels[1] : null;
  const chunks = [];
  const blockSize = 1152;

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const length = Math.min(blockSize, left.length - offset);
    const left16 = new Int16Array(length);
    const right16 = right ? new Int16Array(length) : null;

    for (let i = 0; i < length; i++) {
      left16[i] = Math.max(-32768, Math.min(32767, left[offset + i] * 32768));
      if (right16) {
        right16[i] = Math.max(-32768, Math.min(32767, right[offset + i] * 32768));
      }
    }

    const encoded = right16
      ? encoder.encodeBuffer(left16, right16)
      : encoder.encodeBuffer(left16);
    if (encoded.length > 0) chunks.push(encoded);
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(flushed);

  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let resultOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }
  return result.buffer;
}

self.addEventListener('message', event => {
  try {
    const { operation, channelBuffers, sampleRate, targetAmplitude, kbps } = event.data;
    const channels = channelBuffers.map(buffer => new Float32Array(buffer));

    if (operation === 'normalize') {
      const normalized = normalize(channels, targetAmplitude);
      const buffers = normalized.map(channel => channel.buffer);
      self.postMessage({ buffers }, buffers);
      return;
    }

    if (operation === 'encodeMp3') {
      const buffer = encodeMp3(channels, sampleRate, kbps);
      self.postMessage({ buffer }, [buffer]);
      return;
    }

    throw new Error(`未対応の音声処理です: ${operation}`);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
});
