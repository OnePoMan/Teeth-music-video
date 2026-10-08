#!/bin/bash
# Blind pairs for the critic step (docs/critic-checklist.md): each new frame side by side with a reference frame,
# left/right at random, so the critic judges them without knowing which is which. The key goes to a separate file
# that is not given to the critic.
#
#   blind-pairs.sh OUTDIR KEYFILE new1.png new2.png ... -- ref1.png ref2.png ...
#
# Writes OUTDIR/pair01.png ... (A left, B right, each 960x540, a grey gap between) and appends one line per pair to
# KEYFILE: "pair01 A=<file> B=<file>". New frame i is paired with reference i (cycling through the references).
OUT=$1; KEY=$2; shift 2
NEW=(); REF=(); seen=0
for a in "$@"; do
  if [ "$a" = "--" ]; then seen=1; continue; fi
  if [ $seen = 0 ]; then NEW+=("$a"); else REF+=("$a"); fi
done
[ -n "$OUT" ] && [ -n "$KEY" ] && [ ${#NEW[@]} -gt 0 ] && [ ${#REF[@]} -gt 0 ] || { sed -n 5,8p "$0"; exit 1; }
mkdir -p "$OUT" "$(dirname "$KEY")"
for i in "${!NEW[@]}"; do
  n=${NEW[$i]}; r=${REF[$((i % ${#REF[@]}))]}
  name=$(printf 'pair%02d' $((i + 1)))
  if [ $((RANDOM % 2)) = 0 ]; then A=$n; B=$r; else A=$r; B=$n; fi
  ffmpeg -loglevel error -y -i "$A" -i "$B" -filter_complex \
    "[0]scale=960:540[a];[1]scale=960:540[b];[a]pad=976:540:0:0:color=0x808080[ap];[ap][b]hstack" \
    -frames:v 1 "$OUT/$name.png" || exit 1
  echo "$name A=$A B=$B" >> "$KEY"
done
echo "wrote ${#NEW[@]} pairs to $OUT (key: $KEY)"
