"""
BRIDGE – Emergency Notification Dispatcher.

Dispatches urgent SOS alerts to registered phone destinations using the Telegram Bot API.
Verifies provider acceptance synchronously and reports delivery status honestly without
claiming false delivery guarantees.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(override=False)
except ImportError:
    pass

logger = logging.getLogger("bridge.notifications")

# Telegram Bot API endpoint
TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"


def get_notification_config() -> Dict[str, Any]:
    """Retrieve notification provider configuration."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    phone_dest = os.environ.get("TELEGRAM_PHONE_DESTINATION", chat_id).strip()

    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    twilio_from = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
    twilio_to = os.environ.get("TWILIO_TO_NUMBER", "").strip()

    enable_voice_calls = os.environ.get("ENABLE_TWILIO_CALLS", "true").strip().lower() in ("true", "1", "yes")
    has_twilio = bool(twilio_sid and twilio_token and twilio_from and twilio_to)

    return {
        "provider": "telegram",
        "configured": bool(bot_token and chat_id),
        "bot_token_present": bool(bot_token),
        "chat_id": chat_id,
        "phone_destination": phone_dest,
        "twilio_configured": bool(enable_voice_calls and has_twilio),
        "twilio_to": twilio_to,
        "voice_calls_enabled": enable_voice_calls,
    }


def format_sos_message(
    incident_id: str,
    service: str,
    reason: str,
    current_status: str = "open",
    affected_services: Optional[list[str]] = None,
    failure_type: str = "monitored_failure",
) -> str:
    """Format structured emergency markdown message for mobile push alert."""
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    affected_str = ", ".join(affected_services) if affected_services else service

    return (
        f"🚨 *BRIDGE EMERGENCY SOS ALERT*\n\n"
        f"• *Incident ID:* `{incident_id}`\n"
        f"• *Failed Service:* `{service}`\n"
        f"• *Status:* `{current_status.upper()}` (P1 Critical)\n"
        f"• *Trigger Source:* `{failure_type}`\n"
        f"• *Root Cause / Reason:* {reason}\n"
        f"• *Cascaded Services:* `{affected_str}`\n"
        f"• *Timestamp:* {now_utc}\n\n"
        f"⚠️ *Operator Action:* Approval gate required before executing high-risk recovery playbooks."
    )


def notify_sos_destination(
    incident_id: str,
    service: str,
    reason: str,
    current_status: str = "open",
    affected_services: Optional[list[str]] = None,
    failure_type: str = "monitored_failure",
    timeout_seconds: float = 4.0,
) -> Dict[str, Any]:
    """Send emergency alert to registered phone destination via Telegram Bot API.

    Returns structured delivery acceptance report.
    Never claims delivery success unless provider returns HTTP 200 with ok=true.
    """
    config = get_notification_config()
    now_iso = datetime.now(timezone.utc).isoformat()

    result: Dict[str, Any]

    if not config["configured"]:
        logger.info(
            "Notification skipped: Telegram credentials not configured in environment. Operating in mock/test mode."
        )
        result = {
            "provider": "telegram",
            "accepted": False,
            "status": "unconfigured",
            "destination": config["phone_destination"] or "unspecified",
            "timestamp": now_iso,
            "error": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured",
        }
    else:
        message_text = format_sos_message(
            incident_id=incident_id,
            service=service,
            reason=reason,
            current_status=current_status,
            affected_services=affected_services,
            failure_type=failure_type,
        )

        url = TELEGRAM_API_URL.format(token=os.environ.get("TELEGRAM_BOT_TOKEN", "").strip())
        payload = {
            "chat_id": config["chat_id"],
            "text": message_text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "BRIDGE-AlertNotifier/1.0",
                },
            )

            with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
                status_code = resp.getcode()
                response_body = json.loads(resp.read().decode("utf-8"))

                if status_code == 200 and response_body.get("ok") is True:
                    message_id = response_body.get("result", {}).get("message_id")
                    logger.info(
                        "Telegram alert accepted by provider for incident %s (msg_id: %s)",
                        incident_id,
                        message_id,
                    )
                    result = {
                        "provider": "telegram",
                        "accepted": True,
                        "status": "accepted_by_provider",
                        "message_id": message_id,
                        "destination": config["phone_destination"],
                        "timestamp": now_iso,
                        "error": None,
                    }
                else:
                    err_desc = response_body.get("description", "Unknown Telegram API rejection")
                    logger.warning("Telegram notification rejected by API: %s", err_desc)
                    result = {
                        "provider": "telegram",
                        "accepted": False,
                        "status": "rejected_by_provider",
                        "destination": config["phone_destination"],
                        "timestamp": now_iso,
                        "error": err_desc,
                    }

        except urllib.error.HTTPError as http_err:
            err_msg = f"HTTP {http_err.code}: {http_err.reason}"
            logger.warning("Telegram notification failed with HTTP error: %s", err_msg)
            result = {
                "provider": "telegram",
                "accepted": False,
                "status": "provider_http_error",
                "destination": config["phone_destination"],
                "timestamp": now_iso,
                "error": err_msg,
            }
        except Exception as exc:
            logger.warning("Failed to dispatch Telegram alert: %s", exc)
            result = {
                "provider": "telegram",
                "accepted": False,
                "status": "network_or_timeout_error",
                "destination": config["phone_destination"],
                "timestamp": now_iso,
                "error": str(exc),
            }

    return result


def notify_twilio_voice_call(
    incident_id: str,
    service: str,
    reason: str,
    timeout_seconds: float = 8.0,
) -> Dict[str, Any]:
    """Initiate an automated emergency phone call via Twilio Voice API.
    
    Calls the configured operator phone number and plays a spoken text-to-speech
    voice alarm regarding the incident.
    """
    import base64
    import re
    import urllib.parse

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
    to_number = os.environ.get("TWILIO_TO_NUMBER", "").strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    if not (account_sid and auth_token and from_number and to_number):
        return {
            "provider": "twilio_voice",
            "accepted": False,
            "status": "unconfigured",
            "destination": to_number or "unspecified",
            "timestamp": now_iso,
            "error": "TWILIO_ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER, or TO_NUMBER not configured",
        }

    # Clean service and reason for TwiML speech
    safe_service = re.sub(r"[^a-zA-Z0-9_\-\s]", "", service or "system")
    safe_reason = re.sub(r"[^a-zA-Z0-9_\-\s\.\,]", "", reason or "Critical incident detected")
    twiml_say = (
        f"<Response>"
        f"<Pause length='1'/>"
        f"<Say voice='alice' loop='2'>Emergency alert from Agnitia Bridge. Critical failure detected on service {safe_service}. Reason: {safe_reason}. Please check the SRE dashboard immediately.</Say>"
        f"</Response>"
    )

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
    auth_header = "Basic " + base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("ascii")

    form_data = urllib.parse.urlencode({
        "To": to_number,
        "From": from_number,
        "Twiml": twiml_say,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            url,
            data=form_data,
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Agnitia-Bridge-VoiceCaller/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            status_code = resp.getcode()
            body = json.loads(resp.read().decode("utf-8"))
            call_sid = body.get("sid")
            if status_code in (200, 201) and call_sid:
                logger.info("Twilio emergency voice call queued: incident %s (sid: %s)", incident_id, call_sid)
                return {
                    "provider": "twilio_voice",
                    "accepted": True,
                    "status": "call_queued",
                    "call_sid": call_sid,
                    "destination": to_number,
                    "timestamp": now_iso,
                    "error": None,
                }
            else:
                return {
                    "provider": "twilio_voice",
                    "accepted": False,
                    "status": "call_rejected",
                    "destination": to_number,
                    "timestamp": now_iso,
                    "error": body.get("message", "Twilio rejected call"),
                }
    except urllib.error.HTTPError as http_err:
        err_body = ""
        try:
            err_body = http_err.read().decode("utf-8")
        except Exception:
            pass
        logger.warning("Twilio HTTP error (%d): %s", http_err.code, err_body or http_err.reason)
        return {
            "provider": "twilio_voice",
            "accepted": False,
            "status": "twilio_http_error",
            "destination": to_number,
            "timestamp": now_iso,
            "error": f"HTTP {http_err.code}: {err_body or http_err.reason}",
        }
    except Exception as exc:
        logger.warning("Twilio voice call error: %s", exc)
        return {
            "provider": "twilio_voice",
            "accepted": False,
            "status": "network_or_timeout_error",
            "destination": to_number,
            "timestamp": now_iso,
            "error": str(exc),
        }



