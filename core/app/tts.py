"""ElevenLabs text-to-speech proxy. The API key never leaves the server."""

import os

import httpx2
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
MAX_CHARS = 600  # assistant replies are 3 short sentences; this caps credit spend

_client: httpx2.AsyncClient | None = None


def voices() -> dict[str, str]:
    """Parse ELEVENLABS_VOICES ("Emilia:id,Mateo:id") into {name: voice_id}, keeping order."""
    pairs = (item.split(":", 1) for item in os.getenv("ELEVENLABS_VOICES", "").split(",") if ":" in item)
    return {name.strip(): voice_id.strip() for name, voice_id in pairs if name.strip() and voice_id.strip()}


def is_configured() -> bool:
    return bool(os.getenv("ELEVENLABS_API_KEY") and voices())


def _get_client() -> httpx2.AsyncClient:
    global _client
    if _client is None:
        _client = httpx2.AsyncClient(timeout=httpx2.Timeout(10.0, connect=5.0))
    return _client


async def stream_speech(text: str, voice: str | None = None) -> StreamingResponse:
    if not is_configured():
        raise HTTPException(503, "tts_not_configured")
    available = voices()
    if voice is None:
        voice = next(iter(available))
    if voice not in available:
        raise HTTPException(400, "unknown_voice")
    text = text.strip()[:MAX_CHARS]
    if not text:
        raise HTTPException(400, "empty_text")

    request = _get_client().build_request(
        "POST",
        ELEVENLABS_URL.format(voice_id=available[voice]),
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "accept": "audio/mpeg"},
        json={
            "text": text,
            "model_id": os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "speed": 0.9},
        },
    )
    try:
        upstream = await _get_client().send(request, stream=True)
    except httpx2.HTTPError as exc:
        print(f"[tts] ElevenLabs unreachable: {exc!r}")
        raise HTTPException(503, "tts_unreachable") from exc

    if upstream.status_code != 200:
        detail = (await upstream.aread())[:300]
        await upstream.aclose()
        print(f"[tts] ElevenLabs {upstream.status_code}: {detail!r}")
        raise HTTPException(503, f"tts_upstream_{upstream.status_code}")

    return StreamingResponse(
        upstream.aiter_bytes(),
        media_type="audio/mpeg",
        background=BackgroundTask(upstream.aclose),
    )
