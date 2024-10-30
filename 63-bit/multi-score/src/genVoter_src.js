const Voter = require('./voter');
const {RandomPuzzle} = require('./puzzle');
const {
    vJsonCastVotePath,
    getVerificationKeys,
    snarkVerify,
  } = require('./snarkjsHelper'); 
const fs = require('fs');
const n=63;
const t=40;

const puzzle = new RandomPuzzle(n, t);

const nCandidates = __nCandiadates__;
const S = __S__;
const k = __k__;



async function getaVoter(n, nCandidates, S, k) {
  const voter = new Voter();
  await voter.init(n, nCandidates, S, k);
  await voter.topup(1);
  await voter.genCastVoteData(puzzle);
  return voter;
}

async function main() {
  const voter = new Voter();
  const puzzleStr = voter.stringify(puzzle);
  if (!fs.existsSync('voter_data')) {
    fs.mkdirSync('voter_data');
  }
  fs.writeFileSync('voter_data/puzzle.json', puzzleStr);


  for (let i = 0; i < 10; i++) {
    const voter = await getaVoter(n, nCandidates, S, k);
    console.log(voter.address);
}
}

main().catch(e => console.error(e)).finally(() => process.exit(0));