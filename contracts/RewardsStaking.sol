// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/IRewardsDistributor.sol';
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
 * Originally was splitted from RewardsDistributor to keep contract size under control
 * This Contract keeps tracing the pending staking and commission rate and last settled era,
 * Sync staking changes when era starts for each runner.
 *
 * We apply staking changes at next era and commission rate changes are applied at two Eras later. We design this
 * to allow time for the delegators to consider their delegation when a Runner changes the commission rate. But the first stake
 * change and commission rate change of a runner that made on registration are applied immediately, In this way, the rewards
 * on the era that runner registered can also be distributed correctly.
 *
 * Since it relies on runner call a serial of functions, so there are possibilities that runner stop calling these functions.
 * The way we address this problem is
 * 1. No further staking changes are allowed for the runner and its delegators.
 *   e.g lastSettledEra=1, stake changes in Era2, current era: 3, if applyStakeChange() is not called, then no stake changes will be allowed any more.
 * 2. These management functions are permissionless, so delegators can call them on runner's behalf so they can remove their delegation from the runner.
 *
 */
contract RewardsStaking is IRewardsStaking, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    // -- Storage --

    ISettings public settings;

    //Pending staker address: runner => indexNumber => staker
    mapping(address => mapping(uint256 => address)) private pendingStakers;

    //Pending staker's index number: runner => staker => indexNumber
    mapping(address => mapping(address => uint256)) private pendingStakerNos;

    //Numbers of pending stake changes: runner => pendingStakeChangeLength
    mapping(address => uint256) private pendingStakeChangeLength;

    //Era number of CommissionRateChange should apply: runner => CommissionRateChange Era number
    mapping(address => uint256) private pendingCommissionRateChange;

    //Last settled Era number: runner => lastSettledEra this is the last era runner have applied all stake changes
    mapping(address => uint256) private lastSettledEra;

    //total staking amount per runner: runner => totalStakingAmount
    mapping(address => uint256) private totalStakingAmount;

    //delegator's delegation amount to runner: delegator => runner => delegationAmount
    mapping(address => mapping(address => uint256)) private delegation;

    //rewards commission rates per runner: runner => commissionRates
    mapping(address => uint256) private commissionRates;

    // @notice Node Runner Stake Weight (PerMill), must be > 1e6
    uint256 private _runnerStakeWeight;

    mapping(address => uint256) private _previousRunnerStakeWeights;

    // -- Events --

    /**
     * @dev Emitted when the stake amount change.
     */
    event StakeChanged(address indexed runner, address indexed staker, uint256 amount);

    /**
     * @dev Emitted when the runner commission rates change.
     */
    event ICRChanged(address indexed runner, uint256 commissionRate);

    /**
     * @dev Emitted when lastSettledEra update.
     */
    event SettledEraUpdated(address indexed runner, uint256 era);

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

    function setRunnerStakeWeight(uint256 _weight) external onlyOwner {
        _runnerStakeWeight = _weight;
    }

    /**
     * @dev Callback method of stake change, called by Staking contract when
     * Indexers or Delegators try to change their stake amount.
     * Update pending stake info stored in contract states with Staking contract,
     * and wait to apply at next Era.
     * New Indexer's first stake change need to apply immediately。
     * Last era's reward need to be collected before this can pass.
     */
    function onStakeChange(address _runner, address _source) external onlyStaking {
        uint256 currentEra = _getCurrentEra();
        uint256 lastEra = currentEra - 1;

        IRewardsDistributor rewardsDistributor = _getRewardsDistributor();

        if (totalStakingAmount[_runner] == 0) {
            IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(_runner);

            rewardsDistributor.setLastClaimEra(_runner, lastEra);
            lastSettledEra[_runner] = lastEra;

            IStakingManager stakingManager = IStakingManager(
                settings.getContractAddress(SQContracts.StakingManager)
            );
            //apply first onStakeChange
            uint256 newDelegation = stakingManager.getAfterDelegationAmount(_runner, _runner);
            // apply _runnerStakeWeight
            uint256 _runnerStakeWeight = runnerStakeWeight();
            newDelegation = MathUtil.mulDiv(newDelegation, _runnerStakeWeight, PER_MILL);
            if (_previousRunnerStakeWeights[runner] != _runnerStakeWeight) {
                _previousRunnerStakeWeights[runner] = _runnerStakeWeight;
            }
            // end
            delegation[_runner][_runner] = newDelegation;

            uint256 newAmount = MathUtil.mulDiv(
                newDelegation,
                rewardInfo.accSQTPerStake,
                PER_TRILL
            );
            rewardsDistributor.setRewardDebt(_runner, _runner, newAmount);

            //make sure the eraReward be 0, when runner reregister
            rewardsDistributor.resetEraReward(_runner, currentEra);

            _updateTotalStakingAmount(stakingManager, _runner, 0, false);

            //apply first onICRChgange
            uint256 newCommissionRate = IIndexerRegistry(
                settings.getContractAddress(SQContracts.IndexerRegistry)
            ).getCommissionRate(_runner);
            commissionRates[_runner] = newCommissionRate;

            emit StakeChanged(_runner, _runner, newDelegation);
            emit ICRChanged(_runner, newCommissionRate);
            emit SettledEraUpdated(_runner, lastEra);

            // notify stake allocation
            IStakingAllocation stakingAllocation = IStakingAllocation(
                settings.getContractAddress(SQContracts.StakingAllocation)
            );
            stakingAllocation.onStakeUpdate(_runner);
        } else {
            // if the staker is runner or ther runner is still registered, need to collect rewards first
            if (
                _runner == _source ||
                IIndexerRegistry(settings.getContractAddress(SQContracts.IndexerRegistry))
                    .isIndexer(_runner)
            ) {
                require(
                    rewardsDistributor.collectAndDistributeEraRewards(currentEra, _runner) ==
                        lastEra,
                    'RS002'
                );
                IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(_runner);
                require(checkAndReflectSettlement(_runner, rewardInfo.lastClaimEra), 'RS003');
            }

            if (!_pendingStakeChange(_runner, _source)) {
                pendingStakers[_runner][pendingStakeChangeLength[_runner]] = _source;
                pendingStakerNos[_runner][_source] = pendingStakeChangeLength[_runner];
                pendingStakeChangeLength[_runner]++;
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
    function onICRChange(address runner, uint256 startEra) external onlyIndexerRegistry {
        uint256 currentEra = _getCurrentEra();
        require(startEra > currentEra, 'RS004');

        IRewardsDistributor rewardsDistributor = _getRewardsDistributor();
        require(
            rewardsDistributor.collectAndDistributeEraRewards(currentEra, runner) == currentEra - 1,
            'RS002'
        );
        IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(runner);

        require(checkAndReflectSettlement(runner, rewardInfo.lastClaimEra), 'RS003');
        pendingCommissionRateChange[runner] = startEra;
    }

    /**
     * @dev Apply the stake change and calaulate the new rewardDebt for staker.
     */
    function applyStakeChange(address runner, address staker) external {
        IRewardsDistributor rewardsDistributor = _getRewardsDistributor();
        IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(runner);
        uint256 lastClaimEra = rewardInfo.lastClaimEra;

        require(_pendingStakeChange(runner, staker), 'RS005');
        require(lastSettledEra[runner] < lastClaimEra, 'RS006');

        rewardsDistributor.claimFrom(runner, staker);

        // run hook for delegation change
        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        uint256 newDelegation = stakingManager.getAfterDelegationAmount(staker, runner);

        // test whether it is runner's Stake Change
        if (staker == runner) {
            uint256 _runnerStakeWeight = runnerStakeWeight();
            newDelegation = MathUtil.mulDiv(newDelegation, _runnerStakeWeight, PER_MILL);
            if (_previousRunnerStakeWeights[runner] != _runnerStakeWeight) {
                _previousRunnerStakeWeights[runner] = _runnerStakeWeight;
            }
        }
        delegation[staker][runner] = newDelegation;

        uint256 newAmount = MathUtil.mulDiv(newDelegation, rewardInfo.accSQTPerStake, PER_TRILL);
        rewardsDistributor.setRewardDebt(runner, staker, newAmount);

        // Remove the pending stake change of the staker.
        uint256 stakerIndex = pendingStakerNos[runner][staker];
        pendingStakers[runner][stakerIndex] = address(0x00);
        address lastStaker = pendingStakers[runner][pendingStakeChangeLength[runner] - 1];
        pendingStakers[runner][stakerIndex] = lastStaker;
        pendingStakerNos[runner][lastStaker] = stakerIndex;
        pendingStakeChangeLength[runner]--;

        _updateTotalStakingAmount(stakingManager, runner, lastClaimEra, true);
        emit StakeChanged(runner, staker, newDelegation);

        // notify stake allocation
        IStakingAllocation stakingAllocation = IStakingAllocation(
            settings.getContractAddress(SQContracts.StakingAllocation)
        );
        stakingAllocation.onStakeUpdate(runner);
    }

    /**
     * @dev Apply the CommissionRate change and update the commissionRates stored in contract states.
     */
    function applyICRChange(address runner) external {
        uint256 currentEra = _getCurrentEra();
        require(
            pendingCommissionRateChange[runner] != 0 &&
                pendingCommissionRateChange[runner] <= currentEra,
            'RS005'
        );

        IRewardsDistributor rewardsDistributor = _getRewardsDistributor();
        IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(runner);
        require(lastSettledEra[runner] < rewardInfo.lastClaimEra, 'RS006');

        IStakingManager stakingManager = IStakingManager(
            settings.getContractAddress(SQContracts.StakingManager)
        );
        uint256 newCommissionRate = IIndexerRegistry(
            settings.getContractAddress(SQContracts.IndexerRegistry)
        ).getCommissionRate(runner);
        commissionRates[runner] = newCommissionRate;
        pendingCommissionRateChange[runner] = 0;
        _updateTotalStakingAmount(stakingManager, runner, rewardInfo.lastClaimEra);
        emit ICRChanged(runner, newCommissionRate);
    }

    /**
     * @dev Check if the previous Era has been settled, also update lastSettledEra.
     * Require to be true when someone try to claimRewards() or onStakeChangeRequested().
     */
    function checkAndReflectSettlement(address runner, uint256 lastClaimEra) public returns (bool) {
        uint256 currentEra = _getCurrentEra();
        if (lastSettledEra[runner] == currentEra - 1) {
            return true;
        }
        if (pendingStakeChangeLength[runner] == 0 && pendingCommissionRateChange[runner] == 0) {
            lastSettledEra[runner] = currentEra - 1;
            emit SettledEraUpdated(runner, currentEra - 1);
            return true;
        }
        if (
            pendingStakeChangeLength[runner] == 0 &&
            pendingCommissionRateChange[runner] - 1 > lastClaimEra
        ) {
            lastSettledEra[runner] = lastClaimEra;
            emit SettledEraUpdated(runner, lastClaimEra);
            return true;
        }
        return false;
    }

    /**
     * @dev Called by RewardsDistributor#collectAndDistributeEraRewards(), apply
     * Require to be true when someone try to claimRewards() or onStakeChangeRequested().
     */
    function applyRunnerWeightChange(address _runner) public {
        uint256 _runnerStakeWeight = runnerStakeWeight();
        uint256 _previousRunnerStakeWeight = previousRunnerStakeWeight(_runner);
        if (_runnerStakeWeight != _previousRunnerStakeWeight) {
            IRewardsDistributor rewardsDistributor = _getRewardsDistributor();
            rewardsDistributor.claimFrom(_runner, _runner);
            IndexerRewardInfo memory rewardInfo = rewardsDistributor.getRewardInfo(_runner);
            // increase runner stake
            uint256 currentStake = delegation[_runner][_runner];
            // can not find unaltered ownstake, revert calculate from currentStake
            uint256 newStake = MathUtil.mulDiv(
                currentStake,
                _previousRunnerStakeWeight,
                _runnerStakeWeight
            );
            //            assert(newStake >= currentStake, 'error todo');
            uint256 newDebtAmount = MathUtil.mulDiv(newStake, rewardInfo.accSQTPerStake, PER_TRILL);
            rewardsDistributor.setRewardDebt(_runner, _runner, newDebtAmount);
            delegation[_runner][_runner] = newStake;
            if (newStake > currentStake) {
                totalStakingAmount[_runner] += newStake - currentStake;
            } else {
                totalStakingAmount[_runner] -= currentStake - newStake;
            }
            _previousRunnerStakeWeights[_runner] = _runnerStakeWeight;
        }
        // else skip
    }

    /**
     * @dev Update the totalStakingAmount of the runner with the state from Staking contract.
     * Called when applyStakeChange or applyICRChange.
     * @param stakingManager Staking contract interface
     * @param runner Indexer address
     */
    function _updateTotalStakingAmount(
        IStakingManager stakingManager,
        address runner,
        uint256 lastClaimEra,
        bool doCheck
    ) private {
        if (!doCheck || checkAndReflectSettlement(runner, lastClaimEra)) {
            uint256 runnerStake = stakingManager.getAfterDelegationAmount(runner, runner);
            totalStakingAmount[runner] =
                stakingManager.getTotalStakingAmount(runner) +
                MathUtil.mulDiv(runnerStake, (runnerStakeWeight() - PER_MILL), PER_MILL);
        }
    }

    /**
     * @dev Get RewardsDistributor instant
     */
    function _getRewardsDistributor() private view returns (IRewardsDistributor) {
        return IRewardsDistributor(settings.getContractAddress(SQContracts.RewardsDistributor));
    }

    /**
     * @dev Get current Era number from EraManager.
     */
    function _getCurrentEra() private returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        return eraManager.safeUpdateAndGetEra();
    }

    /**
     * @dev Check whether the runner has pending stake changes for the staker.
     */
    function _pendingStakeChange(address _runner, address _staker) private view returns (bool) {
        return pendingStakers[_runner][pendingStakerNos[_runner][_staker]] == _staker;
    }

    // -- Views --
    function getTotalStakingAmount(address runner) public view returns (uint256) {
        return totalStakingAmount[runner];
    }

    function getLastSettledEra(address runner) public view returns (uint256) {
        return lastSettledEra[runner];
    }

    function getCommissionRate(address runner) public view returns (uint256) {
        return commissionRates[runner];
    }

    function getDelegationAmount(address source, address runner) public view returns (uint256) {
        return delegation[source][runner];
    }

    function getCommissionRateChangedEra(address runner) public view returns (uint256) {
        return pendingCommissionRateChange[runner];
    }

    function getPendingStakeChangeLength(address runner) public view returns (uint256) {
        return pendingStakeChangeLength[runner];
    }

    function getPendingStaker(address runner, uint256 i) public view returns (address) {
        return pendingStakers[runner][i];
    }

    function runnerStakeWeight() public view returns (uint256) {
        if (_runnerStakeWeight < 1e6) {
            return 1e6;
        } else {
            return _runnerStakeWeight;
        }
    }

    function previousRunnerStakeWeight(address runner) public view returns (uint256) {
        uint256 runnerStakeWeight = _previousRunnerStakeWeights[runner];
        if (runnerStakeWeight < 1e6) {
            return 1e6;
        } else {
            return runnerStakeWeight;
        }
    }
}
