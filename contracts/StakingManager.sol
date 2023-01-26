// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './Staking.sol';
import './interfaces/IStakingManager.sol';
import './interfaces/IIndexerRegistry.sol';

contract StakingManager is IStakingManager, Initializable, OwnableUpgradeable {

    ISettings private settings;

    /**
     * @dev Emitted when delegtor cancel unbond request.
     */
    event UnbondCancelled(address indexed source, address indexed indexer, uint256 amount, uint256 index);

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
        if (staking._isEmptyDelegation(_indexer, _indexer)) {
            require(msg.sender == settings.getIndexerRegistry(), 'G001');
            staking._registerIndexer(_indexer);
        } else {
            require(msg.sender == _indexer, 'G002');
        }
        staking._delegateToIndexer(_indexer, _indexer, _amount);
    }

    /**
     * @dev Delegator stake to Indexer, Indexer cannot call this.
     */
    function delegate(address _indexer, uint256 _amount) external override {
        require(msg.sender != _indexer, 'G004');
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(msg.sender, _indexer);
        // delegation limit should not exceed
        staking._checkDelegateLimitation(_indexer, _amount);
        staking._delegateToIndexer(msg.sender, _indexer, _amount);
    }

    /**
     * @dev Unstake Indexer's self delegation. When this is called by indexer,
     * the existential amount should be greater than minimum staking amount
     * If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer.
     */
    function unstake(address _indexer, uint256 _amount) external override {
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(_indexer, _indexer);
        if (msg.sender == settings.getIndexerRegistry()) {
            staking._unregisterIndexer(_indexer);
        } else {
            require(msg.sender == _indexer, 'G002');

            uint256 minimumStakingAmount = IIndexerRegistry(settings.getIndexerRegistry()).minimumStakingAmount();
            uint256 stakingAmountAfter = staking.getAfterDelegationAmount(_indexer, _indexer) - _amount;
            require(stakingAmountAfter >= minimumStakingAmount, 'S008');
            (,,uint256 totalStakingAmount) = staking.totalStakingAmount(_indexer);
            require(stakingAmountAfter * staking.indexerLeverageLimit() >= totalStakingAmount - _amount, 'S008');
        }
        staking._startUnbond(_indexer, _indexer, _amount);
    }

    /**
     * @dev Request a unbond from an indexer for specific amount.
     */
    function undelegate(address _indexer, uint256 _amount) external override {
        // check if called by an indexer
        require(_indexer != msg.sender, 'G004');
        Staking staking = Staking(settings.getStaking());
        staking.reflectEraUpdate(msg.sender, _indexer);
        staking._startUnbond(msg.sender, _indexer, _amount);
    }

    /**
     * @dev Allow delegator transfer their delegation from an indexer to another.
     * Indexer's self delegations are not allow to redelegate.
     */
    function redelegate(
        address from_indexer,
        address to_indexer,
        uint256 _amount
    ) external override {
        Staking staking = Staking(settings.getStaking());
        address _source = msg.sender;
        require(from_indexer != msg.sender, 'G004');
        // delegation limit should not exceed
        staking._checkDelegateLimitation(to_indexer, _amount);

        staking.reflectEraUpdate(_source, from_indexer);
        staking._removeDelegation(_source, from_indexer, _amount);
        staking.reflectEraUpdate(_source, to_indexer);
        staking._addDelegation(_source, to_indexer, _amount);
    }

    function cancelUnbonding(uint256 unbondReqId) external {
        Staking staking = Staking(settings.getStaking());
        require(unbondReqId >= staking.withdrawnLength(msg.sender), 'S007');
        (address indexer, uint256 amount, uint256 startTime) = staking.unbondingAmount(msg.sender, unbondReqId);
        require(amount > 0, 'S007');
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        require(indexerRegistry.isIndexer(indexer), 'S007');

        staking._removeUnbondingAmount(msg.sender, unbondReqId);
        if (msg.sender != indexer) {
            staking._checkDelegateLimitation(indexer, amount);
        }
        staking._addDelegation(msg.sender, indexer, amount);

        emit UnbondCancelled(msg.sender, indexer, amount, unbondReqId);
    }

    /**
     * @dev Withdraw max 10 mature unbond requests from an indexer.
     * Each withdraw need to exceed lockPeriod.
     */
    function widthdraw() external override {
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

            staking._withdrawARequest(msg.sender, i);
        }
    }

    function slashIndexer(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getDisputeManager(), 'G005');
        Staking staking = Staking(settings.getStaking());
        require(_amount <= staking.getSlashableAmount(_indexer), 'S010');
        
        staking._slashIndexer(_indexer, _amount);
    }

    function stakeCommission(address _indexer, uint256 _amount) external {
        require(msg.sender == settings.getRewardsDistributer(), 'G003');
        //_addDelegation(_indexer, _indexer, _amount);
    }


}