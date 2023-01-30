// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './Staking.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IIndexerRegistry.sol';
import './utils/StakingUtil.sol';
import './interfaces/IEraManager.sol';

contract StakingManager is IStakingManager, Initializable, OwnableUpgradeable {

    ISettings private settings;

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        // Settings
        settings = _settings;
    }

     /**
     * @dev Indexers stake to themself.
     * The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry.
     */
    function stake(address _indexer, uint256 _amount) external override {
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(_indexer, _indexer);
        if (staking.isEmptyDelegation(_indexer, _indexer)) {
            require(msg.sender == settings.getIndexerRegistry(), 'G001');
            staking.addIndexer(_indexer);
        } else {
            require(msg.sender == _indexer, 'G002');
        }
        staking.delegateToIndexer(_indexer, _indexer, _amount);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     */
    function delegate(address _indexer, uint256 _amount) external {
        require(msg.sender != _indexer, 'G004');
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(msg.sender, _indexer);
        // delegation limit should not exceed
        staking.checkDelegateLimitation(_indexer, _amount);
        staking.delegateToIndexer(msg.sender, _indexer, _amount);
    }

    /**
     * @dev Unstake Indexer's self delegation. When this is called by indexer,
     * the existential amount should be greater than minimum staking amount
     * If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer.
     */
    function unstake(address _indexer, uint256 _amount) external {
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(_indexer, _indexer);
        if (msg.sender == settings.getIndexerRegistry()) {
            staking.removeIndexer(_indexer);
        } else {
            require(msg.sender == _indexer, 'G002');

            uint256 minimumStakingAmount = IIndexerRegistry(settings.getIndexerRegistry()).minimumStakingAmount();
            uint256 stakingAmountAfter = this.getAfterDelegationAmount(_indexer, _indexer) - _amount;
            require(stakingAmountAfter >= minimumStakingAmount, 'S008');
            (,,uint256 totalStakingAmount) = staking.totalStakingAmount(_indexer);
            require(stakingAmountAfter * staking.indexerLeverageLimit() >= totalStakingAmount - _amount, 'S008');
        }
        staking.startUnbond(_indexer, _indexer, _amount);
    }

    /**
     * @dev Request a unbond from an indexer for specific amount.
     */
    function undelegate(address _indexer, uint256 _amount) external {
        // check if called by an indexer
        require(_indexer != msg.sender, 'G004');
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(msg.sender, _indexer);
        staking.startUnbond(msg.sender, _indexer, _amount);
    }

    /**
     * @dev Allow delegator transfer their delegation from an indexer to another.
     * Indexer's self delegations are not allow to redelegate.
     */
    function redelegate(
        address from_indexer,
        address to_indexer,
        uint256 _amount
    ) external {
        Staking staking = Staking(settings.getStaking());
        address _source = msg.sender;
        require(from_indexer != msg.sender, 'G004');
        // delegation limit should not exceed
        staking.checkDelegateLimitation(to_indexer, _amount);

        staking.reflectEraUpdate(_source, from_indexer);
        staking.removeDelegation(_source, from_indexer, _amount);
        staking.reflectEraUpdate(_source, to_indexer);
        staking.addDelegation(_source, to_indexer, _amount);
    }

    function cancelUnbonding(uint256 unbondReqId) external {
        Staking staking = Staking(settings.getStaking());
        require(unbondReqId >= staking.withdrawnLength(msg.sender), 'S007');
        (address indexer, uint256 amount, uint256 startTime) = staking.unbondingAmount(msg.sender, unbondReqId);
        require(amount > 0, 'S007');
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        require(indexerRegistry.isIndexer(indexer), 'S007');

        staking.removeUnbondingAmount(msg.sender, unbondReqId);
        if (msg.sender != indexer) {
            staking.checkDelegateLimitation(indexer, amount);
        }
        staking.addDelegation(msg.sender, indexer, amount);
    }

    /**
     * @dev Withdraw max 10 mature unbond requests from an indexer.
     * Each withdraw need to exceed lockPeriod.
     */
    function widthdraw() external {
        Staking staking = Staking(settings.getStaking());
        require(!IDisputeManager(settings.getDisputeManager()).isOnDispute(msg.sender), 'G006');
        uint256 withdrawingLength = staking.unbondingLength(msg.sender) - staking.withdrawnLength(msg.sender);
        require(withdrawingLength > 0, 'S009');

        uint256 latestWithdrawnLength = staking.withdrawnLength(msg.sender);
        for (uint256 i = latestWithdrawnLength; i < latestWithdrawnLength + withdrawingLength; i++) {
            (,,uint256 startTime) = staking.unbondingAmount(msg.sender, i);
            if (block.timestamp - startTime < staking.lockPeriod()) {
                break;
            }

            staking.withdrawARequest(msg.sender, i);
        }
    }

    function slashIndexer(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getDisputeManager(), 'G005');
        Staking staking = Staking(settings.getStaking());
        require(_amount <= this.getSlashableAmount(_indexer), 'S010');
        
        staking.slashIndexer(_indexer, _amount);
    }

    // -- Views --

    function getTotalStakingAmount(address _indexer) external view override returns (uint256) {
        uint256 eraNumber = IEraManager(settings.getEraManager()).eraNumber();
        Staking staking = Staking(settings.getStaking());
        (uint256 era, uint256 valueAt, uint256 valueAfter) = staking.totalStakingAmount(_indexer);
        StakingAmount memory sm = StakingAmount(era, valueAt, valueAfter);
        return StakingUtil.currentStaking(sm, eraNumber);
    }

    function getAfterDelegationAmount(address _source, address _indexer) external view override returns (uint256) {
        Staking staking = Staking(settings.getStaking());
        (,,uint256 amount) = staking.delegation(_source, _indexer);
        return amount;
    }

    function getUnbondingAmounts(address _source) external view returns (UnbondAmount[] memory) {
        Staking staking = Staking(settings.getStaking());
        uint256 withdrawingLength = staking.unbondingLength(_source) - staking.withdrawnLength(_source);
        UnbondAmount[] memory unbondAmounts = new UnbondAmount[](withdrawingLength);

        uint256 i;
        uint256 latestWithdrawnLength = staking.withdrawnLength(_source);
        for (uint256 j = latestWithdrawnLength; j < latestWithdrawnLength + withdrawingLength; j++) {
            (address indexer, uint256 amount, uint256 startTime) = staking.unbondingAmount(_source, j);
            unbondAmounts[i] = UnbondAmount(indexer, amount, startTime);
            i++;
        }

        return unbondAmounts;
    }

    function getSlashableAmount(address _indexer) external view returns (uint256) {
        Staking staking = Staking(settings.getStaking());
        (,,uint256 slashableAmount) = staking.delegation(_indexer, _indexer);
        uint256 withdrawingLength = staking.unbondingLength(_indexer) - staking.withdrawnLength(_indexer);
        uint256 latestWithdrawnLength = staking.withdrawnLength(_indexer);
        for (uint256 i = latestWithdrawnLength; i < latestWithdrawnLength + withdrawingLength; i++) {
            (,uint256 amount,) = staking.unbondingAmount(_indexer, i);
            slashableAmount += amount;
        }
        return slashableAmount;
    }
}