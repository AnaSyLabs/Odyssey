// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConsensusRegistry as C} from "../src/ConsensusRegistry.sol";

contract ConsensusRegistryTest is Test {
    C c;
    address admin = address(0xA);
    address op = address(0xB);
    address[3] vals = [address(0x1), address(0x2), address(0x3)];
    bytes32 ds = keccak256("ds");
    bytes32 wid = keccak256("world");

    function setUp() public {
        c = new C(admin, op, 6667, 3, 100, 3, 2);
        vm.startPrank(admin);
        for (uint256 i; i < 3; i++) c.grantRole(c.VALIDATOR(), vals[i]);
        vm.stopPrank();
        vm.prank(op);
        c.createDataset(ds, C.Dataset(8, 1 days, 20, 3, 300, 70, false));
    }

    function _submit(uint32 samples, uint32 devices) internal returns (bytes32 id) {
        vm.prank(op);
        c.submitTile(ds, 1, 1, bytes32(uint256(1)), samples, devices);
        id = c.tileId(ds, 1, 1);
    }

    function _vote(bytes32 id, uint32 a, uint32 b, uint32 d) internal {
        uint32[3] memory p = [a, b, d];
        for (uint256 i; i < 3; i++) { vm.prank(vals[i]); c.vote(id, p[i]); }
    }

    function test_checkedIsRateWithFloor() public {
        (, , uint32 checked, , ) = c.tiles(_submit(400, 5)); // 3% of 400 = 12
        assertEq(checked, 12);
        vm.prank(op);
        c.submitTile(ds, 2, 1, 0, 30, 5); // 3% of 30 = 1, floor is 3
        (, , uint32 small, , ) = c.tiles(c.tileId(ds, 2, 1));
        assertEq(small, 3);
    }

    function test_smallTileWaitsThenOpens() public {
        bytes32 id = _submit(10, 5);
        (, , , C.Status s, ) = c.tiles(id);
        assertEq(uint8(s), uint8(C.Status.Pending));
        vm.prank(vals[0]);
        vm.expectRevert(C.TileClosed.selector);
        c.vote(id, 0);
        _submit(400, 5);
        (, , , s, ) = c.tiles(id);
        assertEq(uint8(s), uint8(C.Status.Open));
    }

    function test_acceptsOnMedianAtQuorum() public {
        bytes32 id = _submit(400, 5); // checked 12, need 12 * 66.67% = 8.0004 -> 9
        _vote(id, 9, 9, 0); // median 9
        (, , , C.Status s, ) = c.tiles(id);
        assertEq(uint8(s), uint8(C.Status.Accepted));
    }

    function test_rejectsBelowQuorum() public {
        bytes32 id = _submit(400, 5);
        _vote(id, 12, 8, 7); // median 8
        (, , , C.Status s, ) = c.tiles(id);
        assertEq(uint8(s), uint8(C.Status.Rejected));
    }

    function test_voteGuards() public {
        bytes32 id = _submit(400, 5);
        vm.prank(vals[0]);
        c.vote(id, 5);
        vm.prank(vals[0]);
        vm.expectRevert(C.AlreadyVoted.selector);
        c.vote(id, 5);
        vm.prank(vals[1]);
        vm.expectRevert(C.BadVote.selector);
        c.vote(id, 13);
        vm.prank(address(0x99));
        vm.expectRevert();
        c.vote(id, 5);
    }

    function test_closedTileCannotBeResubmitted() public {
        bytes32 id = _submit(400, 5);
        _vote(id, 12, 12, 12);
        vm.prank(op);
        vm.expectRevert(C.TileClosed.selector);
        c.submitTile(ds, 1, 1, 0, 400, 5);
    }

    function test_datasetBounds() public {
        vm.startPrank(op);
        vm.expectRevert(C.BadDataset.selector);
        c.createDataset(keccak256("a"), C.Dataset(8, 1 days, 20, 3, 99, 70, false)); // rate below floor
        vm.expectRevert(C.BadDataset.selector);
        c.createDataset(keccak256("b"), C.Dataset(12, 1 days, 20, 3, 300, 70, false)); // hex too fine
        vm.expectRevert(C.BadDataset.selector);
        c.createDataset(ds, C.Dataset(8, 1 days, 20, 3, 300, 70, false)); // exists
        vm.stopPrank();
    }

    function test_twoAlertsBanFromFirstAlert() public {
        vm.warp(1000);
        vm.prank(op);
        c.raiseAlert(wid, "duplicate", bytes32(uint256(1)));
        assertFalse(c.isBanned(wid));
        vm.warp(2000);
        vm.prank(op);
        c.raiseAlert(wid, "honeypot", bytes32(uint256(2)));
        assertTrue(c.isBanned(wid));
        assertEq(c.bannedFrom(wid), 1000);
    }

    function test_sameAlertCountsOnce() public {
        vm.startPrank(op);
        c.raiseAlert(wid, "duplicate", bytes32(uint256(1)));
        vm.expectRevert(C.DuplicateAlert.selector);
        c.raiseAlert(wid, "duplicate", bytes32(uint256(1)));
        vm.stopPrank();
        assertFalse(c.isBanned(wid));
    }

    function test_liftClearsBan() public {
        vm.startPrank(op);
        c.raiseAlert(wid, "a", bytes32(uint256(1)));
        c.raiseAlert(wid, "b", bytes32(uint256(2)));
        vm.stopPrank();
        vm.prank(admin);
        c.lift(wid);
        assertFalse(c.isBanned(wid));
        vm.prank(op);
        vm.expectRevert();
        c.lift(wid); // operator cannot lift
    }
}
