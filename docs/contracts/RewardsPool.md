# Solidity API

## RewardsPool

### Pool

```solidity
struct Pool {
  uint256 totalStake;
  uint256 totalReward;
  uint256 unclaimTotalLabor;
  uint256 unclaimReward;
  mapping(address => uint256) stake;
  mapping(address => uint256) labor;
}
```

### IndexerDeployment

```solidity
struct IndexerDeployment {
  uint256 unclaim;
  bytes32[] deployments;
  mapping(bytes32 => uint256) index;
}
```

### EraPool

```solidity
struct EraPool {
  uint256 unclaimDeployment;
  mapping(address => struct RewardsPool.IndexerDeployment) indexerUnclaimDeployments;
  mapping(bytes32 => struct RewardsPool.Pool) pools;
}
```

### pools

```solidity
mapping(uint256 => struct RewardsPool.EraPool) pools
```

### settings

```solidity
contract ISettings settings
```

### alphaNumerator

```solidity
int32 alphaNumerator
```

### alphaDenominator

```solidity
int32 alphaDenominator
```

### Alpha

```solidity
event Alpha(int32 alphaNumerator, int32 alphaDenominator)
```

### Labor

```solidity
event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total)
```

### Collect

```solidity
event Collect(bytes32 deploymentId, address indexer, uint256 era, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

_update the settings._

### setAlpha

```solidity
function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public
```

_Update the alpha for cobb-douglas function._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _alphaNumerator | int32 | int32. |
| _alphaDenominator | int32 | int32. |

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256)
```

_get the Pool reward by deploymentId, era and indexer. returns my labor and total reward._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| era | uint256 | uint256. |
| indexer | address | address. |

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

_Add Labor(reward) for current era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |
| amount | uint256 | uint256. the labor of services. |

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from previous era Pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### batchCollect

```solidity
function batchCollect(address indexer) external
```

_Batch collect all deployments from previous era Pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address. |

### collectEra

```solidity
function collectEra(uint256 era, bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| era | uint256 | uint256. |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### batchCollectEra

```solidity
function batchCollectEra(uint256 era, address indexer) external
```

_Batch collect all deployments in pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| era | uint256 | uint256. |
| indexer | address | address. |

### _batchCollect

```solidity
function _batchCollect(uint256 era, address indexer) private
```

### _collect

```solidity
function _collect(uint256 era, bytes32 deploymentId, address indexer) private
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external view returns (bool)
```

### getUnclaimDeployments

```solidity
function getUnclaimDeployments(uint256 era, address indexer) external view returns (bytes32[])
```

### _cobbDouglas

```solidity
function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256)
```

## RewardsPool

### Pool

```solidity
struct Pool {
  uint256 totalStake;
  uint256 totalReward;
  uint256 unclaimTotalLabor;
  uint256 unclaimReward;
  mapping(address => uint256) stake;
  mapping(address => uint256) labor;
}
```

### IndexerDeployment

```solidity
struct IndexerDeployment {
  uint256 unclaim;
  bytes32[] deployments;
  mapping(bytes32 => uint256) index;
}
```

### EraPool

```solidity
struct EraPool {
  uint256 unclaimDeployment;
  mapping(address => struct RewardsPool.IndexerDeployment) indexerUnclaimDeployments;
  mapping(bytes32 => struct RewardsPool.Pool) pools;
}
```

### pools

```solidity
mapping(uint256 => struct RewardsPool.EraPool) pools
```

### settings

```solidity
contract ISettings settings
```

### alphaNumerator

```solidity
int32 alphaNumerator
```

### alphaDenominator

```solidity
int32 alphaDenominator
```

### Alpha

```solidity
event Alpha(int32 alphaNumerator, int32 alphaDenominator)
```

### Labor

```solidity
event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total)
```

### Collect

```solidity
event Collect(bytes32 deploymentId, address indexer, uint256 era, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

_update the settings._

### setAlpha

```solidity
function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public
```

_Update the alpha for cobb-douglas function._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _alphaNumerator | int32 | int32. |
| _alphaDenominator | int32 | int32. |

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256)
```

_get the Pool reward by deploymentId, era and indexer. returns my labor and total reward._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| era | uint256 | uint256. |
| indexer | address | address. |

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

_Add Labor(reward) for current era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |
| amount | uint256 | uint256. the labor of services. |

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from previous era Pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### batchCollect

```solidity
function batchCollect(address indexer) external
```

_Batch collect all deployments from previous era Pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address. |

### collectEra

```solidity
function collectEra(uint256 era, bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| era | uint256 | uint256. |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### batchCollectEra

```solidity
function batchCollectEra(uint256 era, address indexer) external
```

_Batch collect all deployments in pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| era | uint256 | uint256. |
| indexer | address | address. |

### _batchCollect

```solidity
function _batchCollect(uint256 era, address indexer) private
```

### _collect

```solidity
function _collect(uint256 era, bytes32 deploymentId, address indexer) private
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external view returns (bool)
```

### getUnclaimDeployments

```solidity
function getUnclaimDeployments(uint256 era, address indexer) external view returns (bytes32[])
```

### _cobbDouglas

```solidity
function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256)
```

## RewardsPool

### Pool

```solidity
struct Pool {
  uint256 totalStake;
  uint256 totalReward;
  uint256 unclaimTotalLabor;
  uint256 unclaimReward;
  mapping(address => uint256) stake;
  mapping(address => uint256) labor;
}
```

### EraPool

```solidity
struct EraPool {
  uint256 unclaimDeployment;
  mapping(address => uint256) indexerUnclaimDeployments;
  mapping(bytes32 => struct RewardsPool.Pool) pools;
}
```

### pools

```solidity
mapping(uint256 => struct RewardsPool.EraPool) pools
```

### settings

```solidity
contract ISettings settings
```

### alphaNumerator

```solidity
int32 alphaNumerator
```

### alphaDenominator

```solidity
int32 alphaDenominator
```

### Alpha

```solidity
event Alpha(int32 alphaNumerator, int32 alphaDenominator)
```

### Labor

```solidity
event Labor(bytes32 deploymentId, address indexer, uint256 amount, uint256 total)
```

### Collect

```solidity
event Collect(bytes32 deploymentId, address indexer, uint256 era, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

_update the settings._

### setAlpha

```solidity
function setAlpha(int32 _alphaNumerator, int32 _alphaDenominator) public
```

_Update the alpha for cobb-douglas function._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _alphaNumerator | int32 | int32. |
| _alphaDenominator | int32 | int32. |

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) public view returns (uint256, uint256)
```

_get the Pool reward by deploymentId, era and indexer. returns my labor and total reward._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| era | uint256 | uint256. |
| indexer | address | address. |

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

_Add Labor(reward) for current era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |
| amount | uint256 | uint256. the labor of services. |

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from previous era Pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### collect_era

```solidity
function collect_era(uint256 era, bytes32 deploymentId, address indexer) external
```

_Collect reward (stake) from era pool._

| Name | Type | Description |
| ---- | ---- | ----------- |
| era | uint256 |  |
| deploymentId | bytes32 | byte32. |
| indexer | address | address. |

### _collect

```solidity
function _collect(uint256 era, bytes32 deploymentId, address indexer) private
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external view returns (bool)
```

### _cobbDouglas

```solidity
function _cobbDouglas(uint256 reward, uint256 myLabor, uint256 myStake, uint256 totalStake) private view returns (uint256)
```

