// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

interface IRewardsPool {
    function getReward(
        bytes32 deploymentId,
        uint256 era,
        address indexer
    ) external returns (uint256, uint256);

    function labor(bytes32 deploymentId, address indexer, uint256 amount) external;

    function collect(bytes32 deploymentId, address indexer) external;

    function collectEra(uint256 era, bytes32 deploymentId, address indexer) external;

    function batchCollectEra(uint256 era, address indexer) external;

    function isClaimed(uint256 era, address indexer) external returns (bool);

    function getUnclaimDeployments(
        uint256 era,
        address indexer
    ) external view returns (bytes32[] memory);
}
