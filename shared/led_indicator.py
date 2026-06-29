#!/usr/bin/env python3
"""
led_indicator.py — an OPTIONAL LED blinker for the network demos.

The idea: a network packet is invisible. When one arrives, flash a real LED
on the breadboard so the event becomes something you can SEE on the table.

This helper is deliberately fail-soft. If no LED is wired up, or gpiozero
isn't installed, or you're on a laptop with no GPIO pins at all, it does NOT
crash. It prints one clear message and then quietly does nothing whenever you
ask it to flash. The network demo keeps working exactly as before.

Wiring (identical to 01-hello-gpio):
    GPIO pin -> 330 ohm resistor -> LED long leg
    LED short leg -> a GND pin
"""


class PacketLED:
    """Flashes an LED when told to. Becomes a harmless no-op if there's no
    hardware, so the rest of the demo never has to care whether a real LED
    is plugged in."""

    def __init__(self, pin):
        self.pin = pin
        self.led = None  # stays None if anything goes wrong = "no-op mode"

        # gpiozero is the friendly pin library, pre-installed on Raspberry Pi OS.
        try:
            from gpiozero import LED
        except ImportError:
            print(f"[LED] gpiozero not found — running with NO light on GPIO{pin}.")
            print("[LED] (The network demo still works. To enable the light, see")
            print("[LED]  the --system-site-packages venv note in the README.)")
            return

        # Even with gpiozero present, building the LED can fail on a machine
        # with no real GPIO (or if the pin is already in use). Handle it loudly.
        try:
            self.led = LED(pin)
            print(f"[LED] Ready on GPIO{pin}. Each packet will blink the light.")
        except Exception as exc:
            print(f"[LED] Couldn't set up the LED on GPIO{pin}: {exc}")
            print("[LED] Continuing with NO light — the network demo is unaffected.")
            self.led = None

    def flash(self, on_time=0.4):
        """Blink once to announce a packet. Returns immediately — it does NOT
        pause the receive loop, so the light blinks while we keep listening."""
        if self.led is None:
            return  # no-op mode: nothing wired, nothing to do
        try:
            # background=True (the default) runs the blink in its own thread.
            self.led.blink(on_time=on_time, off_time=0.1, n=1, background=True)
        except Exception:
            pass  # never let a hardware hiccup take down the demo

    def close(self):
        """Turn the LED off and release the pin cleanly on shutdown."""
        if self.led is None:
            return
        try:
            self.led.off()
            self.led.close()
        except Exception:
            pass
