const { randomBytes, generatePrimeSync } = require('crypto');
const { poseidon } = require('circomlibjs');
const { ethers } = require('hardhat');
const { assert } = require('chai');

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
function wordsHasher9(words) {
  return poseidon([
    poseidon([words[0], words[1], words[2]]),
    poseidon([words[3], words[4], words[5]]),
    poseidon([words[6], words[7], words[8]]),
  ]);
}
function wordsHasher(words) {
  if (words.length === 9) return wordsHasher9(words);
  return poseidon([
    wordsHasher9(words.slice(0, 9)),
    wordsHasher9(words.slice(9, 18)),
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
function bigInt2BigNumberStruct(x) {
  const x_hex = x.toString(16);
  const x_BigNumers = `0x${x_hex.padStart(64 * Math.ceil(x_hex.length / 64), '0')}`; // padding with leading zeros to fill words of 32 bytes

  return {
    // val: ethers.BigNumber.from(x).toHexString(),
    val: x_BigNumers,
    neg: false,
    bitlen: x.toString(2).length,
  };
}

function bigint_to_words(n, k, x) {
  assert(x.toString(2).length <= n * k);
  const mod = 1n << BigInt(n);
  const res = [];
  let x_temp = x;
  for (let idx = 0; idx < k; idx++) {
    res.push(x_temp % mod);
    x_temp /= mod;
  }
  return res;
}

function words_to_bigint(n, k, x) {
  assert(k === x.length);
  const mod = 1n << BigInt(n);
  let res;
  res = x[k - 1];
  for (let idx = k - 2; idx >= 0; idx--) {
    res = x[idx] + mod * res;
  }
  return res;
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
  bigInt2BigNumberStruct,
  bigint_to_words,
  wordsHasher,
};
