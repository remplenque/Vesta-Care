from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.responses import FileResponse, Response, StreamingResponse  # noqa: E402

from app import assistant, tts, whatsapp  # noqa: E402

app = FastAPI(title="Vesta Core")
STATIC = Path(__file__).parent / "static"


@app.get("/")
def mic_test_page() -> FileResponse:
    # Temporary voice test page until web/ exists.
    return FileResponse(STATIC / "mic.html")


@app.get("/v1/persons/{person_id}")
def get_person(person_id: str) -> dict[str, object]:
    if person_id != assistant.PERSON_RECORD["person_id"]:
        raise HTTPException(404, "person_not_found")
    return assistant.PERSON_RECORD


@app.post("/v1/assistant/message", response_model=assistant.AssistantResponse)
async def assistant_message(req: assistant.AssistantRequest) -> assistant.AssistantResponse:
    return await assistant.handle_message(req)


@app.get("/v1/assistant/briefing")
def assistant_briefing(person_id: str = "per_01") -> dict[str, object]:
    return assistant.briefing()


@app.get("/v1/tts/voices")
def tts_voices() -> list[dict[str, str]]:
    return [{"name": name} for name in tts.voices()] if tts.is_configured() else []


@app.get("/v1/tts")
async def text_to_speech(text: str, voice: str | None = None) -> StreamingResponse:
    return await tts.stream_speech(text, voice)


@app.post("/v1/channels/whatsapp/webhook")
async def whatsapp_webhook(request: Request) -> Response:
    return await whatsapp.handle_webhook(request)


@app.get("/health")
def health() -> dict[str, object]:
    import os

    return {
        "status": "ok",
        "llm": bool(os.getenv("ANTHROPIC_API_KEY")),
        "tts": tts.is_configured(),
        "notify": "log",
    }
