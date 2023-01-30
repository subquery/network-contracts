// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IEraManager.sol';
import './Constants.sol';
import './interfaces/IRewardsStaking.sol';
import './interfaces/IStakingManager.sol';

/**
 * @title Indexer Registry Contract
 * @notice ### Overview
 * The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers.
 * It also provide the entry for Indexers to register, unregister, and config their metedata.
 *
 * ### Terminology
 * Indexer metadata -- The metadata of Indexer stored on IPFS include Indexer nickname, service endpoint...
 *
 * ### Detail
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

    /**
    * @dev Commission rate information. One per Indexer.
    * Commission rate change need to be applied at the Era after next Era.
    */
    struct CommissionRate {
        uint256 era;         // last update era
        uint256 valueAt;     // value at the era
        uint256 valueAfter;  // value to be refreshed from next era
    }

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;
    /// @notice An address is registered to an Indexer or not.
    mapping(address => bool) public isIndexer;
    /// @notice Indexer's metadata: indexer => metadata
    mapping(address => bytes32) public metadataByIndexer;
    /// @notice Indexer main account => controller account
    mapping(address => address) public indexerToController;
    /// @notice Indexer controller account => main account
    mapping(address => address) public controllerToIndexer;
    /// @notice The minimum stake amount for Indexer, set by owner.
    uint256 public minimumStakingAmount;
    // Delegation tax rate per indexer
    mapping(address => CommissionRate) public commissionRates;

    /// @dev ### EVENTS
    /// @notice Emitted when user register to an Indexer.
    event RegisterIndexer(address indexed indexer, uint256 amount, bytes32 metadata);
    /// @notice Emitted when user unregister to an Indexer.
    event UnregisterIndexer(address indexed indexer);
    /// @notice Emitted when Indexers update their Metadata.
    event UpdateMetadata(address indexed indexer, bytes32 metadata);
    /// @notice Emitted when Indexer set the controller account.
    event SetControllerAccount(address indexed indexer, address indexed controller);
    /// @notice Emitted when Indexer remove the controller account.
    event RemoveControllerAccount(address indexed indexer, address indexed controller);
    /// @notice Emitted when Indexer set their commissionRate.
    event SetCommissionRate(address indexed indexer, uint256 amount);


    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the minimumStakingAmount.
     * @param _settings ISettings contract
     */
    function initialize(ISettings _settings, uint256 _minimumStakingAmount) external initializer {
        __Ownable_init();

        settings = _settings;
        minimumStakingAmount = _minimumStakingAmount;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice set the Indexer minimum staking amount only by owner.
     * @param _amount new minimumStakingAmount
     */
    function setminimumStakingAmount(uint256 _amount) external onlyOwner {
        minimumStakingAmount = _amount;
    }

    /**
     * @notice call to register to an Indexer, this function will interacte with staking contract to handle the Indexer first stake and commission rate setup.
     * @param _amount Indexer init staked amount(must over minimumStakingAmount)
     * @param _metadata Indexer metadata
     * @param _rate Indexer init commission rate
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

        setInitialCommissionRate(msg.sender, _rate);
        IStakingManager(settings.getStakingManager()).stake(msg.sender, _amount);

        emit RegisterIndexer(msg.sender, _amount, _metadata);
    }

    /**
     * @notice Indexer call to unregister, need to check no running indexing projects on this Indexer from QueryRegistry contract. This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after unregister.
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

        IStakingManager stakingManager = IStakingManager(settings.getStakingManager());
        uint256 amount = stakingManager.getAfterDelegationAmount(msg.sender, msg.sender);
        stakingManager.unstake(msg.sender, amount);

        emit UnregisterIndexer(msg.sender);
    }

    /**
     * @notice Indexers call to update their Metadata.
     * @param _metadata Indexer metadata to update
     */
    function updateMetadata(bytes32 _metadata) external {
        require(isIndexer[msg.sender], 'Not an indexer');
        metadataByIndexer[msg.sender] = _metadata;
        emit UpdateMetadata(msg.sender, _metadata);
    }

    /**
     * @notice Indexers call to set the controller account, since indexer only allowed to set one controller account, we need to remove the previous controller account.
     * @param _controller The address of controller account, indexer to set
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
     * @notice Indexers call to remove the controller account. need to remove both indexerToController and controllerToIndexer.
     */
    function removeControllerAccount() public {
        require(isIndexer[msg.sender], 'Only indexer can remove controller account');
        // remove 2 directional links between indexer and controller
        address _controller = indexerToController[msg.sender];
        delete indexerToController[msg.sender];
        delete controllerToIndexer[_controller];
        emit RemoveControllerAccount(msg.sender, _controller);
    }

    /**
     * @notice Determine the address is a controller account
     * @param _address The addree to determine is a controller account
     * @return Result of is the address is a controller account
     */
    function isController(address _address) external view returns (bool) {
        return controllerToIndexer[_address] != ZERO_ADDRESS;
    }

    /**
     * @dev Set initial commissionRate only called by indexerRegistry contract,
     * when indexer do registration. The commissionRate need to apply at once.
     */
    function setInitialCommissionRate(address indexer, uint256 rate) private {
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        require(rewardsStaking.getTotalStakingAmount(indexer) == 0, 'Not settled');
        require(rate <= PER_MILL, 'Invalid rate');
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        commissionRates[indexer] = CommissionRate(eraNumber, rate, rate);

        emit SetCommissionRate(indexer, rate);
    }

    /**
     * @dev Set commissionRate only called by Indexer.
     * The commissionRate need to apply at two Eras after.
     */
    function setCommissionRate(uint256 rate) external {
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        require(isIndexer[msg.sender], 'Not indexer');
        require(rate <= PER_MILL, 'Invalid rate');
        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        rewardsStaking.onICRChange(msg.sender, eraNumber + 2);
        CommissionRate storage commissionRate = commissionRates[msg.sender];
        if (commissionRate.era < eraNumber) {
            commissionRate.era = eraNumber;
            commissionRate.valueAt = commissionRate.valueAfter;
        }
        commissionRate.valueAfter = rate;

        emit SetCommissionRate(msg.sender, rate);
    }

    function getCommissionRate(address indexer) external view returns (uint256) {
        uint256 era = IEraManager(settings.getEraManager()).eraNumber();
        CommissionRate memory rate = commissionRates[indexer];
        if ((rate.era + 1) < era) {
            return rate.valueAfter;
        } else {
            return rate.valueAt;
        }
    }
}
