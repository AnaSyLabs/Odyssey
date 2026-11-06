#!/bin/bash
# Silent cut: each take trimmed to its usable segments (loading screens removed), joined in order.
set -e
T=takes
seg() { ffmpeg -v error -y -ss "$2" -to "$3" -i "$T/take-$1.mp4" -c:v libx264 -preset slow -crf 18 -an -r 30 "parts/$1-$4.mp4"; echo "file 'parts/$1-$4.mp4'" >> list.txt; }
rm -rf parts list.txt; mkdir parts
seg 01 0 13.0 a
seg 02 0 19.2 a
seg 03 0 16.5 a
seg 04 0 10.4 a; seg 04 11.2 25.5 b
seg 05 0 14.4 a; seg 05 16.0 32.8 b
seg 06 0 9.6 a
seg 07 0 11.4 a; seg 07 16.6 31.7 b
seg 08 0 17.4 a
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy silent-cut.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of compact silent-cut.mp4
