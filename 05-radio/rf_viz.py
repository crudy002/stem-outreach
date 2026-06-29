#!/usr/bin/env python3
"""
spectrum.py - a live radio "spectrum" you can watch right in the terminal.

It runs the rtl_sdr program in the background, reads the raw radio samples it
spits out, and draws a bar chart of "how much signal is at each frequency"
right now. Press f to jump to a new station any time.

The big idea: the air around you is full of radio waves at many different
frequencies, all at once. This is a little window that shows a slice of them
as bars - a tall bar means a strong signal at that spot. Tuning just slides
the window to a different part of the radio dial. The dongle itself is "dumb":
it just hands us a firehose of numbers (I/Q samples), and ALL of the "this is
a spectrum" cleverness happens here in software. That's what the "software" in
software-defined radio means.

Needs:
  - an RTL-SDR dongle plugged in
  - the rtl_sdr command:   sudo apt install rtl-sdr
  - numpy:                 pip install numpy   (inside the project venv)

Controls while running:
  f       type a new station, in MHz (e.g. 104.5)
  q       quit
  Ctrl-C  also quits  (so does being killed with SIGTERM)
"""

import sys
import time
import select
import shutil
import signal
import argparse
import threading
import subprocess

# numpy is our one outside helper. If it's missing, say so in plain English.
try:
    import numpy as np
except ImportError:
    sys.exit(
        "\nThis needs numpy and it isn't installed.\n"
        "Turn on the project's virtual environment, then install it:\n"
        "    source venv/bin/activate\n"
        "    pip install numpy\n"
    )

# termios/tty let us read single keypresses without waiting for Enter.
# They only exist on Linux/Mac - which is fine, this runs on a Pi.
try:
    import termios
    import tty
    HAVE_TERMIOS = True
except ImportError:
    HAVE_TERMIOS = False

# ----- terminal text tricks (ANSI escape codes) ----------------------------
HOME     = "\033[H"          # move cursor to top-left
CLEAR    = "\033[2J\033[H"   # wipe the whole screen
EOL      = "\033[K"          # erase from cursor to end of line
HIDE_CUR = "\033[?25l"
SHOW_CUR = "\033[?25h"
RESET    = "\033[0m"
GREEN    = "\033[92m"
YELLOW   = "\033[93m"
RED      = "\033[91m"
DIM      = "\033[90m"

FFT_SIZE = 2048              # how many samples become one picture
BLOCK    = FFT_SIZE * 2      # rtl_sdr sends 2 bytes (an I and a Q) per sample

# Shared between the background reader thread and the main display loop.
shared = {
    "proc":   None,                  # the running rtl_sdr process
    "latest": None,                  # the newest block of raw bytes it gave us
    "run":    True,                  # flips False when we're shutting down
    "lock":   threading.Lock(),
}


def spawn(freq_hz, rate, gain):
    """Start rtl_sdr tuned to freq_hz, streaming raw samples to our pipe."""
    args = ["rtl_sdr", "-f", str(int(freq_hz)), "-s", str(int(rate))]
    if gain is not None:             # leaving -g off lets the dongle auto-gain
        args += ["-g", str(gain)]
    args += ["-"]                    # "-" means: write samples to stdout
    return subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,   # hush the normal "lost samples" chatter
    )


def reader_loop():
    """Background job: constantly keep the freshest block of samples on hand."""
    while shared["run"]:
        proc = shared["proc"]
        if proc is None or proc.stdout is None:
            time.sleep(0.05)
            continue
        try:
            block = proc.stdout.read(BLOCK)
        except (ValueError, OSError):
            # the pipe got closed underneath us mid-retune - that's expected
            time.sleep(0.02)
            continue
        if not block:                # empty = the process ended (retuning)
            time.sleep(0.02)
            continue
        shared["latest"] = block


def retune(freq_hz, rate, gain):
    """Switch stations by restarting rtl_sdr on the new frequency."""
    with shared["lock"]:
        old = shared["proc"]
        shared["proc"] = spawn(freq_hz, rate, gain)
    if old:                          # stop the previous one cleanly
        old.terminate()
        try:
            old.wait(timeout=1.0)
        except subprocess.TimeoutExpired:
            old.kill()


# ----- turning raw samples into a picture ----------------------------------
WINDOW = np.hanning(FFT_SIZE)        # smooths the math so the bars look clean


def compute_spectrum(block, smoothed):
    """Raw bytes -> a smoothed 'signal strength at each frequency' array."""
    raw = np.frombuffer(block, dtype=np.uint8)[:BLOCK].astype(np.float32)
    raw -= 127.5                      # samples arrive centered on 127.5
    iq = raw[0::2] + 1j * raw[1::2]   # pair them up into one complex wave

    # The FFT splits that wave into "how much of each frequency is present."
    spec = np.fft.fftshift(np.fft.fft(iq * WINDOW))
    power = 20 * np.log10(np.abs(spec) + 1e-9)   # strength, in decibels

    # The dead-center bar is a known dongle quirk (a "DC spike"), not a real
    # station. Flatten it so it doesn't fool your eyes or the auto-scaling.
    c = FFT_SIZE // 2
    power[c - 2:c + 3] = np.median(power)

    # Ease toward each new frame so the bars don't jitter like crazy.
    if smoothed is None:
        return power
    return 0.5 * power + 0.5 * smoothed


def draw(power, freq_hz, rate):
    """Print the bar chart, painting over the previous frame."""
    term = shutil.get_terminal_size((80, 24))
    width = max(20, term.columns)
    rows = max(6, term.lines - 5)

    # Squash the full-resolution data down to one value per screen column.
    cols = np.interp(np.linspace(0, FFT_SIZE - 1, width),
                     np.arange(FFT_SIZE), power)

    # Scale it so quiet noise sits near the floor and peaks reach the top.
    lo = np.percentile(cols, 25)
    hi = max(np.percentile(cols, 99.7), lo + 6)
    frac = np.clip((cols - lo) / (hi - lo), 0.0, 1.0)
    heights = (frac * rows).astype(int)

    out = [HOME]
    out.append(
        f"{DIM} RTL-SDR live spectrum    "
        f"tuned {freq_hz / 1e6:7.2f} MHz    span {rate / 1e6:.2f} MHz    "
        f"[f] change   [q] quit{RESET}{EOL}"
    )

    # Draw the bars from the top row down to the bottom row.
    for level in range(rows, 0, -1):
        line = []
        for col in range(width):
            if heights[col] >= level:
                f = frac[col]
                color = GREEN if f < 0.5 else YELLOW if f < 0.8 else RED
                line.append(color + "\u2588")     # a solid block
            else:
                line.append(" ")
        out.append("".join(line) + RESET + EOL)

    # A little frequency ruler under the chart.
    half = rate / 2 / 1e6
    left = f"{freq_hz / 1e6 - half:.2f}"
    mid = f"{freq_hz / 1e6:.2f} MHz"
    right = f"{freq_hz / 1e6 + half:.2f}"
    gap = max(0, width - len(left) - len(right))
    ruler = (left + mid.center(gap) + right)[:width]
    out.append(DIM + ruler + RESET + EOL)

    sys.stdout.write("\n".join(out))
    sys.stdout.flush()


def warn(msg):
    """Show a message long enough to actually read it, then carry on."""
    sys.stdout.write("  " + YELLOW + msg + RESET + "\n")
    sys.stdout.flush()
    time.sleep(1.3)


def prompt_new_station(current_hz, old_term, is_tty):
    """Pause the display, ask for a new frequency, return it in Hz."""
    if is_tty and old_term is not None:          # back to normal typing/echo
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_term)
    sys.stdout.write(SHOW_CUR + "\n")

    try:
        text = input("  New station in MHz (e.g. 104.5), blank = keep current: ").strip()
    except (EOFError, KeyboardInterrupt):
        text = ""

    new_hz = current_hz
    if text:
        try:
            f = float(text)
            if f > 3000:                         # they typed Hz - be friendly
                f = f / 1e6
            if 24 <= f <= 1766:                  # the range a basic dongle reaches
                new_hz = f * 1e6
            else:
                warn(f"{f:.3f} MHz is outside the dongle's ~24-1766 MHz range - "
                     f"keeping {current_hz / 1e6:.2f}.")
        except ValueError:
            warn(f"'{text}' isn't a number - keeping {current_hz / 1e6:.2f} MHz.")

    sys.stdout.write(HIDE_CUR + CLEAR)           # back to live mode
    if is_tty:
        tty.setcbreak(sys.stdin.fileno())
    return new_hz


def main():
    ap = argparse.ArgumentParser(description="Live terminal radio spectrum from an RTL-SDR.")
    ap.add_argument("freq", nargs="?", default=104.5, type=float,
                    help="starting station in MHz (default 104.5)")
    ap.add_argument("--rate", type=float, default=1_024_000,
                    help="sample rate in Hz; lower it if the Pi struggles (default 1024000)")
    ap.add_argument("--gain", default="auto",
                    help="tuner gain in dB, or 'auto' (default auto)")
    args = ap.parse_args()

    if shutil.which("rtl_sdr") is None:
        sys.exit("\nCan't find the 'rtl_sdr' command.\n"
                 "Install it with:   sudo apt install rtl-sdr\n"
                 "Then confirm the dongle is seen:   rtl_test\n")

    gain = None if str(args.gain).lower() == "auto" else args.gain
    start_mhz = args.freq if args.freq < 3000 else args.freq / 1e6
    freq_hz = start_mhz * 1e6

    # Kick off the background reader and tune in.
    threading.Thread(target=reader_loop, daemon=True).start()
    retune(freq_hz, args.rate, gain)

    # Wait a moment for samples so we can complain clearly if none show up.
    t0 = time.time()
    while shared["latest"] is None and time.time() - t0 < 2.5:
        if shared["proc"].poll() is not None:
            break
        time.sleep(0.1)
    if shared["latest"] is None:
        shared["run"] = False
        sys.exit("\nThe dongle didn't send any data. Things to check:\n"
                 "  - is the RTL-SDR actually plugged in?\n"
                 "  - does 'rtl_test' see it?\n"
                 "  - is another program (gqrx, SDR++) already using it?\n")

    is_tty = sys.stdin.isatty() and HAVE_TERMIOS
    old_term = termios.tcgetattr(sys.stdin) if is_tty else None

    def cleanup():
        shared["run"] = False
        if shared["proc"]:
            shared["proc"].terminate()
        if is_tty and old_term is not None:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_term)
        sys.stdout.write(SHOW_CUR + RESET + "\n")
        sys.stdout.flush()

    # Being killed (SIGTERM) should clean up exactly like Ctrl-C does.
    signal.signal(signal.SIGTERM, lambda *_: cleanup() or sys.exit(0))

    smoothed = None
    sys.stdout.write(CLEAR + HIDE_CUR)
    if is_tty:
        tty.setcbreak(sys.stdin.fileno())

    try:
        while True:
            block = shared["latest"]
            if block and len(block) >= BLOCK:
                smoothed = compute_spectrum(block, smoothed)
                draw(smoothed, freq_hz, args.rate)

            # Has the user pressed a key? (don't block waiting for one)
            if is_tty and select.select([sys.stdin], [], [], 0)[0]:
                ch = sys.stdin.read(1)
                if ch in ("q", "Q"):
                    break
                if ch in ("f", "F", "\n", "\r"):
                    new_hz = prompt_new_station(freq_hz, old_term, is_tty)
                    if abs(new_hz - freq_hz) > 1:
                        retune(new_hz, args.rate, gain)
                        freq_hz = new_hz
                        smoothed = None          # start the smoothing fresh

            time.sleep(0.06)                     # ~15 frames per second
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
