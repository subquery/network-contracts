// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';

struct GiftSeries {
    uint256 maxSupply;
    uint256 totalSupply;
    bool active;
    string tokenURI;
}

struct Gift {
    uint256 seriesId;
}

interface ISQTGift is IERC721Upgradeable {
    function getSeries(uint256 tokenId) external view returns (uint256);
}
