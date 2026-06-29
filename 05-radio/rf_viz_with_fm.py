#!/usr/bin/env python3
"""
radio.py - SEE and HEAR an FM station at the same time, from one dongle.

A radio dongle can only be used by one program at a time, so we can't run a
spectrum viewer and an audio player side by side. Instead this single script
reads the dongle's raw number-stream ONCE and does two things with it:

  1. turns every sample into sound  (FM demodulation -> the speakers)
  2. snapshots the stream now and then into the on-screen bar chart

That's the whole software-defined-radio idea in one window: the picture and
the sound are just two different bits of math run on the same firehose of
numbers coming off the dongle.

Why the on-screen view is narrow: smooth audio on a Raspberry Pi 3 means
sampling at a modest rate, and the rate sets how wide a slice of the dial you
see. So you get about one station's width on screen - which is fine, because
you tune by typing the frequency anyway.

Needs:
  - an RTL-SDR dongle plugged in
  - the rtl_sdr command:   sudo apt install rtl-sdr
  - aplay (for sound):     sudo apt install alsa-utils
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

try:
    import numpy as np
except ImportError:
    sys.exit(
        "\nThis needs numpy and it isn't installed.\n"
        "Turn on the project's virtual environment, then install it:\n"
        "    source venv/bin/activate\n"
        "    pip install numpy\n"
    )

try:
    import termios
    import tty
    HAVE_TERMIOS = True
except ImportError:
    HAVE_TERMIOS = False

# ----- terminal text tricks (ANSI escape codes) ----------------------------
HOME     = "\033[H"
CLEAR    = "\033[2J\033[H"
EOL      = "\033[K"
HIDE_CUR = "\033[?25l"
SHOW_CUR = "\033[?25h"
RESET    = "\033[0m"
GREEN    = "\033[92m"
YELLOW   = "\033[93m"
RED      = "\033[91m"
DIM      = "\033[90m"

FFT_SIZE    = 2048             # samples per spectrum picture
BLOCK_SAMP  = 8192             # complex samples read per chunk (for audio)
BLOCK_BYTES = BLOCK_SAMP * 2   # 2 bytes (an I and a Q) per sample

shared = {
    "proc":   None,            # the running rtl_sdr process
    "latest": None,            # newest raw block (the spectrum peeks at this)
    "run":    True,
    "lock":   threading.Lock(),
}


def spawn(freq_hz, rate, gain):
    """Start rtl_sdr tuned to freq_hz, streaming raw samples to our pipe."""
    args = ["rtl_sdr", "-f", str(int(freq_hz)), "-s", str(int(rate))]
    if gain is not None:
        args += ["-g", str(gain)]
    args += ["-"]
    return subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)


def retune(freq_hz, rate, gain):
    """Switch stations by restarting rtl_sdr on the new frequency."""
    with shared["lock"]:
        old = shared["proc"]
        shared["proc"] = spawn(freq_hz, rate, gain)
    if old:
        old.terminate()
        try:
            old.wait(timeout=1.0)
        except subprocess.TimeoutExpired:
            old.kill()


def audio_loop(aplay, decim, scale):
    """
    The sound thread. Reads the FULL stream (no skipping - audio needs every
    sample) and FM-demodulates it into speaker sound.

    FM hides the audio in HOW FAST the wave's angle turns from one sample to
    the next. So: multiply each sample by the (conjugate of the) one before
    it, take the angle, and that angle IS the audio waveform. Then we thin it
    down (decimate) from the radio rate to a normal audio rate.
    """
    prev = None
    while shared["run"]:
        proc = shared["proc"]
        if proc is None or proc.stdout is None:
            time.sleep(0.02)
            continue
        try:
            raw = proc.stdout.read(BLOCK_BYTES)
        except (ValueError, OSError):
            prev = None
            time.sleep(0.02)
            continue
        if not raw:                      # rtl_sdr ended (we're retuning)
            prev = None
            time.sleep(0.02)
            continue

        shared["latest"] = raw           # let the spectrum peek at this block

        b = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 127.5
        x = b[0::2] + 1j * b[1::2]       # the complex radio wave
        if prev is not None:             # stitch onto the tail of last block
            x = np.concatenate(([prev], x))
        prev = x[-1]

        disc = np.angle(x[1:] * np.conj(x[:-1]))     # <- the FM "audio"

        # Thin from the radio rate down to the audio rate by averaging groups.
        n = (len(disc) // decim) * decim
        if n == 0:
            continue
        audio = disc[:n].reshape(-1, decim).mean(axis=1)

        samples = np.clip(audio * scale, -32767, 32767).astype("<i2")
        try:
            aplay.stdin.write(samples.tobytes())
        except (BrokenPipeError, ValueError, OSError):
            break                        # aplay went away - stop the thread


# ----- the picture ---------------------------------------------------------
WINDOW = np.hanning(FFT_SIZE)


def compute_spectrum(block, smoothed):
    raw = np.frombuffer(block, dtype=np.uint8)[:FFT_SIZE * 2].astype(np.float32)
    raw -= 127.5
    iq = raw[0::2] + 1j * raw[1::2]
    spec = np.fft.fftshift(np.fft.fft(iq * WINDOW))
    power = 20 * np.log10(np.abs(spec) + 1e-9)
    c = FFT_SIZE // 2                    # flatten the center "DC spike" artifact
    power[c - 2:c + 3] = np.median(power)
    if smoothed is None:
        return power
    return 0.5 * power + 0.5 * smoothed


def draw(power, freq_hz, rate):
    term = shutil.get_terminal_size((80, 24))
    width = max(20, term.columns)
    rows = max(6, term.lines - 5)

    cols = np.interp(np.linspace(0, FFT_SIZE - 1, width),
                     np.arange(FFT_SIZE), power)
    lo = np.percentile(cols, 25)
    hi = max(np.percentile(cols, 99.7), lo + 6)
    frac = np.clip((cols - lo) / (hi - lo), 0.0, 1.0)
    heights = (frac * rows).astype(int)

    out = [HOME]
    out.append(
        f"{DIM} SDR radio - seeing + hearing    "
        f"tuned {freq_hz / 1e6:7.2f} MHz    span {rate / 1e6:.2f} MHz    "
        f"[f] change   [q] quit{RESET}{EOL}"
    )
    for level in range(rows, 0, -1):
        line = []
        for col in range(width):
            if heights[col] >= level:
                f = frac[col]
                color = GREEN if f < 0.5 else YELLOW if f < 0.8 else RED
                line.append(color + "\u2588")
            else:
                line.append(" ")
        out.append("".join(line) + RESET + EOL)

    half = rate / 2 / 1e6
    left = f"{freq_hz / 1e6 - half:.2f}"
    mid = f"{freq_hz / 1e6:.2f} MHz"
    right = f"{freq_hz / 1e6 + half:.2f}"
    gap = max(0, width - len(left) - len(right))
    out.append(DIM + (left + mid.center(gap) + right)[:width] + RESET + EOL)

    sys.stdout.write("\n".join(out))
    sys.stdout.flush()


def warn(msg):
    sys.stdout.write("  " + YELLOW + msg + RESET + "\n")
    sys.stdout.flush()
    time.sleep(1.3)


def prompt_new_station(current_hz, old_term, is_tty):
    if is_tty and old_term is not None:
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
            if f > 3000:
                f = f / 1e6
            if 24 <= f <= 1766:
                new_hz = f * 1e6
            else:
                warn(f"{f:.3f} MHz is outside the dongle's ~24-1766 MHz range - "
                     f"keeping {current_hz / 1e6:.2f}.")
        except ValueError:
            warn(f"'{text}' isn't a number - keeping {current_hz / 1e6:.2f} MHz.")
    sys.stdout.write(HIDE_CUR + CLEAR)
    if is_tty:
        tty.setcbreak(sys.stdin.fileno())
    return new_hz


def main():
    ap = argparse.ArgumentParser(description="See and hear an FM station from an RTL-SDR.")
    ap.add_argument("freq", nargs="?", default=104.5, type=float,
                    help="starting station in MHz (default 104.5)")
    ap.add_argument("--rate", type=float, default=256000,
                    help="sample rate in Hz; higher = wider view but more CPU (default 256000)")
    ap.add_argument("--gain", default="auto",
                    help="tuner gain in dB, or 'auto' (default auto)")
    ap.add_argument("--volume", type=float, default=3.0,
                    help="audio loudness multiplier (default 3.0)")
    args = ap.parse_args()

    for cmd, pkg in (("rtl_sdr", "rtl-sdr"), ("aplay", "alsa-utils")):
        if shutil.which(cmd) is None:
            sys.exit(f"\nCan't find the '{cmd}' command.\n"
                     f"Install it with:   sudo apt install {pkg}\n")

    gain = None if str(args.gain).lower() == "auto" else args.gain
    start_mhz = args.freq if args.freq < 3000 else args.freq / 1e6
    freq_hz = start_mhz * 1e6

    decim = max(1, round(args.rate / 32000))     # thin radio rate -> ~32 kHz audio
    audio_rate = int(round(args.rate / decim))
    scale = args.volume * 32767 / np.pi

    # Open the speaker pipe once and leave it open across retunes.
    aplay = subprocess.Popen(
        ["aplay", "-r", str(audio_rate), "-f", "S16_LE", "-c", "1", "-t", "raw", "-q"],
        stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )

    retune(freq_hz, args.rate, gain)
    threading.Thread(target=audio_loop, args=(aplay, decim, scale), daemon=True).start()

    # Wait a moment for samples so we can complain clearly if none arrive.
    t0 = time.time()
    while shared["latest"] is None and time.time() - t0 < 2.5:
        if shared["proc"].poll() is not None:
            break
        time.sleep(0.1)
    if shared["latest"] is None:
        shared["run"] = False
        sys.exit("\nThe dongle didn't send any data. Things to check:\n"
                 "  - is the RTL-SDR plugged in?\n"
                 "  - does 'rtl_test' see it?\n"
                 "  - is another program (gqrx, SDR++) already using it?\n")

    is_tty = sys.stdin.isatty() and HAVE_TERMIOS
    old_term = termios.tcgetattr(sys.stdin) if is_tty else None

    def cleanup():
        shared["run"] = False
        if shared["proc"]:
            shared["proc"].terminate()
        try:
            aplay.stdin.close()
        except Exception:
            pass
        aplay.terminate()
        if is_tty and old_term is not None:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_term)
        sys.stdout.write(SHOW_CUR + RESET + "\n")
        sys.stdout.flush()

    signal.signal(signal.SIGTERM, lambda *_: cleanup() or sys.exit(0))

    smoothed = None
    sys.stdout.write(CLEAR + HIDE_CUR)
    if is_tty:
        tty.setcbreak(sys.stdin.fileno())

    try:
        while True:
            block = shared["latest"]
            if block and len(block) >= FFT_SIZE * 2:
                smoothed = compute_spectrum(block, smoothed)
                draw(smoothed, freq_hz, args.rate)

            if is_tty and select.select([sys.stdin], [], [], 0)[0]:
                ch = sys.stdin.read(1)
                if ch in ("q", "Q"):
                    break
                if ch in ("f", "F", "\n", "\r"):
                    new_hz = prompt_new_station(freq_hz, old_term, is_tty)
                    if abs(new_hz - freq_hz) > 1:
                        retune(new_hz, args.rate, gain)
                        freq_hz = new_hz
                        smoothed = None

            time.sleep(0.06)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
