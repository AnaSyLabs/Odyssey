// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";
import {Test} from "forge-std/Test.sol";
import {OdsySubscriptions} from "../src/OdsySubscriptions.sol";

contract Reenter {
    OdsySubscriptions immutable subs;
    bytes32[] proof;
    uint256 amount;

    constructor(OdsySubscriptions s) {
        subs = s;
    }

    function arm(uint256 a, bytes32[] memory p) external {
        amount = a;
        proof = p;
    }

    receive() external payable {
        subs.claim(1, address(this), amount, proof); // must fail: already claimed + nonReentrant
    }
}

contract OdsySubscriptionsTest is Test {
    OdsySubscriptions subs;
    address owner = makeAddr("owner");
    address lab = makeAddr("lab");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    bytes32 constant DS = keccak256("dataset-1");
    uint256 constant PRICE = 0.01 ether;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.roll(100);
        subs = new OdsySubscriptions(owner);
        vm.prank(owner);
        subs.setPrice(DS, PRICE);
        vm.deal(lab, 10 ether);
    }

    function leaf(uint256 e, address a, uint256 amt) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(e, a, amt))));
    }

    function subscribe() internal returns (uint64) {
        vm.prank(lab);
        return subs.subscribe{value: PRICE}(DS);
    }

    // --- subscribe --------------------------------------------------------------------------------

    function test_subscribe_grantsThirtyDaysAndSplits() public {
        uint64 until = subscribe();
        assertEq(until, block.timestamp + 30 days);
        assertEq(subs.paidUntil(lab, DS), until);
        assertEq(subs.unallocatedRewards(), 0.007 ether);
        assertEq(subs.treasuryBalance(), 0.003 ether);
        assertEq(address(subs).balance, PRICE);
    }

    function test_subscribe_renewalStacksAndLapsedRestarts() public {
        uint64 first = subscribe();
        assertEq(subscribe(), first + 30 days);
        vm.warp(first + 60 days); // lapsed
        assertEq(subscribe(), block.timestamp + 30 days);
    }

    function test_subscribe_capsPrepaidPeriod() public {
        for (uint256 i; i < 5; i++) subscribe(); // 150 days
        vm.prank(lab);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.PrepaidTooFar.selector, uint64(block.timestamp + 180 days)));
        subs.subscribe{value: PRICE}(DS);
    }

    function test_subscribe_rejectsWrongAmountAndUnlisted() public {
        vm.prank(lab);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.WrongAmount.selector, PRICE, PRICE + 1));
        subs.subscribe{value: PRICE + 1}(DS);

        vm.prank(owner);
        subs.setPrice(DS, 0);
        vm.prank(lab);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.NotForSale.selector, DS));
        subs.subscribe{value: PRICE}(DS);
    }

    function test_plainTransfersRevert() public {
        vm.prank(lab);
        (bool ok,) = address(subs).call{value: 1}("");
        assertFalse(ok);
    }

    // --- owner-only -------------------------------------------------------------------------------

    function test_ownerOnly() public {
        bytes memory unauthorized = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, lab);
        vm.startPrank(lab);
        vm.expectRevert(unauthorized);
        subs.setPrice(DS, 1);
        vm.expectRevert(unauthorized);
        subs.setContributorBps(8_000);
        vm.expectRevert(unauthorized);
        subs.publishRewards(bytes32(uint256(1)), 0, 1);
        vm.expectRevert(unauthorized);
        subs.withdrawTreasury(payable(lab));
        vm.stopPrank();
    }

    function test_contributorBpsBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.BpsOutOfRange.selector, uint16(4_999)));
        subs.setContributorBps(4_999);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.BpsOutOfRange.selector, uint16(10_001)));
        subs.setContributorBps(10_001);
        subs.setContributorBps(8_000);
        vm.stopPrank();
        subscribe();
        assertEq(subs.unallocatedRewards(), 0.008 ether);
    }

    function test_withdrawTreasuryLeavesContributorFunds() public {
        subscribe();
        address payable to = payable(makeAddr("treasury"));
        vm.prank(owner);
        subs.withdrawTreasury(to);
        assertEq(to.balance, 0.003 ether);
        assertEq(address(subs).balance, 0.007 ether);
        assertEq(subs.treasuryBalance(), 0);
    }

    // --- rewards ----------------------------------------------------------------------------------

    /// Two leaves: alice 0.005, bob 0.002. Root = commutative hash of the two leaves.
    function publishTwo() internal returns (bytes32 la, bytes32 lb) {
        subscribe();
        la = leaf(1, alice, 0.005 ether);
        lb = leaf(1, bob, 0.002 ether);
        vm.roll(block.number + 1);
        vm.prank(owner);
        subs.publishRewards(Hashes.commutativeKeccak256(la, lb), 0.007 ether, block.number - 1);
    }

    function test_claim_paysEachAccountOnce() public {
        (bytes32 la, bytes32 lb) = publishTwo();
        bytes32[] memory pa = new bytes32[](1);
        pa[0] = lb;
        bytes32[] memory pb = new bytes32[](1);
        pb[0] = la;

        vm.prank(bob); // anyone can claim for alice; funds go to alice
        subs.claim(1, alice, 0.005 ether, pa);
        subs.claim(1, bob, 0.002 ether, pb);
        assertEq(alice.balance, 0.005 ether);
        assertEq(bob.balance, 0.002 ether);
        assertEq(subs.unallocatedRewards(), 0);

        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.AlreadyClaimed.selector, 1, alice));
        subs.claim(1, alice, 0.005 ether, pa);
    }

    function test_claim_rejectsWrongAmountAccountAndEpoch() public {
        (, bytes32 lb) = publishTwo();
        bytes32[] memory pa = new bytes32[](1);
        pa[0] = lb;
        vm.expectRevert(OdsySubscriptions.InvalidProof.selector);
        subs.claim(1, alice, 0.006 ether, pa);
        vm.expectRevert(OdsySubscriptions.InvalidProof.selector);
        subs.claim(1, bob, 0.005 ether, pa);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.UnknownEpoch.selector, 2));
        subs.claim(2, alice, 0.005 ether, pa);
    }

    function test_claim_cannotExceedEpochTotal() public {
        subscribe();
        // A faulty root whose leaves sum to more than the published total.
        bytes32 la = leaf(1, alice, 0.005 ether);
        bytes32 lb = leaf(1, bob, 0.005 ether);
        vm.roll(block.number + 1);
        vm.prank(owner);
        subs.publishRewards(Hashes.commutativeKeccak256(la, lb), 0.007 ether, block.number - 1);
        bytes32[] memory p = new bytes32[](1);
        p[0] = lb;
        subs.claim(1, alice, 0.005 ether, p);
        p[0] = la;
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.ClaimsExceedEpochTotal.selector, 1));
        subs.claim(1, bob, 0.005 ether, p);
    }

    function test_publish_guards() public {
        subscribe();
        vm.roll(block.number + 5);
        vm.startPrank(owner);
        vm.expectRevert(OdsySubscriptions.EmptyRoot.selector);
        subs.publishRewards(bytes32(0), 0, 1);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.RewardsExceedPool.selector, 1 ether, 0.007 ether));
        subs.publishRewards(bytes32(uint256(1)), 1 ether, 1);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.BlockNotFinished.selector, block.number));
        subs.publishRewards(bytes32(uint256(1)), 0, block.number);
        subs.publishRewards(bytes32(uint256(1)), 0.001 ether, block.number - 1);
        vm.expectRevert(abi.encodeWithSelector(OdsySubscriptions.BlockNotAfterLastEpoch.selector, block.number - 1, block.number - 1));
        subs.publishRewards(bytes32(uint256(2)), 0, block.number - 1);
        vm.stopPrank();
        assertEq(subs.epoch(), 1);
        assertEq(subs.unallocatedRewards(), 0.006 ether); // the rest stays for later epochs
    }

    function test_claim_reentrancyBlocked() public {
        subscribe();
        Reenter r = new Reenter(subs);
        bytes32 lr = leaf(1, address(r), 0.002 ether);
        bytes32 lb = leaf(1, bob, 0.005 ether);
        vm.roll(block.number + 1);
        vm.prank(owner);
        subs.publishRewards(Hashes.commutativeKeccak256(lr, lb), 0.007 ether, block.number - 1);
        bytes32[] memory p = new bytes32[](1);
        p[0] = lb;
        r.arm(0.002 ether, p);
        vm.expectRevert(); // the nested claim reverts, so the payout reverts
        subs.claim(1, address(r), 0.002 ether, p);
        assertFalse(subs.claimed(1, address(r)));
    }

    function testFuzz_splitAddsUp(uint96 p, uint16 bps) public {
        vm.assume(p > 0);
        bps = uint16(bound(bps, 5_000, 10_000));
        vm.startPrank(owner);
        subs.setPrice(DS, p);
        subs.setContributorBps(bps);
        vm.stopPrank();
        vm.deal(lab, p);
        vm.prank(lab);
        subs.subscribe{value: p}(DS);
        assertEq(subs.unallocatedRewards() + subs.treasuryBalance(), p);
        assertEq(subs.unallocatedRewards(), (uint256(p) * bps) / 10_000);
    }
}
