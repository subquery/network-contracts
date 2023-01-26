// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IStakingManager {
    function stake(address _indexer, uint256 _amount) external;

    function unstake(address _indexer, uint256 _amount) external;

    function delegate(address _delegator, uint256 _amount) external;

    function redelegate(
        address from_indexer,
        address to_indexer,
        uint256 _amount
    ) external;

    function undelegate(address _indexer, uint256 _amount) external;

    function widthdraw() external;

    function slashIndexer(address _indexer, uint256 _amount) external;

    function stakeCommission(address _indexer, uint256 _amount) external;
}