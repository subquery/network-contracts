// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/access/Ownable.sol';

contract PriceOracle is Ownable {
    ///@notice the price of assetA in assetB
    mapping(address => mapping(address => uint256)) public prices;

    ///@notice the size limit when controller change price
    uint256 public sizeLimit;

    ///@notice the time limit when controller change price
    uint256 public timeLimit;

    ///@notice the time of latest set price
    uint256 public latestPriceTime;

    ///@notice the controller account which can change price
    address public controller;

    constructor(uint256 _sizeLimit, uint256 _timeLimit) Ownable() {
        sizeLimit = _sizeLimit;
        timeLimit = _timeLimit;
    }

    event PricePosted(address assetA, address assetB, uint256 previousPrice, uint256 newPrice);

    ///@notice update change price limit
    function setLimit(uint256 _sizeLimit, uint256 _timeLimit) public onlyOwner {
        sizeLimit = _sizeLimit;
        timeLimit = _timeLimit;
    }

    ///@notice update the controller account
    function setController(address _controller) public onlyOwner {
        controller = _controller;
    }

    ///@notice get the price of assetA in assetB
    function getAssetPrice(address assetA, address assetB) public view returns (uint256) {
        uint256 price = prices[assetA][assetB];
        require(price > 0, "OR001");
        return price;
    }

    ///set the price of assetA in assetB
    ///AssetA in AssetB with a fixed precision of 18 decimal places
    ///Thus, if we wanted set 1 USDC = 13 SQT The price be 13000000000000000000000000000000(13e30)

    function setAssetPrice(address assetA, address assetB, uint256 price) public {
        if (msg.sender == controller) {
            require(latestPriceTime + timeLimit > block.number, "OR002");
            uint256 prePrice = prices[assetA][assetB];
            uint256 sizeChanged = 0;
            if (prePrice > price) {
                sizeChanged = (prePrice - price) * 100 / prePrice;
            } else {
                sizeChanged = (price - prePrice) * 100 / prePrice;
            }
            require(sizeChanged < sizeLimit, "OR003");
        } else {
            require(msg.sender == owner(), "0R002");
        }

        emit PricePosted(assetA, assetB, prices[assetA][assetB], price);
        prices[assetA][assetB] = price;
    }
}
