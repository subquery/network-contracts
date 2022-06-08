// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

import './interfaces/IServiceAgreement.sol';
import './interfaces/ISettings.sol';
import './interfaces/IIndexerRegistry.sol';

// This contract is the place Consumer publish a purchase offer or accept a plan for a specific deployment.
// And also the place indexers can search and take these purchase offer.
contract ClosedServiceAgreement is IServiceAgreement, IClosedServiceAgreement, ERC165 {
    address settings;

    address public consumer;
    address public indexer;
    bytes32 public deploymentId;
    uint256 public lockedAmount;
    uint256 public contractPeriod;
    uint256 public startDate;
    uint256 public planId;
    uint256 public planTemplateId;
    AgreementType public agreementType = AgreementType.Closed;

    constructor(
        address _settings,
        address _consumer,
        address _indexer,
        bytes32 _deploymentId,
        uint256 _lockedAmount,
        uint256 _startDate,
        uint256 _contractPeriod,
        uint256 _planId,
        uint256 _planTemplateId
    ) {
        settings = _settings;
        consumer = _consumer;
        indexer = _indexer;
        deploymentId = _deploymentId;
        lockedAmount = _lockedAmount;
        contractPeriod = _contractPeriod;
        startDate = _startDate;
        planId = _planId;
        planTemplateId = _planTemplateId;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IServiceAgreement).interfaceId || super.supportsInterface(interfaceId);
    }

    // IServiceAgreement
    function hasEnded() external view returns (bool) {
        return block.timestamp > (startDate + contractPeriod);
    }

    // anyone function
    function fireDispute() external {
        // TODO: if dispute wins, staking of indexer could be slashed
    }

    function period() external view returns (uint256) {
        return contractPeriod;
    }

    function value() external view returns (uint256) {
        return lockedAmount;
    }
}
