/* global describe it ethers before beforeEach afterEach overwriteArtifact */
const { expect, assert } = require('chai');
const { ethers } = require('hardhat');
const poseidonGenContract = require('circomlibjs/src/poseidon_gencontract');
const fs = require('fs');
const RegisterCommitements = require('../src/IncMerkleTree');
const { MerkleTree: EligibilityMerkleTree } = require('../src/merkleTree');
const Voter = require('../src/voter');
const { poseidon, mineToBlockNumber } = require('../src/utils');
const {
  vJsonCastVotePath,
  getVerificationKeys,
} = require('../src/snarkjsHelper');
const { RandomPuzzle } = require('../src/puzzle');

let eVoteInstance;
const n = 63;
const nVoters = __NVOTERS__;
const nCandidates = __nCandiadates__;
const S = __S__;
const k = __k__;
const t = 40;
const fee = 1;
let voters;
let admin;
let relayer;
const _registrationBlockInterval = nVoters + 300;
const _votingBlockInterval = nVoters + 300;
const _tallyBlockInterval = nVoters + 300;
const DEPOSIT = 1;
const DEPOSIT_ETH = ethers.utils.parseEther(DEPOSIT.toString());
let registerCommitements;
let eligibilityMerkleTree;
let puzzle;
let U = 1n;
let V = 1n;
let tallyingResult = Array(nCandidates).fill(0);
const log = {
  nVoters,
  nCandidates,
  S,
  k,
  constraints: __constraints__,
  compilationTime: __compilation__,
  generationTime: __generation__,
  provingKeySize: __proving__,
  depolyGas: 0,
  posidonT3Gas: 0,
  posidonT4Gas: 0,
  initializeGas: 0,
  proofTimeAvg: 0,
  proofTimeMin: 0,
  proofTimeMax: 0,
  registerGasAvg: 0,
  registerGasMin: 0,
  registerGasMax: 0,
  castGasAvg: 0,
  castGasMin: 0,
  castGasMax: 0,
  tallyGas: 0,
};

assert(n <= 63, 'n must be <= 63');
assert(
  Math.floor(Math.log2(S * nVoters)) + 1 <= k,
  'k must be >= 1 + floor(log2(S * nVoters))',
);
describe('zk-Evote-HTLP', () => {
  before(async () => {
    [admin, relayer] = await ethers.getSigners();
    voters = [];
    for (let i = 0; i < nVoters; i++) {
      voters.push(await new Voter(2 * DEPOSIT, n, nCandidates, S, k));
    }



    puzzle = new RandomPuzzle(n, t); // .getPuzzle();
    assert(
      1n << BigInt(nCandidates * k) < puzzle.N,
      '2**(nCandidates * k) < N',
    );

  });

  it('Deploy', async () => {


    // Deploy Evoting
    const EVote = await ethers.getContractFactory('ZkEvoteHTLP', {
      admin,
    });
    eVoteInstance = await EVote.deploy();
    await eVoteInstance.deployed();
    log.depolyGas = eVoteInstance.deployTransaction.gasLimit.toNumber();
  });
  it('Initialize', async () => {
    const solPuzzle = {
      N: puzzle.N,
      g: puzzle.g,
      h: puzzle.h,
      T: puzzle.T,
    };
    let tx = await eVoteInstance.initialize(
      _registrationBlockInterval,
      _votingBlockInterval,
      _tallyBlockInterval,
      nVoters,
      solPuzzle,
      k,
      S,
      { value: DEPOSIT_ETH },
    );
    const receipt = await tx.wait();
    log.initializeGas = receipt.gasUsed.toNumber();
  });
  it('Register', async () => {
    let voter;
    let tx;
    let receipt;
    let registerEvent;
    for (let i = 0; i < nVoters; i++) {
      voter = voters[i];
      tx = await eVoteInstance
        .connect(voter.signer)
        .register( {
          value: DEPOSIT_ETH,
        });
      receipt = await tx.wait();
      voter.log.registerGas = receipt.gasUsed.toNumber();
      registerEvent = receipt.events.find((ev) => ev.event === 'Register');

    }
  });
  it('Cast Vote', async () => {
    const finishRegistartionBlockNumber = await eVoteInstance.finishRegistartionBlockNumber();
    await mineToBlockNumber(finishRegistartionBlockNumber.toNumber());
    let voter;
    let tx;
    let receipt;
    for (let i = 0; i < nVoters; i++) {
      voter = voters[i];
      await voter.genCastVoteData(
        puzzle
      );

      tx = await eVoteInstance
        .connect(relayer)
        .castVote(voter.castVoteData, voter.formatProof);
      receipt = await tx.wait();
      voter.log.castGas = receipt.gasUsed.toNumber();
      //U = (U * voter.castVoteData.u) % puzzle.N;
      //V = (V * voter.castVoteData.v) % puzzle.N_square;
      //tallyingResult = tallyingResult.map((num, indx) => num + voter.d[indx]);
      //expect(await eVoteInstance.U()).to.equal(U);
      //expect(await eVoteInstance.V()).to.equal(V);
    }
  }).timeout(80000 * nVoters);

  // it('Set Tallying Result', async () => {
  //   const finishVotingBlockNumber = await eVoteInstance.finishVotingBlockNumber();
  //   await mineToBlockNumber(finishVotingBlockNumber.toNumber());
  //   let tx;
  //   const { _w, halvingProof } = puzzle.solveSha256(U);

  //   const tData = {
  //     D: tallyingResult,
  //     _w: _w,
  //     vdfProof: halvingProof,
  //   };

  //   tx = await eVoteInstance.connect(admin).setTally(tData);
  //   const receipt = await tx.wait();
  //   log.tallyGas = receipt.gasUsed.toNumber();
  //   for (let i = 0; i < nCandidates; i++) {
  //     expect(await eVoteInstance.tallyingResult(i)).to.equal(tallyingResult[i]);
  //   }
  // }).timeout(200000000);

  it('logging', () => {
    const proofTime = [];
    const registerGas = [];
    const castGas = [];
    for (let i = 0; i < nVoters; i++) {
      proofTime.push(voters[i].log.proofTime);
      registerGas.push(voters[i].log.registerGas);
      castGas.push(voters[i].log.castGas);
    }
    log.proofTimeAvg = proofTime.reduce((a, b) => a + b, 0) / nVoters;
    log.registerGasAvg = registerGas.reduce((a, b) => a + b, 0) / nVoters;
    log.castGasAvg = castGas.reduce((a, b) => a + b, 0) / nVoters;
    log.proofTimeMax = Math.max(...proofTime);
    log.registerGasMax = Math.max(...registerGas);
    log.castGasMax = Math.max(...castGas);
    log.proofTimeMin = Math.min(...proofTime);
    log.registerGasMin = Math.min(...registerGas);
    log.castGasMin = Math.min(...castGas);
    console.log(log);
    // fs.appendFile("./statistics.txt", Object.values(log).join(' ') + '\n', (err) => {
    //     if(err) {
    //     throw err;}
    //     // console.log("Data has been written to file successfully.");
    //     })
  });
});
