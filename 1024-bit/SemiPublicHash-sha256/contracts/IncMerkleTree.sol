// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {PoseidonT3} from "./utils/Poseidon.sol";

contract IncMerkleTree {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ZERO_VALUE = 0;
    uint256 public treeDepth;

    uint256[] public filledSubtrees;
    uint256[] public zeros;
    uint256 public nextIndex = 0;
    uint256 public root;

    function initializeMerkleTree(uint256 _treeDepth) internal {
        require(_treeDepth > 0, "_treeDepth should be greater than zero");
        treeDepth = _treeDepth;
        uint256 currentZero = ZERO_VALUE;
        zeros.push(currentZero);
        filledSubtrees.push(currentZero);

        for (uint32 i = 1; i < _treeDepth; i++) {
            currentZero = hashLeftRight(currentZero, currentZero);
            zeros.push(currentZero);
            filledSubtrees.push(currentZero);
        }

        root = hashLeftRight(currentZero, currentZero);
    }

    function hashLeftRight(
        uint256 _left,
        uint256 _right
    ) public pure returns (uint256) {
        require(_left < SNARK_SCALAR_FIELD, "_left should be inside the field");
        require(
            _right < SNARK_SCALAR_FIELD,
            "_right should be inside the field"
        );
        return PoseidonT3.poseidon([_left, _right]);
    }

    function _insert(uint256 _leaf) internal returns (uint256 index) {
        uint256 currentIndex = nextIndex;
        require(
            currentIndex != uint256(2) ** treeDepth,
            "Merkle tree is full. No more leafs can be added"
        );
        nextIndex += 1;
        uint256 currentLevelHash = _leaf;
        uint256 left;
        uint256 right;

        for (uint256 i = 0; i < treeDepth; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];

                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }

            currentLevelHash = hashLeftRight(left, right);

            currentIndex /= 2;
        }

        root = currentLevelHash;
        return nextIndex - 1;
    }

    function getRoot() public view returns (uint256) {
        return root;
    }
}
