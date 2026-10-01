"""Inbound WhatsApp via Twilio: Twilio POSTs each message here and we answer with TwiML.

Replying inside the webhook response means no Twilio SDK and no outbound API call.
"""

import base64
import hashlib
import hmac
import os
from xml.sax.saxutils import escape

from fastapi import HTTPException, Request
from fastapi.responses import Response

from app import assistant

UNKNOWN_NUMBER_REPLY = "Hola, soy Vesta. Este número todavía no está registrado conmigo."
MEDIA_REPLY = "Por ahora solo puedo leer mensajes escritos. ¿Me lo puede escribir, por favor?"


def _numbers_to_person() -> dict[str, str]:
    """WHATSAPP_PERSON_NUMBERS="+56911111111,+56922222222" -> every number talks as per_01."""
    raw = os.getenv("WHATSAPP_PERSON_NUMBERS", "")
    return {n.strip(): "per_01" for n in raw.split(",") if n.strip()}


def _twiml(text: str | None) -> Response:
    body = f"<Message>{escape(text)}</Message>" if text else ""
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><Response>{body}</Response>', media_type="application/xml")


def _valid_signature(url: str, params: dict[str, str], signature: str, token: str) -> bool:
    # Twilio: base64(HMAC-SHA1(auth_token, url + each param key+value sorted by key)).
    payload = url + "".join(k + params[k] for k in sorted(params))
    digest = hmac.new(token.encode(), payload.encode(), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


async def handle_webhook(request: Request) -> Response:
    params = {k: str(v) for k, v in (await request.form()).items()}

    token = os.getenv("TWILIO_AUTH_TOKEN")
    public_url = os.getenv("PUBLIC_CORE_URL")
    if token and public_url:
        url = public_url.rstrip("/") + request.url.path
        if not _valid_signature(url, params, request.headers.get("X-Twilio-Signature", ""), token):
            raise HTTPException(403, "invalid_signature")
    else:
        print("[whatsapp] signature check skipped: set TWILIO_AUTH_TOKEN and PUBLIC_CORE_URL")

    sender = params.get("From", "").removeprefix("whatsapp:")
    person_id = _numbers_to_person().get(sender)
    if person_id is None:
        print(f"[whatsapp] message from unregistered number ending in {sender[-4:]}")
        return _twiml(UNKNOWN_NUMBER_REPLY)

    if int(params.get("NumMedia", "0") or 0) > 0 and not params.get("Body", "").strip():
        return _twiml(MEDIA_REPLY)

    text = params.get("Body", "").strip()
    if not text:
        return _twiml(None)

    res = await assistant.handle_message(
        assistant.AssistantRequest(person_id=person_id, channel="whatsapp", text=text)
    )
    return _twiml(res.reply)
