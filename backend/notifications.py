import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from pywebpush import webpush, WebPushException

import config

logger = logging.getLogger("aaharsetu.notifications")

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"
SUBSCRIPTIONS_FILE = Path(__file__).resolve().parent / "push_subscriptions.json"


class NotificationManager:
    def __init__(self):
        self.bot_token = config.TELEGRAM_BOT_TOKEN
        self.chat_id = config.TELEGRAM_CHAT_ID
        self.vapid_public_key = config.VAPID_PUBLIC_KEY
        self.vapid_private_key_path = Path(config.VAPID_PRIVATE_KEY_PATH)
        if not self.vapid_private_key_path.is_absolute():
            self.vapid_private_key_path = ROOT_DIR / config.VAPID_PRIVATE_KEY_PATH
        self.vapid_claim = config.VAPID_CLAIM_EMAIL
        self._subscriptions: List[Dict[str, Any]] = self._load_subscriptions()

    def reload_config(self):
        """Reload configuration from environment and .env file."""
        if ENV_FILE.exists():
            from dotenv import dotenv_values
            env_vals = dotenv_values(ENV_FILE)
            self.bot_token = env_vals.get("TELEGRAM_BOT_TOKEN", self.bot_token)
            self.chat_id = env_vals.get("TELEGRAM_CHAT_ID", self.chat_id)
            self.vapid_public_key = env_vals.get("VAPID_PUBLIC_KEY", self.vapid_public_key)
            priv_path = env_vals.get("VAPID_PRIVATE_KEY_PATH", "")
            if priv_path:
                p = Path(priv_path)
                self.vapid_private_key_path = p if p.is_absolute() else ROOT_DIR / p
            self.vapid_claim = env_vals.get("VAPID_CLAIM_EMAIL", self.vapid_claim)

    def _persist_env_var(self, key: str, value: str):
        """Safely update or append a key-value in .env file."""
        if not ENV_FILE.exists():
            ENV_FILE.write_text(f"{key}={value}\n", encoding="utf-8")
            return
        
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
        found = False
        new_lines = []
        for line in lines:
            if line.strip().startswith(f"{key}=") or line.strip().startswith(f"{key} ="):
                new_lines.append(f"{key}={value}")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"{key}={value}")
        ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        os.environ[key] = value

    # ==================== TELEGRAM BOT INTEGRATION ====================

    def get_telegram_status(self) -> Dict[str, Any]:
        """Fetch real-time Telegram Bot info and updates status."""
        self.reload_config()
        if not self.bot_token:
            return {
                "configured": False,
                "target_configured": False,
                "bot": None,
                "chat_id": None,
                "message": "TELEGRAM_BOT_TOKEN is not set.",
            }

        bot_info = None
        recent_updates_count = 0
        latest_sender = None
        error_msg = None

        try:
            me_resp = requests.get(
                f"https://api.telegram.org/bot{self.bot_token}/getMe",
                timeout=15,
            ).json()
            if me_resp.get("ok"):
                bot_info = me_resp["result"]
            else:
                error_msg = me_resp.get("description", "Invalid bot token")
        except Exception as exc:
            error_msg = f"Network error contacting Telegram API: {exc}"

        if bot_info:
            try:
                updates_resp = requests.get(
                    f"https://api.telegram.org/bot{self.bot_token}/getUpdates?limit=5",
                    timeout=15,
                ).json()
                if updates_resp.get("ok"):
                    results = updates_resp.get("result", [])
                    recent_updates_count = len(results)
                    if results:
                        last = results[-1]
                        msg = last.get("message") or last.get("channel_post") or last.get("my_chat_member")
                        if msg:
                            chat = msg.get("chat", {})
                            latest_sender = chat.get("first_name") or chat.get("title") or chat.get("username")
            except Exception as exc:
                logger.warning("Could not fetch Telegram updates: %s", exc)

        return {
            "configured": bool(self.bot_token),
            "target_configured": bool(self.chat_id),
            "chat_id": self.chat_id or None,
            "bot": bot_info,
            "recent_updates_count": recent_updates_count,
            "latest_sender": latest_sender,
            "error": error_msg,
        }

    def detect_telegram_chat(self) -> Dict[str, Any]:
        """
        Polls getUpdates to detect the chat ID of a user or group who clicked /start
        or messaged @ahaarsetu_bot, saves it to .env, and sends a confirmation message.
        """
        self.reload_config()
        if not self.bot_token:
            return {"success": False, "message": "TELEGRAM_BOT_TOKEN is missing in .env"}

        try:
            updates_resp = requests.get(
                f"https://api.telegram.org/bot{self.bot_token}/getUpdates",
                timeout=15,
            ).json()
        except Exception as exc:
            return {"success": False, "message": f"Failed to contact Telegram API: {exc}"}

        if not updates_resp.get("ok"):
            return {
                "success": False,
                "message": f"Telegram API error: {updates_resp.get('description', 'Unknown')}",
            }

        updates = updates_resp.get("result", [])
        if not updates:
            bot_username = "ahaarsetu_bot"
            return {
                "success": False,
                "message": (
                    f"No incoming messages found yet. Please open Telegram, search for @{bot_username} "
                    f"(or open https://t.me/{bot_username}), tap 'Start' or send /start, and try detecting again."
                ),
            }

        # Look for the newest message with a chat
        detected_chat_id = None
        sender_label = "Rescue Coordinator"

        for update in reversed(updates):
            msg = update.get("message") or update.get("channel_post") or update.get("my_chat_member")
            if msg and "chat" in msg and "id" in msg["chat"]:
                detected_chat_id = str(msg["chat"]["id"])
                chat = msg["chat"]
                sender_label = chat.get("title") or chat.get("first_name") or chat.get("username") or "Telegram User"
                break

        if not detected_chat_id:
            return {
                "success": False,
                "message": "Found updates, but could not determine a valid chat destination.",
            }

        # Save to .env and runtime
        self.chat_id = detected_chat_id
        config.TELEGRAM_CHAT_ID = detected_chat_id
        self._persist_env_var("TELEGRAM_CHAT_ID", detected_chat_id)

        # Send welcome message
        welcome_text = (
            "🌿 *AaharSetu Food Rescue Network Connected!*\n\n"
            f"Hello {sender_label}! This chat has been successfully linked to receive real-time rescue "
            "notifications, driver dispatches, and safe-window emergency alerts.\n\n"
            "• Destination ID: `" + detected_chat_id + "`\n"
            "• Status: Active & Operational 🟢"
        )
        self.send_telegram_alert(welcome_text)

        return {
            "success": True,
            "chat_id": detected_chat_id,
            "sender": sender_label,
            "message": f"Successfully detected and configured Telegram Chat ID: {detected_chat_id} ({sender_label})!",
        }

    def set_telegram_chat(self, chat_id: str) -> Dict[str, Any]:
        """Manually configure and verify a Telegram chat ID."""
        cleaned = chat_id.strip()
        if not cleaned:
            return {"success": False, "message": "Chat ID cannot be empty."}

        self.chat_id = cleaned
        config.TELEGRAM_CHAT_ID = cleaned
        self._persist_env_var("TELEGRAM_CHAT_ID", cleaned)

        # Send ping verification
        ping_text = (
            "🌿 *AaharSetu Destination Configured!*\n\n"
            "Your chat destination has been manually registered. "
            "Automated rescue alerts will now be sent here."
        )
        sent = self.send_telegram_alert(ping_text)

        return {
            "success": sent.get("sent", False),
            "chat_id": cleaned,
            "message": "Chat ID saved and verified." if sent.get("sent") else f"Saved, but ping failed: {sent.get('error')}",
        }

    def send_telegram_alert(self, text: str, parse_mode: str = "Markdown") -> Dict[str, Any]:
        """Send a message to the configured Telegram destination."""
        self.reload_config()
        if not self.bot_token or not self.chat_id:
            return {
                "sent": False,
                "error": "Telegram bot token or destination chat ID is missing.",
            }

        try:
            resp = requests.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": True,
                },
                timeout=15,
            ).json()

            if resp.get("ok"):
                return {"sent": True, "message_id": resp["result"]["message_id"]}
            return {"sent": False, "error": resp.get("description", "Failed to send message")}
        except Exception as exc:
            logger.error("Failed to send Telegram message: %s", exc)
            return {"sent": False, "error": str(exc)}

    # ==================== WEB PUSH NOTIFICATIONS ====================

    def _load_subscriptions(self) -> List[Dict[str, Any]]:
        if SUBSCRIPTIONS_FILE.exists():
            try:
                return json.loads(SUBSCRIPTIONS_FILE.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error("Error reading subscriptions: %s", e)
        return []

    def _save_subscriptions(self):
        try:
            SUBSCRIPTIONS_FILE.write_text(json.dumps(self._subscriptions, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error("Error saving subscriptions: %s", e)

    def get_vapid_public_key(self) -> str:
        self.reload_config()
        return self.vapid_public_key

    def add_push_subscription(self, subscription: Dict[str, Any], city_id: str = "blr", user_id: Optional[str] = None):
        """Register or update a browser push subscription."""
        endpoint = subscription.get("endpoint")
        if not endpoint:
            raise ValueError("Subscription must have an endpoint")

        # Deduplicate by endpoint
        self._subscriptions = [s for s in self._subscriptions if s.get("endpoint") != endpoint]
        self._subscriptions.append({
            "subscription": subscription,
            "endpoint": endpoint,
            "city_id": city_id,
            "user_id": user_id,
        })
        self._save_subscriptions()
        return {"status": "subscribed", "total_subscribers": len(self._subscriptions)}

    def remove_push_subscription(self, endpoint: str):
        """Unsubscribe an endpoint."""
        initial = len(self._subscriptions)
        self._subscriptions = [s for s in self._subscriptions if s.get("endpoint") != endpoint]
        if len(self._subscriptions) != initial:
            self._save_subscriptions()
        return {"status": "unsubscribed", "total_subscribers": len(self._subscriptions)}

    def send_web_push(self, subscription: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        """Send an encrypted Web Push notification using pywebpush."""
        self.reload_config()
        if not self.vapid_private_key_path.exists():
            logger.error("VAPID private key file not found at %s", self.vapid_private_key_path)
            return False

        try:
            webpush(
                subscription_info=subscription,
                data=json.dumps(payload),
                vapid_private_key=str(self.vapid_private_key_path),
                vapid_claims={"sub": self.vapid_claim},
                ttl=120,
            )
            return True
        except WebPushException as exc:
            logger.warning("WebPush failed: %s (Response: %s)", exc, exc.response.text if exc.response else "")
            return False
        except Exception as exc:
            logger.error("Unexpected error sending webpush: %s", exc)
            return False

    def broadcast_alert(
        self,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        city_id: Optional[str] = None,
        send_telegram: bool = True,
    ) -> Dict[str, Any]:
        """Broadcast rescue alert to both Web Push subscribers and Telegram destination."""
        payload = {
            "title": title,
            "body": body,
            "icon": "/icon.svg",
            "badge": "/icon.svg",
            "tag": "aaharsetu-rescue-alert",
            "data": data or {"url": "/"},
        }

        # 1. Web Push broadcast
        active_subscribers = []
        sent_count = 0
        failed_count = 0

        for item in self._subscriptions:
            if city_id and item.get("city_id") and item.get("city_id") != city_id:
                active_subscribers.append(item)
                continue

            sub = item.get("subscription")
            if not sub:
                continue

            ok = self.send_web_push(sub, payload)
            if ok:
                sent_count += 1
                active_subscribers.append(item)
            else:
                failed_count += 1
                # Drop invalid/expired subscriptions
                continue

        if len(active_subscribers) != len(self._subscriptions):
            self._subscriptions = active_subscribers
            self._save_subscriptions()

        # 2. Telegram Alert
        telegram_result = None
        if send_telegram and self.chat_id:
            tg_text = (
                f"🚨 *{title}*\n\n"
                f"{body}\n\n"
                f"📍 City: `{city_id or 'All'}`\n"
                f"⏱ Sent at: `{data.get('timestamp') if data else 'Now'}`"
            )
            telegram_result = self.send_telegram_alert(tg_text)

        return {
            "web_push_sent": sent_count,
            "web_push_failed": failed_count,
            "active_subscribers": len(self._subscriptions),
            "telegram": telegram_result,
        }


notifications = NotificationManager()
