// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IIndexerRegistry {
    function isIndexer(address _address) external view returns (bool);

    function getController(address indexer) external view returns (address);

    function minimumStakingAmount() external view returns (uint256);

    function getCommissionRate(address indexer) external view returns (uint256);

    function setInitialCommissionRate(address indexer, uint256 rate) external;

    function setCommissionRate(uint256 rate) external;
}
