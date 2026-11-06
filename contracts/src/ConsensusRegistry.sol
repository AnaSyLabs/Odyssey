// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Decides whether a "tile" of samples (one H3 hex cell x one epoch of one dataset) is good,
/// and bans a World ID after `strikeLimit` provable alerts. Scoring happens off-chain; this contract
/// only holds the rules, the validators' pass counts and the verdicts.
/// @dev shortcut: validators are an allowlist with one vote each (README phase 2 starts permissioned);
/// add stake weighting, commit-reveal and challenges when staking lands.
/// shortcut: rules are immutable per deployment; redeploy to change them.
contract ConsensusRegistry is AccessControl {
    /// The gateway: creates datasets, submits tiles, raises alerts.
    bytes32 public constant OPERATOR = keccak256("OPERATOR");
    /// Allowed to vote on tiles.
    bytes32 public constant VALIDATOR = keccak256("VALIDATOR");

    // Global rules, set once at deploy. Datasets may only be stricter.
    uint16 public immutable quorumBps; // share of checked samples that must pass, e.g. 6667 = 2/3
    uint8 public immutable committeeSize; // votes needed to finish a tile
    uint16 public immutable minSampleRateBps; // lowest spot-check rate a dataset may pick
    uint32 public immutable minChecks; // every tile gets at least this many checks
    uint8 public immutable strikeLimit; // alerts before a World ID is banned

    struct Dataset {
        uint8 h3Resolution; // hex size, 6..10
        uint32 epochLength; // seconds per time bucket
        uint32 minSamples; // fewer samples than this and the tile waits
        uint32 minDevices; // fewer distinct devices than this and the tile waits
        uint16 sampleRateBps; // share of samples spot-checked
        uint8 acceptScore; // validators pass a sample at or above this score (0..100)
        bool exists;
    }

    enum Status { None, Pending, Open, Accepted, Rejected }

    struct Tile {
        bytes32 root; // Merkle root of the tile's samples
        uint32 samples;
        uint32 checked; // how many samples validators must check
        Status status;
        uint8 votes;
    }

    mapping(bytes32 dataset => Dataset) public datasets;
    mapping(bytes32 tileId => Tile) public tiles;
    mapping(bytes32 tileId => uint32[]) private passVotes;
    mapping(bytes32 tileId => mapping(address => bool)) public voted;

    mapping(bytes32 alertId => bool) public alertSeen;
    mapping(bytes32 worldId => uint8) public strikes;
    mapping(bytes32 worldId => uint64) public firstAlertAt;
    /// Time from which a banned World ID's data is excluded; 0 means not banned.
    mapping(bytes32 worldId => uint64) public bannedFrom;

    event DatasetCreated(bytes32 indexed dataset);
    event TileSubmitted(bytes32 indexed tileId, Status status, uint32 samples, uint32 checked);
    event TileFinalized(bytes32 indexed tileId, bool accepted, uint32 medianPassed, uint32 checked);
    event Alert(bytes32 indexed worldId, bytes32 indexed kind, bytes32 ref, uint8 strikes);
    event Banned(bytes32 indexed worldId, uint64 from);
    event Lifted(bytes32 indexed worldId);

    error BadRules();
    error BadDataset();
    error UnknownDataset();
    error TileClosed();
    error AlreadyVoted();
    error BadVote();
    error DuplicateAlert();

    constructor(address admin, address operator, uint16 quorumBps_, uint8 committeeSize_, uint16 minSampleRateBps_, uint32 minChecks_, uint8 strikeLimit_) {
        if (quorumBps_ == 0 || quorumBps_ > 10_000 || committeeSize_ == 0 || minSampleRateBps_ == 0 || minSampleRateBps_ > 10_000 || minChecks_ == 0 || strikeLimit_ == 0) revert BadRules();
        quorumBps = quorumBps_;
        committeeSize = committeeSize_;
        minSampleRateBps = minSampleRateBps_;
        minChecks = minChecks_;
        strikeLimit = strikeLimit_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR, operator);
    }

    // ---- datasets ----

    /// `id` is the dataset's Arkiv key. Rules cannot change afterwards.
    function createDataset(bytes32 id, Dataset calldata d) external onlyRole(OPERATOR) {
        if (datasets[id].exists) revert BadDataset();
        if (d.h3Resolution < 6 || d.h3Resolution > 10 || d.epochLength < 1 hours || d.minSamples == 0 || d.minDevices == 0
            || d.sampleRateBps < minSampleRateBps || d.sampleRateBps > 10_000 || d.acceptScore > 100) revert BadDataset();
        datasets[id] = d;
        datasets[id].exists = true;
        emit DatasetCreated(id);
    }

    // ---- tiles ----

    function tileId(bytes32 dataset, uint64 cell, uint64 epoch) public pure returns (bytes32) {
        return keccak256(abi.encode(dataset, cell, epoch));
    }

    /// Opens a tile for voting, or parks it as Pending when it is too small. A Pending tile can be resubmitted.
    function submitTile(bytes32 dataset, uint64 cell, uint64 epoch, bytes32 root, uint32 samples, uint32 devices) external onlyRole(OPERATOR) {
        Dataset storage d = datasets[dataset];
        if (!d.exists) revert UnknownDataset();
        bytes32 id = tileId(dataset, cell, epoch);
        Tile storage t = tiles[id];
        if (t.status > Status.Pending) revert TileClosed();

        bool big = samples >= d.minSamples && devices >= d.minDevices;
        uint32 want = uint32((uint256(samples) * d.sampleRateBps + 9_999) / 10_000); // rounded up
        uint32 checked = big ? (want < minChecks ? minChecks : want) : 0;
        if (checked > samples) checked = samples;

        t.root = root;
        t.samples = samples;
        t.checked = checked;
        t.status = big ? Status.Open : Status.Pending;
        emit TileSubmitted(id, t.status, samples, checked);
    }

    /// A validator says how many of the tile's checked samples it scored at or above the dataset's acceptScore.
    /// The tile finishes on the vote that reaches `committeeSize`.
    function vote(bytes32 id, uint32 passed) external onlyRole(VALIDATOR) {
        Tile storage t = tiles[id];
        if (t.status != Status.Open) revert TileClosed();
        if (voted[id][msg.sender]) revert AlreadyVoted();
        if (passed > t.checked) revert BadVote();
        voted[id][msg.sender] = true;
        passVotes[id].push(passed);
        t.votes++;
        if (t.votes == committeeSize) _finalize(id, t);
    }

    function _finalize(bytes32 id, Tile storage t) private {
        uint32[] memory v = passVotes[id];
        for (uint256 i = 1; i < v.length; i++) { // insertion sort, committees are tiny
            uint32 x = v[i];
            uint256 j = i;
            while (j > 0 && v[j - 1] > x) { v[j] = v[j - 1]; j--; }
            v[j] = x;
        }
        uint32 median = v[v.length / 2];
        bool ok = uint256(median) * 10_000 >= uint256(quorumBps) * t.checked;
        t.status = ok ? Status.Accepted : Status.Rejected;
        emit TileFinalized(id, ok, median, t.checked);
    }

    // ---- strikes ----

    /// Only for objective evidence (bad signature, duplicate, failed honeypot, impossible location), never "the majority disagreed".
    /// The same (worldId, kind, ref) cannot be counted twice.
    function raiseAlert(bytes32 worldId, bytes32 kind, bytes32 ref) external onlyRole(OPERATOR) {
        bytes32 id = keccak256(abi.encode(worldId, kind, ref));
        if (alertSeen[id]) revert DuplicateAlert();
        alertSeen[id] = true;
        if (strikes[worldId] == 0) firstAlertAt[worldId] = uint64(block.timestamp);
        uint8 s = ++strikes[worldId];
        emit Alert(worldId, kind, ref, s);
        if (s >= strikeLimit && bannedFrom[worldId] == 0) {
            bannedFrom[worldId] = firstAlertAt[worldId];
            emit Banned(worldId, firstAlertAt[worldId]);
        }
    }

    function isBanned(bytes32 worldId) external view returns (bool) {
        return bannedFrom[worldId] != 0;
    }

    /// Appeal granted. Past alerts are forgiven.
    function lift(bytes32 worldId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        strikes[worldId] = 0;
        firstAlertAt[worldId] = 0;
        bannedFrom[worldId] = 0;
        emit Lifted(worldId);
    }
}
