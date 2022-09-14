# Solidity API

## StakingAmount

```solidity
struct StakingAmount {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## CommissionRate

```solidity
struct CommissionRate {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## UnbondAmount

```solidity
struct UnbondAmount {
  address indexer;
  uint256 amount;
  uint256 startTime;
}
```

## IStaking

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

### delegate

```solidity
function delegate(address _delegator, uint256 _amount) external
```

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

### widthdraw

```solidity
function widthdraw() external
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

### getAfterDelegationAmount

```solidity
function getAfterDelegationAmount(address _delegator, address _indexer) external view returns (uint256)
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### lockedAmount

```solidity
function lockedAmount(address _delegator) external view returns (uint256)
```

## StakingAmount

```solidity
struct StakingAmount {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## CommissionRate

```solidity
struct CommissionRate {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## UnbondAmount

```solidity
struct UnbondAmount {
  address indexer;
  uint256 amount;
  uint256 startTime;
}
```

## IStaking

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

### delegate

```solidity
function delegate(address _delegator, uint256 _amount) external
```

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

### widthdraw

```solidity
function widthdraw() external
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

### getAfterDelegationAmount

```solidity
function getAfterDelegationAmount(address _delegator, address _indexer) external view returns (uint256)
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### lockedAmount

```solidity
function lockedAmount(address _delegator) external view returns (uint256)
```

## StakingAmount

```solidity
struct StakingAmount {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## CommissionRate

```solidity
struct CommissionRate {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## UnbondAmount

```solidity
struct UnbondAmount {
  address indexer;
  uint256 amount;
  uint256 startTime;
}
```

## IStaking

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

### delegate

```solidity
function delegate(address _delegator, uint256 _amount) external
```

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

### widthdraw

```solidity
function widthdraw() external
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

### getAfterDelegationAmount

```solidity
function getAfterDelegationAmount(address _delegator, address _indexer) external view returns (uint256)
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### lockedAmount

```solidity
function lockedAmount(address _delegator) external view returns (uint256)
```

## StakingAmount

```solidity
struct StakingAmount {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## CommissionRate

```solidity
struct CommissionRate {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

## UnbondAmount

```solidity
struct UnbondAmount {
  address indexer;
  uint256 amount;
  uint256 startTime;
}
```

## IStaking

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

### delegate

```solidity
function delegate(address _delegator, uint256 _amount) external
```

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

### widthdraw

```solidity
function widthdraw() external
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

### getAfterDelegationAmount

```solidity
function getAfterDelegationAmount(address _delegator, address _indexer) external view returns (uint256)
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### lockedAmount

```solidity
function lockedAmount(address _delegator) external view returns (uint256)
```

## IStaking

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

### delegate

```solidity
function delegate(address _delegator, uint256 _amount) external
```

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

### widthdraw

```solidity
function widthdraw() external
```

### getTotalEffectiveStake

```solidity
function getTotalEffectiveStake(address _indexer) external view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address _delegator, address _indexer) external view returns (uint256)
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

