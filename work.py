import os
from pydub import AudioSegment

BGM_FOLDER = os.path.join(os.path.dirname(__file__), 'bgm')


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

    bgm_duck_db = -20.0
    body = body_bgm.overlay(source, gain_during_overlay=bgm_duck_db)

    final_mix = intro_bgm + body + outro_bgm
    return final_mix
