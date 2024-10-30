// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

struct G1Point {
    uint X;
    uint Y;
}
// Encoding of field elements is: X[0] * z + X[1]
struct G2Point {
    uint[2] X;
    uint[2] Y;
}

struct VerifyingKey {
    G1Point alpha1;
    G2Point beta2;
    G2Point gamma2;
    G2Point delta2;
    G1Point[] IC;
}
struct Proof {
    G1Point A;
    G2Point B;
    G1Point C;
}

struct SnarkProof {
    uint[2] a;
    uint[2][2] b;
    uint[2] c;
}

struct castVoteData {
    uint u;
    uint v_d1;
    uint v_d2;
    uint v_x;
}

struct rawVoteData {
    uint256 aggregate_d;
    uint256 aggregate_x;
    uint256 r;
}

struct tallyData {
    uint256[] D;
    uint256[] X;
    uint256[] D_mul;
    uint256[2] _w;
    uint256[2][] vdfProof;
}

struct Puzzle {
    uint256 N;
    uint256 g;
    uint256 h;
    uint256 T;
}
