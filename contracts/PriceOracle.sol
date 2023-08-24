// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IPriceOracle.sol';

contract PriceOracle is IPriceOracle, Initializable, OwnableUpgradeable {
    ///@notice the price of assetA in assetB
    mapping(address => mapping(address => uint256)) public prices;

    ///@notice the size limit when controller change price
    uint256 public sizeLimit;

    ///@notice the block number limit when controller change price
    uint256 public blockLimit;

    ///@notice the block number of latest set price
    uint256 public latestPriceBlock;

    uint256 public enlargementFactor = 1e6;

    ///@notice the controller account which can change price
    address public controller;

    function initialize(uint256 _sizeLimit, uint256 _blockLimit) external initializer {
        __Ownable_init();

        sizeLimit = _sizeLimit;
        blockLimit = _blockLimit;
    }

    event PricePosted(address assetA, address assetB, uint256 previousPrice, uint256 newPrice);

    ///@notice update change price limit
    function setLimit(uint256 _sizeLimit, uint256 _blockLimit) public onlyOwner {
        sizeLimit = _sizeLimit;
        blockLimit = _blockLimit;
    }

    ///@notice update the controller account
    function setController(address _controller) public onlyOwner {
        controller = _controller;
    }

    ///@notice get the price of assetA in assetB
    function getAssetPrice(address assetFrom, address assetTo) public view returns (uint256) {
        uint256 price = prices[assetFrom][assetTo];
        require(price > 0, "OR001");
        return price;
    }

    ///set the price of assetA in assetB
    ///AssetA in AssetB with a fixed precision of 18 decimal places
    ///Thus, if we wanted set 1 USDC = 13 SQT The price be 13000000000000000000000000000000(13e30)
    ///@param assetA priceToken
    ///@param assetB sqtToken
    function setAssetPrice(address assetFrom, address assetTo, uint256 assetFromAmount, uint256 assetToAmount) public {
        uint256 prePrice = prices[assetFrom][assetTo];
        uint256 price = assetToAmount * enlargementFactor / assetFromAmount;
        if (msg.sender == controller) {
            require(latestPriceBlock + blockLimit < block.number, "OR002");

            uint256 priceChanged = prePrice > price ? prePrice - price : price - prePrice;
            uint256 sizeChanged = priceChanged * 100 / prePrice;

            require(sizeChanged < sizeLimit, "OR003");
        } else {
            require(msg.sender == owner(), "OR004");
        }

        latestPriceBlock = block.number;
        prices[assetFrom][assetTo] = assetToAmount * enlargementFactor / assetToAmount;
        emit PricePosted(assetFrom, assetTo, prePrice, price);
    }

    function convertPrice(address fromToken, address toToken, uint256 amount) public view returns (uint256) {
        if (fromToken == toToken){
            return amount;
        }
        uint256 assetPrice = getAssetPrice(fromToken, toToken);
        return amount * assetPrice / enlargementFactor;
    }
}
