// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

struct GiftSeries {
  uint256 maxSupply;
  uint256 maxSQT;
  uint256 defaultValue;
  uint256 minValue;
  uint256 maxValue;
  uint256 totalSupply;
  uint256 totalRedeemableSQT;
  uint256 totalRedeemedSQT;
  bool active;
  bool redeemable;
  string tokenURI;
}

struct Gift {
  uint256 seriesId;
  uint256 sqtValue;
}

interface ISQTGift is IERC721Upgradeable {
  function getSQTRedeemableValue(uint256 tokenId) external view returns (uint256);

  function getGiftRedeemable(uint256 tokenId) external view returns (bool);

  function afterTokenRedeem(uint256 tokenId) external;
}