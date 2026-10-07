#!/bin/bash
# Renders pilot v6 in frame-exact segments (30 fps), skipping segments already done, so a container restart
# loses at most one segment. Then joins them and adds the audio.
cd /home/user/Teeth-music-video/app || exit 1
OUT=../out/review/v6
SEGS=("0 9.3333333" "9.3333333 19.3333333" "19.3333333 25.3333333" "25.3333333 36" "36 46.6")
i=0
for s in "${SEGS[@]}"; do
  i=$((i+1)); set -- $s
  f=$OUT/s$i.mp4
  if [ -s "$f" ]; then echo "skip $f"; continue; fi
  CHROME_PATH=/opt/pw-browsers/chromium bun scripts/render.ts video --swiftshader --url http://localhost:5190 --from $1 --to $2 --fps 30 --samples 1 --preset medium --noaudio --out $OUT/tmp$i.mp4 > $OUT/log$i.txt 2>&1 && mv $OUT/tmp$i.mp4 $f || { echo "segment $i failed"; tail -3 $OUT/log$i.txt; exit 1; }
  echo "done $f"
done
printf "file 's%d.mp4'\n" 1 2 3 4 5 > $OUT/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i $OUT/list.txt -ss 0 -t 46.6 -i ../audio/monster.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest ../out/review/pilot-v6.mp4 && echo "joined ../out/review/pilot-v6.mp4"
