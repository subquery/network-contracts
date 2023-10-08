// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import './IServiceAgreement.sol';

interface IIndexerServiceAgreement {

    function addServiceAgreement(uint256 agreementId, ClosedServiceAgreementInfo memory agreement) external returns (uint256);

    function removeEndedServiceAgreement(uint256 id, ClosedServiceAgreementInfo memory agreement) external;

    function getIndexerServiceAgreementLengh(address indexer) external view returns (uint256);

    function getIndexerAgreementId(address indexer, uint256 id) external view returns (uint256);

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool);
}
