// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

struct RedeemRange {
  uint256 startTokenId;
  uint256 endTokenId;
  uint256 sqtValue;
}

interface ISQTGift {
  function getSQTRedeemableValue(uint256 tokenId) external view returns (uint256);
}