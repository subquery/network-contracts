// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

interface IRewardsBooster {
    /// @notice Project Running Reward Pool
    struct DeploymentPool {
        uint256 boosterPoints;
        mapping(address => uint256) boosterMap;
        // snapshot for claimed
        uint256 accRewardsPerBooster;
        uint256 totalAllocatedToken;
        // current
        mapping(address => uint256) indexerAllocations;
        uint256 accRewardsForDeployment;
        uint256 accRewardsForDeploymentSnapshot;
        uint256 accRewardsPerBoosterSnapshot;
        uint256 accRewardsPerAllocatedToken;
    }

    // max labor = block.timestamp - startTime
    // actual labor = block.timestamp - startTime - missedLabor
    struct IndexerDeploymentReward {
        uint256 missedLaborTime;
        uint256 claimedRewards;
    }

    struct DeploymentReward {
        uint256 accRewardsForDeployment;
        uint256 accRewardsForDeploymentSnapshot;
        uint256 accRewardsPerBoosterSnapshot;
        uint256 accRewardsPerAllocatedToken;
    }

    function getNewRewardsPerBooster() external view returns (uint256);

    function getAccRewardsPerBooster() external view returns (uint256);

    function updateAccRewardsPerBooster() external returns (uint256);

    function getAccRewardsForDeployment(bytes32 _deploymentId)
    external
    view
    returns (uint256);

    function onDeploymentBoosterUpdate(bytes32 _deploymentId)
    external
    returns (uint256);

    function onAllocationUpdate(bytes32 _deploymentId)
    external
    returns (uint256);

    function getAccRewardsPerAllocatedToken(bytes32 _deploymentId)
    external
    view
    returns (uint256, uint256);

    function getRewards(address indexer, bytes32 deployment) external view returns (uint256);

    function updateDeploymentAllocated(bytes32 deployment, uint256 changed, bool isAdd) external;

//    function getQueryFund(bytes32 deploymentId, address user) external returns (uint256);
//
//    function claimQueryFund(bytes32 deploymentId, address user, uint256 channelId) external;
}
