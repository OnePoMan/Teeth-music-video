#!/bin/bash
# Renders pilot v7 in frame-exact segments (30 fps), skipping segments already done, so a container restart
# loses at most one segment. Then joins them, holds the last frame until 46.6 s and adds the audio, plus a
# light 1600x900 review copy.
#
#   review-v7.sh          render every missing segment, then join
#   review-v7.sh 5 ...    render only the listed segments (if missing), join only if all 5 exist
#   DRY=1 review-v7.sh    print the render/ffmpeg commands instead of running them (skip logic still applies)
#
# Where it runs: by default Google Chrome with the GPU (a laptop or desktop). The cloud container has no GPU and no
# Chrome: CHROME_PATH=/opt/pw-browsers/chromium RENDER_GL=--swiftshader review-v7.sh. RENDER_URL picks the dev
# server (default http://localhost:5190; render.ts starts a private one if nothing answers there).
#
# Frame mapping (render.ts video -> main.ts stream): frames n = round(from*30) .. round(to*30)-1, frame n at
# time n/30, `--to` exclusive. Segment 5 ends at the hook1|mirror cut (mirror scene does not exist yet):
#   cut = timeOfBeat(floor(beatAt(46.52 + 0.02))) = beats[69] = 46.022 s (data/monster/audio.json)
#   frames with t < 46.022: n <= 1380 (1380/30 = 46.0, 1381/30 = 46.0333) -> --to 46.0333333 (round(*30) = 1381)
#   so segment 5 = frames 1080..1380 (301 frames), joined total = 1381 frames, then hold 17 frames -> 1398 = 46.6 s.
cd "$(dirname "$0")/.." || exit 1
# paths are overridable for testing only (V7_*), defaults are the real ones
OUT=${V7_OUT:-../out/review/v7}
FINAL=${V7_FINAL:-../out/review/pilot-v7.mp4}
REVIEW=${V7_REVIEW:-../out/review/pilot-v7-review.mp4}
AUDIO=${V7_AUDIO:-../audio/monster.mp3}
FPS=30
END=46.6
END_FRAMES=1398   # round(46.6*30)
JOIN_FRAMES=1381  # round(46.0333333*30): frames before the hold
GL=${RENDER_GL:-}
URL=${RENDER_URL:-http://localhost:5190}
SEGS=("0 9.3333333" "9.3333333 19.3333333" "19.3333333 25.3333333" "25.3333333 36" "36 46.0333333")

run() { if [ -n "$DRY" ]; then echo "+ $*"; else "$@"; fi; }
# tr: ffprobe on Windows ends its lines with CRLF, which breaks the string compares and $((...)) below
nframes() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1" | tr -d '\r'; }

render_seg() { # $1 = segment number
  local i=$1; set -- ${SEGS[$((i-1))]}
  local f=$OUT/s$i.mp4
  if [ -s "$f" ]; then echo "skip $f"; return 0; fi
  local cmd=(bun scripts/render.ts video $GL --url $URL --from $1 --to $2 --fps 30 --samples 1 --preset medium --noaudio --out $OUT/tmp$i.mp4)
  if [ -n "$DRY" ]; then echo "+ ${cmd[*]} > $OUT/log$i.txt 2>&1 && mv $OUT/tmp$i.mp4 $f"; return 0; fi
  mkdir -p "$OUT"
  "${cmd[@]}" > $OUT/log$i.txt 2>&1 && mv $OUT/tmp$i.mp4 $f || { echo "segment $i failed"; tail -3 $OUT/log$i.txt; return 1; }
  echo "done $f"
}

join_all() {
  # 1) concat the 5 segments (stream copy, frame-exact: each segment is CFR 30 fps)
  if [ -n "$DRY" ]; then echo "+ printf \"file 's%d.mp4'\\n\" 1 2 3 4 5 > $OUT/list.txt"; else printf "file 's%d.mp4'\n" 1 2 3 4 5 > $OUT/list.txt; fi
  run ffmpeg -loglevel error -y -f concat -safe 0 -i $OUT/list.txt -map 0:v -c:v copy $OUT/joined.mp4 || return 1
  local n=$JOIN_FRAMES
  if [ -z "$DRY" ]; then
    n=$(nframes $OUT/joined.mp4)
    [ "$n" = "$JOIN_FRAMES" ] || echo "WARNING: joined has $n frames, expected $JOIN_FRAMES"
  fi
  # 2) hold the last frame until END, add the trimmed audio
  local hold=$(awk -v e=$END_FRAMES -v n=$n -v r=$FPS 'BEGIN{printf "%.6f", (e-n)/r}')
  run ffmpeg -loglevel error -y -i $OUT/joined.mp4 -ss 0 -t $END -i $AUDIO -map 0:v -map 1:a \
    -vf tpad=stop_mode=clone:stop_duration=$hold -r $FPS -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p \
    -c:a aac -b:a 320k -t $END -movflags +faststart $OUT/tmp-final.mp4 || return 1
  run mv $OUT/tmp-final.mp4 $FINAL || return 1
  # 3) light review copy
  run ffmpeg -loglevel error -y -i $FINAL -vf scale=1600:900 -c:v libx264 -crf 26 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -movflags +faststart $OUT/tmp-review.mp4 || return 1
  run mv $OUT/tmp-review.mp4 $REVIEW || return 1
  if [ -n "$DRY" ]; then return 0; fi
  # 4) check the duration (46.6 s +- 1 frame)
  local fr=$(nframes $FINAL)
  local d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $FINAL | tr -d '\r')
  echo "joined $FINAL: $fr frames, $d s (expected $END_FRAMES frames, $END s)"
  awk -v d=$d -v e=$END -v r=$FPS 'BEGIN{exit !(d-e<=1/r && e-d<=1/r)}' && [ $((fr-END_FRAMES)) -le 1 ] && [ $((END_FRAMES-fr)) -le 1 ] \
    || { echo "DURATION CHECK FAILED"; return 1; }
  echo "review copy $REVIEW"
}

if [ $# -gt 0 ]; then LIST=("$@"); else LIST=(1 2 3 4 5); fi
for i in "${LIST[@]}"; do
  case $i in [1-5]) ;; *) echo "bad segment: $i (1-5)"; exit 1;; esac
  render_seg $i || exit 1
done
for i in 1 2 3 4 5; do
  if [ ! -s $OUT/s$i.mp4 ]; then
    if [ -n "$DRY" ] && [ $# -eq 0 ]; then continue; fi  # dry run of a full pass: the segments would exist by now
    echo "not joining: $OUT/s$i.mp4 missing"; exit 0
  fi
done
join_all || { echo "join failed"; exit 1; }
