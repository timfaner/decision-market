// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import {VerifyingKey} from "./utils/struct.sol";
import {bigModExp} from "./utils/bigModExp.sol";

import {verifierZKSNARK} from "./utils/verifier_zkSNARK.sol";
import {Groth16Verifier} from "./utils/Groth16Verifyer.sol";

contract Verifier is bigModExp, Groth16Verifier {
    function vdfVerify(
        uint256 T,
        uint256 N,
        uint256 X,
        uint256 Y,
        uint256[2][] calldata _u
    ) public returns (bool) {
        for (uint256 i = 0; i < _u.length; i++) {
            if (mulmod(_u[i][0], _u[i][1], N) != 1) return false;
        }
        bytes32 N_bytes = bytes32(N);
        uint256 T_halving = T;
        uint256 u;
        uint256 x = X;
        uint256 y = Y;
        uint256 r;

        for (uint256 i = 0; i < _u.length; i++) {
            T_halving = T_halving >> 1;
            u = mulmod(_u[i][0], _u[i][0], N);
            r = uint256(sha256(abi.encodePacked([u, x, T_halving, y])));
            x = mulmod(
                uint256(BigModExp(bytes32(x), bytes32(r), N_bytes)),
                u,
                N
            );
            y = mulmod(
                uint256(BigModExp(bytes32(u), bytes32(r), N_bytes)),
                y,
                N
            );
        }

        return (mulmod(x, x, N) == y);
    }

    function merkleVerify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash < proofElement) {
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
        }
        return computedHash == root;
    }

    // function setZKVerifyingKey(VerifyingKey memory _vKey, uint index) internal {
    //     verifierZKSNARK.setVerifyingKey(_vKey, index);
    // }

    // function zkVerify(
    //     uint[2] memory a,
    //     uint[2][2] memory b,
    //     uint[2] memory c,
    //     uint[] memory input,
    //     VerifyingKey memory vk
    // ) public view returns (bool) {
    //     return verifierZKSNARK.verifyProof(a, b, c, input, vk);
    // }
}
