// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

interface IPlanManager {
    function getPlan(address indexer, uint256 planId)
        external
        view
        returns (
            uint256 price,
            uint256 planTemplateId,
            bytes32 deploymentId,
            bool active
        );

    function getPlanTemplate(uint256 planTemplateId)
        external
        view
        returns (
            uint256 period,
            uint256 dailyReqCap,
            uint256 rateLimit,
            bytes32 metadata,
            bool active
        );
}
