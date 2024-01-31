// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import './IServiceAgreement.sol';

interface IServiceAgreementRegistry {
    function getClosedServiceAgreement(
        uint256 agreementId
    ) external view returns (ClosedServiceAgreementInfo memory);

    function nextServiceAgreementId() external view returns (uint256);

    function createClosedServiceAgreement(
        ClosedServiceAgreementInfo memory agreement
    ) external returns (uint256);

    function hasOngoingClosedServiceAgreement(
        address indexer,
        bytes32 deploymentId
    ) external view returns (bool);
}
