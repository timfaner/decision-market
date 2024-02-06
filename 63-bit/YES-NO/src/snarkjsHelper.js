const { groth16 } = require('snarkjs');
const path = require('path');
const fs = require('fs');

const SNARK_SCALAR_FIELD = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

const wasmCastVotePath = path.join(
  __dirname,
  '../build/castVote_main_js/castVote_main.wasm',
);
const zkeyCastVotePath = path.join(
  __dirname,
  '../build/castVote_mainFinal.zkey',
);
const vJsonCastVotePath = path.join(
  __dirname,
  '../build/verifier_castVote_main.json',
);

async function snarkFullProve(witness, wasmPath, zkeyPath) {
  const { proof, publicSignals } = await groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath,
  );
  const zkProof = {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
  return { zkProof, publicSignals };
}

function formatVKey(vkey) {
  const IC = [];
  for (let i = 0; i < vkey.IC.length; i++) {
    IC.push({ X: BigInt(vkey.IC[i][0]), Y: BigInt(vkey.IC[i][1]) });
  }
  return {
    alpha1: {
      X: BigInt(vkey.vk_alpha_1[0]),
      Y: BigInt(vkey.vk_alpha_1[1]),
    },
    beta2: {
      X: [BigInt(vkey.vk_beta_2[0][1]), BigInt(vkey.vk_beta_2[0][0])],
      Y: [BigInt(vkey.vk_beta_2[1][1]), BigInt(vkey.vk_beta_2[1][0])],
    },
    gamma2: {
      X: [BigInt(vkey.vk_gamma_2[0][1]), BigInt(vkey.vk_gamma_2[0][0])],
      Y: [BigInt(vkey.vk_gamma_2[1][1]), BigInt(vkey.vk_gamma_2[1][0])],
    },
    delta2: {
      X: [BigInt(vkey.vk_delta_2[0][1]), BigInt(vkey.vk_delta_2[0][0])],
      Y: [BigInt(vkey.vk_delta_2[1][1]), BigInt(vkey.vk_delta_2[1][0])],
    },
    IC,
  };
}

function getVerificationKeys(vkJSONfile) {
  return formatVKey(JSON.parse(fs.readFileSync(vkJSONfile)));
}

module.exports = {
  SNARK_SCALAR_FIELD,
  wasmCastVotePath,
  zkeyCastVotePath,
  vJsonCastVotePath,
  snarkFullProve,
  getVerificationKeys,
};
