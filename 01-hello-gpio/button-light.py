#!/usr/bin/env python3
"""Hold the button -> LED on. Release -> LED off."""
from signal import pause

try:
    from gpiozero import LED, Button
except ImportError:
    print("Couldn't find gpiozero. Check the venv setup in the README.")
    raise SystemExit(1)

led = LED(17)        # GPIO17, pin 11
button = Button(27)  # GPIO27, pin 13

# These two lines say: "when the button does X, make the LED do Y."
button.when_pressed = led.on
button.when_released = led.off

print("Press the button to light the LED. Press Ctrl+C to stop.")
pause()  # keep the program alive and listening for presses

