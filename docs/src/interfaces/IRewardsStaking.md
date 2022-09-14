# Solidity API

## IRewardsStaking

### onStakeChange

```solidity
function onStakeChange(address indexer, address user) external
```

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

### applyStakeChange

```solidity
function applyStakeChange(address indexer, address staker) external
```

### applyICRChange

```solidity
function applyICRChange(address indexer) external
```

### checkAndReflectSettlement

```solidity
function checkAndReflectSettlement(address indexer, uint256 lastClaimEra) external returns (bool)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) external view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address source, address indexer) external view returns (uint256)
```

