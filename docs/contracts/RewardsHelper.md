# Solidity API

## RewardsHelper

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### batchApplyStakeChange

```solidity
function batchApplyStakeChange(address indexer, address[] stakers) public
```

_Apply a list of stakers' StakeChanges, call applyStakeChange one by one._

### batchClaim

```solidity
function batchClaim(address delegator, address[] indexers) public
```

### batchCollectAndDistributeRewards

```solidity
function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public
```

### indexerCatchup

```solidity
function indexerCatchup(address indexer) public
```

### batchCollectWithPool

```solidity
function batchCollectWithPool(address indexer, bytes32[] deployments) public
```

### getPendingStakers

```solidity
function getPendingStakers(address indexer) public view returns (address[])
```

### getRewardsAddTable

```solidity
function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

### getRewardsRemoveTable

```solidity
function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

## RewardsHelper

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### batchApplyStakeChange

```solidity
function batchApplyStakeChange(address indexer, address[] stakers) public
```

_Apply a list of stakers' StakeChanges, call applyStakeChange one by one._

### batchClaim

```solidity
function batchClaim(address delegator, address[] indexers) public
```

### batchCollectAndDistributeRewards

```solidity
function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public
```

### indexerCatchup

```solidity
function indexerCatchup(address indexer) public
```

### batchCollectWithPool

```solidity
function batchCollectWithPool(address indexer, bytes32[] deployments) public
```

### getPendingStakers

```solidity
function getPendingStakers(address indexer) public view returns (address[])
```

### getRewardsAddTable

```solidity
function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

### getRewardsRemoveTable

```solidity
function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

## RewardsHelper

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### batchApplyStakeChange

```solidity
function batchApplyStakeChange(address indexer, address[] stakers) public
```

_Apply a list of stakers' StakeChanges, call applyStakeChange one by one._

### batchClaim

```solidity
function batchClaim(address delegator, address[] indexers) public
```

### batchCollectAndDistributeRewards

```solidity
function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public
```

### updateIndexerStatus

```solidity
function updateIndexerStatus(address indexer) public
```

### batchCollectWithPool

```solidity
function batchCollectWithPool(address indexer, bytes32[] deployments) public
```

### getPendingStakers

```solidity
function getPendingStakers(address indexer) public view returns (address[])
```

### getRewardsAddTable

```solidity
function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

### getRewardsRemoveTable

```solidity
function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

## RewardsHelper

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### batchApplyStakeChange

```solidity
function batchApplyStakeChange(address indexer, address[] stakers) public
```

_Apply a list of stakers' StakeChanges, call applyStakeChange one by one._

### batchClaim

```solidity
function batchClaim(address delegator, address[] indexers) public
```

### batchCollectAndDistributeRewards

```solidity
function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public
```

### batchCollectWithPool

```solidity
function batchCollectWithPool(address indexer, bytes32[] deployments) public
```

### getPendingStakers

```solidity
function getPendingStakers(address indexer) public view returns (address[])
```

### getRewardsAddTable

```solidity
function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

### getRewardsRemoveTable

```solidity
function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

