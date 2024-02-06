#!/bin/bash
set -e

# export NODE_OPTIONS=--max-old-space-size=161792
dir=$(dirname $(pwd))
snarkjs="node --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 --expose-gc $dir/node_modules/snarkjs/cli.js"
size=25

echo "Generating powersOfTau_""$size""_final.ptau" > time.txt
echo "start time: $(date)" >> time.txt

timerStart=$(date +%s%N)
$snarkjs powersoftau new bn128 $size pot0.ptau
timerEnd=$(date +%s%N)
time=$(((timerEnd - timerStart)/1000000))
echo "pot0 time: $time ms" >> time.txt
timerStart=$(date +%s%N)
$snarkjs powersoftau contribute pot0.ptau pot1.ptau --name="First contribution" -e="random text"
timerEnd=$(date +%s%N)
time=$(((timerEnd - timerStart)/1000000))
echo "pot1 time: $time ms" >> time.txt
rm -rf pot0.ptau
timerStart=$(date +%s%N)
$snarkjs powersoftau contribute pot1.ptau pot2.ptau --name="Second contribution" -e="some random text"
timerEnd=$(date +%s%N)
time=$(((timerEnd - timerStart)/1000000))
echo "pot2 time: $time ms" >> time.txt
rm -rf pot1.ptau
timerStart=$(date +%s%N)
$snarkjs powersoftau beacon pot2.ptau potbeacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
timerEnd=$(date +%s%N)
time=$(((timerEnd - timerStart)/1000000))
echo "beacon time: $time ms" >> time.txt
rm -rf pot2.ptau
timerStart=$(date +%s%N)
$snarkjs powersoftau prepare phase2 potbeacon.ptau $(echo "powersOfTau_""$size""_final.ptau")
timerEnd=$(date +%s%N)
time=$(((timerEnd - timerStart)/1000000))
echo "potfinal time: $time ms" >> time.txt
rm -rf potbeacon.ptau
echo "end time: $(date)" >> time.txt