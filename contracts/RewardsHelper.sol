// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './RewardsDistributer.sol';
import './RewardsStaking.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Helper Contract
 * @notice ### Overview
 * The Helper functions for Rewards.
 */
contract RewardsHelper is Initializable, OwnableUpgradeable {
    using MathUtil for uint256;

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
     * @dev Apply a list of stakers' StakeChanges, call applyStakeChange one by one.
     */
    function batchApplyStakeChange(address indexer, address[] memory stakers) public {
        RewardsStaking rewardsStaking = RewardsStaking(settings.getRewardsStaking());
        for (uint256 i = 0; i < stakers.length; i++) {
            rewardsStaking.applyStakeChange(indexer, stakers[i]);
        }
    }

    function batchClaim(address delegator, address[] memory indexers) public {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        for (uint256 i = 0; i < indexers.length; i++) {
            rewardsDistributer.claimFrom(indexers[i], delegator);
        }
    }

    function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        // check current era is after lastClaimEra
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 currentEra = eraManager.safeUpdateAndGetEra();
        uint256 loopCount = MathUtil.min(batchSize, currentEra - rewardsDistributer.getRewardInfo(indexer).lastClaimEra - 1);
        for (uint256 i = 0; i < loopCount; i++) {
            rewardsDistributer.collectAndDistributeEraRewards(currentEra, indexer);
        }
    }

    function indexerCatchup(address indexer) public {
        StakingManager stakingManager = StakingManager(settings.getStakingManager());
        stakingManager.widthdraw(indexer);

        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        RewardsStaking rewardsStaking = RewardsStaking(settings.getRewardsStaking());
        uint256 currentEra = IEraManager(settings.getEraManager()).eraNumber();

        uint256 lastClaimEra = rewardsDistributer.getRewardInfo(indexer).lastClaimEra;
        if (rewardsStaking.getLastSettledEra(indexer) >= lastClaimEra && lastClaimEra < currentEra - 1){
            rewardsDistributer.collectAndDistributeRewards(indexer);
        }

        // apply all stakers' change of an indexer
        while(rewardsStaking.getPendingStakeChangeLength(indexer) > 0){
            address staker = rewardsStaking.getPendingStaker(indexer, rewardsStaking.getPendingStakeChangeLength(indexer) - 1);
            rewardsStaking.applyStakeChange(indexer, staker);
        }

        lastClaimEra = rewardsDistributer.getRewardInfo(indexer).lastClaimEra;
        if (rewardsStaking.getLastSettledEra(indexer) >= lastClaimEra && lastClaimEra < currentEra - 1){
            rewardsDistributer.collectAndDistributeRewards(indexer);
        }

        // apply indexer's commission rate change
        uint256 ICREra = rewardsStaking.getCommissionRateChangedEra(indexer);
        if (ICREra != 0 && ICREra <= currentEra){
            rewardsStaking.applyICRChange(indexer);
        }

        // catch up current era
        while(rewardsDistributer.getRewardInfo(indexer).lastClaimEra < currentEra - 1){
            rewardsDistributer.collectAndDistributeRewards(indexer);
        }
    }

    function batchCollectWithPool(address indexer, bytes32[] memory deployments) public {
        IRewardsPool rewardsPool = IRewardsPool(settings.getRewardsPool());
        for (uint256 i = 0; i < deployments.length; i++) {
            rewardsPool.collect(deployments[i], indexer);
        }

        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        rewardsDistributer.collectAndDistributeRewards(indexer);
    }

    function getPendingStakers(address indexer) public view returns (address[] memory) {
        RewardsStaking rewardsStaking = RewardsStaking(settings.getRewardsStaking());
        uint256 length = rewardsStaking.getPendingStakeChangeLength(indexer);
        address[] memory _stakers = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            _stakers[i] = rewardsStaking.getPendingStaker(indexer, i);
        }

        return _stakers;
    }

    function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[] memory) {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = rewardsDistributer.getRewardAddTable(indexer, i + startEra);
        }
        return table;
    }

    function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[] memory) {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = rewardsDistributer.getRewardRemoveTable(indexer, i + startEra);
        }
        return table;
    }
}
