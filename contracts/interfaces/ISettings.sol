// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

enum SQContracts {
    SQToken,
    Staking,
    StakingManager,
    IndexerRegistry,
    ProjectRegistry,
    EraManager,
    PlanManager,
    ServiceAgreementRegistry,
    ServiceAgreementExtra,
    RewardsDistributor,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    InflationController,
    Vesting,
    DisputeManager,
    StateChannel,
    ConsumerRegistry,
    PriceOracle,
    RootChainManager,
    Treasury,
    RewardsBooster,
    StakingAllocation
}

interface ISettings {
    function setBatchAddress(SQContracts[] calldata sq, address[] calldata _address) external;

    function setContractAddress(SQContracts sq, address _address) external;

    function getContractAddress(SQContracts sq) external view returns (address);
}
