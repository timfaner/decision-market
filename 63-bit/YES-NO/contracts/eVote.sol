// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// import "hardhat/console.sol";

import {PoseidonT4} from "./utils/Poseidon.sol";
import {SnarkProof, castVoteData, tallyData, Puzzle, VerifyingKey} from "./utils/struct.sol";

import {IncMerkleTree as registerCommitments} from "./IncMerkleTree.sol";
import {Verifier} from "./Verifier.sol";

contract ZkEvoteHTLP is registerCommitments, Verifier {
    address public admin;
    mapping(address => bool) public refunded;
    mapping(address => bool) public registeredVoters;
    mapping(uint256 => bool) public nullifierHashes;
    uint256 public nVoters;
    uint256 public registeredCount = 0;
    bytes32 public eligibilityMerkleTreeRoot;
    uint public finishRegistartionBlockNumber;
    uint public finishVotingBlockNumber;
    uint public finishTallyBlockNumber;
    uint public constant DEPOSIT = 1 ether;
    uint public tallyingResult;
    VerifyingKey public vKeyCastVote;
    Puzzle public puzzle;
    uint256 public N_square;
    uint256 public NghHash;
    uint256 public U = 1;
    uint256 public V = 1;

    event Register(uint256 indexed commitment, uint256 leafIndex);
    constructor() {}
    function initialize(
        bytes32 _eligibilityMerkleTreeRoot,
        uint _registrationBlockInterval,
        uint _votingBlockInterval,
        uint _tallyBlockInterval,
        uint256 _treeDepth,
        uint256 _nVoters,
        Puzzle calldata _puzzle,
        VerifyingKey calldata _vKeyCastVote
    ) public payable {
        require(msg.value == DEPOSIT, "Invalid deposit value");
        admin = msg.sender;
        nVoters = _nVoters;
        vKeyCastVote = _vKeyCastVote;
        eligibilityMerkleTreeRoot = _eligibilityMerkleTreeRoot;
        finishRegistartionBlockNumber =
            block.number +
            _registrationBlockInterval;
        finishVotingBlockNumber =
            finishRegistartionBlockNumber +
            _votingBlockInterval;
        finishTallyBlockNumber = finishVotingBlockNumber + _tallyBlockInterval;
        registerCommitments.initializeMerkleTree(_treeDepth);

        puzzle = _puzzle;
        N_square = puzzle.N * puzzle.N;
        NghHash = PoseidonT4.poseidon([puzzle.N, puzzle.g, puzzle.h]);
    }

    function register(
        uint256 _commitment,
        bytes32[] memory _eligibilityMerkleProof
    ) public payable {
        require(msg.value == DEPOSIT, "Invalid deposit value");
        require(
            block.number <= finishRegistartionBlockNumber,
            "Registration phase is already closed"
        );
        // require(registeredCount < nVoters, "Max number of voters is reached");
        require(registeredVoters[msg.sender] == false, "Already registered");
        require(
            Verifier.merkleVerify(
                _eligibilityMerkleProof,
                eligibilityMerkleTreeRoot,
                keccak256(abi.encodePacked(msg.sender))
            ),
            "Ineligible voter"
        );
        uint256 insertedIndex = registerCommitments._insert(_commitment);
        registeredCount += 1;
        registeredVoters[msg.sender] = true;
        emit Register(_commitment, insertedIndex);
    }
    function castVote(
        castVoteData calldata vData,
        uint256 _fee,
        SnarkProof calldata vProof
    ) public payable {
        require(
            block.number > finishRegistartionBlockNumber,
            "Casting Vote phase has not been started yet"
        );
        require(
            block.number <= finishVotingBlockNumber,
            "Voting phase is already closed"
        );
        require(_fee <= DEPOSIT, "Fee exceeds the deposit");
        require(nullifierHashes[vData.nullifierHash] == false, "Already voted");

        uint256 rootRelayerFeeHash = PoseidonT4.poseidon(
            [registerCommitments.getRoot(), uint256(uint160(msg.sender)), _fee]
        );
        uint256 castVoteDataHash = PoseidonT4.poseidon(
            [vData.u, vData.v, vData.nullifierHash]
        );
        uint256 publicSignalsHash = PoseidonT4.poseidon(
            [NghHash, rootRelayerFeeHash, castVoteDataHash]
        );

        uint256[] memory _publicSignals = new uint256[](1);
        _publicSignals[0] = publicSignalsHash;
        require(
            Verifier.zkVerify(
                vProof.a,
                vProof.b,
                vProof.c,
                _publicSignals,
                vKeyCastVote
            ),
            "Invalid encrypted vote"
        );
        nullifierHashes[vData.nullifierHash] = true;
        accumulate(vData.u, vData.v);
        payable(msg.sender).transfer(_fee);
    }

    function setTally(tallyData calldata tData) public {
        require(msg.sender == admin, "Only admin can set the tally result");
        require(
            block.number > finishVotingBlockNumber &&
                block.number <= finishTallyBlockNumber,
            "Tallying phase is already closed"
        );

        require(
            mulmod(tData._w[0], tData._w[1], puzzle.N) == 1,
            "w' is not in z*"
        );
        uint256 w = mulmod(tData._w[0], tData._w[0], puzzle.N);

        // \pi_{LHTLP} statement 1
        require(
            Verifier.vdfVerify(puzzle.T, puzzle.N, U, w, tData.vdfProof),
            "Invalid VDF Proof"
        );

        // \pi_{LHTLP} statement 2
        require(
            tData.D <= registeredCount,
            "tallyingResult have to be less than # of registered voters"
        );

        uint256 tmp1 = uint256(
            BigModExp(bytes32(w), bytes32(puzzle.N), bytes32(N_square))
        );
        // uint256 tmp2 = uint256(
        //     BigModExp(
        //         bytes32(puzzle.N + 1),
        //         bytes32(tData.D),
        //         bytes32(N_square)
        //     )
        // );
        // ((1+N) ^ d) == (1 + d * N) mod N^2
        uint256 tmp2 = 1 + mulmod(puzzle.N, tData.D, N_square);

        // \pi_{LHTLP} statement 3
        require(mulmod(tmp1, tmp2, N_square) == V, "Incorrect tallying result");

        tallyingResult = tData.D;
    }

    function accumulate(uint256 _u, uint256 _v) internal {
        U = mulmod(U, _u, puzzle.N);
        V = mulmod(V, _v, N_square);
    }
}
