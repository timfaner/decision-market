// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// import "hardhat/console.sol";

import {SnarkProof, castVoteData, tallyData, Puzzle} from "./utils/struct.sol";


import {Verifier} from "./Verifier.sol";

contract ZkEvoteHTLP is  Verifier {
    address public admin;
    mapping(address => bool) public refunded;
    mapping(address => bool) public registeredVoters;
    uint256 public nVoters;
    uint256 public registeredCount;
    bytes32 public eligibilityMerkleTreeRoot;
    uint public finishRegistartionBlockNumber;
    uint public finishVotingBlockNumber;
    uint public finishTallyBlockNumber;
    uint public constant DEPOSIT = 1 ether;
    uint256[] public tallyingResult;
    Puzzle public puzzle;
    uint256 public N_square;
    uint256 public U = 1;
    uint256 public V_D1 = 1;
    uint256 public V_D2 = 1;
    uint256 public V_X = 1;
    uint256 public k;
    uint256 public S;

    event Register(address indexed voter);
    constructor() {}
    function initialize(
        uint _registrationBlockInterval,
        uint _votingBlockInterval,
        uint _tallyBlockInterval,
        uint256 _nVoters,
        Puzzle calldata _puzzle,
        uint256 _k,
        uint256 _S
    ) public payable {
        require(msg.value == DEPOSIT, "Invalid deposit value");
        admin = msg.sender;
        nVoters = _nVoters;
        registeredCount = 0;
        finishRegistartionBlockNumber =
            block.number +
            _registrationBlockInterval;
        finishVotingBlockNumber =
            finishRegistartionBlockNumber +
            _votingBlockInterval;
        finishTallyBlockNumber = finishVotingBlockNumber + _tallyBlockInterval;
        k = _k;
        S = _S;
        puzzle = _puzzle;
        N_square = puzzle.N * puzzle.N;
    }

    function register() public payable {
        require(msg.value == DEPOSIT, "Invalid deposit value");
        require(
            block.number <= finishRegistartionBlockNumber,
            "Registration phase is already closed"
        );
        require(registeredCount < nVoters, "Max number of voters is reached");
        require(registeredVoters[msg.sender] == false, "Already registered");
        registeredCount += 1;
        registeredVoters[msg.sender] = true;
        emit Register(msg.sender);
    }
    function castVote(
        castVoteData calldata vData,
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

        require(
            this.verifyProof(
                vProof.a,
                vProof.b,
                vProof.c,
                [vData.u, vData.v_d1, vData.v_d2, vData.v_x]
            ),
            "Invalid encrypted vote"
        );
        accumulate(vData.u, vData.v_d1, vData.v_d2, vData.v_x);
    }

    function setTally(tallyData calldata tData) public {
        
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
        uint256 maxTotalSocre = registeredCount * S;
        for (uint i = 0; i < tData.D.length; i++) {
            require(
                tData.D[i] <= maxTotalSocre,
                "tallyingResult have to be less than # of registered voters * max Score"
            );
        }
        uint256 aggregated_D = 0;
        for (uint i = 0; i < tData.D.length; i++) {
            aggregated_D += tData.D[i] << (i * k);
        }
        uint256 tmp1 = uint256(
            BigModExp(bytes32(w), bytes32(puzzle.N), bytes32(N_square))
        );
        // uint256 tmp2 = uint256(
        //     BigModExp(
        //         bytes32(puzzle.N + 1),
        //         bytes32(aggregated_D),
        //         bytes32(N_square)
        //     )
        // );
        // ((1+N) ^ d) == (1 + d * N) mod N^2
        uint256 tmp2 = 1 + mulmod(puzzle.N, aggregated_D, N_square);

        // \pi_{LHTLP} statement 3
        require(mulmod(tmp1, tmp2, N_square) == V_X, "Incorrect tallying result");

        tallyingResult = tData.D;
    }

    function accumulate(uint256 _u, uint256 _v_d1, uint256 _v_d2, uint256 _v_x) internal {
        U = mulmod(U, _u, puzzle.N);
        V_D1 = mulmod(V_D1, _v_d1, N_square);
        V_D2 = mulmod(V_D2, _v_d2, puzzle.N);
        V_X = mulmod(V_X, _v_x, N_square);
    }
}
