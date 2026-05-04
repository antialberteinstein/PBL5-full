"""
LCD Bridge for communicating with ESP32-controlled LCD screens.
"""

from __future__ import annotations

import logging
import threading
import time
import unicodedata
import requests

from config.api_config import LCD_ESP32_IP, ENABLE_LCD

_last_lcd_time: float = 0
_lcd_lock = threading.Lock()

def remove_accents(text: str) -> str:
    """Remove Vietnamese accents for LCD display compatibility."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))

def send_to_lcd(name: str, esp32_ip: str = LCD_ESP32_IP) -> None:
    """
    Send a name to the LCD screen via ESP32.
    Includes a 3-second cooldown to avoid overwhelming the ESP32.
    """
    if not ENABLE_LCD:
        return

    global _last_lcd_time

    with _lcd_lock:
        now = time.time()
        if now - _last_lcd_time < 3.0:
            logging.debug("Skipping LCD update (cooldown): %s", name)
            return
        _last_lcd_time = now

    def _send() -> None:
        clean_name = remove_accents(name)
        try:
            logging.info("Sending name '%s' to LCD at %s", clean_name, esp32_ip)
            requests.get(
                f"http://{esp32_ip}/display",
                params={"name": clean_name},
                timeout=2,
            )
            logging.info("Successfully updated LCD with name: %s", clean_name)
        except Exception as e:
            logging.error("LCD update failed: %s", e)

    # Run in a background thread to avoid blocking the caller
    threading.Thread(target=_send, daemon=True).start()
