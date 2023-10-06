// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IIndexerServiceAgreement {

    function addServiceAgreement(address indexer, uint256 agreementId, bytes32 deploymentId) external;

    function removeEndedServiceAgreement(uint256 id, address indexer, bytes32 deploymentId) external;

    function getIndexerServiceAgreementLengh(address indexer) external view returns (uint256);

    function getIndexerAgreementId(address indexer, uint256 id) external view returns (uint256);

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool);
}
