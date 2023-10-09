// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

interface IPurchaseOfferMarket {
    function createPurchaseOffer(
        bytes32 _deploymentId,
        uint256 _planTemplateId,
        uint256 _deposit,
        uint16 _limit,
        uint256 _minimumAcceptHeight,
        uint256 _expireDate
    ) external;

    function cancelPurchaseOffer(uint256 _offerId) external;

    function acceptPurchaseOffer(uint256 _offerId, bytes32 _poi) external;
}
