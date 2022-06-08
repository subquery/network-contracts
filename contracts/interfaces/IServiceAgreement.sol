// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

enum AgreementType {
    Closed,
    Open
}

interface IServiceAgreement {
    function hasEnded() external view returns (bool);

    function deploymentId() external view returns (bytes32);

    function period() external view returns (uint256);

    function startDate() external view returns (uint256);

    function value() external view returns (uint256);

    function agreementType() external view returns (AgreementType);
}

interface IClosedServiceAgreement is IServiceAgreement {
    function indexer() external view returns (address);

    function consumer() external view returns (address);

    function planId() external view returns (uint256);

    function planTemplateId() external view returns (uint256);
}

interface IOpenServiceAgreement is IServiceAgreement {
    function indexers() external view returns (address[] memory);

    function consumers() external view returns (address[] memory);
}
