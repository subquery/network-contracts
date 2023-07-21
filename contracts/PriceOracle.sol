// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

contract PriceOracle {
    mapping(address => uint) public prices;
    event PricePosted(address asset, uint previousPrice, uint newPrice);

    function getAssetPrice(address asset) public override view returns (uint) {
        return prices[asset];
    }

    //SQT in USDC with a fixed precision of 18 decimal places
    //Thus, if we wanted 1 SQT = 0.03 USDC The price be 30000000000000000 (3e16)
    function setAssetPrice(address asset, uint price) public {
        emit PricePosted(asset, prices[asset], price);
        prices[asset] = price;
    }
}