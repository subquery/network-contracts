// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

struct RunnerAllocation {
    uint256 total;
    uint256 used;
    uint256 overflowTime;
    uint256 overflowAt;
}

interface IStakingAllocation {
    function onStakeUpdate(address _runner) external;

    function allocatedTokens(address _runner, bytes32 _deployment) external view returns (uint256);

    function runnerAllocation(address _runner) external view returns (RunnerAllocation memory);

    function overAllocationTime(address _runner) external view returns (uint256);

    function isOverAllocation(address _runner) external view returns (bool);

    // total allocations on the deployment
    function deploymentAllocations(bytes32 _deploymentId) external view returns (uint256);
}
