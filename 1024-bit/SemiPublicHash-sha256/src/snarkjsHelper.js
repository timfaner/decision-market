// const { groth16 } = require('snarkjs');
const path = require('path');
const fs = require('fs');
const util = require('util');

BigInt.prototype.toJSON = function () {
  return this.toString();
};
const exec = util.promisify(require('child_process').exec);

const SNARK_SCALAR_FIELD = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

const zkeyFile = path.join(__dirname, '../build/castVote_mainFinal.zkey');
const vJsonFile = path.join(__dirname, '../build/verifier_castVote_main.json');
const cppPath = path.join(__dirname, '../build/castVote_main_cpp/');
const circuitName = 'castVote_main';
const prover = path.join(__dirname, '../build/rapidsnark/build/prover');

async function calculateWitness(input) {
  const inputjson = JSON.stringify(input);
  const inputFile = path.join(`${cppPath + circuitName}.json`);
  const wtnsFile = path.join(`${cppPath + circuitName}.wtns`);
  const runc = path.join(cppPath + circuitName);
  fs.writeFile(inputFile, inputjson, (err) => {
    if (err) throw err;
  });
  await exec(`cd ${cppPath}`);
  const proc = await exec(`${runc} ${inputFile} ${wtnsFile}`);
  if (proc.stdout !== '') {
    console.log(proc.stdout);
  }
  if (proc.stderr !== '') {
    console.error(proc.stderr);
  }
  return wtnsFile;
}

async function snarkFullProve(inputSignals) {
  const wtnsFile = await calculateWitness(inputSignals, cppPath, circuitName);
  const proofFile = path.join(`${cppPath + circuitName}_proof.json`);
  const publicSignalsFile = path.join(
    `${cppPath + circuitName}_publicSignals.json`,
  );
  const proc = await exec(
    `${prover
    } ${
      zkeyFile
    } ${
      wtnsFile
    } ${
      proofFile
    } ${
      publicSignalsFile}`,
  );
  if (proc.stdout !== '') {
    console.log(proc.stdout);
  }
  if (proc.stderr !== '') {
    console.error(proc.stderr);
  }
  const proof = JSON.parse(fs.readFileSync(proofFile));
  const publicSignals = JSON.parse(fs.readFileSync(publicSignalsFile));

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

function getVerificationKeys() {
  return formatVKey(JSON.parse(fs.readFileSync(vJsonFile)));
}

module.exports = {
  SNARK_SCALAR_FIELD,
  snarkFullProve,
  getVerificationKeys,
};
