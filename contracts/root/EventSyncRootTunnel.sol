// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import {FxBaseRootTunnel} from "@maticnetwork/fx-portal/contracts/tunnel/FxBaseRootTunnel.sol";

/**
 * @title EventSyncRootTunnel
 */
contract EventSyncRootTunnel is FxBaseRootTunnel {
    bytes public latestData;

    bytes32 public constant NEW_ERA = keccak256("NEW_ERA");

    event NewEraStart(uint256 indexed era, address caller);

    constructor(address _checkpointManager, address _fxRoot) FxBaseRootTunnel(_checkpointManager, _fxRoot) {}

    function _processMessageFromChild(bytes memory data) internal override {
        latestData = data;
        (bytes32 eventType, bytes memory eventData) = abi.decode(data, (bytes32, bytes));
        if (eventType == NEW_ERA) {
            (uint256 eraId, address caller) = abi.decode(
                data,
                (uint256, address)
            );
            emit NewEraStart(eraId, caller);
        }
    }

    function sendMessageToChild(bytes memory message) public {
        _sendMessageToChild(message);
    }
}