#!/usr/bin/env python3
"""Blink an LED five times — the 'hello world' of hardware."""
from time import sleep

# gpiozero is the friendly library for talking to the Pi's pins.
# It comes pre-installed on Raspberry Pi OS.
try:
    from gpiozero import LED
except ImportError:
    print("Couldn't find gpiozero.")
    print("Make sure your venv was made with --system-site-packages")
    print("(see the project README note), then try again.")
    raise SystemExit(1)

LED_PIN = 17  # GPIO17, the pin labeled "pin 11" on the header

led = LED(LED_PIN)

print(f"Blinking the LED on GPIO{LED_PIN}. Watch the board!")
for count in range(5):
    led.on()                       # send power to the pin -> light ON
    print(f"  blink {count + 1}")
    sleep(0.5)                     # wait half a second
    led.off()                      # cut the power -> light OFF
    sleep(0.5)

print("Done! If nothing lit up, double-check the wiring and resistor.")
