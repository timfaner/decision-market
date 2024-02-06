// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import {VerifyingKey} from "./utils/struct.sol";
import {BigNumbers, BigNumber} from "./utils/BigNumbers.sol";

import {verifierZKSNARK} from "./utils/verifier_zkSNARK.sol";

contract Verifier is verifierZKSNARK {
    using BigNumbers for *;
    function vdfVerify(
        uint256 T,
        BigNumber memory N,
        BigNumber memory X,
        BigNumber memory Y,
        BigNumber[2][] calldata _u
    ) public view returns (bool) {
        for (uint256 i = 0; i < _u.length; i++) {
            if (!_u[i][0].modinvVerify(N, _u[i][1])) return false;
        }
        uint256 T_halving = T;
        BigNumber memory u;
        BigNumber memory x = X;
        BigNumber memory y = Y;
        BigNumber memory r;
        bytes memory T_halving_bytes;
        for (uint256 i = 0; i < _u.length; i++) {
            T_halving = T_halving >> 1;
            u = _u[i][0].modexp(BigNumbers.two(), N);
            T_halving_bytes = abi.encodePacked(T_halving);
            r = BigNumbers.init(
                abi.encodePacked(
                    sha256(
                        abi.encodePacked(u.val, x.val, T_halving_bytes, y.val)
                    )
                ),
                false
            );
            x = u.modmul(x.modexp(r, N), N);
            y = y.modmul(u.modexp(r, N), N);
        }
        BigNumber memory tmp = BigNumbers.two().pow(T_halving);
        x = x.modexp(tmp, N);
        return (BigNumbers.cmp(x, y, false) == 0);
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

    function zkVerify(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input,
        VerifyingKey memory vk
    ) public view returns (bool) {
        return verifierZKSNARK.verifyProof(a, b, c, input, vk);
    }
}
