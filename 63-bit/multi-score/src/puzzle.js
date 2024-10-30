const { generatePrimeSync } = require('crypto');
const {
  gcdBigInt,
  modInv,
  getRandomBigInt,
  pow,
  poseidon,
} = require('./utils');
const fs = require('fs');
class RandomPuzzle {
  constructor(n, t) {
    this.n = n
    this.t = BigInt(t);
    this.T = 2n ** this.t;
    const pSize = Math.ceil(n / 2);
    const qSize = n - pSize;
    this.p = generatePrimeSync(pSize, { safe: true, bigint: true });
    this.q = generatePrimeSync(qSize, { safe: true, bigint: true });

    this.N = this.p * this.q;
    this.phi = (this.p - 1n) * (this.q - 1n);

    this._p = (this.p - 1n) / 2n;
    this._q = (this.q - 1n) / 2n;
    this.order_QR = this._p * this._q; // = phi/4
    this.phi_order_QR = (this._p - 1n) * (this._q - 1n);

    this.N_square = this.N * this.N;

    this.g = this.pickupRandomG(this.n, this.N);
    this.exp = pow(2n, this.T % this.phi_order_QR, this.order_QR);
    this.h = this.solve(this.g).puzzleSol;
  }

  recover_from_file(fileName) {
    const data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    
    this.n = data.n;
    this.t = BigInt(data.t);
    this.T = BigInt(data.T);
    this.p = BigInt(data.p);
    this.q = BigInt(data.q);
    this.N = BigInt(data.N);
    this.phi = BigInt(data.phi);
    this._p = BigInt(data._p);
    this._q = BigInt(data._q);
    this.order_QR = BigInt(data.order_QR);
    this.phi_order_QR = BigInt(data.phi_order_QR);
    this.N_square = BigInt(data.N_square);
    this.g = BigInt(data.g);
    this.exp = BigInt(data.exp);
    this.h = BigInt(data.h);
  }

  pickupRandomG() {
    let g1;
    let g;
    while (true) {
      g1 = getRandomBigInt(this.n);
      if (g1 !== 1n && gcdBigInt(g1, this.N) === 1n) {
        // g1 \in Z^{*}
        g = g1 ** 2n % this.N; // g \in QR and its order \in {_q, _p, order_QR}
        if (pow(g, this._p, this.N) !== 1n && pow(g, this._p, this.N) !== 1n)
        // check that g order is not _q nor _p, then it must be order_QR
        { return g; } // g is a geenerator of QR
      }
    }
  }

  solve(_x) {
    const sol = pow(_x, this.exp, this.N);
    let _T_halving = this.T;
    const proof = [];
    let x = _x;
    let y = sol;
    for (let i = 0n; i < this.t; i++) {
      _T_halving /= 2n;
      const e = pow(2n, (_T_halving - 1n) % this.phi_order_QR, this.order_QR);
      const _u = pow(x, e, this.N);
      const _u_inv = modInv(_u, this.N);
      proof.push([_u, _u_inv]);
      const u = _u ** 2n % this.N;
      const r = poseidon([u, x, _T_halving, y]);
      x = (pow(x, r, this.N) * u) % this.N;
      y = (pow(u, r, this.N) * y) % this.N;
    }

    return {
      puzzleSol: sol,
      halvingProof: proof,
    };
  }

  LHTLPGen(s) {
    // 从1到N^2范围内随机选择r
    const r = getRandomBigInt(this.n * 2);
    
    // 计算u = g^r mod N
    const u = pow(this.g, r, this.N);

    // 计算v = h^(r*N) * (1+N)^s mod N^2
    const h_rN = pow(this.h, r * this.N, this.N_square);
    const oneN_s = pow(1n + this.N, s, this.N_square); 
    const v = (h_rN * oneN_s) % this.N_square;

    return {
      u: u,
      v: v,
      r: r // 返回r用于验证
    };
  }

  MHTLPGen(s) {
    // 从1到N^2范围内随机选择r
    const r = getRandomBigInt(this.n * 2n);
    
    // 计算u = g^r mod N
    const u = pow(this.g, r, this.N);

    // 计算v = h^r * s mod N
    const h_r = pow(this.h, r, this.N);
    const v = (h_r * s) % this.N;

    return {
      u: u,
      v: v,
      r: r // 返回r用于验证
    };
  }

  
  solveSha256(_x) {
    // const sol = pow(_x, this.exp, this.N);
    const _w = pow(
      _x,
      pow(2n, (this.T - 1n) % this.phi_order_QR, this.order_QR),
      this.N,
    );
    const _w_inv = modInv(_w, this.N);
    let _T_halving = this.T;
    const proof = [];
    let x = _x;
    let y = pow(_w, 2n, this.N);
    for (let i = 0n; i < this.t; i++) {
      _T_halving /= 2n;
      const e = pow(2n, (_T_halving - 1n) % this.phi_order_QR, this.order_QR);
      const _u = pow(x, e, this.N);
      const _u_inv = modInv(_u, this.N);
      proof.push([_u, _u_inv]);
      const u = _u ** 2n % this.N;
      // let r = poseidon([u, x, _T_halving, y]);
      const r = BigInt(
        ethers.utils.soliditySha256(
          ['uint256', 'uint256', 'uint256', 'uint256'],
          [u, x, _T_halving, y],
        ),
      );
      x = (pow(x, r, this.N) * u) % this.N;
      y = (pow(u, r, this.N) * y) % this.N;
    }
    return {
      _w: [_w, _w_inv],
      halvingProof: proof,
    };
  }

  brutalSolve(_x) {
    let w = _x;
    for(let i = 0n; i < this.T; i++) {
      w = w * w % this.N;
    }
    return w;
  }

  solvePuzzle(u, v) {
    const w = this.brutalSolve(u);
    const w_N = pow(w, this.N, this.N_square);
    const v_div_w_N = (v * modInv(w_N, this.N_square)) % this.N_square;
    const s = (v_div_w_N - 1n) / this.N;
    return s;
  }

  getPuzzle() {
    return {
      p: this.p,
      q: this.q,
      N: this.N,
      phi: this.phi,
      N_square: this.N_square,
      g: this.g,
      h: this.h,
    };
  }
}

module.exports = { RandomPuzzle };
