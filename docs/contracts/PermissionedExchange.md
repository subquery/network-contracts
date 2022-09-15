# Solidity API

## PermissionedExchange

### ExchangeOrder

```solidity
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
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _pairId, uint256 _tokenGiveBalance) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### createPairOrders

```solidity
function createPairOrders(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _tokenGiveBalance) public
```

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PermissionedExchange

### ExchangeOrder

```solidity
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
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _pairId, uint256 _tokenGiveBalance) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### createPairOrders

```solidity
function createPairOrders(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _tokenGiveBalance) public
```

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

