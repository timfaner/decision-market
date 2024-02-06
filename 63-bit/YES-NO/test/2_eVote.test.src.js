/* global describe it ethers before beforeEach afterEach overwriteArtifact */
const { expect } = require('chai');
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
const TREE_DEPTH = __DEPTH__;
const nVoters = __NVOTERS__;
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
let tallyingResult = 0;
const log = {
  TREE_DEPTH,
  nVoters,
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

describe('zk-Evote-HTLP', () => {
  before(async () => {
    [admin, relayer] = await ethers.getSigners();
    voters = [];
    for (let i = 0; i < nVoters; i++) {
      voters.push(await new Voter(2 * DEPOSIT, n));
    }

    eligibilityMerkleTree = new EligibilityMerkleTree(
      voters.map((v) => v.address),
    );
    for (let i = 0; i < nVoters; i++) {
      voters[i].setEligibilityProof(eligibilityMerkleTree);
    }
    registerCommitements = new RegisterCommitements(TREE_DEPTH);
    puzzle = new RandomPuzzle(n, t); // .getPuzzle();

    // Deploy Poseidon library
    await overwriteArtifact('PoseidonT3', poseidonGenContract.createCode(2));
    await overwriteArtifact('PoseidonT4', poseidonGenContract.createCode(3));
  });

  it('Deploy', async () => {
    const PoseidonT3 = await ethers.getContractFactory('PoseidonT3', admin);
    const poseidonT3 = await PoseidonT3.deploy();
    await poseidonT3.deployed();
    const PoseidonT4 = await ethers.getContractFactory('PoseidonT4', admin);
    const poseidonT4 = await PoseidonT4.deploy();
    await poseidonT4.deployed();

    // Deploy Evoting
    const EVote = await ethers.getContractFactory('ZkEvoteHTLP', {
      libraries: {
        PoseidonT3: poseidonT3.address,
        PoseidonT4: poseidonT4.address,
      },
      admin,
    });
    eVoteInstance = await EVote.deploy();
    await eVoteInstance.deployed();
    log.depolyGas = eVoteInstance.deployTransaction.gasLimit.toNumber();
    log.posidonT3Gas = poseidonT3.deployTransaction.gasLimit.toNumber();
    log.posidonT4Gas = poseidonT4.deployTransaction.gasLimit.toNumber();
  });
  it('Initialize', async () => {
    const solPuzzle = {
      N: puzzle.N,
      g: puzzle.g,
      h: puzzle.h,
      T: puzzle.T,
    };
    const _vKeyCastVote = getVerificationKeys(vJsonCastVotePath);
    let tx;
    tx = await eVoteInstance.initialize(
      eligibilityMerkleTree.getHexRoot(),
      _registrationBlockInterval,
      _votingBlockInterval,
      _tallyBlockInterval,
      TREE_DEPTH,
      nVoters,
      solPuzzle,
      _vKeyCastVote,
      { value: DEPOSIT_ETH },
    );
    const receipt = await tx.wait();
    log.initializeGas = receipt.gasUsed.toNumber();

    expect(await eVoteInstance.root()).to.equal(registerCommitements.root);
    expect(await eVoteInstance.NghHash()).to.equal(
      poseidon([solPuzzle.N, solPuzzle.g, solPuzzle.h]),
    );
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
        .register(voter.commitmentHash, voter.eligibilityProof, {
          value: DEPOSIT_ETH,
        });
      receipt = await tx.wait();
      voter.log.registerGas = receipt.gasUsed.toNumber();
      registerEvent = receipt.events.find((ev) => ev.event === 'Register');
      const [_commitmentHash, insertedIndex] = registerEvent.args;
      expect(_commitmentHash).to.equal(voter.commitmentHash);
      registerCommitements.insertLeaves([voter.commitmentHash]);
      expect(insertedIndex).to.equal(
        registerCommitements.tree[0].indexOf(voter.commitmentHash),
      );
      expect(await eVoteInstance.root()).to.equal(registerCommitements.root);
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
        registerCommitements,
        puzzle,
        relayer.address,
        fee,
      );

      tx = await eVoteInstance
        .connect(relayer)
        .castVote(voter.castVoteData, fee, voter.zkProof);
      receipt = await tx.wait();
      voter.log.castGas = receipt.gasUsed.toNumber();
      U = (U * voter.castVoteData.u) % puzzle.N;
      V = (V * voter.castVoteData.v) % puzzle.N_square;
      tallyingResult += voter.d;
      expect(await eVoteInstance.U()).to.equal(U);
      expect(await eVoteInstance.V()).to.equal(V);
    }
  }).timeout(80000 * nVoters);

  it('Set Tallying Result', async () => {
    const finishVotingBlockNumber = await eVoteInstance.finishVotingBlockNumber();
    await mineToBlockNumber(finishVotingBlockNumber.toNumber());
    let tx;
    const { _w, halvingProof } = puzzle.solveSha256(U);

    const tData = {
      D: tallyingResult,
      _w: _w,
      vdfProof: halvingProof,
    };

    tx = await eVoteInstance.connect(admin).setTally(tData);
    const receipt = await tx.wait();
    log.tallyGas = receipt.gasUsed.toNumber();
    expect(await eVoteInstance.tallyingResult()).to.equal(tallyingResult);
  }).timeout(200000000);

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
