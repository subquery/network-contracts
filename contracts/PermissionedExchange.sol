// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './MathUtil.sol';
import './Constants.sol';
import './interfaces/ISettings.sol';

contract PermissionedExchange is Initializable, OwnableUpgradeable, Constants {
    using SafeERC20 for IERC20;
    using MathUtil for uint256;

    struct ExchangeOrder {
        address tokenGive;
        address tokenGet;
        uint256 amountGive;
        uint256 amountGet;
        address sender;
        uint256 expireDate;
    }

    uint256 public nextOrderId;
    mapping(address => mapping(address => uint256)) public tradeQuota;
    mapping(address => bool) public exchangeController;
    mapping(uint256 => ExchangeOrder) public orders;

    event ExchangeOrderSent(
        uint256 indexed orderId,
        address sender,
        address tokenGive,
        address tokenGet,
        uint256 amountGive,
        uint256 amountGet,
        uint256 expireDate
    );
    event Trade(uint256 indexed orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet);
    event OrderSettled(
        uint256 indexed orderId,
        address tokenGive,
        uint256 amountGive,
        address tokenGet,
        uint256 amountGet
    );

    function initialize() external initializer {
        __Ownable_init();
    }

    function addController(address _controller) external onlyOwner {
        exchangeController[_controller] = true;
    }

    function addQuota(
        address _token,
        address _account,
        uint256 _amount
    ) external {
        require(exchangeController[msg.sender] == true, 'Not controller');
        tradeQuota[_token][_account] += _amount;
    }

    function sendOrder(
        address _tokenGive,
        address _tokenGet,
        uint256 _amountGive,
        uint256 _amountGet,
        uint256 _expireDate
    ) public onlyOwner {
        require(_expireDate > block.timestamp, 'invalid expireDate');
        require(_amountGive > 0 && _amountGet > 0, 'invalid amount');
        IERC20(_tokenGive).safeTransferFrom(msg.sender, address(this), _amountGive);
        orders[nextOrderId] = ExchangeOrder(_tokenGive, _tokenGet, _amountGive, _amountGet, msg.sender, _expireDate);
        emit ExchangeOrderSent(nextOrderId, msg.sender, _tokenGive, _tokenGet, _amountGive, _amountGet, _expireDate);
        nextOrderId += 1;
    }

    function trade(uint256 _orderId, uint256 _amount) public {
        ExchangeOrder storage order = orders[_orderId];
        require(tradeQuota[order.tokenGet][msg.sender] >= _amount, 'tradeQuota reached');
        require(order.expireDate > block.timestamp, 'order expired');
        require(order.amountGet >= _amount, 'trade amount exceed order balance');
        uint256 amount = (order.amountGive * _amount * PER_MILL) / order.amountGet / PER_MILL;
        order.amountGet -= _amount;
        order.amountGive -= amount;
        IERC20(order.tokenGet).safeTransferFrom(msg.sender, order.sender, _amount);
        IERC20(order.tokenGive).safeTransfer(msg.sender, amount);
        emit Trade(_orderId, order.tokenGet, _amount, order.tokenGive, amount);
    }

    function settleExpiredOrder(uint256 _orderId) public {
        ExchangeOrder memory order = orders[_orderId];
        require(order.expireDate < block.timestamp, 'order not expired');
        if (order.amountGive != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.amountGive);
        }
        emit OrderSettled(_orderId, order.tokenGive, order.amountGive, order.tokenGet, order.amountGet);
        delete orders[_orderId];
    }
}
