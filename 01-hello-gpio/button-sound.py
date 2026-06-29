#!/usr/bin/env python3
"""Hold the button -> LED on AND alarm sounds. Release -> both stop.

This is the GPIO-basics demo with sound bolted on. One physical action --
pressing the button -- now drives two kinds of output at once: something you
SEE (the LED) and something you HEAR (alarm.mp3). Hold = light + alarm,
let go = dark + silence.
"""
import shutil
import subprocess
from pathlib import Path
from signal import pause

try:
    from gpiozero import LED, Button
except ImportError:
    print("Couldn't find gpiozero. Check the venv setup in the README.")
    raise SystemExit(1)

# The sound lives in the SAME folder as this script. Building the path this way
# means it works no matter which folder you launch the script from.
SOUND_FILE = Path(__file__).resolve().parent / "alarm.mp3"

# A Raspberry Pi can't play an mp3 straight from Python, so we hand the file off
# to a small command-line music player. mpg123 is the lightest and the one we
# recommend; the rest are just fallbacks in case it's not installed.
# Install the recommended one ONCE with:  sudo apt install mpg123
#
# The flags on each line tell the player two things: "be quiet in the terminal"
# and "loop forever." Looping is what makes it a real alarm -- it keeps blaring
# the whole time the button is held, then we cut it off the moment it's released.
PLAYERS = {
    "mpg123": ["mpg123", "--quiet", "--loop", "-1"],
    "ffplay": ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", "-loop", "0"],
    "cvlc":   ["cvlc", "--quiet", "--loop"],
    "mpv":    ["mpv", "--no-video", "--really-quiet", "--loop=inf"],
}


def find_player():
    """Return the command for the first mp3 player we can find, else None."""
    for name, command in PLAYERS.items():
        if shutil.which(name):   # shutil.which = "is this program installed?"
            return command
    return None


PLAYER = find_player()
led = LED(17)        # GPIO17, pin 11
button = Button(27)  # GPIO27, pin 13

# We keep a handle on the currently-playing sound so we can stop it on release.
current_sound = None


def start_alarm():
    """Button went down: light the LED and start the alarm."""
    global current_sound
    led.on()
    if PLAYER is None or not SOUND_FILE.exists():
        return  # No player or no file -> just skip sound; the LED still works.
    stop_sound()  # belt-and-suspenders: kill any leftover sound first
    # Popen starts the player and immediately returns, so the button stays
    # responsive instead of freezing while the audio plays.
    current_sound = subprocess.Popen(PLAYER + [str(SOUND_FILE)])


def stop_alarm():
    """Button came back up: turn off the LED and silence the alarm."""
    led.off()
    stop_sound()


def stop_sound():
    """Stop the alarm if it's currently playing."""
    global current_sound
    if current_sound is not None and current_sound.poll() is None:
        current_sound.terminate()  # poll() is None means "still running"
    current_sound = None


# Tell the volunteer up front if the SOUND half won't work -- loudly and
# clearly -- but keep running so the LED half of the demo still goes.
if PLAYER is None:
    print("Heads up: no mp3 player found, so the LED works but there's NO sound.")
    print("Fix it once with:  sudo apt install mpg123")
elif not SOUND_FILE.exists():
    print(f"Heads up: couldn't find {SOUND_FILE.name} next to this script.")
    print("The LED works, but there's no sound until that file is in place.")

# These two lines say: "when the button does X, make the Pi do Y."
button.when_pressed = start_alarm
button.when_released = stop_alarm

print("Press the button to light the LED and sound the alarm. Press Ctrl+C to stop.")
# pause() keeps the program alive and listening for presses. Wrapping it lets us
# catch Ctrl+C and shut down tidily instead of dumping a scary traceback.
try:
    pause()
except KeyboardInterrupt:
    pass
finally:
    stop_alarm()  # make sure the LED is off and the alarm is silenced
    print("\nStopped. LED off, alarm quiet. See you at the next press!")
