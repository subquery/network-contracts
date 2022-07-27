// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISettings.sol';

contract PermissionedExchange is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    struct ExchangeOrder {
        address tokenGive;
        address tokenGet;
        uint256 amountGive;
        uint256 amountGet;
        address sender;
        uint256 expireDate;
        uint256 amountGiveLeft;
    }

    ISettings public settings;
    //next order Id
    uint256 public nextOrderId;
    //record trade quota for traders for specific token: address => trader address => trade Quota
    mapping(address => mapping(address => uint256)) public tradeQuota;
    //record address is controller or not
    mapping(address => bool) public exchangeController;
    //record orders: orderId => ExchangeOrder
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

    function initialize(ISettings _settings) external initializer {
        __Ownable_init();
        settings = _settings;
    }

    /**
     * @dev Set controller role for this contract, controller have the permission to addQuota for trader
     */
    function setController(address _controller, bool _isController) external onlyOwner {
        exchangeController[_controller] = _isController;
    }

    /**
     * @dev allow controllers to add the trade quota to traders on specific token
     */
    function addQuota(
        address _token,
        address _account,
        uint256 _amount
    ) external {
        require(exchangeController[msg.sender] == true, 'Not controller');
        tradeQuota[_token][_account] += _amount;
    }

    /**
     * @dev only onwer have the permission to send the order for now,
     * traders can do exchanges on onwer sent order
     */
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
        orders[nextOrderId] = ExchangeOrder(
            _tokenGive,
            _tokenGet,
            _amountGive,
            _amountGet,
            msg.sender,
            _expireDate,
            _amountGive
        );
        emit ExchangeOrderSent(nextOrderId, msg.sender, _tokenGive, _tokenGet, _amountGive, _amountGet, _expireDate);
        nextOrderId += 1;
    }

    /**
     * @dev traders do exchange on traders order, but need to trade under the trade quota.
     */
    function trade(uint256 _orderId, uint256 _amount) public {
        ExchangeOrder storage order = orders[_orderId];
        if (order.tokenGet == settings.getSQToken()) {
            require(tradeQuota[order.tokenGet][msg.sender] >= _amount, 'tradeQuota reached');
        }
        require(order.expireDate > block.timestamp, 'order invalid');
        uint256 amount = (order.amountGive * _amount) / order.amountGet;
        require(amount <= order.amountGiveLeft, 'trade amount exceed order balance');
        order.amountGiveLeft -= amount;
        if (order.tokenGet == settings.getSQToken()) {
            tradeQuota[order.tokenGet][msg.sender] -= amount;
        }
        IERC20(order.tokenGet).safeTransferFrom(msg.sender, order.sender, _amount);
        IERC20(order.tokenGive).safeTransfer(msg.sender, amount);
        emit Trade(_orderId, order.tokenGet, _amount, order.tokenGive, amount);
    }

    /**
     * @dev everyone allowed to call settleExpiredOrder to settled expired order
     * this will return left given token back to order sender.
     */
    function settleExpiredOrder(uint256 _orderId) public {
        ExchangeOrder memory order = orders[_orderId];
        require(order.expireDate != 0, 'order not exist');
        require(order.expireDate < block.timestamp, 'order not expired');
        if (order.amountGiveLeft != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.amountGiveLeft);
        }
        emit OrderSettled(
            _orderId,
            order.tokenGive,
            order.amountGive - order.amountGiveLeft,
            order.tokenGet,
            order.amountGet - ((order.amountGet * order.amountGiveLeft) / order.amountGive)
        );
        delete orders[_orderId];
    }

    /**
     * @dev order sender can cancel the sent order anytime, and this will return left
     * given token back to order sender.
     */
    function cancelOrder(uint256 _orderId) public {
        ExchangeOrder memory order = orders[_orderId];
        require(order.expireDate != 0, 'order not exist');
        require(msg.sender == order.sender, 'only order sender allowed');
        if (order.amountGiveLeft != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.amountGiveLeft);
        }
        emit OrderSettled(
            _orderId,
            order.tokenGive,
            order.amountGive - order.amountGiveLeft,
            order.tokenGet,
            order.amountGet - ((order.amountGet * order.amountGiveLeft) / order.amountGive)
        );
        delete orders[_orderId];
    }
}
