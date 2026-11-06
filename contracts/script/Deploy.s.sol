// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ConsensusRegistry} from "../src/ConsensusRegistry.sol";

/// Reads every rule from the environment (see .env.example). Run:
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $DEPLOYER_KEY --broadcast
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        ConsensusRegistry c = new ConsensusRegistry(
            vm.envAddress("ADMIN"),
            vm.envAddress("OPERATOR"),
            uint16(vm.envOr("QUORUM_BPS", uint256(6667))),
            uint8(vm.envOr("COMMITTEE_SIZE", uint256(5))),
            uint16(vm.envOr("MIN_SAMPLE_RATE_BPS", uint256(100))),
            uint32(vm.envOr("MIN_CHECKS", uint256(3))),
            uint8(vm.envOr("STRIKE_LIMIT", uint256(2)))
        );
        vm.stopBroadcast();
        console.log("ConsensusRegistry", address(c));
    }
}
