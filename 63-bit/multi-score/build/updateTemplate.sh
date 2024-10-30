#!/bin/bash
# 切换到脚本所在目录
cd "$(dirname "$0")"


# 读取变量并显示
echo "从文件中读取变量:"
while IFS='=' read -r key value; do
  # 将变量赋值给对应的shell变量
  case "$key" in
    depth) depth=$value ;;
    nVoters) nVoters=$value ;;
    nCandiadates) nCandiadates=$value ;;
    S) S=$value ;;
    k) k=$value ;;
    castVoteStatistics) castVoteStatistics=$value ;;
  esac
done < variables.txt

# 将castVoteStatistics分割成数组
IFS=' ' read -r -a statistics <<< "$castVoteStatistics"

cp ../circuits/castVote_main_src.circom ../circuits/castVote_main.circom
cp ../test/2_eVote.test.src.js ../test/2_eVote.test.js
cp ../src/verifyCircuit_src.js ../src/verifyCircuit.js

echo "depth: $depth"
echo "nVoters: $nVoters" 
echo "nCandiadates: $nCandiadates"
echo "S: $S"
echo "k: $k"
echo "castVoteStatistics: $castVoteStatistics"



sed -i.bak "s/__NVOTERS__/$nVoters/g" ../test/2_eVote.test.js
sed -i.bak "s/__nCandiadates__/$nCandiadates/g" ../circuits/castVote_main.circom
sed -i.bak "s/__nCandiadates__/$nCandiadates/g" ../src/verifyCircuit.js
sed -i.bak "s/__nCandiadates__/$nCandiadates/g" ../test/2_eVote.test.js
sed -i.bak "s/__S__/$S/g" ../circuits/castVote_main.circom
sed -i.bak "s/__S__/$S/g" ../test/2_eVote.test.js
sed -i.bak "s/__S__/$S/g" ../src/verifyCircuit.js
sed -i.bak "s/__k__/$k/g" ../circuits/castVote_main.circom
sed -i.bak "s/__k__/$k/g" ../test/2_eVote.test.js
sed -i.bak "s/__k__/$k/g" ../src/verifyCircuit.js

sed -i.bak "s/__constraints__/${statistics[0]}/g" ../test/2_eVote.test.js
sed -i.bak "s/__compilation__/${statistics[1]}/g" ../test/2_eVote.test.js
sed -i.bak "s/__generation__/${statistics[2]}/g" ../test/2_eVote.test.js
sed -i.bak "s/__proving__/${statistics[3]}/g" ../test/2_eVote.test.js