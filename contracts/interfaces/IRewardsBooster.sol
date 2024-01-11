// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

interface IRewardsBooster {
    /// @notice Project Running Reward Pool
    struct DeploymentPool {
        // total booster for the deployment
        uint256 boosterPoint;
        // account => booster points staked
        mapping(address => uint256) accountBooster;
        // account => query rewards
        mapping(address => BoosterQueryReward) boosterQueryRewards;
        uint256 totalAllocatedToken;
        // current
        mapping(address => uint256) indexerAllocations;
        // update when booster point changed, to calculate deployment rewards, including allocation and query reward
        uint256 accRewardsForDeployment;
        // update when allocation changed, so new allocation are not entitled for earlier rewards, for allocation only
        uint256 accRewardsForDeploymentSnapshot;
        // ?? not sure if needed?? update when booster point changed, including allocation and query reward
        uint256 accRewardsPerBooster;
        // update when booster changed, snapshot for claimed
        uint256 accRewardsPerBoosterSnapshot;
        // update when allocation changed, so new allocation are not entitled for earlier rewards
        uint256 accRewardsPerAllocatedToken;
        // update when booster changed, used to calc query booster rewards
        uint256 accQueryRewardsPerBooster;
        uint256 accQueryRewardsForDeploymentSnapshot;
    }

    struct BoosterQueryReward {
        // update when booster changed
        uint256 accQueryRewardsPerBoosterSnapshot;
        // add when booster change
        uint256 accQueryRewards;
        uint256 spentQueryRewards;
    }

    // max labor = block.timestamp - startTime
    // actual labor = block.timestamp - startTime - missedLabor
    struct Allocation {
        address indexer;
        bytes32 deploymentId;
        uint256 amount;
        uint256 startTime;
        uint256 startEra;
        // update when claimed
        uint256 accRewardsPerToken;
        uint256 missedLabor;
        // the block number allocation reward was last claimed
        uint256 lastClaimedAt;
    }

    function getNewRewardsPerBooster() external view returns (uint256);

    function getAccRewardsPerBooster() external view returns (uint256);

    function updateAccRewardsPerBooster() external returns (uint256);

    function getAccRewardsForDeployment(bytes32 _deploymentId)
    external
    view
    returns (uint256);

    function onDeploymentBoosterUpdate(bytes32 _deploymentId, address _account)
    external
    returns (uint256);

    function onAllocationUpdate(bytes32 _deploymentId)
    external
    returns (uint256);

    function getAccRewardsPerAllocatedToken(bytes32 _deploymentId)
    external
    view
    returns (uint256, uint256);

    function getRewards(bytes32 _deploymentId, address _indexer) external view returns (uint256, uint256);

//    function getQueryFund(bytes32 deploymentId, address user) external returns (uint256);
//
//    function claimQueryFund(bytes32 deploymentId, address user, uint256 channelId) external;
}
