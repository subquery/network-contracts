// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISettings.sol';

/**
 * @title PermissionedExchange Contract
 * @notice For now PermissionedExchange contract allows traders trade their SQTs on admin sent orders, later on we may allow others to send their orders. Controllers may set the trade quota for trader, and trader cannot trade over the their quota.
 * It provides a way for indexers to swap their rewards(SQT) to stable token with a fixed exchange rate.
 */
contract PermissionedExchange is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

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

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;
    /// @notice The next order Id
    uint256 public nextOrderId;
    /// @notice Trade quota for traders for specific token: address => trader address => trade Quota
    mapping(address => mapping(address => uint256)) public tradeQuota;
    /// @notice Account address is controller or not
    mapping(address => bool) public exchangeController;
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
        uint256 expireDate
    );
    /// @notice Emitted when trader trade on exist orders.
    event Trade(uint256 indexed orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet);
    /// @notice Emitted when expired exchange order settled.
    event OrderSettled(
        uint256 indexed orderId,
        address tokenGive,
        uint256 amountGive,
        address tokenGet,
        uint256 amountGet
    );
    /// @notice Emitted when controller add trade quota to trader.
    event QuotaAdded(address token, address account, uint256 amount);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract make order start from 1 and set controller account.
     * @param _settings ISettings contract
     * @param _controllers List of addresses to set as controller account
     */
    function initialize(ISettings _settings, address[] calldata _controllers) external initializer {
        __Ownable_init();
        settings = _settings;
        nextOrderId = 1;
        for (uint256 i; i < _controllers.length; i++) {
            exchangeController[_controllers[i]] = true;
        }
    }

    /**
     * @notice Set controller role for this contract, controller have the permission to addQuota for trader.
     * @param _controller The account address to set.
     * @param _isController Set to controller or not.
     */
    function setController(address _controller, bool _isController) external onlyOwner {
        exchangeController[_controller] = _isController;
    }

    /**
     * @notice allow controllers to add the trade quota to traders on specific token.
     * @param _token Token address to add quota.
     * @param _account Trader address to add quota.
     * @param _account Quota amount to add.
     */
    function addQuota(
        address _token,
        address _account,
        uint256 _amount
    ) external {
        require(exchangeController[msg.sender] == true, 'PE001');
        tradeQuota[_token][_account] += _amount;
        emit QuotaAdded(_token, _account, _amount);
        emit QuotaAdded(_token, _account, _amount);
    }

    /**
     * @notice only onwer have the permission to send the order for now, and traders can do exchanges on these exist orders.
     * @param _tokenGive The token address order want give.
     * @param _tokenGet The token address order want get.
     * @param _amountGive Amount of give token to calculate exchange rate.
     * @param _amountGet Amount of get token to calculate exchange rate.
     * @param _expireDate Exchange order expire date in uinx timestamp.
     * @param _pairId The order id of its pair order. 0 means no pair order.
     * @param _tokenGiveBalance The balance of order give token amount.
     */
    function sendOrder(
        address _tokenGive,
        address _tokenGet,
        uint256 _amountGive,
        uint256 _amountGet,
        uint256 _expireDate,
        uint256 _pairId,
        uint256 _tokenGiveBalance
    ) public onlyOwner {
        require(_expireDate > block.timestamp, 'PE002');
        require(_amountGive > 0 && _amountGet > 0, 'PE003');
        if (_tokenGiveBalance > 0){
            IERC20(_tokenGive).safeTransferFrom(msg.sender, address(this), _tokenGiveBalance);
        }
        orders[nextOrderId] = ExchangeOrder(
            _tokenGive,
            _tokenGet,
            _amountGive,
            _amountGet,
            msg.sender,
            _expireDate,
            _pairId,
            _tokenGiveBalance
        );
        emit ExchangeOrderSent(nextOrderId, msg.sender, _tokenGive, _tokenGet, _amountGive, _amountGet, _expireDate);
        nextOrderId += 1;
    }

    /**
     * @notice admin have the permission to create pair orders, traders tarde on one of the pair orders, the token get will transfer to the token give of its pair order.
     * @param _tokenGive The token address order want give.
     * @param _tokenGet The token address order want get.
     * @param _amountGive Amount of give token to calculate exchange rate.
     * @param _amountGet Amount of get token to calculate exchange rate.
     * @param _expireDate Exchange order expire date in uinx timestamp.
     * @param _tokenGiveBalance The balance of order give token amount.
     */
    function createPairOrders(
        address _tokenGive,
        address _tokenGet,
        uint256 _amountGive,
        uint256 _amountGet,
        uint256 _expireDate,
        uint256 _tokenGiveBalance
    ) public onlyOwner {
        require(_tokenGiveBalance > 0, 'PE004');
        sendOrder(_tokenGive, _tokenGet, _amountGive, _amountGet, _expireDate, nextOrderId+1, _tokenGiveBalance);
        sendOrder(_tokenGet, _tokenGive, _amountGet, _amountGive, _expireDate, nextOrderId-1, 0);
    }

    /**
     * @notice Traders do exchange on exchange orders, but need to trade under the trade quota.
     * If the order has no pair order, the token get will transfer to order sender, otherwise will transfer to the token give of its pair order.
     * @param _orderId The order id to trade.
     * @param _amount The amount to trade.
     */
    function trade(uint256 _orderId, uint256 _amount) public {
        ExchangeOrder storage order = orders[_orderId];
        if (order.tokenGet == settings.getSQToken()) {
            require(tradeQuota[order.tokenGet][msg.sender] >= _amount, 'PE005');
        }
        require(order.expireDate > block.timestamp, 'PE006');
        uint256 amount = (order.amountGive * _amount) / order.amountGet;
        require(amount > 0, 'PE007');
        require(amount <= order.tokenGiveBalance, 'PE008');
        order.tokenGiveBalance -= amount;
        if (order.tokenGet == settings.getSQToken()) {
            tradeQuota[order.tokenGet][msg.sender] -= _amount;
        }
        if (order.pairOrderId != 0){
            IERC20(order.tokenGet).safeTransferFrom(msg.sender, address(this), _amount);
            ExchangeOrder storage pairOrder = orders[order.pairOrderId];
            pairOrder.tokenGiveBalance += _amount;
        }else{
            IERC20(order.tokenGet).safeTransferFrom(msg.sender, order.sender, _amount);
        }
        IERC20(order.tokenGive).safeTransfer(msg.sender, amount);
        emit Trade(_orderId, order.tokenGet, _amount, order.tokenGive, amount);
    }

    /**
     * @notice Everyone allowed to call settleExpiredOrder to settled expired order this will return left given token back to order sender.
     * @param _orderId The order id to settle.
     */
    function settleExpiredOrder(uint256 _orderId) public {
        ExchangeOrder memory order = orders[_orderId];
        require(order.expireDate != 0, 'PE009');
        require(order.expireDate < block.timestamp, 'PE010');
        if (order.tokenGiveBalance != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.tokenGiveBalance);
        }
        emit OrderSettled(
            _orderId,
            order.tokenGive,
            order.amountGive,
            order.tokenGet,
            order.amountGet
        );
        delete orders[_orderId];
    }

    /**
     * @notice Order sender can cancel the sent order anytime, and this will return leftgiven token back to order sender.
     * @param _orderId The order id to cancel.
     */
    function cancelOrder(uint256 _orderId) public {
        ExchangeOrder memory order = orders[_orderId];
        require(order.expireDate != 0, 'PE009');
        require(msg.sender == order.sender, 'PE011');
        if (order.tokenGiveBalance != 0) {
            IERC20(order.tokenGive).safeTransfer(order.sender, order.tokenGiveBalance);
        }
        if (order.pairOrderId != 0){
            ExchangeOrder storage pairOrder = orders[order.pairOrderId];
            pairOrder.pairOrderId = 0;
        }
        emit OrderSettled(
            _orderId,
            order.tokenGive,
            order.amountGive,
            order.tokenGet,
            order.amountGet
        );
        delete orders[_orderId];
    }
}
