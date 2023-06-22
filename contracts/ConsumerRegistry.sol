// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IConsumer.sol';

/**
 * @title Consumer Registry Contract
 * @notice ### Overview
 * This contract include consumer controllers
 */
contract ConsumerRegistry is Initializable, OwnableUpgradeable {
    using ERC165CheckerUpgradeable for address;

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice users authorised by consumer that can request access token from indexer
    /// consumer address => controller address => bool
    mapping(address => mapping(address => bool)) public controllers;

    // -- Events --

    /**
     * @dev Emitted when consumer add new controller
     */
    event ControllerAdded(address indexed consumer, address controller);
    /**
     * @dev Emitted when consumer remove user
     */
    event ControllerRemoved(address indexed consumer, address controller);

    /**
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev Consumer add controller can request access token from indexer.
     */
    function addController(address consumer, address controller) external {
        if (_isContract(consumer)) {
            require(consumer.supportsInterface(type(IConsumer).interfaceId), 'CR002');
            IConsumer cConsumer = IConsumer(consumer);
            require(cConsumer.isSigner(msg.sender), 'CR003');
        } else {
            require(msg.sender == consumer, 'CR001');
        }

        controllers[consumer][controller] = true;
        emit ControllerAdded(consumer, controller);
    }

    /**
     * @dev Consumer remove users can request access token from indexer.
     */
    function removeController(address consumer, address controller) external {
        if (_isContract(consumer)) {
            require(consumer.supportsInterface(type(IConsumer).interfaceId), 'CR002');
            IConsumer cConsumer = IConsumer(consumer);
            require(cConsumer.isSigner(msg.sender), 'CR003');
        } else {
            require(msg.sender == consumer, 'CR001');
        }

        delete controllers[consumer][controller];
        emit ControllerRemoved(consumer, controller);
    }

    function isController(address consumer, address controller) external view returns (bool) {
        return controllers[consumer][controller];
    }

    /// @notice Determine the input address is contract or not
    function _isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}
