#!/usr/bin/env bash
# 방송용 내레이션 처리: 저역 잡음 → 웅웅거림 → 명료도 → 공기감 → 치찰음 → 압축 → 템포 → 음량(-16 LUFS, -1.5 dBTP)
#   tools/master_voice.sh <in.wav> <out.wav> <tempo, 예: 1.10>
set -euo pipefail
in="$1"; out="$2"; tempo="${3:-1.0}"
chain="highpass=f=80,\
equalizer=f=280:t=q:w=1.2:g=-2.5,\
equalizer=f=3200:t=q:w=1.0:g=2.5,\
treble=g=2:f=9000,\
deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-21dB:ratio=3:attack=4:release=90:knee=4:makeup=3,\
atempo=${tempo},\
aresample=48000"
stats=$(ffmpeg -hide_banner -nostats -i "$in" -af "${chain},loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$in" -af "${chain},loudnorm=I=-16:TP=-1.5:LRA=7:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):linear=true,aresample=48000" -ac 1 "$out"
