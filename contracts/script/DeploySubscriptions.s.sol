// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OdsySubscriptions} from "../src/OdsySubscriptions.sol";

/// Deploys OdsySubscriptions. The owner sets prices and publishes reward roots, so it must be the
/// gateway's 0G wallet (OG_PRIVATE_KEY in apps/web/.env).
///   forge script script/DeploySubscriptions.s.sol --rpc-url galileo --broadcast --private-key $OG_PRIVATE_KEY
/// Optional: OWNER=0x... to make another address the owner.
contract DeploySubscriptions is Script {
    function run() external returns (OdsySubscriptions subs) {
        vm.startBroadcast();
        address owner = vm.envOr("OWNER", msg.sender);
        subs = new OdsySubscriptions(owner);
        vm.stopBroadcast();
        console.log("OdsySubscriptions:", address(subs));
        console.log("owner:", owner);
        console.log("deploy block:", block.number);
    }
}
