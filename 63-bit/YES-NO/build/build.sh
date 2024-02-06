#!/bin/bash
set -e


powersOfTau="powersOfTau28_hez_final_17.ptau"

# colors
RED=`tput setaf 1`
GREEN=`tput setaf 2`
NC=`tput sgr0`

# function for circuit compilation and key Gen
function circuitCompileGenKey(){
   citcuitName="$1"
   verifierKeyName="$2"
   echo "${GREEN}Compiling $citcuitName circuit${NC}" >&2
   compile_start=$(date +%s%N)
   if ! circom ../circuits/"$citcuitName".circom --r1cs --wasm >&2  ||
      ! [[ -s ./"$citcuitName"_js/"$citcuitName".wasm ]]
   then
      echo "${RED}$citcuitName compilation failed${NC}" >&2
      exit 1
   else
      echo "${GREEN}$citcuitName compilation succeeded${NC}" >&2
   fi
   compile_end=$(date +%s%N)

   echo "${GREEN}Generating proving key for $citcuitName circuit${NC}" >&2
   keyGen_start=$(date +%s%N)
   $snarkjs groth16 setup "$citcuitName".r1cs $powersOfTau "$citcuitName"000.zkey >&2
   if [[ ! -s "$citcuitName"000.zkey ]]; then
      echo "${RED}Generating proving key for $citcuitName circuit failed${NC}" >&2
      echo "${RED}May need to update \$powersOfTau, for more information, https://github.com/iden3/snarkjs#7-prepare-phase-2${NC}" >&2
      exit -1
   fi
   $snarkjs zkey contribute "$citcuitName"000.zkey "$citcuitName"001.zkey --name="1st Contributor Name" -v -e="more random text" >&2
   $snarkjs zkey contribute "$citcuitName"001.zkey "$citcuitName"002.zkey --name="Second contribution Name" -v -e="Another random entropy" >&2
   $snarkjs zkey beacon "$citcuitName"002.zkey "$citcuitName"Final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2" >&2
   keyGen_end=$(date +%s%N)
   $snarkjs zkey export verificationkey "$citcuitName"Final.zkey "$verifierKeyName".json
   echo "${GREEN}Generating proving key for $citcuitName circuit completed${NC}" >&2

   #statistics
   Nconstraints=`$snarkjs r1cs info "$citcuitName".r1cs|grep "Constraints"|cut -d ":" -f 3`
   compileTime=$(((compile_end - compile_start)/1000000))
   keyGenTime=$(((keyGen_end - keyGen_start)/1000000))
   provingKeySize=`stat -c%s "$citcuitName"Final.zkey`
   
   #delete temp keys
   rm "$citcuitName"000.zkey
   rm "$citcuitName"001.zkey
   rm "$citcuitName"002.zkey
   
   #return statistics
   echo "$Nconstraints $compileTime $keyGenTime $provingKeySize"

}

# function for printing statistics of a cuircit
function printStatistics(){
   citcuitName="$1"
   statistics=($2)

   echo """

   Statistics of ${GREEN}$citcuitName${NC} circuit:
   number of constraints = ${GREEN}${statistics[0]}${NC}, 
   compilation time      = ${GREEN}${statistics[1]}${NC} ms, 
   proof generation time = ${GREEN}${statistics[2]}${NC} ms,
   proving Key Size      = ${GREEN}${statistics[3]}${NC} Bytes
   
   """  >&2
}

# Main()
useMessage="Usage: ./build.sh -n ${GREEN}[NUMBER_of_VOTERS]${NC}"
# Parsing arguments
while getopts "hn:" opt
do
   case "$opt" in
      n)
         nVotersOpt="$OPTARG";
         if [[ $nVotersOpt -le "0" ]]; then
            echo $useMessage;
            exit 1
         fi
      ;;
      h) 
         echo $useMessage;
         exit 0
      ;;
      :)
         echo $useMessage;
         exit 1
      ;;
      *)
         echo $useMessage;
         exit 1
      ;;
   esac
done
if [ $OPTIND -eq 1 ]; 
then 
   echo $useMessage;
   exit 1
fi

nVoters=$nVotersOpt
depth=$(python3 -c "import math; print(math.ceil(math.log2($nVoters)))")

cp ../circuits/castVote_main_src.circom ../circuits/castVote_main.circom
cp ../test/2_eVote.test.src.js ../test/2_eVote.test.js

sed -i "s/__DEPTH__/$depth/g" ../circuits/castVote_main.circom
sed -i "s/__DEPTH__/$depth/g" ../test/2_eVote.test.js
sed -i "s/__NVOTERS__/$nVoters/g" ../test/2_eVote.test.js

snarkjs=../node_modules/.bin/snarkjs

# check dependencies
if [[ ! -d "../node_modules" ]]; then
   echo "${GREEN}Install dependencies packages${NC}"
    cd ../
    npm i
    cd build
fi

# check powersoftau
if [[ ! -f "$powersOfTau" ]]; then
   #$snarkjs powersoftau new bn128 18 pot0.ptau -v
   #$snarkjs powersoftau contribute pot0.ptau pot1.ptau --name="First contribution" -v -e="random text"
   #$snarkjs powersoftau contribute pot1.ptau pot2.ptau --name="Second contribution" -v -e="some random text"
   #$snarkjs powersoftau beacon pot2.ptau potbeacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
   #$snarkjs powersoftau prepare phase2 potbeacon.ptau $powersOfTau -v
   echo "${GREEN}Downloading powersOfTau${NC}"
   curl https://hermez.s3-eu-west-1.amazonaws.com/$powersOfTau -o "$powersOfTau"
else
   echo "${GREEN}powersOfTau exists, skipping download${NC}"
fi


# # increase the heap size for node
# export NODE_OPTIONS=--max-old-space-size=32768

# # compile and key Gen
castVoteStatistics=$(circuitCompileGenKey "castVote_main" "verifier_castVote_main")

#print statistics
printStatistics "castVote_main" "$castVoteStatistics"

statistics=($castVoteStatistics)
sed -i "s/__constraints__/${statistics[0]}/g" ../test/2_eVote.test.js
sed -i "s/__compilation__/${statistics[1]}/g" ../test/2_eVote.test.js
sed -i "s/__generation__/${statistics[2]}/g" ../test/2_eVote.test.js
sed -i "s/__proving__/${statistics[3]}/g" ../test/2_eVote.test.js


# # print how to run test
echo """

To test, run the following command:
   ${GREEN}npm run test
${NC}"""



