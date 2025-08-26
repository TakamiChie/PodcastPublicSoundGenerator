import os
import numpy as np
import noisereduce as nr
from pydub import AudioSegment

DEFAULT_TARGET_DB = 80.0


def reduce_noise(audio: AudioSegment, sample_duration_ms: int = 1000) -> AudioSegment:
  """最初のsample_duration_msミリ秒をノイズとして抽出し、全体から除去する。"""
  if len(audio) <= sample_duration_ms:
    return audio
  noise_sample = audio[:sample_duration_ms]
  dtype_map = {1: np.int8, 2: np.int16, 4: np.int32}
  sample_width = audio.sample_width
  dtype = dtype_map.get(sample_width, np.int16)
  audio_np = np.array(audio.get_array_of_samples()).astype(np.float32)
  noise_np = np.array(noise_sample.get_array_of_samples()).astype(np.float32)
  channels = audio.channels
  if channels > 1:
    audio_np = audio_np.reshape((-1, channels))
    noise_np = noise_np.reshape((-1, channels))
    reduced = np.empty_like(audio_np)
    for ch in range(channels):
      reduced[:, ch] = nr.reduce_noise(y=audio_np[:, ch], sr=audio.frame_rate, y_noise=noise_np[:, ch])
    reduced = reduced.reshape((-1,))
  else:
    reduced = nr.reduce_noise(y=audio_np, sr=audio.frame_rate, y_noise=noise_np)
  reduced = np.clip(reduced, np.iinfo(dtype).min, np.iinfo(dtype).max)
  return audio._spawn(reduced.astype(dtype).tobytes())

def highpass_filter(audio: AudioSegment) -> AudioSegment:
  """簡易ノイズ除去: 低周波ノイズを抑制"""
  return audio.high_pass_filter(200)

def normalize_volume(audio: AudioSegment, target_db: float = DEFAULT_TARGET_DB) -> AudioSegment:
  """音源の全体音量をtarget_dbに近づける。"""
  if audio.dBFS == float('-inf'):
    return audio
  target_dbfs = target_db - 100
  gain = target_dbfs - audio.dBFS
  return audio.apply_gain(gain)

BGM_FOLDER = os.path.join(os.path.dirname(__file__), 'bgm')
BGM_DUCK_DB = -20.0 # BGMをポッドキャスト再生中に10%の音量にする（約-20dB） 20 * log10(0.1) = -20 dB


def set_bgm(source: AudioSegment, bgm_name: str,
            intro_duration_ms: int = 5000,
            outro_duration_ms: int = 5000) -> AudioSegment:
    """Combine intro/outro BGM with source audio and duck BGM during the body."""
    bgm_path = os.path.join(BGM_FOLDER, bgm_name)
    bgm_audio = AudioSegment.from_file(bgm_path)

    podcast_duration_ms = len(source)
    total_duration_ms = intro_duration_ms + podcast_duration_ms + outro_duration_ms

    full_bgm = bgm_audio
    if len(full_bgm) < total_duration_ms:
        num_loops = (total_duration_ms + len(full_bgm) - 1) // len(full_bgm)
        full_bgm *= num_loops
    full_bgm = full_bgm[:total_duration_ms]

    intro_bgm = full_bgm[:intro_duration_ms]

    body_bgm_start = intro_duration_ms
    body_bgm_end = intro_duration_ms + podcast_duration_ms
    body_bgm = full_bgm[body_bgm_start:body_bgm_end]

    outro_bgm_start = body_bgm_end
    outro_bgm = full_bgm[outro_bgm_start:total_duration_ms]

    fade_out_duration_ms = 1000
    if len(outro_bgm) >= fade_out_duration_ms:
        outro_bgm = outro_bgm.fade_out(fade_out_duration_ms)
    elif len(outro_bgm) > 0:
        outro_bgm = outro_bgm.fade_out(len(outro_bgm))

    body = body_bgm.overlay(source, gain_during_overlay=BGM_DUCK_DB)

    final_mix = intro_bgm + body + outro_bgm
    return final_mix
