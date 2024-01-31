// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

// -- Data --

/**
 * @dev closed service agreement information
 */
struct ClosedServiceAgreementInfo {
    address consumer;
    address indexer;
    bytes32 deploymentId;
    uint256 lockedAmount;
    uint256 startDate;
    uint256 period;
    uint256 planId;
    uint256 planTemplateId;
}
