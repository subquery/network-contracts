// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IRewardsPool {
    function labor(bytes32 deploymentId, address indexer, uint256 amount) external;

    function collect(bytes32 deploymentId, address indexer) external;
}
