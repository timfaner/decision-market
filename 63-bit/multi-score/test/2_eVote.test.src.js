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
const _registrationBlockInterval = nVoters + 10000;
const _votingBlockInterval = nVoters + 10000;
const _tallyBlockInterval = nVoters + 10000;
const DEPOSIT = 1;
const DEPOSIT_ETH = ethers.utils.parseEther(DEPOSIT.toString());
let registerCommitements;
let eligibilityMerkleTree;
let puzzle;
let U = 1n;
let V_D1 = 1n;
let V_D2 = 1n;
let V_X = 1n;
let tallyingResult_X = Array(nCandidates).fill(0);
let tallyingResult_D = Array(nCandidates).fill(0);
let tallyingResult_D_mul = Array(nCandidates).fill(1);
let aggregate_d = 0n;
let aggregate_x = 0n;
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


    const files = fs.readdirSync('voter_data')
    .filter(f => f !== 'puzzle.json'); // 排除puzzle.json
    for (let i = 0; i < nVoters; i++) {
      let voter = new Voter();  
      voters.push(voter);
    }
    await Promise.all(voters.map(
      voter => {
        voter.topup(2 * DEPOSIT)
      const randomFile = files[Math.floor(Math.random() * files.length)];
      voter.recover_from_file(`voter_data/${randomFile}`);
      }
    ));

    console.log("voters initialized");




    puzzle = new RandomPuzzle(n, t);
    puzzle.recover_from_file(`voter_data/puzzle.json`);
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


      tx = await eVoteInstance
        .connect(voter.signer)
        .castVote(voter.castVoteData, voter.formatProof);
      receipt = await tx.wait();
      voter.log.castGas = receipt.gasUsed.toNumber();


      tx = await eVoteInstance
        .connect(voter.signer)
        .accumulateByOne(voter.castVoteData);

      U = (U * voter.castVoteData.u) % puzzle.N;
      V_D1 = (V_D1 * voter.castVoteData.v_d1) % puzzle.N_square;
      V_X = (V_X * voter.castVoteData.v_x) % puzzle.N_square;
      V_D2 = (V_D2 * voter.castVoteData.v_d2) % puzzle.N;
      // expect(await eVoteInstance.U()).to.equal(U);
      // expect(await eVoteInstance.V_D1()).to.equal(V_D1);
      // expect(await eVoteInstance.V_D2()).to.equal(V_D2);
      // expect(await eVoteInstance.V_X()).to.equal(V_X);
    }
  }).timeout(80000 * nVoters);

  it('Set Tallying Result', async () => {
    const finishVotingBlockNumber = await eVoteInstance.finishVotingBlockNumber();
    await mineToBlockNumber(finishVotingBlockNumber.toNumber());
    let tx;
    for (let i=0; i<nVoters; i++) {
      let voter = voters[i];      
      tallyingResult_X = tallyingResult_X.map(
        (num, indx) => num + voter.x[indx]
      );
      
      tallyingResult_D = tallyingResult_D.map(  
        (num, indx) => num + voter.d[indx]
      );

      tallyingResult_D_mul = tallyingResult_D;
      // tallyingResult_D_mul = tallyingResult_D_mul.map(
      //   (num, indx) => num * voter.d[indx]
      // );
      aggregate_d = aggregate_d + voter.aggregated_d;
      aggregate_x = aggregate_x + voter.aggregated_x;
    }


    const { _w, halvingProof } = puzzle.solveSha256(U);
    const tData = {
      D: tallyingResult_D,
      X: tallyingResult_X,
      D_mul: tallyingResult_D_mul,
      _w: _w,
      vdfProof: halvingProof,
    };
    tx = await eVoteInstance.connect(admin).setTally(tData);
    const receipt = await tx.wait();
    log.tallyGas = receipt.gasUsed.toNumber();
    for (let i = 0; i < nCandidates; i++) {
      expect(await eVoteInstance.tallyingResult_X(i)).to.equal(tallyingResult_X[i]);
      expect(await eVoteInstance.tallyingResult_D(i)).to.equal(tallyingResult_D[i]);

      //expect(await eVoteInstance.tallyingResult_D_mul(i)).to.equal(tallyingResult_D[i]);
    }
  }).timeout(200000000);

  it('Verify Claim', async () => {


    for (let i = 0; i < nVoters; i++) {
      let voter = voters[i];
      await eVoteInstance.connect(voter.signer).verifyClaim({
        aggregate_d: voter.aggregated_d,
        aggregate_x: voter.aggregated_x,
        r: voter.r,
      });
    }

  });

  it('Claim Reward', async () => {
    for (let i = 0; i < nVoters; i++) {
      let voter = voters[i];
      await eVoteInstance.connect(voter.signer).claimReward();
    }
  });

  it('Retrive Result', async () => {
    const result = await eVoteInstance.connect(admin).retriveResult();
    console.log("result: ", result);
  });

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
