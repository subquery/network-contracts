// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISQToken.sol';

/**
 * @title Token Exchange Contract
 * @notice This smart contract enables single-direction token trading between two predefined tokens ('tokenGet' and 'tokenGive').
 * It features owner-exclusive rights for trade cancellations, adding a layer of control and security. After each trade,
 * the 'tokenGet' is automatically burned, reducing its total supply in circulation. This contract is ideal for controlled
 * trading environments with a focus on token supply management.
 */
contract TokenExchange is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    struct ExchangeOrder {
        address tokenGive;
        address tokenGet;
        uint256 amountGive;
        uint256 amountGet;
        address sender;
        uint256 tokenGiveBalance;
    }

    /// @dev ### STATES
    /// @notice The next order Id
    uint256 public nextOrderId;
    /// @notice Orders: orderId => ExchangeOrder
    mapping(uint256 => ExchangeOrder) public orders;

    /// @dev ### EVENTS
    /// @notice Emitted when exchange order sent.
    event ExchangeOrderSent(
        uint256 indexed orderId,
        address sender,
        address tokenGive,
        address tokenGet,
        uint256 amountGive,
        uint256 amountGet,
        uint256 tokenGiveBalance
    );
    /// @notice Emitted when expired exchange order settled.
    event OrderSettled(
        uint256 indexed orderId,
        address tokenGive,
        address tokenGet,
        uint256 amountGive
    );
    /// @notice Emitted when trader trade on exist orders.
    event Trade(
        uint256 indexed orderId,
        address tokenGive,
        address tokenGet,
        uint256 amountGive,
        uint256 amountGet
    );

    function initialize() external initializer {
        __Ownable_init();

        nextOrderId = 1;
    }

    /**
     * @notice only onwer have the permission to send the order for now, and traders can do exchanges on these exist orders.
     * @param _tokenGive The token address order want give.
     * @param _tokenGet The token address order want get
.    * @param _tokenGiveBalance The balance of order give token amount.
     */
    function sendOrder(
        address _tokenGive,
        address _tokenGet,
        uint256 _amountGive,
        uint256 _amountGet,
        uint256 _tokenGiveBalance
    ) public onlyOwner {
        require(_tokenGiveBalance > 0, 'TE001');

        IERC20(_tokenGive).safeTransferFrom(msg.sender, address(this), _tokenGiveBalance);
        orders[nextOrderId] = ExchangeOrder(
            _tokenGive,
            _tokenGet,
            _amountGive,
            _amountGet,
            msg.sender,
            _tokenGiveBalance
        );

        emit ExchangeOrderSent(
            nextOrderId,
            msg.sender,
            _tokenGive,
            _tokenGet,
            _amountGive,
            _amountGet,
            _tokenGiveBalance
        );

        nextOrderId += 1;
    }

    /**
     * @notice Owner can cancel the sent order anytime, and this will return leftgiven token back to owner.
     * @param orderId The order id to cancel.
     */
    function cancelOrder(uint256 orderId) public onlyOwner {
        ExchangeOrder memory order = orders[orderId];
        require(order.sender != address(0), 'TE002');

        if (order.tokenGiveBalance != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.tokenGiveBalance);
        }

        emit OrderSettled(orderId, order.tokenGive, order.tokenGet, order.tokenGiveBalance);

        delete orders[orderId];
    }

    /**
     * @notice Traders do exchange on exchange orders. The trading rate is 1:1. Token get will be burn after trading
     * @param orderId The order id to trade.
     * @param amount The amount to trade.
     */
    function trade(uint256 orderId, uint256 amount) public {
        ExchangeOrder storage order = orders[orderId];
        require(order.sender != address(0), 'TE002');

        ISQToken(order.tokenGet).burnFrom(msg.sender, amount);

        uint256 amountGive = (amount * order.amountGive) / order.amountGet;
        require(amountGive <= order.tokenGiveBalance, 'TE003');

        IERC20(order.tokenGive).safeTransfer(msg.sender, amountGive);
        order.tokenGiveBalance = order.tokenGiveBalance - amountGive;

        emit Trade(orderId, order.tokenGive, order.tokenGet, amountGive, amount);
    }
}
