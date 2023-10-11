// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IStakingManager {
    function stake(address _indexer, uint256 _amount) external;

    function unstake(address _indexer, uint256 _amount) external;

    function slashIndexer(address _indexer, uint256 _amount) external;

    function getTotalStakingAmount(address _indexer) external view returns (uint256);

    function getAfterDelegationAmount(address _delegator, address _indexer) external view returns (uint256);
}