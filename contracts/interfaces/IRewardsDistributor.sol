// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import './IServiceAgreementRegistry.sol';

// Reward info for query.
struct IndexerRewardInfo {
    uint256 accSQTPerStake;
    uint256 lastClaimEra;
    uint256 eraReward;
}

interface IRewardsDistributor {
    function setLastClaimEra(address indexer, uint256 era) external;

    function setRewardDebt(address indexer, address delegator, uint256 amount) external;

    function resetEraReward(address indexer, uint256 era) external;

    function collectAndDistributeRewards(address indexer) external;

    function collectAndDistributeEraRewards(uint256 era, address indexer) external returns (uint256);

    function increaseAgreementRewards(uint256 agreementId) external;

    function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external;

    function claim(address indexer) external;

    function claimFrom(address indexer, address user) external returns (uint256);

    function userRewards(address indexer, address user) external view returns (uint256);

    function getRewardInfo(address indexer) external view returns (IndexerRewardInfo memory);
}
