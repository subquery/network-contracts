// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IIndexerServiceAgreement.sol';

/**
 * @title Indexer Service Agreement Contract
 * @notice ### Overview
 * This contract tracks all service Agreements for Indexers.
 */
contract IndexerServiceAgreement is Initializable, OwnableUpgradeable, IIndexerServiceAgreement {

    /// @notice serviceAgreement address: Indexer address => index number => serviceAgreement address
    mapping(address => mapping(uint256 => uint256)) private closedServiceAgreementIds;

    /// @notice number of service agreements: Indexer address =>  number of service agreements
    mapping(address => uint256) private indexerCsaLength;

    /// @notice number of service agreements: Indexer address => DeploymentId => number of service agreements
    mapping(address => mapping(bytes32 => uint256)) public indexerDeploymentCsaLength;

    /**
     * @dev Initialize this contract. Load establisherWhitelist.
     */
    function initialize() external initializer {
        __Ownable_init();
    }

    function addServiceAgreement(address indexer, uint256 agreementId, bytes32 deploymentId) external {
        closedServiceAgreementIds[indexer][indexerCsaLength[indexer]] = agreementId;
        indexerCsaLength[indexer] += 1;
        indexerDeploymentCsaLength[indexer][deploymentId] += 1;
    }

    function removeEndedServiceAgreement(uint256 id, address indexer, bytes32 deploymentId) external {
        closedServiceAgreementIds[indexer][id] = closedServiceAgreementIds[indexer][indexerCsaLength[indexer] - 1];
        delete closedServiceAgreementIds[indexer][indexerCsaLength[indexer] - 1];
        indexerCsaLength[indexer] -= 1;
        indexerDeploymentCsaLength[indexer][deploymentId] -= 1;
    }

    function getIndexerServiceAgreementLengh(address indexer) external view returns (uint256) {
        return indexerCsaLength[indexer];
    }

    function getIndexerAgreementId(address indexer, uint256 id) external view returns (uint256) {
        return closedServiceAgreementIds[indexer][id];
    }

    function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool) {
        return indexerDeploymentCsaLength[indexer][deploymentId] > 0;
    }
}
