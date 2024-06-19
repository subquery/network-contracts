// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './Staking.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/IEraManager.sol';
import './utils/StakingUtil.sol';
import './utils/MathUtil.sol';

/**
 * Split from Staking, to keep contract size under control
 */
contract StakingManager is IStakingManager, Initializable, OwnableUpgradeable {
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
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        if (staking.isEmptyDelegation(_runner, _runner)) {
            require(msg.sender == settings.getContractAddress(SQContracts.IndexerRegistry), 'G001');
            staking.addRunner(_runner);
        } else {
            require(msg.sender == _runner, 'G002');
        }
        staking.delegateToIndexer(_runner, _runner, _amount);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     */
    function delegate(address _runner, uint256 _amount) external {
        require(msg.sender != _runner, 'G004');
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        // delegation limit should not exceed
        staking.checkDelegateLimitation(_runner, _amount);
        staking.delegateToIndexer(msg.sender, _runner, _amount);
    }

    /**
     * @dev Unstake Indexer's self delegation. When this is called by indexer,
     * the existential amount should be greater than minimum staking amount
     * If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer.
     */
    function unstake(address _runner, uint256 _amount) external {
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
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        address _source = msg.sender;
        require(_fromRunner != msg.sender, 'G004');
        // delegation limit should not exceed
        staking.checkDelegateLimitation(_toRunner, _amount);

        staking.removeDelegation(_source, _fromRunner, _amount);
        staking.addDelegation(_source, _toRunner, _amount);
    }

    function cancelUnbonding(uint256 unbondReqId) external {
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
        //        if (msg.sender != indexer) {
        //            staking.checkDelegateLimitation(indexer, amount);
        //        }
        staking.addDelegation(msg.sender, indexer, amount);
    }

    /**
     * @dev Withdraw max 10 mature unbond requests from an indexer.
     * Each withdraw need to exceed lockPeriod.
     */
    function widthdraw() external {
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

    function getDelegationAmount(address _source, address _runner) public view returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getContractAddress(SQContracts.EraManager))
            .eraNumber();
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        (uint256 era, uint256 valueAt, uint256 valueAfter) = staking.delegation(_source, _runner);
        StakingAmount memory sm = StakingAmount(era, valueAt, valueAfter);
        return StakingUtil.currentStaking(sm, eraNumber);
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

    function cancelUnbondingFor(uint256 unbondReqId, address user) external onlyOwner {
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        require(unbondReqId >= staking.withdrawnLength(user), 'S007');
        (address indexer, uint256 amount, ) = staking.unbondingAmount(user, unbondReqId);
        require(amount > 0, 'S007');
        IIndexerRegistry indexerRegistry = IIndexerRegistry(
            settings.getContractAddress(SQContracts.IndexerRegistry)
        );
        require(indexerRegistry.isIndexer(indexer), 'S007');

        staking.removeUnbondingAmount(user, unbondReqId);
        staking.addDelegation(msg.sender, indexer, amount);
    }

    function undelegateFor(
        address _runner,
        address _user,
        uint256 _amount,
        address _recipient
    ) external onlyOwner {
        // check if called by an indexer
        require(_runner != _user, 'G004');
        Staking staking = Staking(settings.getContractAddress(SQContracts.Staking));
        uint256 unboundId = staking.startUnbond(_user, _runner, _amount, UnbondType.Undelegation);

        staking.withdrawARequest2(msg.sender, unboundId, _recipient);
    }
}
