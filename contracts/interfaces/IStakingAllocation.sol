// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IStakingAllocation {
    function update(address _indexer, uint256 _amount) external;

    function allocation(address _indexer, bytes32 _deployment) external view returns (uint256);

    function isSuspended(address _indexer) external view returns (bool);
}
