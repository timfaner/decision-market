const {
  getRandomBigInt,
  pow,
  getCommitmentHasher,
  getNullifierHasher,
  getRandomSigner,
} = require('./utils');
const {
  zkeyCastVotePath,
  wasmCastVotePath,
  snarkFullProve,
} = require('./snarkjsHelper');

class Voter {
  constructor(balance, n) {
    return (async () => {
      this.signer = await getRandomSigner(balance);
      this.address = this.signer.address;
      this.secret = getRandomBigInt(252);
      this.r = getRandomBigInt(2 * n);
      this.d = Math.floor(Math.random() * 10) % 2;
      this.commitmentHash = getCommitmentHasher(
        this.secret,
        BigInt(this.address),
      );
      this.log = { proofTime: 0, registerGas: 0, castGas: 0 };
      return this;
    })();
  }

  setEligibilityProof(eligibilityMerkleTree) {
    this.eligibilityProof = eligibilityMerkleTree.getProof(this.address);
  }

  async genCastVoteData(registerCommitments, puzzle, relayerAddr, fee) {
    const registerProof = registerCommitments.generateProof(
      this.commitmentHash,
    );
    this.castVoteData = {
      u: pow(puzzle.g, this.r, puzzle.N),
      // ((1+N) ^ d) == (1 + d * N) mod N^2
      v:
        (pow(pow(puzzle.h, this.r, puzzle.N), puzzle.N, puzzle.N_square)
          * (puzzle.N * BigInt(this.d) + 1n))
        % puzzle.N_square,
      nullifierHash: getNullifierHasher(
        this.secret,
        registerProof.insertedIndex,
      ),
    };
    const circuitInputs = {
      N: puzzle.N,
      g: puzzle.g,
      h: puzzle.h,
      merkleRoot: registerProof.root,
      relayerAddr: BigInt(relayerAddr),
      fee: fee,
      r: this.r,
      d: this.d,
      proof: registerProof.elements,
      insertedIndex: registerProof.insertedIndex,
      secret: this.secret,
      voterAddr: BigInt(this.address),
      u: this.castVoteData.u,
      v: this.castVoteData.v,
      nullifierHash: this.castVoteData.nullifierHash,
    };
    const startTime = process.hrtime();

    const { zkProof, publicSignals } = await snarkFullProve(
      circuitInputs,
      wasmCastVotePath,
      zkeyCastVotePath,
    );

    const elapsedTime = process.hrtime(startTime);
    this.log.proofTime = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000; // time in ms

    this.zkProof = zkProof;
    this.publicSignalsHash = publicSignals[0];
  }
}

module.exports = Voter;
