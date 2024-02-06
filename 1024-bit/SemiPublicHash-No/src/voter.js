const {
  bigint_to_words,
  getRandomBigInt,
  pow,
  getCommitmentHasher,
  getNullifierHasher,
  getRandomSigner,
} = require('./utils');
const { snarkFullProve } = require('./snarkjsHelper');

class Voter {
  constructor(balance, n, n_per_word, kN, kr, lr) {
    return (async () => {
      this.signer = await getRandomSigner(balance);
      this.address = this.signer.address;
      this.secret = getRandomBigInt(252);
      this.r = getRandomBigInt(lr);
      this.d = Math.floor(Math.random() * 10) % 2;
      this.commitmentHash = getCommitmentHasher(
        this.secret,
        BigInt(this.address),
      );
      this.n_per_word = n_per_word;
      this.kN = kN;
      this.kr = kr;
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
    this.u = pow(puzzle.g, this.r, puzzle.N);
    // ((1+N) ^ d) == (1 + d * N) mod N^2
    this.v = (pow(pow(puzzle.h, this.r, puzzle.N), puzzle.N, puzzle.N_square)
        * (puzzle.N * BigInt(this.d) + 1n))
      % puzzle.N_square;
    this.castVoteData = {
      u: bigint_to_words(this.n_per_word, this.kN, this.u),
      v: bigint_to_words(this.n_per_word, 2 * this.kN, this.v),
      nullifierHash: getNullifierHasher(this.secret, registerProof.insertedIndex),
    };
    const circuitInputs = {
      N: bigint_to_words(this.n_per_word, this.kN, puzzle.N),
      g: bigint_to_words(this.n_per_word, this.kN, puzzle.g),
      h_pow_N: bigint_to_words(
        this.n_per_word,
        2 * this.kN,
        pow(puzzle.h, puzzle.N, puzzle.N_square),
      ),
      merkleRoot: registerProof.root,
      relayerAddr: BigInt(relayerAddr),
      fee: fee,
      r: bigint_to_words(this.n_per_word, this.kr, this.r),
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

    const { zkProof, publicSignals } = await snarkFullProve(circuitInputs);

    const elapsedTime = process.hrtime(startTime);
    this.log.proofTime = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000; // time in ms

    this.zkProof = zkProof;
    // this.publicSignalsHash = publicSignals[0];
  }
}

module.exports = Voter;
