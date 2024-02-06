const { randomBytes } = require('crypto');
const { poseidon } = require('circomlibjs');
const { ethers } = require('hardhat');

async function mineToBlockNumber(number) {
  const currentBlock = await ethers.provider.getBlock('latest');
  if (number > currentBlock.number) {
    await ethers.provider.send('hardhat_mine', [
      `0x${(number - currentBlock.number).toString(16)}`,
    ]);
  }
}

async function getRandomSigner(balance) {
  const [, tmpAdmin] = await ethers.getSigners();
  const signer = await ethers.Wallet.createRandom().connect(ethers.provider);
  await tmpAdmin.sendTransaction({
    to: signer.address,
    value: ethers.utils.parseEther(balance.toString()),
  });
  return signer;
}

function getNullifierHasher(secret, pathIndicesNum) {
  return poseidon([secret, pathIndicesNum]);
}

function getCommitmentHasher(secret, committerAddr) {
  return poseidon([secret, committerAddr]);
}

function getPublicSignalsHasherCastVote(signals) {
  return poseidon([
    poseidon([signals[0], signals[1], signals[2]]),
    poseidon([signals[3], signals[4], signals[5]]),
    poseidon([signals[6], signals[7], signals[8]]),
  ]);
}

function getRandomAddress() {
  return ethers.Wallet.createRandom().address;
}

function getRandomBigInt(n) {
  const nByte = Math.ceil(n / 8);
  const RandomBytes = randomBytes(nByte);
  const r = BigInt(
    `0b${
      BigInt(`0x${RandomBytes.toString('hex')}`)
        .toString(2)
        .slice(0, n)}`,
  );
  return r;
}

function pow(b, e, n) {
  let r = 1n;
  while (e > 0) {
    if (e % 2n === 1n) {
      r = (r * b) % n;
    }
    e /= 2n;
    b = (b ** 2n) % n;
  }
  return r;
}

function xgcdBigInt(a, b) {
  if (typeof a === 'number') a = BigInt(a);
  if (typeof b === 'number') b = BigInt(b);

  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;

  while (a !== 0n) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  return {
    g: b,
    x,
    y,
  };
}

function gcdBigInt(a, b) {
  if (a === 0n) return b;
  return gcdBigInt(b % a, a);
}

function modInv(a, n) {
  const egcd = xgcdBigInt(a, n);
  if (egcd.g !== 1n) {
    throw new RangeError(
      `${a.toString()} does not have inverse modulo ${n.toString()}`,
    ); // modular inverse does not exist
  } else {
    const x = egcd.x % n;
    return x < 0n ? x + n : x;
  }
}

module.exports = {
  poseidon,
  getCommitmentHasher,
  getNullifierHasher,
  getPublicSignalsHasherCastVote,
  getRandomAddress,
  getRandomBigInt,
  pow,
  xgcdBigInt,
  gcdBigInt,
  modInv,
  getRandomSigner,
  mineToBlockNumber,
};
