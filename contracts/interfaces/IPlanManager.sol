// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

/**
 * @notice Plan is created by an Indexer,
 * a service agreement will be created once a consumer accept a plan.
 */
struct Plan {
    address indexer;
    uint256 price;
    uint256 templateId;
    bytes32 deploymentId;
    bool active;
}

/**
 * @notice PlanTemplate is created and maintained by the owner,
 * the owner provides a set of PlanTemplates for indexers to choose.
 * For Indexer and Consumer to create the Plan and Purchase Offer.
 */
struct PlanTemplate {
    uint256 period;
    uint256 dailyReqCap;
    uint256 rateLimit;
    bytes32 metadata;
    bool active;
}

struct PlanTemplateV2 {
    uint256 period;
    uint256 dailyReqCap;
    uint256 rateLimit;
    address priceToken;
    bytes32 metadata;
    bool active;
}

interface IPlanManager {
    function getPlan(uint256 planId) external view returns (Plan memory);

    function getPlanTemplate(uint256 templateId) external view returns (PlanTemplateV2 memory);

    function convertPlanPriceToSQT(address priceToken, uint256 price) external view returns (uint256);
}
