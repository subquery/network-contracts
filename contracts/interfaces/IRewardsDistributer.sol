// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import './IServiceAgreementRegistry.sol';

interface IRewardsDistributer {
    function collectAndDistributeRewards(address indexer) external;

    function onStakeChange(address indexer, address user) external;

    function onICRChange(address indexer, uint256 startEra) external;

    function increaseAgreementRewards(ClosedServiceAgreementInfo memory agreement) external;

    function addInstantRewards(
        address indexer,
        address sender,
        uint256 amount
    ) external;

    function claim(address indexer) external;

    function userRewards(address indexer, address user) external view returns (uint256);

    function getTotalStakingAmount(address _indexer) external view returns (uint256);
}
