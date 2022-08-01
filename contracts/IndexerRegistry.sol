// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IEraManager.sol';
import './Constants.sol';

/**
 * @title Indexer Registry Contract
 * @dev 
 * ## Overview
 * The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers.
 * It also provide the entry for Indexers to register, unregister, and config their metedata.
 *
 ## Terminology
 * Indexer metadata -- The metadata of Indexer stored on IPFS include Indexer nickname, service endpoint...
 *
 * ## Detail
 * Each Indexer has two accounts:
 * Main Account:
 *  The main account is stored in the indexer’s own wallet.
 *  The indexer can use the main account to make the following actions:
 *      - staking/unstaking
 *      - register/unregisterIndexer
 *      - set/remove a controller account
 *      - start an indexing for a query project with specific controller account
 *
 * Controller Account:
 *  The controller account is set by the main account which can execute some
 *  actions on the behalf of the main account.
 *  These actions include:
 *      - reporting / updating the status of the indexing service on chain
 *
 * Indexer must set a appropriate commission rate and stake enough SQT Token when registering.
 * Indexer need to make sure all the query projects with NOT INDEXING status before unregister.
 */
contract IndexerRegistry is Initializable, OwnableUpgradeable, Constants {
    using SafeERC20 for IERC20;

    // -- Storage --

    ISettings public settings;
    //An address is registered to an Indexer or not.
    mapping(address => bool) public isIndexer;
    //Indexer's metadata: indexer => metadata
    mapping(address => bytes32) public metadataByIndexer;
    //Indexer main account => controller account
    mapping(address => address) public indexerToController;
    //Indexer controller account => main account
    mapping(address => address) public controllerToIndexer;
    //The minimum stake amount for Indexer, set by owner.
    uint256 public minimumStakingAmount;

    // -- Events --
    /**
     * @dev Emitted when user register to an Indexer.
     */
    event RegisterIndexer(address indexed indexer, uint256 amount, bytes32 metadata);
    /**
     * @dev Emitted when user unregister to an Indexer.
     */
    event UnregisterIndexer(address indexed indexer);
    /**
     * @dev Emitted when Indexers update their Metadata.
     */
    event UpdateMetadata(address indexed indexer, bytes32 metadata);
    /**
     * @dev Emitted when Indexer set the controller account.
     */
    event SetControllerAccount(address indexed indexer, address indexed controller);
    /**
     * @dev Emitted when Indexer remove the controller account.
     */
    event RemoveControllerAccount(address indexed indexer, address indexed controller);

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        minimumStakingAmount = 1000;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev set the Indexer minimum staking amount only by owner.
     */
    function setminimumStakingAmount(uint256 _amount) external onlyOwner {
        minimumStakingAmount = _amount;
    }

    /**
     * @dev call to register to an Indexer, this function will interacte with
     * staking contract to handle the Indexer first stake and commission rate setup.
     */
    function registerIndexer(
        uint256 _amount,
        bytes32 _metadata,
        uint256 _rate
    ) external {
        require(!isIndexer[msg.sender], 'Already registered');
        require(_amount >= minimumStakingAmount, 'Not meet the minimum staking amount');

        isIndexer[msg.sender] = true;
        metadataByIndexer[msg.sender] = _metadata;

        IStaking staking = IStaking(settings.getStaking());
        staking.setInitialCommissionRate(msg.sender, _rate);
        staking.stake(msg.sender, _amount);

        emit RegisterIndexer(msg.sender, _amount, _metadata);
    }

    /**
     * @dev Indexer call to unregister, need to check no running indexing projects on this Indexer
     * from QueryRegistry contract.
     * This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after
     * unregister.
     */
    function unregisterIndexer() external {
        require(isIndexer[msg.sender], 'Not registered');
        require(
            IQueryRegistry(settings.getQueryRegistry()).numberOfIndexingDeployments(msg.sender) == 0,
            'Can not unregister from the network due to running indexing projects'
        );

        removeControllerAccount();
        isIndexer[msg.sender] = false;
        delete metadataByIndexer[msg.sender];

        IStaking staking = IStaking(settings.getStaking());
        uint256 amount = staking.getDelegationAmount(msg.sender, msg.sender);
        staking.unstake(msg.sender, amount);

        emit UnregisterIndexer(msg.sender);
    }

    /**
     * @dev Indexers call to update their Metadata.
     */
    function updateMetadata(bytes32 _metadata) external {
        require(isIndexer[msg.sender], 'Not an indexer');
        metadataByIndexer[msg.sender] = _metadata;
        emit UpdateMetadata(msg.sender, _metadata);
    }

    /**
     * @dev Indexers call to set the controller account, since indexer only allowed to set one controller account,
     *  we need to remove the previous controller account.
     */
    function setControllerAccount(address _controller) external {
        // ensure to not use a controller used by someone else
        require(isIndexer[msg.sender], 'Only indexer can set controller account');
        require(controllerToIndexer[_controller] == ZERO_ADDRESS, 'Controller account is used by an indexer already');

        // remove previous controller to indexer link
        address prevController = indexerToController[msg.sender];
        delete controllerToIndexer[prevController];

        // add 2 directional links between indexer and controller
        indexerToController[msg.sender] = _controller;
        controllerToIndexer[_controller] = msg.sender;
        emit SetControllerAccount(msg.sender, _controller);
    }

    /**
     * @dev Indexers call to remove the controller account.
     * need to remove both indexerToController and controllerToIndexer.
     */
    function removeControllerAccount() public {
        require(isIndexer[msg.sender], 'Only indexer can remove controller account');
        // remove 2 directional links between indexer and controller
        address _controller = indexerToController[msg.sender];
        delete indexerToController[msg.sender];
        delete controllerToIndexer[_controller];
        emit RemoveControllerAccount(msg.sender, _controller);
    }

    function isController(address _address) external view returns (bool) {
        return controllerToIndexer[_address] != ZERO_ADDRESS;
    }
}
