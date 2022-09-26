// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '../contracts/PermissionedExchange.sol';
import '../contracts/Settings.sol';
import '../contracts/SQToken.sol';

contract PermissionedExchangeEchidnaTest {
    PermissionedExchange internal pExchange;
    Settings internal settings;
    SQToken internal SQT;
    IERC20 internal USDC;

    struct ExchangeOrder {
        address tokenGive;
        address tokenGet;
        uint256 amountGive;
        uint256 amountGet;
        address sender;
        uint256 expireDate;
        uint256 pairOrderId;
        uint256 tokenGiveBalance;
    }

    constructor() public {
        SQT = new SQToken(address(this));
        settings = new Settings();
        settings.setSQToken(address(SQT));
        pExchange = new PermissionedExchange();
        pExchange.initialize(address(settings), [address(this)]);
    }

    // --- Math ---
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x + y;
        assert(z >= x); // check if there is an addition overflow
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        assert(z <= x); // check if there is a subtraction overflow
    }

    function test_init(uint256 _agive, uint256 _aget, uint256 _ed, uint256 _tgb, uint256 _qm) public {
        uint256 firstOrderId = pExchange.nextOrderId();
        pExchange.createPairOrders(address(SQT), address(USDC), _agive, _aget, _ed, _tgb);
        assert(pExchange.nextOrderId() == add(firstOrderId, 2));
        ExchangeOrder firstOrder = pExchange.orders(firstOrderId);
        ExchangeOrder nextOrder = pExchange.orders(add(firstOrderId, 1));
        assert(firstOrder.tokenGive == address(SQT));
        assert(firstOrder.tokenGet == address(USDC));
        assert(nextOrder.tokenGive == address(USDC));
        assert(nextOrder.tokenGet == address(SQT));

        test_addQuota(_qm);

        test_trade(add(firstOrderId, 1), _qm);

        test_cancelOrder(firstOrderId);
    }

    function test_addQuota(uint256 qm) public {
        pExchange.addQuota(address(SQT), adress(this), qm);
        assert(pExchange.tradeQuota(address(SQT), adress(this)) == qm);
    }

    function test_trade(uint256 id, uint256 amount) public {
        uint256 balanceBefore = SQT.balance(address(pExchange));
        ExchangeOrder order = pExchange.orders(id); 
        uint256 tgbBefore = order.tokenGiveBalance;
        uint256 ptgbBefore = pExchange.orders(order.pairOrderId).tokenGiveBalance;
        uint256 amountGet = (order.amountGive * _amount) / order.amountGet;
        pExchange.trade(id, amount);
        assert(SQT.balance(address(pExchange)) == add(balanceBefore, amount));
        assert(pExchange.orders(id).tokenGiveBalance == sub(tgbBefore, amountGet));
        assert(pExchange.orders(order.pairOrderId).tokenGiveBalance == add(ptgbBefore, amount));
    }

    function test_cancelOrder(uint256 id) public {
        uint256 balanceBefore = SQT.balance(address(pExchange));
        ExchangeOrder order = pExchange.orders(id); 
        uint256 tgb = order.tokenGiveBalance;
        pExchange.cancelOrder(id);
        assert(SQT.balance(address(pExchange)) == sub(balanceBefore, tgb));
        assert(pExchange.orders(id).tokenGive == address(0));
        assert(pExchange.orders(order.pairOrderId).pairOrderId == 0);
    }
}