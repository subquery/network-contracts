# Solidity API

## RewardsStaking

### settings

```solidity
contract ISettings settings
```

### pendingStakers

```solidity
mapping(address => mapping(uint256 => address)) pendingStakers
```

### pendingStakerNos

```solidity
mapping(address => mapping(address => uint256)) pendingStakerNos
```

### pendingStakeChangeLength

```solidity
mapping(address => uint256) pendingStakeChangeLength
```

### pendingCommissionRateChange

```solidity
mapping(address => uint256) pendingCommissionRateChange
```

### lastSettledEra

```solidity
mapping(address => uint256) lastSettledEra
```

### totalStakingAmount

```solidity
mapping(address => uint256) totalStakingAmount
```

### delegation

```solidity
mapping(address => mapping(address => uint256)) delegation
```

### commissionRates

```solidity
mapping(address => uint256) commissionRates
```

### StakeChanged

```solidity
event StakeChanged(address indexer, address staker, uint256 amount)
```

_Emitted when the stake amount change._

### ICRChanged

```solidity
event ICRChanged(address indexer, uint256 commissionRate)
```

_Emitted when the indexer commission rates change._

### SettledEraUpdated

```solidity
event SettledEraUpdated(address indexer, uint256 era)
```

_Emitted when lastSettledEra update._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### onlyStaking

```solidity
modifier onlyStaking()
```

### onStakeChange

```solidity
function onStakeChange(address _indexer, address _source) external
```

_Callback method of stake change, called by Staking contract when
Indexers or Delegators try to change their stake amount.
Update pending stake info stored in contract states with Staking contract,
and wait to apply at next Era.
New Indexer's first stake change need to apply immediately。
Last era's reward need to be collected before this can pass._

### onICRChange

```solidity
function onICRChange(address indexer, uint256 startEra) external
```

_Callback method of stake change, called by Staking contract when
Indexers try to change commitionRate.
Update commitionRate info stored in contract states with Staking contract,
and wait to apply at two Eras later.
Last era's reward need to be collected before this can pass._

### applyStakeChange

```solidity
function applyStakeChange(address indexer, address staker) external
```

_Apply the stake change and calaulate the new rewardDebt for staker._

### applyICRChange

```solidity
function applyICRChange(address indexer) external
```

_Apply the CommissionRate change and update the commissionRates stored in contract states._

### checkAndReflectSettlement

```solidity
function checkAndReflectSettlement(address indexer, uint256 lastClaimEra) public returns (bool)
```

_Check if the previous Era has been settled, also update lastSettledEra.
Require to be true when someone try to claimRewards() or onStakeChangeRequested()._

### _updateTotalStakingAmount

```solidity
function _updateTotalStakingAmount(contract IStaking staking, address indexer, uint256 lastClaimEra) private
```

_Update the totalStakingAmount of the indexer with the state from Staking contract.
Called when applyStakeChange or applyICRChange._

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | contract IStaking | Staking contract interface |
| indexer | address | Indexer address |
| lastClaimEra | uint256 |  |

### _getRewardsDistributer

```solidity
function _getRewardsDistributer() private returns (contract IRewardsDistributer)
```

_Get RewardsDistributer instant_

### _getCurrentEra

```solidity
function _getCurrentEra() private returns (uint256)
```

_Get current Era number from EraManager._

### _pendingStakeChange

```solidity
function _pendingStakeChange(address _indexer, address _staker) private view returns (bool)
```

_Check whether the indexer has pending stake changes for the staker._

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address indexer) public view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) public view returns (uint256)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) public view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address source, address indexer) public view returns (uint256)
```

### getCommissionRateChangedEra

```solidity
function getCommissionRateChangedEra(address indexer) public view returns (uint256)
```

### getPendingStakeChangeLength

```solidity
function getPendingStakeChangeLength(address indexer) public view returns (uint256)
```

### getPendingStaker

```solidity
function getPendingStaker(address indexer, uint256 i) public view returns (address)
```

