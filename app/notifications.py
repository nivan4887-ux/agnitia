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

    enable_voice_calls = os.environ.get("ENABLE_TWILIO_CALLS", "false").strip().lower() in ("true", "1", "yes")

    return {
        "provider": "telegram",
        "configured": bool(bot_token and chat_id),
        "bot_token_present": bool(bot_token),
        "chat_id": chat_id,
        "phone_destination": phone_dest,
        "twilio_configured": False,
        "twilio_to": "",
        "voice_calls_enabled": False,
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
    timeout_seconds: float = 6.0,
) -> Dict[str, Any]:
    """Voice calls are permanently disabled per system policy.
    
    All SOS alerts and sirens operate strictly through the web application audio siren and Telegram push notifications.
    Zero outbound calls are made to external telecom providers.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    logger.info("Voice call execution requested but permanently disabled: incident %s", incident_id)
    return {
        "provider": "twilio_voice",
        "accepted": False,
        "status": "disabled_by_policy",
        "destination": "disabled",
        "timestamp": now_iso,
        "error": "Outbound phone calls are disabled. Emergency alerts operate strictly on the website siren and Telegram.",
    }


