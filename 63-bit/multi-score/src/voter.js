/* eslint-disable no-bitwise */
/* eslint-disable camelcase */
const {
  getRandomBigInt,
  pow,
  getRandomSigner,
} = require('./utils');
const {
  zkeyCastVotePath,
  wasmCastVotePath,
  snarkFullProve,
} = require('./snarkjsHelper');

class Voter {
  constructor(balance, n, nCandidates, S, k) {
    return (async () => {
      this.signer = await getRandomSigner(balance);
      this.address = this.signer.address;

      this.r = getRandomBigInt(2 * n);
      this.d = [];
      let max = S;
      for (let i = 0; i < nCandidates - 1; i++) {
        let d_i = this.getRandomInt(max + 1);
        max -= d_i;
        this.d.push(d_i);
      }
      this.d.push(max);
      this.aggregated_d = 0n;
      for (let i = 0; i < nCandidates; i++) {
        this.aggregated_d += BigInt(this.d[i]) * (1n << BigInt(i * k));
      }
      this.log = { proofTime: 0, registerGas: 0, castGas: 0 };
      return this;
    })();
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }



  async genCastVoteData(puzzle) {
    this.castVoteData = {
      u: pow(puzzle.g, this.r, puzzle.N),
      // ((1+N) ^ aggregated_d) == (1 + aggregated_d * N) mod N^2
      v:
        (pow(pow(puzzle.h, this.r, puzzle.N), puzzle.N, puzzle.N_square)
          * (puzzle.N * BigInt(this.aggregated_d) + 1n))
        % puzzle.N_square,
    };
    const circuitInputs = {
      N: puzzle.N,
      g: puzzle.g,
      h: puzzle.h,
      r: this.r,
      d: this.d,
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
    this.publicSignals = publicSignals;
  }
}

module.exports = Voter;
