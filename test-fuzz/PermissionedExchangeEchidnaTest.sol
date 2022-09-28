// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '../contracts/PermissionedExchange.sol';
import '../contracts/Settings.sol';
import '../contracts/interfaces/ISettings.sol';
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

    constructor() {
        SQT = new SQToken(address(this));
        settings = new Settings();
        settings.setSQToken(address(SQT));
        pExchange = new PermissionedExchange();
        address[] memory t = new address[](1);
        t[0] = address(this);
        pExchange.initialize(ISettings(address(settings)), t);
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
        // (address a,address b,uint256 c,uint256 d,address e,uint256 f,uint256 g,uint256 h) = pExchange.orders(firstOrderId);
        // ExchangeOrder memory firstOrder = ExchangeOrder(a,b,c,d,e,f,g,h);
        // (a,b,c,d,e,f,g,h) = pExchange.orders(add(firstOrderId, 1));
        // ExchangeOrder memory nextOrder = ExchangeOrder(a,b,c,d,e,f,g,h);
        // assert(firstOrder.tokenGive == address(SQT));
        // assert(firstOrder.tokenGet == address(USDC));
        // assert(nextOrder.tokenGive == address(USDC));
        // assert(nextOrder.tokenGet == address(SQT));

        test_addQuota(_qm);

        test_trade(add(firstOrderId, 1), _qm);

        test_cancelOrder(firstOrderId);
    }

    function test_addQuota(uint256 qm) public {
        pExchange.addQuota(address(SQT), address(this), qm);
        assert(pExchange.tradeQuota(address(SQT), address(this)) == qm);
    }

    function test_trade(uint256 id, uint256 amount) public {
        uint256 balanceBefore = SQT.balanceOf(address(pExchange));
        //(address a,address b,uint256 c,uint256 d,address e,uint256 f,uint256 g,uint256 h) = pExchange.orders(id); 
        //ExchangeOrder memory order = ExchangeOrder(a,b,c,d,e,f,g,h);
        (,,uint256 amountGive,uint256 amountGet,,,uint256 pairOrderId,uint256 tgbBefore) = pExchange.orders(id);
        (,,,,,,,uint256 ptgbBefore) = pExchange.orders(pairOrderId);
        uint256 newAmountGet = (amountGive * amount) / amountGet;
        pExchange.trade(id, amount);
        assert(SQT.balanceOf(address(pExchange)) == add(balanceBefore, amount));
        (,,,,,,,uint256 tgb) = pExchange.orders(id);
        assert(tgb == sub(tgbBefore, newAmountGet));
        (,,,,,,,uint256 tgbPair) = pExchange.orders(pairOrderId);
        assert(tgbPair == add(ptgbBefore, amount));
    }

    function test_cancelOrder(uint256 id) public {
        uint256 balanceBefore = SQT.balanceOf(address(pExchange));
        //(address a,address b,uint256 c,uint256 d,address e,uint256 f,uint256 g,uint256 h) = pExchange.orders(id); 
        //ExchangeOrder memory order = ExchangeOrder(a,b,c,d,e,f,g,h);
        (,,,,,,uint256 pairOrderId, uint256 tgb) = pExchange.orders(id);
        pExchange.cancelOrder(id);
        assert(SQT.balanceOf(address(pExchange)) == sub(balanceBefore, tgb));
        (address tg,,,,,,,) = pExchange.orders(id);
        assert(tg == address(0));
        (,,,,,,uint256 poid,) = pExchange.orders(pairOrderId);
        assert(poid == 0);
    }
}