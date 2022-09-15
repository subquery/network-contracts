# Solidity API

## ProxyAdmin

_This contract is the admin of a proxy, and is in charge
of upgrading it as well as transferring it to another admin._

### getProxyImplementation

```solidity
function getProxyImplementation(contract AdminUpgradeabilityProxy proxy) public view returns (address)
```

_Returns the current implementation of a proxy.
This is needed because only the proxy admin can query it._

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the current implementation of the proxy. |

### getProxyAdmin

```solidity
function getProxyAdmin(contract AdminUpgradeabilityProxy proxy) public view returns (address)
```

_Returns the admin of a proxy. Only the admin can query it._

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the current admin of the proxy. |

### changeProxyAdmin

```solidity
function changeProxyAdmin(contract AdminUpgradeabilityProxy proxy, address newAdmin) public
```

_Changes the admin of a proxy._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxy | contract AdminUpgradeabilityProxy | Proxy to change admin. |
| newAdmin | address | Address to transfer proxy administration to. |

### upgrade

```solidity
function upgrade(contract AdminUpgradeabilityProxy proxy, address implementation) public
```

_Upgrades a proxy to the newest implementation of a contract._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxy | contract AdminUpgradeabilityProxy | Proxy to be upgraded. |
| implementation | address | the address of the Implementation. |

### upgradeAndCall

```solidity
function upgradeAndCall(contract AdminUpgradeabilityProxy proxy, address implementation, bytes data) public payable
```

_Upgrades a proxy to the newest implementation of a contract and forwards a function call to it.
This is useful to initialize the proxied contract._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxy | contract AdminUpgradeabilityProxy | Proxy to be upgraded. |
| implementation | address | Address of the Implementation. |
| data | bytes | Data to send as msg.data in the low level call. It should include the signature and the parameters of the function to be called, as described in https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding. |

