// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
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
        mapping(address => RunnerDeploymentReward) runnerAllocationRewards;
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
    }

    struct BoosterQueryReward {
        // update when booster changed
        uint256 accQueryRewardsPerBoosterSnapshot;
        // add when booster change
        uint256 accQueryRewards;
        uint256 spentQueryRewards;
    }

    struct RunnerDeploymentReward {
        uint256 missedLaborTime;
        uint256 accRewardsPerToken;
        uint256 lastClaimedAt;
        uint256 overflowTimeSnapshot;
        uint256 lastReportMissedLabor;
        bool    laborStatus;
    }

    function setIssuancePerBlock(uint256 _issuancePerBlock) external;

    function getNewRewardsPerBooster() external view returns (uint256);

    function getAccRewardsPerBooster() external view returns (uint256);

    function updateAccRewardsPerBooster() external returns (uint256);

    function getAccRewardsForDeployment(bytes32 _deploymentId) external view returns (uint256);

    function onDeploymentBoosterUpdate(
        bytes32 _deploymentId,
        address _account
    ) external returns (uint256);

    function onAllocationUpdate(bytes32 _deploymentId) external returns (uint256);

    function getAccRewardsPerAllocatedToken(
        bytes32 _deploymentId
    ) external view returns (uint256, uint256);

    function getAllocationRewards(
        bytes32 _deploymentId,
        address _runner
    ) external view returns (uint256, uint256);

    function collectAllocationReward(bytes32 _deploymentId, address _runner) external;

    function spendQueryRewards(
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata data
    ) external returns (uint256);

    function refundQueryRewards(
        bytes32 _deploymentId,
        address _spender,
        uint256 _amount,
        bytes calldata data
    ) external;
}
