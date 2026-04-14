// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import './interfaces/IRewardsDistributor.sol';
import './Staking.sol';

import './interfaces/IEraManager.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IStakingManager.sol';
import './utils/MathUtil.sol';
import './utils/StakingUtil.sol';
import './utils/SQParameter.sol';
import './Constants.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/**
 * Split from Staking, to keep contract size under control
 */
contract StakingManager is IStakingManager, Initializable, OwnableUpgradeable, SQParameter {
    using MathUtil for uint256;

    ISettings public settings;

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        // Settings
        settings = _settings;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @dev Indexers stake to themself.
     * The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry.
     */
    function stake(address _runner, uint256 _amount) external override {
        _requireNotBlacklisted(settings, _runner);

        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        if (staking.isEmptyDelegation(_runner, _runner)) {
            require(msg.sender == settings.getContractAddress(SQContracts.IndexerRegistry), 'G001');
            staking.addRunner(_runner);
        } else {
            require(msg.sender == _runner, 'G002');
        }
        staking.transferDelegationTokens(_runner, _amount);
        staking.addDelegation(_runner, _runner, _amount, false);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     * Supports instant delegation with quota-based limits and era window restrictions.
     */
    function delegate(address _runner, uint256 _amount) external {
        _requireNotBlacklisted(settings, msg.sender);
        _requireNotBlacklisted(settings, _runner);

        require(msg.sender != _runner, 'G004');
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));

        // Check delegation limitation
        staking.checkDelegateLimitation(_runner, _amount);

        // Transfer tokens first
        staking.transferDelegationTokens(msg.sender, _amount);

        // Check era progress (70% window by default)
        uint256 eraProgress = _calculateEraProgress();
        uint256 windowPercent = staking.instantEraWindowPercent();
        bool inInstantWindow = windowPercent > 0 && eraProgress <= windowPercent;

        if (!inInstantWindow) {
            // After window: all delegation is pending
            staking.addDelegation(msg.sender, _runner, _amount, false);
            return;
        }

        // Within window: check quota
        uint256 remainingQuota = _getRemainingQuota(msg.sender);

        if (_amount <= remainingQuota) {
            // Case A: Fully instant
            staking.addDelegation(msg.sender, _runner, _amount, true);
            _applyInstantDelegation(msg.sender, _runner);
            _consumeInstantQuota(msg.sender, _amount);
        } else if (remainingQuota > 0) {
            // Case B: Split - instant + pending
            uint256 instantAmount = remainingQuota;
            uint256 pendingAmount = _amount - remainingQuota;

            // Instant portion
            staking.addDelegation(msg.sender, _runner, instantAmount, true);
            _applyInstantDelegation(msg.sender, _runner);
            _consumeInstantQuota(msg.sender, instantAmount);

            // Pending portion
            staking.addDelegation(msg.sender, _runner, pendingAmount, false);
        } else {
            // Case C: Quota exhausted - all pending
            staking.addDelegation(msg.sender, _runner, _amount, false);
        }
    }

    /**
     * @dev Unstake Indexer's self delegation. When this is called by indexer,
     * the existential amount should be greater than minimum staking amount
     * If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer.
     */
    function unstake(address _runner, uint256 _amount) external {
        _requireNotBlacklisted(settings, _runner);

        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        if (msg.sender == settings.getContractAddress(SQContracts.IndexerRegistry)) {
            staking.removeRunner(_runner);
        } else {
            require(msg.sender == _runner, 'G002');

            uint256 minimumStakingAmount = IIndexerRegistry(
                settings.getContractAddress(SQContracts.IndexerRegistry)
            ).minimumStakingAmount();
            uint256 stakingAmountAfter = this.getAfterDelegationAmount(_runner, _runner) - _amount;
            require(stakingAmountAfter >= minimumStakingAmount, 'S008');
            // allow self stake under the amount calculated by indexerLeverageLimit
            //            (,,uint256 totalStakingAmount) = staking.totalStakingAmount(_indexer);
            //            require(stakingAmountAfter * staking.indexerLeverageLimit() >= totalStakingAmount - _amount, 'S008');
        }
        staking.startUnbond(_runner, _runner, _amount, UnbondType.Unstake);
    }

    /**
     * @dev Request a unbond from an indexer for specific amount.
     */
    function undelegate(address _runner, uint256 _amount) external {
        _requireNotBlacklisted(settings, msg.sender);

        // check if called by an indexer
        require(_runner != msg.sender, 'G004');
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        staking.startUnbond(msg.sender, _runner, _amount, UnbondType.Undelegation);
    }

    /**
     * @dev Allow delegator transfer their delegation from an indexer to another.
     * Indexer's self delegations are not allow to redelegate.
     */
    function redelegate(address _fromRunner, address _toRunner, uint256 _amount) external {
        _requireNotBlacklisted(settings, msg.sender);
        _requireNotBlacklisted(settings, _toRunner);

        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        address _source = msg.sender;
        require(_fromRunner != msg.sender, 'G004');
        // delegation limit should not exceed
        staking.checkDelegateLimitation(_toRunner, _amount);

        staking.removeDelegation(_source, _fromRunner, _amount);
        staking.addDelegation(_source, _toRunner, _amount, false);
    }

    // @dev delegate rewards to node operator, can be used by both node operator & delegator
    // can be called even when the node operator has reached the max delegation limit
    // can not be called when the node operator hasn't collected latest rewards
    // can not be called when the node operator is unregistered
    // @param _runner the node operator address
    function stakeReward(address _runner) external {
        _requireNotBlacklisted(settings, msg.sender);
        _requireNotBlacklisted(settings, _runner);

        _stakeReward(msg.sender, _runner, false);
    }

    // @dev batch version of stakeReward
    function batchStakeReward(address[] calldata _runners) external {
        _requireNotBlacklisted(settings, msg.sender);

        for (uint256 i = 0; i < _runners.length; i++) {
            _requireNotBlacklisted(settings, _runners[i]);
            _stakeReward(msg.sender, _runners[i], true);
        }
    }

    function _stakeReward(address _staker, address _runner, bool _skipError) internal {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        // runner should be valid in the following era.
        if (_skipError && this.getAfterDelegationAmount(_runner, _runner) == 0) {
            return;
        }
        require(this.getAfterDelegationAmount(_runner, _runner) > 0, 'S012');
        IRewardsDistributor rewardsDistributor = IRewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        // rewards sent to Staking from rewardsDistributor
        uint256 rewards = rewardsDistributor.claimForDelegate(_runner, _staker);
        if (_skipError && rewards == 0) {
            return;
        }
        require(rewards > 0, 'S011');
        staking.addDelegation(_staker, _runner, rewards, true);
        IRewardsStaking rewardsStaking = IRewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        rewardsStaking.applyRedelegation(_runner, _staker);
    }

    function cancelUnbonding(uint256 unbondReqId) external {
        _requireNotBlacklisted(settings, msg.sender);

        require(
            !(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()),
            'G019'
        );
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        require(unbondReqId >= staking.withdrawnLength(msg.sender), 'S007');
        (address indexer, uint256 amount, ) = staking.unbondingAmount(msg.sender, unbondReqId);
        require(amount > 0, 'S007');
        IIndexerRegistry indexerRegistry = IIndexerRegistry(
            settings.getContractAddress(SQContracts.IndexerRegistry)
        );
        require(indexerRegistry.isIndexer(indexer), 'S007');

        staking.removeUnbondingAmount(msg.sender, unbondReqId);

        staking.addDelegation(msg.sender, indexer, amount, false);
    }

    /**
     * @dev Withdraw max 10 mature unbond requests from an indexer.
     * Each withdraw need to exceed lockPeriod.
     */
    function widthdraw() external {
        _requireNotBlacklisted(settings, msg.sender);

        require(
            !(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()),
            'G019'
        );
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        require(
            !IDisputeManager(settings.getContractAddress(SQContracts.DisputeManager)).isOnDispute(
                msg.sender
            ),
            'G006'
        );
        uint256 withdrawingLength = staking.unbondingLength(msg.sender) -
            staking.withdrawnLength(msg.sender);
        require(withdrawingLength > 0, 'S009');

        uint256 latestWithdrawnLength = staking.withdrawnLength(msg.sender);
        for (
            uint256 i = latestWithdrawnLength;
            i < latestWithdrawnLength + withdrawingLength;
            i++
        ) {
            (, , uint256 startTime) = staking.unbondingAmount(msg.sender, i);
            if (block.timestamp - startTime < staking.lockPeriod()) {
                break;
            }

            staking.withdrawARequest(msg.sender, i);
        }
    }

    function slashRunner(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.DisputeManager), 'G005');
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        require(_amount <= this.getSlashableAmount(_indexer), 'S010');

        staking.slashRunner(_indexer, _amount);
    }

    /**
     * @dev Calculate current era progress as a percentage (in perMill)
     * @return Progress value (0-PER_MILL, where PER_MILL = 100%)
     */
    function _calculateEraProgress() internal view returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));

        uint256 eraStartTime = eraManager.eraStartTime();
        uint256 eraPeriod = eraManager.eraPeriod();

        uint256 elapsed = block.timestamp - eraStartTime;

        // Prevent overflow: if elapsed >= eraPeriod, return 100%
        if (elapsed >= eraPeriod) {
            return PER_MILL;
        }

        return MathUtil.mulDiv(elapsed, PER_MILL, eraPeriod);
    }

    /**
     * @dev Get remaining instant delegation quota for a delegator
     * @param delegator The delegator address
     * @return Remaining quota amount
     */
    function _getRemainingQuota(address delegator) internal view returns (uint256) {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));

        uint256 currentEra = eraManager.eraNumber();
        return staking.getInstantQuotaRemaining(delegator, currentEra);
    }

    /**
     * @dev Apply instant delegation to rewards system
     * @param delegator The delegator address
     * @param runner The runner address
     */
    function _applyInstantDelegation(address delegator, address runner) internal {
        IRewardsStaking rewardsStaking = IRewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        rewardsStaking.applyRedelegation(runner, delegator);
    }

    /**
     * @dev Consume instant quota for a delegator
     * @param delegator The delegator address
     * @param amount The amount to consume
     */
    function _consumeInstantQuota(address delegator, uint256 amount) internal {
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));

        uint256 currentEra = eraManager.eraNumber();
        staking.updateInstantQuotaUsed(delegator, currentEra, amount);
    }

    // -- Views --

    function _getCurrentDelegationAmount(
        address _source,
        address _runner,
        uint256 _currentEra
    ) internal view returns (uint256) {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        (uint256 era, uint256 valueAt, uint256 valueAfter) = staking.delegation(_source, _runner);
        StakingAmount memory sm = StakingAmount(era, valueAt, valueAfter);
        return StakingUtil.currentStaking(sm, _currentEra);
    }

    function getDelegationAmount(
        address _source,
        address _runner
    ) external view override returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getContractAddress(SQContracts.EraManager))
            .eraNumber();
        return _getCurrentDelegationAmount(_source, _runner, eraNumber);
    }

    function getEraDelegationAmount(
        address _source,
        address _runner,
        uint256 _era
    ) external view override returns (uint256) {
        return _getCurrentDelegationAmount(_source, _runner, _era);
    }

    function getTotalStakingAmount(address _runner) public view override returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getContractAddress(SQContracts.EraManager))
            .eraNumber();
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        (uint256 era, uint256 valueAt, uint256 valueAfter) = staking.totalStakingAmount(_runner);
        StakingAmount memory sm = StakingAmount(era, valueAt, valueAfter);
        return StakingUtil.currentStaking(sm, eraNumber);
    }

    function getEffectiveTotalStake(address _runner) external view override returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getContractAddress(SQContracts.EraManager))
            .eraNumber();
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        uint256 totalStake = getTotalStakingAmount(_runner);
        uint256 selfStake = _getCurrentDelegationAmount(_runner, _runner, eraNumber);
        uint256 totalStakeCap = selfStake * staking.indexerLeverageLimit();
        return MathUtil.min(totalStake, totalStakeCap);
    }

    function getAfterDelegationAmount(
        address _source,
        address _runner
    ) external view override returns (uint256) {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        (, , uint256 amount) = staking.delegation(_source, _runner);
        return amount;
    }

    function getUnbondingAmounts(address _source) external view returns (UnbondAmount[] memory) {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        uint256 withdrawingLength = staking.unbondingLength(_source) -
            staking.withdrawnLength(_source);
        UnbondAmount[] memory unbondAmounts = new UnbondAmount[](withdrawingLength);

        uint256 i;
        uint256 latestWithdrawnLength = staking.withdrawnLength(_source);
        for (
            uint256 j = latestWithdrawnLength;
            j < latestWithdrawnLength + withdrawingLength;
            j++
        ) {
            (address runner, uint256 amount, uint256 startTime) = staking.unbondingAmount(
                _source,
                j
            );
            unbondAmounts[i] = UnbondAmount(runner, amount, startTime);
            i++;
        }

        return unbondAmounts;
    }

    function getSlashableAmount(address _runner) external view returns (uint256) {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        (, , uint256 slashableAmount) = staking.delegation(_runner, _runner);
        uint256 withdrawingLength = staking.unbondingLength(_runner) -
            staking.withdrawnLength(_runner);
        uint256 latestWithdrawnLength = staking.withdrawnLength(_runner);
        for (
            uint256 i = latestWithdrawnLength;
            i < latestWithdrawnLength + withdrawingLength;
            i++
        ) {
            (, uint256 amount, ) = staking.unbondingAmount(_runner, i);
            slashableAmount += amount;
        }
        return slashableAmount;
    }
}
