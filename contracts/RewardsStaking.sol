// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsDistributer.sol';
import './interfaces/IRewardsPool.sol';
import './interfaces/IRewardsStaking.sol';
import './interfaces/IServiceAgreementRegistry.sol';
import './interfaces/IStakingAllocation.sol';
import './interfaces/IIndexerRegistry.sol';
import './Constants.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Staking Contract
 * @notice ### Overview
 * Keep tracing the pending staking and commission rate and last settled era.
 */
contract RewardsStaking is IRewardsStaking, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;

    //Pending staker address: indexer => indexNumber => staker
    mapping(address => mapping(uint256 => address)) private pendingStakers;

    //Pending staker's index number: indexer => staker => indexNumber
    mapping(address => mapping(address => uint256)) private pendingStakerNos;

    //Numbers of pending stake changes: indexer => pendingStakeChangeLength
    mapping(address => uint256) private pendingStakeChangeLength;

    //Era number of CommissionRateChange should apply: indexer => CommissionRateChange Era number
    mapping(address => uint256) private pendingCommissionRateChange;

    //Last settled Era number: indexer => lastSettledEra
    mapping(address => uint256) private lastSettledEra;

    //total staking amount per indexer: indexer => totalStakingAmount
    mapping(address => uint256) private totalStakingAmount;

    //delegator's delegation amount to indexer: delegator => indexer => delegationAmount
    mapping(address => mapping(address => uint256)) private delegation;

    //rewards commission rates per indexer: indexer => commissionRates
    mapping(address => uint256) private commissionRates;

    // -- Events --

    /**
     * @dev Emitted when the stake amount change.
     */
    event StakeChanged(address indexed indexer, address indexed staker, uint256 amount);

    /**
     * @dev Emitted when the indexer commission rates change.
     */
    event ICRChanged(address indexed indexer, uint256 commissionRate);

    /**
     * @dev Emitted when lastSettledEra update.
     */
    event SettledEraUpdated(address indexed indexer, uint256 era);

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        //Settings
        settings = _settings;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    modifier onlyStaking() {
        require(msg.sender == settings.getContractAddress(SQContracts.Staking), 'G016');
        _;
    }

    modifier onlyIndexerRegistry() {
        require(msg.sender == settings.getContractAddress(SQContracts.IndexerRegistry), 'G017');
        _;
    }

    /**
     * @dev Callback method of stake change, called by Staking contract when
     * Indexers or Delegators try to change their stake amount.
     * Update pending stake info stored in contract states with Staking contract,
     * and wait to apply at next Era.
     * New Indexer's first stake change need to apply immediately。
     * Last era's reward need to be collected before this can pass.
     */
    function onStakeChange(address _indexer, address _source) external onlyStaking {
        uint256 currentEra = _getCurrentEra();

        IRewardsDistributer rewardsDistributer = _getRewardsDistributer();

        if (totalStakingAmount[_indexer] == 0) {
            IndexerRewardInfo memory rewardInfo = rewardsDistributer.getRewardInfo(_indexer);

            rewardsDistributer.setLastClaimEra(_indexer, currentEra - 1);
            lastSettledEra[_indexer] = currentEra - 1;

            IStakingManager stakingManager = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
            //apply first onStakeChange
            uint256 newDelegation = stakingManager.getAfterDelegationAmount(_indexer, _indexer);
            delegation[_indexer][_indexer] = newDelegation;

            uint256 newAmount = MathUtil.mulDiv(newDelegation, rewardInfo.accSQTPerStake, PER_TRILL);
            rewardsDistributer.setRewardDebt(_indexer, _indexer, newAmount);

            //make sure the eraReward be 0, when indexer reregister
            rewardsDistributer.resetEraReward(_indexer, currentEra);

            totalStakingAmount[_indexer] = stakingManager.getTotalStakingAmount(_indexer);

            //apply first onICRChgange
            uint256 newCommissionRate = IIndexerRegistry(settings.getContractAddress(SQContracts.IndexerRegistry)).getCommissionRate(_indexer);
            commissionRates[_indexer] = newCommissionRate;

            emit StakeChanged(_indexer, _indexer, newDelegation);
            emit ICRChanged(_indexer, newCommissionRate);
            emit SettledEraUpdated(_indexer, currentEra - 1);

            // notify stake allocation
            IStakingAllocation stakingAllocation = IStakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation));
            stakingAllocation.update(_indexer, newDelegation);
        } else {
            require(rewardsDistributer.collectAndDistributeEraRewards(currentEra, _indexer) == currentEra - 1, 'RS002');
            IndexerRewardInfo memory rewardInfo = rewardsDistributer.getRewardInfo(_indexer);

            require(checkAndReflectSettlement(_indexer, rewardInfo.lastClaimEra), 'RS003');
            if (!_pendingStakeChange(_indexer, _source)) {
                pendingStakers[_indexer][pendingStakeChangeLength[_indexer]] = _source;
                pendingStakerNos[_indexer][_source] = pendingStakeChangeLength[_indexer];
                pendingStakeChangeLength[_indexer]++;
            }
        }
    }

    /**
     * @dev Callback method of stake change, called by Staking contract when
     * Indexers try to change commitionRate.
     * Update commitionRate info stored in contract states with Staking contract,
     * and wait to apply at two Eras later.
     * Last era's reward need to be collected before this can pass.
     */
    function onICRChange(address indexer, uint256 startEra) external onlyIndexerRegistry {
        uint256 currentEra = _getCurrentEra();
        require(startEra > currentEra, 'RS004');

        IRewardsDistributer rewardsDistributer = _getRewardsDistributer();
        require(rewardsDistributer.collectAndDistributeEraRewards(currentEra, indexer) == currentEra - 1, 'RS002');
        IndexerRewardInfo memory rewardInfo = rewardsDistributer.getRewardInfo(indexer);

        require(checkAndReflectSettlement(indexer, rewardInfo.lastClaimEra), 'RS003');
        pendingCommissionRateChange[indexer] = startEra;
    }

    /**
     * @dev Apply the stake change and calaulate the new rewardDebt for staker.
     */
    function applyStakeChange(address indexer, address staker) external {
        IRewardsDistributer rewardsDistributer = _getRewardsDistributer();
        IndexerRewardInfo memory rewardInfo = rewardsDistributer.getRewardInfo(indexer);
        uint256 lastClaimEra = rewardInfo.lastClaimEra;

        require(_pendingStakeChange(indexer, staker), 'RS005');
        require(lastSettledEra[indexer] < lastClaimEra, 'RS006');

        rewardsDistributer.claimFrom(indexer, staker);

        // run hook for delegation change
        IStakingManager stakingManager = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
        uint256 newDelegation = stakingManager.getAfterDelegationAmount(staker, indexer);
        delegation[staker][indexer] = newDelegation;

        uint256 newAmount = MathUtil.mulDiv(newDelegation, rewardInfo.accSQTPerStake, PER_TRILL);
        rewardsDistributer.setRewardDebt(indexer, staker, newAmount);

        // Remove the pending stake change of the staker.
        uint256 stakerIndex = pendingStakerNos[indexer][staker];
        pendingStakers[indexer][stakerIndex] = address(0x00);
        address lastStaker = pendingStakers[indexer][pendingStakeChangeLength[indexer] - 1];
        pendingStakers[indexer][stakerIndex] = lastStaker;
        pendingStakerNos[indexer][lastStaker] = stakerIndex;
        pendingStakeChangeLength[indexer]--;

        _updateTotalStakingAmount(stakingManager, indexer, lastClaimEra);
        emit StakeChanged(indexer, staker, newDelegation);

        // notify stake allocation
        IStakingAllocation stakingAllocation = IStakingAllocation(settings.getContractAddress(SQContracts.StakingAllocation));
        stakingAllocation.update(indexer, newDelegation);
    }

    /**
     * @dev Apply the CommissionRate change and update the commissionRates stored in contract states.
     */
    function applyICRChange(address indexer) external {
        uint256 currentEra = _getCurrentEra();
        require(pendingCommissionRateChange[indexer] != 0 && pendingCommissionRateChange[indexer] <= currentEra, 'RS005');

        IRewardsDistributer rewardsDistributer = _getRewardsDistributer();
        IndexerRewardInfo memory rewardInfo = rewardsDistributer.getRewardInfo(indexer);
        require(lastSettledEra[indexer] < rewardInfo.lastClaimEra, 'RS006');

        IStakingManager stakingManager = IStakingManager(settings.getContractAddress(SQContracts.StakingManager));
        uint256 newCommissionRate = IIndexerRegistry(settings.getContractAddress(SQContracts.IndexerRegistry)).getCommissionRate(indexer);
        commissionRates[indexer] = newCommissionRate;
        pendingCommissionRateChange[indexer] = 0;
        _updateTotalStakingAmount(stakingManager, indexer, rewardInfo.lastClaimEra);
        emit ICRChanged(indexer, newCommissionRate);
    }

    /**
     * @dev Check if the previous Era has been settled, also update lastSettledEra.
     * Require to be true when someone try to claimRewards() or onStakeChangeRequested().
     */
    function checkAndReflectSettlement(address indexer, uint256 lastClaimEra) public returns (bool) {
        uint256 currentEra = _getCurrentEra();
        if (lastSettledEra[indexer] == currentEra - 1) {
            return true;
        }
        if (pendingStakeChangeLength[indexer] == 0 && pendingCommissionRateChange[indexer] == 0) {
            lastSettledEra[indexer] = currentEra - 1;
            emit SettledEraUpdated(indexer, currentEra - 1);
            return true;
        }
        if (pendingStakeChangeLength[indexer] == 0 && pendingCommissionRateChange[indexer] - 1 > lastClaimEra) {
            lastSettledEra[indexer] = lastClaimEra;
            emit SettledEraUpdated(indexer, lastClaimEra);
            return true;
        }
        return false;
    }

    /**
     * @dev Update the totalStakingAmount of the indexer with the state from Staking contract.
     * Called when applyStakeChange or applyICRChange.
     * @param stakingManager Staking contract interface
     * @param indexer Indexer address
     */
    function _updateTotalStakingAmount(IStakingManager stakingManager, address indexer, uint256 lastClaimEra) private {
        if (checkAndReflectSettlement(indexer, lastClaimEra)) {
            totalStakingAmount[indexer] = stakingManager.getTotalStakingAmount(indexer);
        }
    }

    /**
     * @dev Get RewardsDistributer instant
     */
    function _getRewardsDistributer() private view returns (IRewardsDistributer) {
        return IRewardsDistributer(settings.getContractAddress(SQContracts.RewardsDistributer));
    }

    /**
     * @dev Get current Era number from EraManager.
     */
    function _getCurrentEra() private returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        return eraManager.safeUpdateAndGetEra();
    }

    /**
     * @dev Check whether the indexer has pending stake changes for the staker.
     */
    function _pendingStakeChange(address _indexer, address _staker) private view returns (bool) {
        return pendingStakers[_indexer][pendingStakerNos[_indexer][_staker]] == _staker;
    }

    // -- Views --
    function getTotalStakingAmount(address indexer) public view returns (uint256) {
        return totalStakingAmount[indexer];
    }

    function getLastSettledEra(address indexer) public view returns (uint256) {
        return lastSettledEra[indexer];
    }

    function getCommissionRate(address indexer) public view returns (uint256) {
        return commissionRates[indexer];
    }

    function getDelegationAmount(address source, address indexer) public view returns (uint256) {
        return delegation[source][indexer];
    }

    function getCommissionRateChangedEra(address indexer) public view returns (uint256) {
        return pendingCommissionRateChange[indexer];
    }

    function getPendingStakeChangeLength(address indexer) public view returns (uint256) {
        return pendingStakeChangeLength[indexer];
    }

    function getPendingStaker(address indexer, uint256 i) public view returns (address) {
        return pendingStakers[indexer][i];
    }
}
