"""Assistant: deterministic safety filter first, then a fast LLM with read-only context."""

import json
import os
import re
import unicodedata
from collections import deque
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic
from pydantic import BaseModel

PROMPTS = Path(__file__).parent / "prompts"

# Demo seed until the real store lands (docs/03-MODULE-core.md §5). All fictional.
PERSON = {"display_name": "Don Luis", "address_form": "usted"}
PERSON_RECORD = {
    "person_id": "per_01", "display_name": "Don Luis", "first_name": "Luis", "age": 78,
    "lives_alone": True, "address_form": "usted", "monitoring_paused": False,
    "contacts": ["ctc_01", "ctc_02"],
}
PRIMARY_CONTACT = "Carolina"
TODAY = [
    {"kind": "medication", "title": "Losartán 50 mg", "time": "09:00", "status": "scheduled"},
    {"kind": "appointment", "title": "Control en el CESFAM", "time": "15:00", "status": "scheduled"},
    {"kind": "social", "title": "Taller de uso del celular (BondUP)", "time": "17:00", "status": "scheduled"},
    {"kind": "medication", "title": "Losartán 50 mg", "time": "21:00", "status": "scheduled"},
]

FLAGS_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "flags": {
            "type": "object",
            "properties": {
                "medical_question": {"type": "boolean"},
                "wants_family_contact": {"type": "boolean"},
                "confirms_medication": {"type": "boolean"},
                "emergency": {"type": "boolean"},
            },
            "required": ["medical_question", "wants_family_contact", "confirms_medication", "emergency"],
            "additionalProperties": False,
        },
        "suggestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["reply", "flags", "suggestions"],
    "additionalProperties": False,
}


class Flags(BaseModel):
    medical_question: bool = False
    wants_family_contact: bool = False
    confirms_medication: bool = False
    emergency: bool = False


class AssistantRequest(BaseModel):
    person_id: str
    channel: str
    text: str


class AssistantResponse(BaseModel):
    reply: str
    flags: Flags
    actions_taken: list[str]
    fallback: bool
    suggestions: list[str] = []


def _normalize(text: str) -> str:
    stripped = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in stripped if unicodedata.category(c) != "Mn")


def _load_phrases(name: str) -> list[str]:
    lines = (PROMPTS / name).read_text(encoding="utf-8").splitlines()
    return [_normalize(line.strip()) for line in lines if line.strip() and not line.startswith("#")]


EMERGENCY_PHRASES = _load_phrases("emergency_phrases.txt")
MEDICAL_PHRASES = _load_phrases("medical_phrases.txt")
SYSTEM_PROMPT = (PROMPTS / "assistant.md").read_text(encoding="utf-8")

MEDICAL_REPLY = f"Esa es una muy buena pregunta para su médico, {PERSON['display_name']}. Le voy a avisar a {PRIMARY_CONTACT} para que lo conversen juntos."
CONFIRM_REPLY = f"Gracias por avisarme, {PERSON['display_name']}. Ya quedó anotado que abrió su medicación."
INGESTION_CLAIM = re.compile(r"\b(se (la |lo )?(haya |ha )?(tomo|tomado)|tomo su)\b")
EMERGENCY_REPLY = f"{PERSON['display_name']}, ya le estoy avisando a {PRIMARY_CONTACT}. Si es grave, llame al 131."

# Tap-to-answer options shown under each reply. Fixed replies get fixed options.
DEFAULT_SUGGESTIONS = ["¿Qué tengo hoy?", "Quiero conversar", f"Avísale a {PRIMARY_CONTACT}"]
MEDICAL_SUGGESTIONS = ["Gracias", "¿Qué tengo hoy?", "Conversemos de otra cosa"]
CONFIRM_SUGGESTIONS = ["Gracias", "¿Qué más tengo hoy?", "Quiero conversar"]
EMERGENCY_SUGGESTIONS = ["Ya estoy bien", f"Llama a {PRIMARY_CONTACT}"]
# Suggestions must never put medication words in the person's mouth (e.g. "Ya tomé el Losartán").
MEDICATION_WORDS = re.compile(
    r"\b(pastilla|remedio|medic|dosis|tome|tomar|tomo|" + "|".join(
        re.escape(_normalize(i["title"].split()[0])) for i in TODAY if i["kind"] == "medication"
    ) + r")"
)
MAX_SUGGESTIONS = 3
MAX_SUGGESTION_CHARS = 32

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        # Voice: a long wait feels broken, so fail fast and fall back.
        _client = anthropic.AsyncAnthropic(timeout=8.0, max_retries=0)
    return _client


_NUMBERS = ["doce", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once"]


def _spoken_time(hhmm: str) -> str:
    """'15:00' -> 'las tres de la tarde', the way an older adult hears it best."""
    hour, minute = (int(x) for x in hhmm.split(":"))
    period = "de la mañana" if hour < 12 else "de la tarde" if hour < 20 else "de la noche"
    article = "la" if hour % 12 == 1 else "las"
    minutes = "" if minute == 0 else " y media" if minute == 30 else f" y {minute}"
    return f"{article} {_NUMBERS[hour % 12]}{minutes} {period}"


def _greeting() -> str:
    hour = datetime.now(ZoneInfo("America/Santiago")).hour
    return "Buenos días" if hour < 12 else "Buenas tardes" if hour < 20 else "Buenas noches"


def _briefing_text() -> str:
    parts = [f"{i['title']} a {_spoken_time(i['time'])}" for i in TODAY]
    return f"{_greeting()}, {PERSON['display_name']}. Hoy tiene " + ", ".join(parts[:-1]) + f" y {parts[-1]}."


def _fallback_reply(norm: str) -> str:
    if any(w in norm for w in ("que tengo", "hoy", "agenda", "dia")):
        return _briefing_text()
    if any(w in norm for w in ("hola", "buenos", "buenas")):
        return f"¡{_greeting()}, {PERSON['display_name']}! Qué alegría saludarlo. ¿Cómo está hoy, {PERSON['display_name']}?"
    return f"Disculpe, {PERSON['display_name']}, no le alcancé a escuchar bien. ¿Me lo repite, por favor?"


# Recent turns per person, shared across channels (voice and WhatsApp). In memory on purpose:
# conversation content is not persisted and never shown to the family.
_history: dict[str, deque[dict[str, str]]] = {}


def _turns(person_id: str) -> deque[dict[str, str]]:
    return _history.setdefault(person_id, deque(maxlen=8))


def _clean_suggestions(raw: list[str]) -> list[str]:
    """Keep short, distinct options; drop anything that steers toward medication decisions."""
    out: list[str] = []
    for item in raw:
        text = " ".join(str(item).split()).strip(" .")
        norm = _normalize(text)
        if not text or len(text) > MAX_SUGGESTION_CHARS or norm in (_normalize(o) for o in out):
            continue
        if any(p in norm for p in MEDICAL_PHRASES + EMERGENCY_PHRASES) or MEDICATION_WORDS.search(norm):
            continue
        out.append(text)
    return out[:MAX_SUGGESTIONS]


def _strip_ingestion_claims(reply: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", reply.strip())
    kept = [x for x in sentences if not INGESTION_CLAIM.search(_normalize(x))]
    if len(kept) == len(sentences):
        return reply
    return " ".join(kept) or f"Aquí estoy para lo que necesite, {PERSON['display_name']}."


async def _ask_llm(person_id: str, text: str) -> tuple[str, Flags, list[str]]:
    context = {
        "person": PERSON,
        "now_local": datetime.now(ZoneInfo("America/Santiago")).strftime("%H:%M"),
        "today": TODAY,
        "primary_contact_name": PRIMARY_CONTACT,
        "recent_turns": list(_turns(person_id)),
    }
    response = await _get_client().messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"<estado>{json.dumps(context, ensure_ascii=False)}</estado>\n\n<persona_dice>{text}</persona_dice>",
        }],
        output_config={"format": {"type": "json_schema", "schema": FLAGS_SCHEMA}},
    )
    if response.stop_reason == "refusal":
        raise ValueError("refusal")
    raw = next(b.text for b in response.content if b.type == "text")
    data = json.loads(raw)
    return data["reply"], Flags(**data["flags"]), _clean_suggestions(data.get("suggestions", []))


async def handle_message(req: AssistantRequest) -> AssistantResponse:
    res = await _respond(req)
    turns = _turns(req.person_id)
    turns.append({"role": "person", "text": req.text})
    turns.append({"role": "assistant", "text": res.reply})
    return res


async def _respond(req: AssistantRequest) -> AssistantResponse:
    norm = _normalize(req.text)

    # Deterministic filter runs before the LLM and never depends on the network.
    if any(p in norm for p in EMERGENCY_PHRASES):
        return AssistantResponse(
            reply=EMERGENCY_REPLY, flags=Flags(emergency=True),
            actions_taken=["alert_opened"], fallback=True, suggestions=EMERGENCY_SUGGESTIONS,
        )
    forced_medical = any(p in norm for p in MEDICAL_PHRASES)
    if forced_medical:
        return AssistantResponse(
            reply=MEDICAL_REPLY, flags=Flags(medical_question=True),
            actions_taken=["alert_opened"], fallback=True, suggestions=MEDICAL_SUGGESTIONS,
        )

    try:
        reply, flags, suggestions = await _ask_llm(req.person_id, req.text)
        fallback = False
    except Exception as exc:  # no key, network, bad JSON: the assistant must still answer
        print(f"[assistant] LLM unavailable, using fallback: {exc!r}")
        reply, flags, fallback, suggestions = _fallback_reply(norm), Flags(), True, []

    if flags.medical_question:
        reply = MEDICAL_REPLY  # fixed text, never the model's wording on clinical topics
        suggestions = MEDICAL_SUGGESTIONS
    elif flags.confirms_medication:
        reply = CONFIRM_REPLY
        suggestions = CONFIRM_SUGGESTIONS
    elif flags.emergency:
        suggestions = EMERGENCY_SUGGESTIONS

    # We only know a compartment was opened; drop any sentence that claims or asks about ingestion.
    reply = _strip_ingestion_claims(reply)

    actions: list[str] = []
    if flags.medical_question or flags.emergency:
        actions.append("alert_opened")
    if flags.wants_family_contact:
        actions.append("family_notified")
    return AssistantResponse(
        reply=reply, flags=flags, actions_taken=actions, fallback=fallback,
        suggestions=suggestions or DEFAULT_SUGGESTIONS,
    )


def briefing() -> dict[str, object]:
    return {"reply": _briefing_text(), "fallback": True, "suggestions": DEFAULT_SUGGESTIONS}
