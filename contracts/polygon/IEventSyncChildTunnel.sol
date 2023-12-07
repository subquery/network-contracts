// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {FxBaseChildTunnel} from "@maticnetwork/fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";
import "../interfaces/ISettings.sol";

/**
 * @title IEventSyncChildTunnel
 */
interface IEventSyncChildTunnel {
    function notifyEraStart(uint256 eraId, address caller) external;
}
