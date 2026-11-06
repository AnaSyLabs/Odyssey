// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title Odyssey dataset subscriptions
/// @notice Labs pay a dataset's price in the native token for 30 days of access. A fixed share of every
/// payment is set aside for the contributors whose samples are in the dataset; the rest is treasury revenue.
/// The gateway splits the contributor share off-chain (pro rata by samples, per payout wallet) and publishes
/// one Merkle root per epoch; contributors, or anyone on their behalf, claim with a proof.
/// @dev Leaves follow OpenZeppelin's StandardMerkleTree: keccak256(bytes.concat(keccak256(abi.encode(epoch, account, amount)))).
contract OdsySubscriptions is Ownable2Step, ReentrancyGuard {
    uint64 public constant PERIOD = 30 days;
    /// @notice Access records on Arkiv live ~182 days, so access can't be prepaid further than this.
    uint64 public constant MAX_PREPAID = 150 days;
    /// @notice Contributors always get at least half of every payment.
    uint16 public constant MIN_CONTRIBUTOR_BPS = 5_000;
    uint16 public constant BPS = 10_000;

    /// @notice Price per period in wei, keyed by the dataset's Arkiv entity key. Zero means not for sale.
    mapping(bytes32 dataset => uint256) public price;
    /// @notice Unix time until which `subscriber` can read `dataset`.
    mapping(address subscriber => mapping(bytes32 dataset => uint64)) public paidUntil;
    /// @notice Contributor share of each payment, in basis points.
    uint16 public contributorBps = 7_000;

    /// @notice Treasury revenue the owner can withdraw.
    uint256 public treasuryBalance;
    /// @notice Contributor share not yet assigned to a published reward root.
    uint256 public unallocatedRewards;
    /// @notice Number of published reward roots; epochs are numbered from 1.
    uint256 public epoch;
    /// @notice Subscriptions up to and including this block are covered by published roots.
    uint256 public rewardsThroughBlock;

    mapping(uint256 epoch => bytes32) public rewardRoot;
    mapping(uint256 epoch => uint256) public rewardTotal;
    mapping(uint256 epoch => uint256) public rewardClaimed;
    mapping(uint256 epoch => mapping(address account => bool)) public claimed;

    event PriceSet(bytes32 indexed dataset, uint256 price);
    event ContributorBpsSet(uint16 bps);
    event Subscribed(address indexed subscriber, bytes32 indexed dataset, uint256 amount, uint256 toContributors, uint64 paidUntil);
    event RewardsPublished(uint256 indexed epoch, bytes32 root, uint256 total, uint256 throughBlock);
    event Claimed(uint256 indexed epoch, address indexed account, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    error NotForSale(bytes32 dataset);
    error WrongAmount(uint256 expected, uint256 sent);
    error PrepaidTooFar(uint64 paidUntil);
    error BpsOutOfRange(uint16 bps);
    error EmptyRoot();
    error RewardsExceedPool(uint256 total, uint256 available);
    error BlockNotAfterLastEpoch(uint256 throughBlock, uint256 last);
    error BlockNotFinished(uint256 throughBlock);
    error UnknownEpoch(uint256 epoch);
    error AlreadyClaimed(uint256 epoch, address account);
    error InvalidProof();
    error ClaimsExceedEpochTotal(uint256 epoch);

    constructor(address owner_) Ownable(owner_) {}

    // --- Owner: catalogue and split -------------------------------------------------------------

    /// @notice Lists a dataset at `newPrice` wei per 30 days, or unlists it with 0. Paid access is kept.
    function setPrice(bytes32 dataset, uint256 newPrice) external onlyOwner {
        price[dataset] = newPrice;
        emit PriceSet(dataset, newPrice);
    }

    /// @notice Changes the contributor share for future payments, within [MIN_CONTRIBUTOR_BPS, BPS].
    function setContributorBps(uint16 bps) external onlyOwner {
        if (bps < MIN_CONTRIBUTOR_BPS || bps > BPS) revert BpsOutOfRange(bps);
        contributorBps = bps;
        emit ContributorBpsSet(bps);
    }

    // --- Labs: subscribe --------------------------------------------------------------------------

    /// @notice Pays exactly the dataset's price for 30 more days of access. Renewals stack from the
    /// current paid-until time; a lapsed subscription restarts now.
    function subscribe(bytes32 dataset) external payable returns (uint64 until) {
        uint256 p = price[dataset];
        if (p == 0) revert NotForSale(dataset);
        if (msg.value != p) revert WrongAmount(p, msg.value);

        uint64 now_ = uint64(block.timestamp);
        uint64 current = paidUntil[msg.sender][dataset];
        until = (current > now_ ? current : now_) + PERIOD;
        if (until - now_ > MAX_PREPAID) revert PrepaidTooFar(until);
        paidUntil[msg.sender][dataset] = until;

        uint256 toContributors = (msg.value * contributorBps) / BPS;
        unallocatedRewards += toContributors;
        treasuryBalance += msg.value - toContributors;
        emit Subscribed(msg.sender, dataset, msg.value, toContributors, until);
    }

    // --- Contributor rewards ----------------------------------------------------------------------

    /// @notice Publishes the next epoch's reward root, covering subscriptions after the last epoch's
    /// block up to and including `throughBlock`. `total` must equal the sum of the root's leaves.
    function publishRewards(bytes32 root, uint256 total, uint256 throughBlock) external onlyOwner {
        if (root == bytes32(0)) revert EmptyRoot();
        if (total > unallocatedRewards) revert RewardsExceedPool(total, unallocatedRewards);
        if (throughBlock <= rewardsThroughBlock) revert BlockNotAfterLastEpoch(throughBlock, rewardsThroughBlock);
        if (throughBlock >= block.number) revert BlockNotFinished(throughBlock);

        uint256 e = ++epoch;
        rewardRoot[e] = root;
        rewardTotal[e] = total;
        rewardsThroughBlock = throughBlock;
        unallocatedRewards -= total;
        emit RewardsPublished(e, root, total, throughBlock);
    }

    /// @notice Pays `account` its reward for epoch `e`. Anyone may call; funds always go to `account`.
    function claim(uint256 e, address account, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        bytes32 root = rewardRoot[e];
        if (root == bytes32(0)) revert UnknownEpoch(e);
        if (claimed[e][account]) revert AlreadyClaimed(e, account);
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(e, account, amount))));
        if (!MerkleProof.verifyCalldata(proof, root, leaf)) revert InvalidProof();
        // A faulty root can never pay out more than the epoch's published total.
        if (rewardClaimed[e] + amount > rewardTotal[e]) revert ClaimsExceedEpochTotal(e);

        claimed[e][account] = true;
        rewardClaimed[e] += amount;
        emit Claimed(e, account, amount);
        Address.sendValue(payable(account), amount);
    }

    // --- Owner: treasury --------------------------------------------------------------------------

    /// @notice Sends all treasury revenue to `to`. Contributor funds are never touched.
    function withdrawTreasury(address payable to) external onlyOwner nonReentrant {
        uint256 amount = treasuryBalance;
        treasuryBalance = 0;
        emit TreasuryWithdrawn(to, amount);
        Address.sendValue(to, amount);
    }
}
