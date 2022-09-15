# Solidity API

## Proxy

_Implements delegation of calls to other contracts, with proper
forwarding of return values and bubbling of failures.
It defines a fallback function that delegates all calls to the address
returned by the abstract _implementation() internal function._

### fallback

```solidity
fallback() external payable
```

_Fallback function.
Implemented entirely in `_fallback`._

### receive

```solidity
receive() external payable
```

_Receive function.
Implemented entirely in `_fallback`._

### _implementation

```solidity
function _implementation() internal view virtual returns (address)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The Address of the implementation. |

### _delegate

```solidity
function _delegate(address implementation) internal
```

_Delegates execution to an implementation contract.
This is a low level function that doesn't return to its internal call site.
It will return to the external caller whatever the implementation returns._

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | Address to delegate. |

### _willFallback

```solidity
function _willFallback() internal virtual
```

_Function that is run as the first thing in the fallback function.
Can be redefined in derived contracts to add functionality.
Redefinitions must call super._willFallback()._

### _fallback

```solidity
function _fallback() internal
```

_fallback implementation.
Extracted to enable manual triggering._

## Address

_Collection of functions related to the address type_

### isContract

```solidity
function isContract(address account) internal view returns (bool)
```

_Returns true if `account` is a contract.

[IMPORTANT]
====
It is unsafe to assume that an address for which this function returns
false is an externally-owned account (EOA) and not a contract.

Among others, `isContract` will return false for the following
types of addresses:

 - an externally-owned account
 - a contract in construction
 - an address where a contract will be created
 - an address where a contract lived, but was destroyed
====_

### sendValue

```solidity
function sendValue(address payable recipient, uint256 amount) internal
```

_Replacement for Solidity's `transfer`: sends `amount` wei to
`recipient`, forwarding all available gas and reverting on errors.

https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
of certain opcodes, possibly making contracts go over the 2300 gas limit
imposed by `transfer`, making them unable to receive funds via
`transfer`. {sendValue} removes this limitation.

https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].

IMPORTANT: because control is transferred to `recipient`, care must be
taken to not create reentrancy vulnerabilities. Consider using
{ReentrancyGuard} or the
https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern]._

### functionCall

```solidity
function functionCall(address target, bytes data) internal returns (bytes)
```

_Performs a Solidity function call using a low level `call`. A
plain`call` is an unsafe replacement for a function call: use this
function instead.

If `target` reverts with a revert reason, it is bubbled up by this
function (like regular Solidity function calls).

Returns the raw returned data. To convert to the expected return value,
use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].

Requirements:

- `target` must be a contract.
- calling `target` with `data` must not revert.

_Available since v3.1.__

### functionCall

```solidity
function functionCall(address target, bytes data, string errorMessage) internal returns (bytes)
```

_Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
`errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1.__

### functionCallWithValue

```solidity
function functionCallWithValue(address target, bytes data, uint256 value) internal returns (bytes)
```

_Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
but also transferring `value` wei to `target`.

Requirements:

- the calling contract must have an ETH balance of at least `value`.
- the called Solidity function must be `payable`.

_Available since v3.1.__

### functionCallWithValue

```solidity
function functionCallWithValue(address target, bytes data, uint256 value, string errorMessage) internal returns (bytes)
```

_Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
with `errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1.__

### _functionCallWithValue

```solidity
function _functionCallWithValue(address target, bytes data, uint256 weiValue, string errorMessage) private returns (bytes)
```

## UpgradeabilityProxy

_This contract implements a proxy that allows to change the
implementation address to which it will delegate.
Such a change is called an implementation upgrade._

### constructor

```solidity
constructor(address _logic, bytes _data) public payable
```

_Contract constructor._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _logic | address | Address of the initial implementation. |
| _data | bytes | Data to send as msg.data to the implementation to initialize the proxied contract. It should include the signature and the parameters of the function to be called, as described in https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding. This parameter is optional, if no data is given the initialization call to proxied contract will be skipped. |

### Upgraded

```solidity
event Upgraded(address implementation)
```

_Emitted when the implementation is upgraded._

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | Address of the new implementation. |

### IMPLEMENTATION_SLOT

```solidity
bytes32 IMPLEMENTATION_SLOT
```

_Storage slot with the address of the current implementation.
This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
validated in the constructor._

### _implementation

```solidity
function _implementation() internal view returns (address impl)
```

_Returns the current implementation._

| Name | Type | Description |
| ---- | ---- | ----------- |
| impl | address | Address of the current implementation |

### _upgradeTo

```solidity
function _upgradeTo(address newImplementation) internal
```

_Upgrades the proxy to a new implementation._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the new implementation. |

### _setImplementation

```solidity
function _setImplementation(address newImplementation) internal
```

_Sets the implementation address of the proxy._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the new implementation. |

## AdminUpgradeabilityProxy

_This contract combines an upgradeability proxy with an authorization
mechanism for administrative tasks.
All external functions in this contract must be guarded by the
`ifAdmin` modifier. See ethereum/solidity#3864 for a Solidity
feature proposal that would enable this to be done automatically._

### constructor

```solidity
constructor(address _logic, address __admin, bytes _data) public payable
```

Contract constructor.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _logic | address | address of the initial implementation. |
| __admin | address | Address of the proxy administrator. |
| _data | bytes | Data to send as msg.data to the implementation to initialize the proxied contract. It should include the signature and the parameters of the function to be called, as described in https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding. This parameter is optional, if no data is given the initialization call to proxied contract will be skipped. |

### AdminChanged

```solidity
event AdminChanged(address previousAdmin, address newAdmin)
```

_Emitted when the administration has been transferred._

| Name | Type | Description |
| ---- | ---- | ----------- |
| previousAdmin | address | Address of the previous admin. |
| newAdmin | address | Address of the new admin. |

### ADMIN_SLOT

```solidity
bytes32 ADMIN_SLOT
```

_Storage slot with the admin of the contract.
This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
validated in the constructor._

### ifAdmin

```solidity
modifier ifAdmin()
```

_Modifier to check whether the `msg.sender` is the admin.
If it is, it will run the function. Otherwise, it will delegate the call
to the implementation._

### admin

```solidity
function admin() external returns (address)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the proxy admin. |

### implementation

```solidity
function implementation() external returns (address)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the implementation. |

### changeAdmin

```solidity
function changeAdmin(address newAdmin) external
```

_Changes the admin of the proxy.
Only the current admin can call this function._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAdmin | address | Address to transfer proxy administration to. |

### upgradeTo

```solidity
function upgradeTo(address newImplementation) external
```

_Upgrade the backing implementation of the proxy.
Only the admin can call this function._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the new implementation. |

### upgradeToAndCall

```solidity
function upgradeToAndCall(address newImplementation, bytes data) external payable
```

_Upgrade the backing implementation of the proxy and call a function
on the new implementation.
This is useful to initialize the proxied contract._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the new implementation. |
| data | bytes | Data to send as msg.data in the low level call. It should include the signature and the parameters of the function to be called, as described in https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding. |

### _admin

```solidity
function _admin() internal view returns (address adm)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| adm | address | The admin slot. |

### _setAdmin

```solidity
function _setAdmin(address newAdmin) internal
```

_Sets the address of the proxy admin._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAdmin | address | Address of the new proxy admin. |

### _willFallback

```solidity
function _willFallback() internal virtual
```

_Only fall back when the sender is not the admin._

