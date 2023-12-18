// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

struct RedeemRange {
  uint256 startTokenId;
  uint256 endTokenId;
  uint256 sqtValue;
}

interface ISQTGift is IERC721Upgradeable {
  function getSQTRedeemableValue(uint256 tokenId) external view returns (uint256);

  function afterTokenRedeem(uint256 tokenId) external;
}