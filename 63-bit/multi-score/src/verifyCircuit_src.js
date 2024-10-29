const Voter = require('./voter');
const {RandomPuzzle} = require('./puzzle');
const {
    vJsonCastVotePath,
    getVerificationKeys,
    snarkVerify,
  } = require('./snarkjsHelper'); 

const n=63;
const t=40;

const puzzle = new RandomPuzzle(n, t);

const nCandidates = __nCandiadates__;
const S = __S__;
const k = __k__;





async function main() {
  const voter = await new Voter(1, n, nCandidates, S, k);
  console.log(voter.address);
  await voter.genCastVoteData(puzzle);


  const verificationKeys = getVerificationKeys(vJsonCastVotePath);

  const result = await snarkVerify(voter.zkProof, verificationKeys, voter.publicSignals);
  console.log(result);

}

main().catch(e => console.error(e)).finally(() => process.exit(0));
