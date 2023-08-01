// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/access/Ownable.sol';

contract PriceOracle is Ownable {
    ///@notice the price of assetA in assetB
    mapping(address => mapping(address => uint)) public prices;

    event PricePosted(address assetA, address assetB, uint previousPrice, uint newPrice);

    ///@notice get the price of assetA in assetB
    function getAssetPrice(address assetA, address assetB) public view returns (uint) {
        uint price = prices[assetA][assetB];
        require(price > 0, "OR001");
        return price;
    }

    ///set the price of assetA in assetB
    ///AssetA in AssetB with a fixed precision of 18 decimal places
    ///Thus, if we wanted set 1 USDC = 13 SQT The price be 13000000000000000000000000000000(13e30)

    function setAssetPrice(address assetA, address assetB, uint price) public onlyOwner {
        prices[assetA][assetB] = price;
        emit PricePosted(assetA, assetB, prices[assetA][assetB], price);
    }
}