// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

struct IndexerAllocation {
    uint256 total;
    uint256 used;
    uint256 overflowTime;
    uint256 overflowAt;
}

interface IStakingAllocation {
    function update(address _indexer, uint256 _amount) external;

    function allocation(address _indexer, bytes32 _deployment) external view returns (uint256);

    function overflowClear(address _indexer, bytes32 _deployment) external;

    function indexer(address _indexer) external view returns (IndexerAllocation memory);

    function overflowTime(address _indexer) external view returns (uint256);

    function isSuspended(address _indexer) external view returns (bool);

    // total allocations on the deployment
    function deploymentAllocations(bytes32 _deploymentId) external view returns (uint256);
}