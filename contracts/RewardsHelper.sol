// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './RewardsDistributer.sol';
import './utils/MathUtil.sol';

contract RewardsHelper is Initializable, OwnableUpgradeable {
    using MathUtil for uint256;

    ISettings private settings;

    /**
     * @dev Initialize this contract.
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        //Settings
        settings = _settings;
    }

    /**
     * @dev Apply a list of stakers' StakeChanges, call applyStakeChange one by one.
     */
    function batchApplyStakeChange(address indexer, address[] memory stakers) public {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        for (uint256 i = 0; i < stakers.length; i++) {
            rewardsDistributer.applyStakeChange(indexer, stakers[i]);
        }
    }

    function batchClaim(address delegator, address[] memory indexers) public {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        for (uint256 i = 0; i < indexers.length; i++) {
            rewardsDistributer._claim(indexers[i], delegator);
        }
    }

    function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public {
        RewardsDistributer rewardsDistributer = RewardsDistributer(settings.getRewardsDistributer());
        // check current era is after lastClaimEra
        IEraManager eraManager = IEraManager(settings.getEraManager());
        uint256 currentEra = eraManager.safeUpdateAndGetEra();
        uint256 loopCount = MathUtil.min(batchSize, currentEra - rewardsDistributer.getRewardInfo(indexer).lastClaimEra - 1);
        for (uint256 i = 0; i < loopCount; i++) {
            rewardsDistributer._collectAndDistributeRewards(currentEra, indexer);
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

}
