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
    * Commission rate change need to be applied at the Era after next Era
    */
    struct CommissionRate {
        uint256 era;         // last update era
        uint256 valueAt;     // value at the era
        uint256 valueAfter;  // value to be refreshed from next era
    }

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;

    /// @notice The minimum stake amount for Indexer, set by owner
    uint256 public minimumStakingAmount;

    /// @notice Indexer's metadata: indexer => metadata, if metadata = 0, no indexer
    mapping(address => bytes32) public indexers;

    /// @notice Delegation tax rate per indexer: indexer => commissionRate
    mapping(address => CommissionRate) public commissionRates;

    /// @notice indexer's controller: indexer => controller
    mapping(address => address) private controllers;

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
     * @param amount new minimumStakingAmount
     */
    function setminimumStakingAmount(uint256 amount) external onlyOwner {
        minimumStakingAmount = amount;
    }

    /**
     * @notice call to register to an Indexer, this function will interacte with staking contract to handle the Indexer first stake and commission rate setup.
     * @param amount Indexer init staked amount(must over minimumStakingAmount)
     * @param metadata Indexer metadata
     * @param rate Indexer init commission rate
     */
    function registerIndexer(uint256 amount, bytes32 metadata, uint256 rate) external {
        require(indexers[msg.sender] == bytes32(0), 'IR001');
        require(amount >= minimumStakingAmount, 'IR002');
        require(metadata != bytes32(0), 'IR005');

        indexers[msg.sender] = metadata;
        setInitialCommissionRate(msg.sender, rate);
        IStakingManager(settings.getStakingManager()).stake(msg.sender, amount);

        emit RegisterIndexer(msg.sender, amount, metadata);
    }

    /**
     * @notice Indexer call to unregister, need to check no running indexing projects on this Indexer from QueryRegistry contract.
     *  This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after unregister.
     */
    function unregisterIndexer() external {
        require(indexers[msg.sender] != bytes32(0), 'IR003');
        require(IQueryRegistry(settings.getQueryRegistry()).numberOfIndexingDeployments(msg.sender) == 0, 'IR004');

        delete indexers[msg.sender];
        delete controllers[msg.sender];

        IStakingManager stakingManager = IStakingManager(settings.getStakingManager());
        uint256 amount = stakingManager.getAfterDelegationAmount(msg.sender, msg.sender);
        stakingManager.unstake(msg.sender, amount);

        emit UnregisterIndexer(msg.sender);
    }

    /**
     * @notice Indexers call to update their Metadata.
     * @param metadata Indexer metadata to update
     */
    function updateMetadata(bytes32 metadata) external {
        require(indexers[msg.sender] != bytes32(0), 'G002');
        require(metadata != bytes32(0), 'IR005');

        indexers[msg.sender] = metadata;

        emit UpdateMetadata(msg.sender, metadata);
    }

    /**
     * @notice Indexers call to set the controller account, since indexer only allowed to set one controller account, we need to remove the previous controller account.
     * @param controller The address of controller account, indexer to set
     */
    function setControllerAccount(address controller) external {
        require(indexers[msg.sender] != bytes32(0), 'G002');

        controllers[msg.sender] = controller;

        emit SetControllerAccount(msg.sender, controller);
    }

    /**
     * @notice Indexers call to remove the controller account. need to remove both controllers and controllerToIndexer.
     */
    function removeControllerAccount() public {
        require(indexers[msg.sender] != bytes32(0), 'G002');

        address controller = controllers[msg.sender];
        delete controllers[msg.sender];

        emit RemoveControllerAccount(msg.sender, controller);
    }

    /**
     * @notice Determine the address is a indexer account
     * @param _address The addree to determine is a indexer account
     * @return Result of is the address is a indexer account
     */
    function isIndexer(address _address) external view returns (bool) {
        return indexers[_address] != bytes32(0);
    }

    /**
     * @notice Get indexer's controller account
     * @param indexer The indexer addree
     * @return Result of its controller
     */
    function getController(address indexer) external view returns (address) {
        return controllers[indexer];
    }

    /**
     * @dev Set initial commissionRate only called by indexerRegistry contract,
     * when indexer do registration. The commissionRate need to apply at once.
     */
    function setInitialCommissionRate(address indexer, uint256 rate) private {
        IRewardsStaking rewardsStaking = IRewardsStaking(settings.getRewardsStaking());
        require(rewardsStaking.getTotalStakingAmount(indexer) == 0, 'RS001');
        require(rate <= PER_MILL, 'IR006');

        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        commissionRates[indexer] = CommissionRate(eraNumber, rate, rate);

        emit SetCommissionRate(indexer, rate);
    }

    /**
     * @dev Set commissionRate only called by Indexer.
     * The commissionRate need to apply at two Eras after.
     */
    function setCommissionRate(uint256 rate) external {
        require(indexers[msg.sender] != bytes32(0), 'G002');
        require(rate <= PER_MILL, 'IR006');

        uint256 eraNumber = IEraManager(settings.getEraManager()).safeUpdateAndGetEra();
        IRewardsStaking(settings.getRewardsStaking()).onICRChange(msg.sender, eraNumber + 2);

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
