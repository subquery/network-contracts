# Solidity API

## IndexerRewardInfo

```solidity
struct IndexerRewardInfo {
  uint256 accSQTPerStake;
  uint256 lastClaimEra;
  uint256 eraReward;
}
```

## IRewardsDistributer

### setLastClaimEra

```solidity
function setLastClaimEra(address indexer, uint256 era) external
```

### setRewardDebt

```solidity
function setRewardDebt(address indexer, address delegator, uint256 amount) external
```

### resetEraReward

```solidity
function resetEraReward(address indexer, uint256 era) external
```

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) external
```

### collectAndDistributeEraRewards

```solidity
function collectAndDistributeEraRewards(uint256 era, address indexer) external returns (uint256)
```

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external
```

### claim

```solidity
function claim(address indexer) external
```

### claimFrom

```solidity
function claimFrom(address indexer, address user) external returns (uint256)
```

### userRewards

```solidity
function userRewards(address indexer, address user) external view returns (uint256)
```

### getRewardInfo

```solidity
function getRewardInfo(address indexer) external view returns (struct IndexerRewardInfo)
```

## IRewardsDistributer

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) external
```

### onStakeChange

```solidity
function onStakeChange(address indexer, address user) external
```

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external
```

### claim

```solidity
function claim(address indexer) external
```

### userRewards

```solidity
function userRewards(address indexer, address user) external view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

## IRewardsDistributer

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) external
```

### onStakeChange

```solidity
function onStakeChange(address indexer, address user) external
```

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### claim

```solidity
function claim(address indexer) external
```

### userRewards

```solidity
function userRewards(address indexer, address user) external view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

## IRewardsDistributer

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) external
```

### onStakeChange

```solidity
function onStakeChange(address indexer, address user) external
```

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### claim

```solidity
function claim(address indexer) external
```

### userRewards

```solidity
function userRewards(address indexer, address user) external view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

## IRewardsDistributer

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) external
```

### onStakeChange

```solidity
function onStakeChange(address indexer, address user) external
```

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(address indexer, address agreementContract) external
```

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### claim

```solidity
function claim(address indexer) external
```

### userRewards

```solidity
function userRewards(address indexer, address user) external view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) external view returns (uint256)
```

