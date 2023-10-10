// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import './IServiceAgreement.sol';

interface IServiceAgreementHelper {

    function addAgreement(uint256 agreementId, ClosedServiceAgreementInfo memory agreement, bool checkThreshold) external;

    function removeEndedAgreement(uint256 id, ClosedServiceAgreementInfo memory agreement) external;

    function getServiceAgreementLength(address indexer) external view returns (uint256);

    function getServiceAgreementId(address indexer, uint256 id) external view returns (uint256);

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool);
}
