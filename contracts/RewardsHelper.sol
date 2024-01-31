// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './RewardsDistributor.sol';
import './RewardsStaking.sol';
import './utils/MathUtil.sol';

/**
 * @title Rewards Helper Contract
 * @notice ### Overview
 * The Helper functions for Rewards.
 */
contract RewardsHelper is Initializable, OwnableUpgradeable {
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
     * @dev Apply a list of stakers' StakeChanges, call applyStakeChange one by one.
     */
    function batchApplyStakeChange(address runner, address[] memory stakers) public {
        RewardsStaking rewardsStaking = RewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        for (uint256 i = 0; i < stakers.length; i++) {
            rewardsStaking.applyStakeChange(runner, stakers[i]);
        }
    }

    function batchClaim(address delegator, address[] memory runners) public {
        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        for (uint256 i = 0; i < runners.length; i++) {
            rewardsDistributor.claimFrom(runners[i], delegator);
        }
    }

    function batchCollectAndDistributeRewards(address runner, uint256 batchSize) public {
        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        // check current era is after lastClaimEra
        IEraManager eraManager = IEraManager(settings.getContractAddress(SQContracts.EraManager));
        uint256 currentEra = eraManager.safeUpdateAndGetEra();
        uint256 loopCount = MathUtil.min(
            batchSize,
            currentEra - rewardsDistributor.getRewardInfo(runner).lastClaimEra - 1
        );
        for (uint256 i = 0; i < loopCount; i++) {
            rewardsDistributor.collectAndDistributeEraRewards(currentEra, runner);
        }
    }

    function indexerCatchup(address runner) public {
        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        RewardsStaking rewardsStaking = RewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        uint256 currentEra = IEraManager(settings.getContractAddress(SQContracts.EraManager))
            .eraNumber();

        uint256 lastClaimEra = rewardsDistributor.getRewardInfo(runner).lastClaimEra;
        if (
            rewardsStaking.getLastSettledEra(runner) >= lastClaimEra &&
            lastClaimEra < currentEra - 1
        ) {
            rewardsDistributor.collectAndDistributeRewards(runner);
        }

        // apply all stakers' change of an runner
        while (rewardsStaking.getPendingStakeChangeLength(runner) > 0) {
            address staker = rewardsStaking.getPendingStaker(
                runner,
                rewardsStaking.getPendingStakeChangeLength(runner) - 1
            );
            rewardsStaking.applyStakeChange(runner, staker);
        }

        lastClaimEra = rewardsDistributor.getRewardInfo(runner).lastClaimEra;
        if (
            rewardsStaking.getLastSettledEra(runner) >= lastClaimEra &&
            lastClaimEra < currentEra - 1
        ) {
            rewardsDistributor.collectAndDistributeRewards(runner);
        }

        // apply runner's commission rate change
        uint256 ICREra = rewardsStaking.getCommissionRateChangedEra(runner);
        if (ICREra != 0 && ICREra <= currentEra) {
            rewardsStaking.applyICRChange(runner);
        }

        // catch up current era
        while (rewardsDistributor.getRewardInfo(runner).lastClaimEra < currentEra - 1) {
            rewardsDistributor.collectAndDistributeRewards(runner);
        }
    }

    function batchCollectWithPool(address runner, bytes32[] memory deployments) public {
        IRewardsPool rewardsPool = IRewardsPool(
            settings.getContractAddress(SQContracts.RewardsPool)
        );
        for (uint256 i = 0; i < deployments.length; i++) {
            rewardsPool.collect(deployments[i], runner);
        }

        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        rewardsDistributor.collectAndDistributeRewards(runner);
    }

    function getPendingStakers(address runner) public view returns (address[] memory) {
        RewardsStaking rewardsStaking = RewardsStaking(
            settings.getContractAddress(SQContracts.RewardsStaking)
        );
        uint256 length = rewardsStaking.getPendingStakeChangeLength(runner);
        address[] memory _stakers = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            _stakers[i] = rewardsStaking.getPendingStaker(runner, i);
        }

        return _stakers;
    }

    function getRewardsAddTable(
        address runner,
        uint256 startEra,
        uint256 length
    ) public view returns (uint256[] memory) {
        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = rewardsDistributor.getRewardAddTable(runner, i + startEra);
        }
        return table;
    }

    function getRewardsRemoveTable(
        address runner,
        uint256 startEra,
        uint256 length
    ) public view returns (uint256[] memory) {
        RewardsDistributor rewardsDistributor = RewardsDistributor(
            settings.getContractAddress(SQContracts.RewardsDistributor)
        );
        uint256[] memory table = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            table[i] = rewardsDistributor.getRewardRemoveTable(runner, i + startEra);
        }
        return table;
    }
}
