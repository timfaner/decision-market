// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// import "hardhat/console.sol";

import {BigNumbers, BigNumber} from "./utils/BigNumbers.sol";
import {PoseidonT3} from "./utils/Poseidon.sol";
import {PoseidonT4} from "./utils/Poseidon.sol";
import {SnarkProof, castVoteData, tallyData, Puzzle, VerifyingKey} from "./utils/struct.sol";

import {IncMerkleTree as registerCommitments} from "./IncMerkleTree.sol";
import {Verifier} from "./Verifier.sol";

contract ZkEvoteHTLP is registerCommitments, Verifier {
    using BigNumbers for *;

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
    BigNumber public N;
    BigNumber public N_square;
    uint256 public NghHash;
    BigNumber public U = BigNumbers.one();
    BigNumber public V = BigNumbers.one();

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
        N = BigNumbers.init(words2Bytes(114, 128, puzzle.N), false);
        N_square = N.pow(uint(2));
        BigNumber memory h = BigNumbers.init(
            words2Bytes(114, 128, puzzle.h),
            false
        );
        require(
            BigNumbers.cmp(
                h.modexp(N, N_square),
                BigNumbers.init(words2Bytes(114, 256, puzzle.h_pow_N), false),
                false
            ) == 0
        );
        NghHash = PoseidonT4.poseidon(
            [
                wordsHasher(_puzzle.N),
                wordsHasher(_puzzle.g),
                wordsHasher(_puzzle.h_pow_N)
            ]
        );
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
            [registerCommitments.root, uint256(uint160(msg.sender)), _fee]
        );
        uint256 castVoteDataHash = PoseidonT4.poseidon(
            [wordsHasher(vData.u), wordsHasher(vData.v), vData.nullifierHash]
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

        require(tData._w[0].modinvVerify(N, tData._w[1]), "w' is not in z*");
        BigNumber memory w = tData._w[0].modexp(BigNumbers.two(), N);
        // \pi_{LHTLP} statement 1
        require(
            Verifier.vdfVerify(puzzle.T, N, U, w, tData.vdfProof),
            "Invalid VDF Proof"
        );

        // \pi_{LHTLP} statement 2
        require(
            tData.D <= registeredCount,
            "tallyingResult have to be less than # of registered voters"
        );

        BigNumber memory tmp1 = w.modexp(N, N_square);

        // ((1+N) ^ d) == (1 + d * N) mod N^2
        // BigNumber memory tmp2 = BigNumbers.one();
        // tmp2 = tmp2.add(
        //     N.modmul(
        //         BigNumbers.init(abi.encodePacked(tData.D), false),
        //         N_square
        //     )
        // );
        BigNumber memory tmp2 = N.add(BigNumbers.one());
        tmp2 = tmp2.modexp(
            BigNumbers.init(abi.encodePacked(tData.D), false),
            N_square
        );

        // \pi_{LHTLP} statement 3
        require(
            BigNumbers.cmp(tmp1.modmul(tmp2, N_square), V, false) == 0,
            "Incorrect tallying result"
        );

        tallyingResult = tData.D;
    }

    function accumulate(uint256[] calldata _u, uint256[] calldata _v) internal {
        // U = U * _u % puzzle.N;
        // V = V * _v % N_square;
        U = U.modmul(BigNumbers.init(words2Bytes(114, 128, _u), false), N);
        V = V.modmul(
            BigNumbers.init(words2Bytes(114, 256, _v), false),
            N_square
        );
    }

    function words2Bytes(
        uint256 _n,
        uint256 _l,
        uint256[] memory x
    ) public pure returns (bytes memory r) {
        uint8 shiftOffset = uint8(_n % 8);
        require(
            shiftOffset == 0 || shiftOffset == 2 || shiftOffset == 4,
            "shifts must be in a single byte"
        );
        uint8 bytesPerWord = uint8(shiftOffset == 0 ? _n >> 3 : (_n >> 3) + 1);
        uint8 byteOffset = 32 - bytesPerWord;
        // require(_l <= bytesPerWord * x.length);
        r = new bytes(_l);
        bytes memory wordBytes = new bytes(32);
        bytes1 overlapByte = 0x0;
        uint256 bytesCount = _l;
        uint8 stopIdx;
        for (uint256 j = 0; j < x.length; j++) {
            stopIdx = bytesPerWord <= bytesCount
                ? byteOffset
                : uint8(31 - bytesCount);
            wordBytes = abi.encodePacked(x[j] << ((shiftOffset * j) % 8));
            bytesCount--;
            r[bytesCount] = wordBytes[31] | overlapByte;
            for (uint8 i = 30; i > stopIdx; i--) {
                bytesCount--;
                r[bytesCount] = wordBytes[i];
            }
            if ((shiftOffset * (j + 1)) % 8 == 0) {
                overlapByte = 0x0;
                bytesCount--;
                r[bytesCount] = wordBytes[stopIdx];
            } else {
                overlapByte = wordBytes[stopIdx];
            }
        }
        return r;
    }

    function Hasher9(uint256[] calldata input) internal pure returns (uint256) {
        return
            PoseidonT4.poseidon(
                [
                    PoseidonT4.poseidon([input[0], input[1], input[2]]),
                    PoseidonT4.poseidon([input[3], input[4], input[5]]),
                    PoseidonT4.poseidon([input[6], input[7], input[8]])
                ]
            );
    }

    function wordsHasher(
        uint256[] calldata words
    ) internal pure returns (uint256) {
        require(words.length == 9 || words.length == 18);
        if (words.length == 9) {
            return Hasher9(words);
        } else {
            return
                PoseidonT3.poseidon([Hasher9(words[:9]), Hasher9(words[9:])]);
        }
    }
}
