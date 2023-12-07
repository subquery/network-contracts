// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {FxBaseChildTunnel} from "@maticnetwork/fx-portal/contracts/tunnel/FxBaseChildTunnel.sol";
import "../interfaces/ISettings.sol";
import "./IEventSyncChildTunnel.sol";

/**
 * @title EventSyncChildTunnel
 */
contract EventSyncChildTunnel is FxBaseChildTunnel, IEventSyncChildTunnel {
    bytes32 public constant NEW_ERA = keccak256("NEW_ERA");
    uint256 public latestStateId;
    address public latestRootMessageSender;
    bytes public latestData;


    ISettings private settings;

    constructor(ISettings _settings, address _fxChild) FxBaseChildTunnel(_fxChild) {
        settings = _settings;
    }

    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    ) internal override validateSender(sender) {
        latestStateId = stateId;
        latestRootMessageSender = sender;
        latestData = data;
    }

    function notifyEraStart(uint256 eraId, address caller) external {
        require(msg.sender == settings.getContractAddress(SQContracts.EraManager), 'SS001');
        bytes memory message = abi.encode(NEW_ERA,(abi.encode(eraId, caller)));
        _sendMessageToRoot(message);
    }
}
