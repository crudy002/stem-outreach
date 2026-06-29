#!/usr/bin/env python3
"""Combined LED + button demo for 01-hello-gpio.

The whole life of the program, made visible:
  1. Startup    -> blink 3 times to say "I'm ready"
  2. Listening  -> each button press toggles the LED and logs what happened
  3. Shutdown   -> a quick goodbye flutter when you press Ctrl+C
"""

from time import sleep, strftime

# gpiozero is the friendly pin library, pre-installed on Raspberry Pi OS.
try:
    from gpiozero import LED, Button
except ImportError:
    print("Couldn't find gpiozero.")
    print("Your venv probably wasn't built with --system-site-packages.")
    print("See the README note, rebuild the venv, then run this again.")
    raise SystemExit(1)

LED_PIN = 17     # GPIO17 = header pin 11
BUTTON_PIN = 27  # GPIO27 = header pin 13


def log(message):
    """Print a message stamped with the clock time, so we can follow along."""
    print(f"[{strftime('%H:%M:%S')}] {message}")


def blink(led, times, on=0.15, off=0.15):
    """Flash the LED a set number of times."""
    for _ in range(times):
        led.on()
        sleep(on)
        led.off()
        sleep(off)


led = LED(LED_PIN)
button = Button(BUTTON_PIN)

press_count = 0  # how many times the button has been pressed


def on_press():
    """Runs automatically every time the button is pressed."""
    global press_count
    press_count += 1
    led.toggle()  # if it's off, turn it on -- and vice versa
    state = "ON " if led.is_lit else "OFF"
    log(f"Button press #{press_count}  ->  LED is now {state}")


button.when_pressed = on_press

# --- startup: say hello ---
log("Starting up...")
log(f"LED on GPIO{LED_PIN} (pin 11), button on GPIO{BUTTON_PIN} (pin 13)")
blink(led, 3)  # the "I'm ready" signal
log("Ready! Press the button to toggle the LED.  (Ctrl+C to quit)")

# --- main loop: just stay alive and let presses come in ---
try:
    while True:
        sleep(0.1)  # nothing to do here -- gpiozero handles presses for us
except KeyboardInterrupt:
    print()  # tidy newline so the ^C doesn't sit on our log line
    log("Shutting down...")
    led.off()
    blink(led, 5, on=0.08, off=0.08)  # quick goodbye flutter
    led.off()
    log(f"Done. You pressed the button {press_count} time(s). Bye!")
