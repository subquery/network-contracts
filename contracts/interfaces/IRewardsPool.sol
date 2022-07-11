// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IRewardsPool {
    function addStake(bytes32 project, address indexer, address sender, uint256 amount) external;

    function addLabor(bytes32 project, address indexer, address sender, uint256 amount) external;

    function claim(bytes32 project, address indexer, bool restake) external;

    function claim_era(bytes32 project, address indexer, uint256 era, bool restake) external;
}
