#!/bin/bash
# Renders a review clip in frame-exact segments (resumable: segments already rendered are skipped, so a container
# restart loses at most one segment), joins them, adds the song when audio/monster.mp3 is there, and writes the light
# review copy (1600x900, CRF 26) that goes to the client.
#
#   clip.sh NAME FROM TO [ONLY] [SEGSEC]
#     NAME    output name: segments in out/review/NAME/, full quality out/review/NAME.mp4, light copy NAME-review.mp4
#     FROM TO seconds; frames round(FROM*30) .. round(TO*30)-1 at 30 fps, frame n at n/30 (TO exclusive, as render.ts)
#     ONLY    scene ids on screen in the range (render.ts --only), e.g. "sea,hook1"; empty = all
#     SEGSEC  segment length in seconds (default 4)
#
# Where it runs: Google Chrome with the GPU by default (a laptop or desktop). The cloud container has no GPU and no
# Chrome: CHROME_PATH=/opt/pw-browsers/chromium RENDER_GL=--swiftshader clip.sh ... RENDER_URL picks the dev server
# (default http://localhost:5190; render.ts starts a private one if nothing answers there). Without the song the
# outputs are silent; run it again once audio/monster.mp3 is in place and only the join is redone.
cd "$(dirname "$0")/.." || exit 1
NAME=$1; FROM=$2; TO=$3; ONLY=${4:-}; SEGSEC=${5:-4}
[ -n "$NAME" ] && [ -n "$FROM" ] && [ -n "$TO" ] || { sed -n 6,10p "$0"; exit 1; }
FPS=30
DIR=../out/review/$NAME
FINAL=../out/review/$NAME.mp4
REVIEW=../out/review/$NAME-review.mp4
AUDIO=../audio/monster.mp3
GL=${RENDER_GL:-}
URL=${RENDER_URL:-http://localhost:5190}
mkdir -p "$DIR"
# tr: ffprobe on Windows ends its lines with CRLF
nframes() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1" | tr -d '\r'; }

F0=$(awk -v t=$FROM -v r=$FPS 'BEGIN{printf "%d", t*r + 0.5}')
F1=$(awk -v t=$TO -v r=$FPS 'BEGIN{printf "%d", t*r + 0.5}')
S=$(awk -v s=$SEGSEC -v r=$FPS 'BEGIN{printf "%d", s*r + 0.5}')
[ "$F1" -gt "$F0" ] || { echo "empty range"; exit 1; }
LIST=$DIR/list.txt; : > "$LIST"
k=0
for ((a = F0; a < F1; a += S)); do
  b=$((a + S)); [ $b -gt $F1 ] && b=$F1
  k=$((k + 1))
  f=$DIR/s$k.mp4
  echo "file 's$k.mp4'" >> "$LIST"
  if [ -s "$f" ] && [ "$(nframes "$f")" = "$((b - a))" ]; then echo "skip $f"; continue; fi
  # times with 7 decimals: round(t*30) gives back exactly a and b
  ta=$(awk -v n=$a -v r=$FPS 'BEGIN{printf "%.7f", n/r}'); tb=$(awk -v n=$b -v r=$FPS 'BEGIN{printf "%.7f", n/r}')
  echo "segment $k: frames $a..$((b - 1)) ($ta-$tb s)"
  bun scripts/render.ts video $GL --url $URL ${ONLY:+--only $ONLY} --from $ta --to $tb --fps $FPS --samples 1 --preset medium --noaudio --out $DIR/tmp$k.mp4 > $DIR/log$k.txt 2>&1 \
    && mv $DIR/tmp$k.mp4 $f || { echo "segment $k failed"; tail -5 $DIR/log$k.txt; exit 1; }
done

ffmpeg -loglevel error -y -f concat -safe 0 -i "$LIST" -map 0:v -c:v copy $DIR/joined.mp4 || exit 1
n=$(nframes $DIR/joined.mp4)
[ "$n" = "$((F1 - F0))" ] || echo "WARNING: joined has $n frames, expected $((F1 - F0))"
DUR=$(awk -v n=$((F1 - F0)) -v r=$FPS 'BEGIN{printf "%.6f", n/r}')
T0=$(awk -v n=$F0 -v r=$FPS 'BEGIN{printf "%.6f", n/r}')  # the first frame's time: the audio starts there
if [ -s "$AUDIO" ]; then
  ffmpeg -loglevel error -y -i $DIR/joined.mp4 -ss $T0 -t $DUR -i $AUDIO -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k \
    -t $DUR -movflags +faststart $DIR/tmp-final.mp4 && mv $DIR/tmp-final.mp4 $FINAL || exit 1
else
  echo "no $AUDIO: silent"
  ffmpeg -loglevel error -y -i $DIR/joined.mp4 -c copy -movflags +faststart $DIR/tmp-final.mp4 && mv $DIR/tmp-final.mp4 $FINAL || exit 1
fi
ffmpeg -loglevel error -y -i $FINAL -vf scale=1600:900 -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart $DIR/tmp-review.mp4 && mv $DIR/tmp-review.mp4 $REVIEW || exit 1
echo "wrote $FINAL ($n frames, $DUR s) and $REVIEW ($(du -h $REVIEW | cut -f1))"
