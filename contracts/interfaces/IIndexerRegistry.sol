// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IIndexerRegistry {
    function isIndexer(address _address) external view returns (bool);

    function isController(address _address) external view returns (bool);

    function controllerToIndexer(address _address) external view returns (address);

    function indexerToController(address _address) external view returns (address);

    function setCommissionRate(uint256 rate) external;

    function minimumStakingAmount() external view returns (uint256);
}
