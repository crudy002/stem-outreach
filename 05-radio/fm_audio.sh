#!/bin/bash
rtl_fm -M wbfm -f 104.5 - | aplay -r 32000 -f S16_LE
