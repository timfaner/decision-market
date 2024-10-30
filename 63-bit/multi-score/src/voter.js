/* eslint-disable no-bitwise */
/* eslint-disable camelcase */
const {
  getRandomBigInt,
  pow,
  getRandomSigner,
} = require('./utils');
const fs = require('fs');
const {
  zkeyCastVotePath,
  wasmCastVotePath,
  snarkFullProve,
} = require('./snarkjsHelper');

class Voter {
  constructor(){
    this.signer = {};
    this.address = '';
  }
  async topup(balance) {
    this.signer = await getRandomSigner(balance);
    this.address = this.signer.address;
  }

  recover_from_file(fileName) {
    const data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    data.signer = this.signer;
    data.address = this.address;




    // 从文件中恢复数据时需要将字符串转换为对应类型
    data.r = BigInt(data.r);
    data.aggregated_x = BigInt(data.aggregated_x);
    data.aggregated_d = BigInt(data.aggregated_d);
    
    // castVoteData中的数据也需要转换为BigInt
    if(data.castVoteData) {
        data.castVoteData.u = BigInt(data.castVoteData.u);
        data.castVoteData.v_d1 = BigInt(data.castVoteData.v_d1);
        data.castVoteData.v_d2 = BigInt(data.castVoteData.v_d2); 
        data.castVoteData.v_x = BigInt(data.castVoteData.v_x);
    }

    // zkProof中的数据需要转换为BigInt
    if(data.zkProof) {
        data.zkProof.pi_a = data.zkProof.pi_a.map(x => BigInt(x));
        data.zkProof.pi_b = data.zkProof.pi_b.map(row => row.map(x => BigInt(x)));
        data.zkProof.pi_c = data.zkProof.pi_c.map(x => BigInt(x));
    }

    // publicSignals需要转换为BigInt
    if(data.publicSignals) {
        data.publicSignals = data.publicSignals.map(x => BigInt(x));
    }

    // formatProof中的数据需要转换为BigInt
    if(data.formatProof) {
        data.formatProof.a = data.formatProof.a.map(x => BigInt(x));
        data.formatProof.b = data.formatProof.b.map(row => row.map(x => BigInt(x)));
        data.formatProof.c = data.formatProof.c.map(x => BigInt(x));
    }

    this.n = data.n;
    this.nCandidates = data.nCandidates;
    this.S = data.S;
    this.k = data.k;
    this.r = data.r;
    this.x = data.x;
    this.aggregated_x = data.aggregated_x;
    this.d = data.d;
    this.aggregated_d = data.aggregated_d;
    this.log = data.log;
    this.castVoteData = data.castVoteData;
    this.zkProof = data.zkProof;
    this.publicSignals = data.publicSignals;
    this.formatProof = data.formatProof;

  }
  async init(n, nCandidates, S, k) {
      this.n = n;
      this.nCandidates = nCandidates;
      this.S = S;
      this.k = k;

      this.r = getRandomBigInt(2 * n);


      this.x = [];
      let sum = 0;
      for(let i = 0; i < nCandidates - 1; i++) {
        if(sum === 1) {
          this.x.push(0);
        } else {
          const x_i = Math.random() < 0.5 ? 0 : 1;
          sum += x_i;
          this.x.push(x_i);
        }
      }
      if(sum === 1) {
        this.x.push(0);
      } else {
        this.x.push(1 - sum);
      }
      this.aggregated_x = 0n;
      for(let i = 0; i < nCandidates; i++) {
        this.aggregated_x += BigInt(this.x[i]) * (1n << BigInt(i * k));
      }

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
    
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  stringify(obj) {
    return JSON.stringify(obj, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  async genCastVoteData(puzzle) {
    
    this.castVoteData = {
      u: pow(puzzle.g, this.r, puzzle.N),
      // ((1+N) ^ aggregated_d) == (1 + aggregated_d * N) mod N^2
      v_d1:
        (pow(pow(puzzle.h, this.r, puzzle.N), puzzle.N, puzzle.N_square)
          * (puzzle.N * BigInt(this.aggregated_d) + 1n))
        % puzzle.N_square,
      v_d2:
        (pow(puzzle.h, this.r, puzzle.N) * this.aggregated_d % puzzle.N) 
        % puzzle.N,

      v_x:
        (pow(pow(puzzle.h, this.r, puzzle.N), puzzle.N, puzzle.N_square)
          * (puzzle.N * BigInt(this.aggregated_x) + 1n))
        % puzzle.N_square,
    };

    const circuitInputs = {
      N: puzzle.N,
      g: puzzle.g,
      h: puzzle.h,
      r: this.r,
      d: this.d,
      x: this.x,
    };
    const startTime = process.hrtime();




    const { zkProof, publicSignals,formatProof } = await snarkFullProve(
      circuitInputs,
      wasmCastVotePath,
      zkeyCastVotePath,
    );

    const elapsedTime = process.hrtime(startTime);
    this.log.proofTime = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000; // time in ms

    this.zkProof = zkProof;
    this.publicSignals = publicSignals;
    this.formatProof = formatProof;


    // 生成10个随机字母
    const randomStr = Array(10).fill()
      .map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
      .join('');
    
    // 创建文件名 
    const fileName = `${this.nCandidates}_${this.S}_${randomStr}.json`;
    
    // 确保目录存在
    if (!fs.existsSync('voter_data')) {
      fs.mkdirSync('voter_data');
    }
    
    // 写入文件
    fs.writeFileSync(
      `voter_data/${fileName}`, 
      this.stringify(this)
    );
  }
}

module.exports = Voter;
