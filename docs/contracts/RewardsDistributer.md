# Solidity API

## RewardsDistributer

### RewardInfo

```solidity
struct RewardInfo {
  uint256 accSQTPerStake;
  mapping(address => uint256) rewardDebt;
  uint256 lastClaimEra;
  uint256 eraReward;
  mapping(uint256 => uint256) eraRewardAddTable;
  mapping(uint256 => uint256) eraRewardRemoveTable;
}
```

### settings

```solidity
contract ISettings settings
```

### info

```solidity
mapping(address => struct RewardsDistributer.RewardInfo) info
```

### DistributeRewards

```solidity
event DistributeRewards(address indexer, uint256 eraIdx, uint256 rewards)
```

_Emitted when rewards are distributed for the earliest pending distributed Era._

### ClaimRewards

```solidity
event ClaimRewards(address indexer, address delegator, uint256 rewards)
```

_Emitted when user claimed rewards._

### RewardsChanged

```solidity
event RewardsChanged(address indexer, uint256 eraIdx, uint256 additions, uint256 removals)
```

_Emitted when the rewards change, such as when rewards coming from new agreement._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### onlyRewardsStaking

```solidity
modifier onlyRewardsStaking()
```

### setLastClaimEra

```solidity
function setLastClaimEra(address indexer, uint256 era) external
```

_Initialize the indexer first last claim era.
Only RewardsStaking can call._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address |
| era | uint256 | uint256 |

### setRewardDebt

```solidity
function setRewardDebt(address indexer, address delegator, uint256 amount) external
```

_Update delegator debt in rewards.
Only RewardsStaking can call._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address |
| delegator | address | address |
| amount | uint256 | uint256 |

### resetEraReward

```solidity
function resetEraReward(address indexer, uint256 era) external
```

_Reset era reward.
Only RewardsStaking can call._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address |
| era | uint256 | uint256 |

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

_Split rewards from agreemrnt into Eras:
Rewards split into one era;
Rewards split into two eras;
Rewards split into more then two eras handled by splitEraSpanMore;
Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
Only be called by ServiceAgreementRegistry contract when new agreement accepted._

| Name | Type | Description |
| ---- | ---- | ----------- |
| agreementId | uint256 | agreement Id |

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external
```

_Send rewards directly to the specified era.
Maybe RewardsPool call or others contracts._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | address |
| sender | address | address |
| amount | uint256 | uint256 |
| era | uint256 | uint256 |

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) public
```

_check if the current Era is claimed._

### collectAndDistributeEraRewards

```solidity
function collectAndDistributeEraRewards(uint256 currentEra, address indexer) public returns (uint256)
```

_Calculate and distribute the rewards for the next Era of the lastClaimEra.
Calculate by eraRewardAddTable and eraRewardRemoveTable.
Distribute by distributeRewards method._

### claim

```solidity
function claim(address indexer) public
```

_Claim rewards of msg.sender for specific indexer._

### claimFrom

```solidity
function claimFrom(address indexer, address user) public returns (uint256)
```

_Claculate the Rewards for user and tranfrer token to user._

### _emitRewardsChangedEvent

```solidity
function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_extract for reuse emit RewardsChanged event_

### _getCurrentEra

```solidity
function _getCurrentEra() private returns (uint256)
```

_Get current Era number from EraManager._

### userRewards

```solidity
function userRewards(address indexer, address user) public view returns (uint256)
```

### getRewardInfo

```solidity
function getRewardInfo(address indexer) public view returns (struct IndexerRewardInfo)
```

### getRewardAddTable

```solidity
function getRewardAddTable(address indexer, uint256 era) public view returns (uint256)
```

### getRewardRemoveTable

```solidity
function getRewardRemoveTable(address indexer, uint256 era) public view returns (uint256)
```

## RewardsDistributer

### RewardInfo

```solidity
struct RewardInfo {
  uint256 accSQTPerStake;
  mapping(address => uint256) rewardDebt;
  uint256 lastClaimEra;
  uint256 eraReward;
  mapping(uint256 => uint256) eraRewardAddTable;
  mapping(uint256 => uint256) eraRewardRemoveTable;
}
```

### IndexerRewardInfo

```solidity
struct IndexerRewardInfo {
  uint256 accSQTPerStake;
  uint256 lastClaimEra;
  uint256 eraReward;
}
```

### settings

```solidity
contract ISettings settings
```

### info

```solidity
mapping(address => struct RewardsDistributer.RewardInfo) info
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

### DistributeRewards

```solidity
event DistributeRewards(address indexer, uint256 eraIdx, uint256 rewards)
```

_Emitted when rewards are distributed for the earliest pending distributed Era._

### ClaimRewards

```solidity
event ClaimRewards(address indexer, address delegator, uint256 rewards)
```

_Emitted when user claimed rewards._

### RewardsChanged

```solidity
event RewardsChanged(address indexer, uint256 eraIdx, uint256 additions, uint256 removals)
```

_Emitted when the rewards change, such as when rewards coming from new agreement._

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

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

_Split rewards from agreemrnt into Eras:
Rewards split into one era;
Rewards split into two eras;
Rewards split into more then two eras handled by splitEraSpanMore;
Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
Only be called by ServiceAgreementRegistry contract when new agreement accepted._

| Name | Type | Description |
| ---- | ---- | ----------- |
| agreementId | uint256 | agreement Id |

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount, uint256 era) external
```

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) public
```

_check if the current Era is claimed._

### _collectAndDistributeRewards

```solidity
function _collectAndDistributeRewards(uint256 currentEra, address indexer) public returns (uint256)
```

_Calculate and distribute the rewards for the next Era of the lastClaimEra.
Calculate by eraRewardAddTable and eraRewardRemoveTable.
Distribute by distributeRewards method._

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
function applyStakeChange(address indexer, address staker) public
```

_Apply the stake change and calaulate the new rewardDebt for staker._

### applyICRChange

```solidity
function applyICRChange(address indexer) public
```

_Apply the CommissionRate change and update the commissionRates stored in contract states._

### claim

```solidity
function claim(address indexer) public
```

_Claim rewards of msg.sender for specific indexer._

### claimFrom

```solidity
function claimFrom(address indexer, address user) public returns (uint256)
```

_Claculate the Rewards for user and tranfrer token to user._

### _emitRewardsChangedEvent

```solidity
function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_extract for reuse emit RewardsChanged event_

### _updateTotalStakingAmount

```solidity
function _updateTotalStakingAmount(contract IStaking staking, address indexer, uint256 currentEra) private
```

_Update the totalStakingAmount of the indexer with the state from Staking contract.
Called when applyStakeChange or applyICRChange._

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | contract IStaking | Staking contract interface |
| indexer | address | Indexer address |
| currentEra | uint256 | Current Era number |

### _checkAndReflectSettlement

```solidity
function _checkAndReflectSettlement(uint256 currentEra, address indexer, uint256 lastClaimEra) private returns (bool)
```

_Check if the previous Era has been settled, also update lastSettledEra.
Require to be true when someone try to claimRewards() or onStakeChangeRequested()._

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

### userRewards

```solidity
function userRewards(address indexer, address user) public view returns (uint256)
```

### getRewardInfo

```solidity
function getRewardInfo(address indexer) public view returns (struct RewardsDistributer.IndexerRewardInfo)
```

### getRewardAddTable

```solidity
function getRewardAddTable(address indexer, uint256 era) public view returns (uint256)
```

### getRewardRemoveTable

```solidity
function getRewardRemoveTable(address indexer, uint256 era) public view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address indexer) public view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) public view returns (uint256)
```

### getCommissionRateChangedEra

```solidity
function getCommissionRateChangedEra(address indexer) public view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address source, address indexer) public view returns (uint256)
```

### getPendingStakeChangeLength

```solidity
function getPendingStakeChangeLength(address indexer) public view returns (uint256)
```

### getPendingStaker

```solidity
function getPendingStaker(address indexer, uint256 i) public view returns (address)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) public view returns (uint256)
```

## RewardsDistributer

### RewardInfo

```solidity
struct RewardInfo {
  uint256 accSQTPerStake;
  mapping(address => uint256) rewardDebt;
  uint256 lastClaimEra;
  uint256 eraReward;
  mapping(uint256 => uint256) eraRewardAddTable;
  mapping(uint256 => uint256) eraRewardRemoveTable;
}
```

### IndexerRewardInfo

```solidity
struct IndexerRewardInfo {
  uint256 accSQTPerStake;
  uint256 lastClaimEra;
  uint256 eraReward;
}
```

### settings

```solidity
contract ISettings settings
```

### info

```solidity
mapping(address => struct RewardsDistributer.RewardInfo) info
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

### DistributeRewards

```solidity
event DistributeRewards(address indexer, uint256 eraIdx, uint256 rewards)
```

_Emitted when rewards are distributed for the earliest pending distributed Era._

### ClaimRewards

```solidity
event ClaimRewards(address indexer, address delegator, uint256 rewards)
```

_Emitted when user claimed rewards._

### RewardsChanged

```solidity
event RewardsChanged(address indexer, uint256 eraIdx, uint256 additions, uint256 removals)
```

_Emitted when the rewards change, such as when rewards coming from new agreement._

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

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

_Split rewards from agreemrnt into Eras:
Rewards split into one era;
Rewards split into two eras;
Rewards split into more then two eras handled by splitEraSpanMore;
Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
Only be called by ServiceAgreementRegistry contract when new agreement accepted._

| Name | Type | Description |
| ---- | ---- | ----------- |
| agreementId | uint256 | agreement Id |

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) public
```

_check if the current Era is claimed._

### _collectAndDistributeRewards

```solidity
function _collectAndDistributeRewards(uint256 currentEra, address indexer) public returns (uint256)
```

_Calculate and distribute the rewards for the next Era of the lastClaimEra.
Calculate by eraRewardAddTable and eraRewardRemoveTable.
Distribute by distributeRewards method._

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
function applyStakeChange(address indexer, address staker) public
```

_Apply the stake change and calaulate the new rewardDebt for staker._

### applyICRChange

```solidity
function applyICRChange(address indexer) public
```

_Apply the CommissionRate change and update the commissionRates stored in contract states._

### claim

```solidity
function claim(address indexer) public
```

_Claim rewards of msg.sender for specific indexer._

### claimFrom

```solidity
function claimFrom(address indexer, address user) public returns (uint256)
```

_Claculate the Rewards for user and tranfrer token to user._

### _emitRewardsChangedEvent

```solidity
function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_extract for reuse emit RewardsChanged event_

### _updateTotalStakingAmount

```solidity
function _updateTotalStakingAmount(contract IStaking staking, address indexer, uint256 currentEra) private
```

_Update the totalStakingAmount of the indexer with the state from Staking contract.
Called when applyStakeChange or applyICRChange._

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | contract IStaking | Staking contract interface |
| indexer | address | Indexer address |
| currentEra | uint256 | Current Era number |

### _checkAndReflectSettlement

```solidity
function _checkAndReflectSettlement(uint256 currentEra, address indexer, uint256 lastClaimEra) private returns (bool)
```

_Check if the previous Era has been settled, also update lastSettledEra.
Require to be true when someone try to claimRewards() or onStakeChangeRequested()._

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

### userRewards

```solidity
function userRewards(address indexer, address user) public view returns (uint256)
```

### getRewardInfo

```solidity
function getRewardInfo(address indexer) public view returns (struct RewardsDistributer.IndexerRewardInfo)
```

### getRewardAddTable

```solidity
function getRewardAddTable(address indexer, uint256 era) public view returns (uint256)
```

### getRewardRemoveTable

```solidity
function getRewardRemoveTable(address indexer, uint256 era) public view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address indexer) public view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) public view returns (uint256)
```

### getCommissionRateChangedEra

```solidity
function getCommissionRateChangedEra(address indexer) public view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address source, address indexer) public view returns (uint256)
```

### getPendingStakeChangeLength

```solidity
function getPendingStakeChangeLength(address indexer) public view returns (uint256)
```

### getPendingStaker

```solidity
function getPendingStaker(address indexer, uint256 i) public view returns (address)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) public view returns (uint256)
```

## RewardsDistributer

### RewardInfo

```solidity
struct RewardInfo {
  uint256 accSQTPerStake;
  mapping(address => uint256) rewardDebt;
  uint256 lastClaimEra;
  uint256 eraReward;
  mapping(uint256 => uint256) eraRewardAddTable;
  mapping(uint256 => uint256) eraRewardRemoveTable;
}
```

### IndexerRewardInfo

```solidity
struct IndexerRewardInfo {
  uint256 accSQTPerStake;
  uint256 lastClaimEra;
  uint256 eraReward;
}
```

### settings

```solidity
contract ISettings settings
```

### info

```solidity
mapping(address => struct RewardsDistributer.RewardInfo) info
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

### DistributeRewards

```solidity
event DistributeRewards(address indexer, uint256 eraIdx, uint256 rewards)
```

_Emitted when rewards are distributed for the earliest pending distributed Era._

### ClaimRewards

```solidity
event ClaimRewards(address indexer, address delegator, uint256 rewards)
```

_Emitted when user claimed rewards._

### RewardsChanged

```solidity
event RewardsChanged(address indexer, uint256 eraIdx, uint256 additions, uint256 removals)
```

_Emitted when the rewards change, such as when rewards coming from new agreement._

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

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(uint256 agreementId) external
```

_Split rewards from agreemrnt into Eras:
Rewards split into one era;
Rewards split into two eras;
Rewards split into more then two eras handled by splitEraSpanMore;
Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
Only be called by ServiceAgreementRegistry contract when new agreement accepted._

| Name | Type | Description |
| ---- | ---- | ----------- |
| agreementId | uint256 | agreement Id |

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) public
```

_check if the current Era is claimed._

### _collectAndDistributeRewards

```solidity
function _collectAndDistributeRewards(uint256 currentEra, address indexer) public returns (uint256)
```

_Calculate and distribute the rewards for the next Era of the lastClaimEra.
Calculate by eraRewardAddTable and eraRewardRemoveTable.
Distribute by distributeRewards method._

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
function applyStakeChange(address indexer, address staker) public
```

_Apply the stake change and calaulate the new rewardDebt for staker._

### applyICRChange

```solidity
function applyICRChange(address indexer) public
```

_Apply the CommissionRate change and update the commissionRates stored in contract states._

### claim

```solidity
function claim(address indexer) public
```

_Claim rewards of msg.sender for specific indexer._

### claimFrom

```solidity
function claimFrom(address indexer, address user) public returns (uint256)
```

_Claculate the Rewards for user and tranfrer token to user._

### _emitRewardsChangedEvent

```solidity
function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_extract for reuse emit RewardsChanged event_

### _updateTotalStakingAmount

```solidity
function _updateTotalStakingAmount(contract IStaking staking, address indexer, uint256 currentEra) private
```

_Update the totalStakingAmount of the indexer with the state from Staking contract.
Called when applyStakeChange or applyICRChange._

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | contract IStaking | Staking contract interface |
| indexer | address | Indexer address |
| currentEra | uint256 | Current Era number |

### _checkAndReflectSettlement

```solidity
function _checkAndReflectSettlement(uint256 currentEra, address indexer, uint256 lastClaimEra) private returns (bool)
```

_Check if the previous Era has been settled, also update lastSettledEra.
Require to be true when someone try to claimRewards() or onStakeChangeRequested()._

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

### userRewards

```solidity
function userRewards(address indexer, address user) public view returns (uint256)
```

### getRewardInfo

```solidity
function getRewardInfo(address indexer) public view returns (struct RewardsDistributer.IndexerRewardInfo)
```

### getRewardAddTable

```solidity
function getRewardAddTable(address indexer, uint256 era) public view returns (uint256)
```

### getRewardRemoveTable

```solidity
function getRewardRemoveTable(address indexer, uint256 era) public view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address indexer) public view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) public view returns (uint256)
```

### getCommissionRateChangedEra

```solidity
function getCommissionRateChangedEra(address indexer) public view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address source, address indexer) public view returns (uint256)
```

### getPendingStakeChangeLength

```solidity
function getPendingStakeChangeLength(address indexer) public view returns (uint256)
```

### getPendingStaker

```solidity
function getPendingStaker(address indexer, uint256 i) public view returns (address)
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) public view returns (uint256)
```

## RewardsDistributer

### RewardInfo

```solidity
struct RewardInfo {
  uint256 accSQTPerStake;
  mapping(address => uint256) rewardDebt;
  uint256 lastClaimEra;
  uint256 eraReward;
  mapping(uint256 => uint256) eraRewardAddTable;
  mapping(uint256 => uint256) eraRewardRemoveTable;
}
```

### settings

```solidity
contract ISettings settings
```

### info

```solidity
mapping(address => struct RewardsDistributer.RewardInfo) info
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

### DistributeRewards

```solidity
event DistributeRewards(address indexer, uint256 eraIdx)
```

_Emitted when rewards are distributed for the earliest pending distributed Era._

### ClaimRewards

```solidity
event ClaimRewards(address indexer, address delegator, uint256 rewards)
```

_Emitted when user claimed rewards._

### RewardsChanged

```solidity
event RewardsChanged(address indexer, uint256 eraIdx, uint256 additions, uint256 removals)
```

_Emitted when the rewards change, such as when rewards coming from new agreement._

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

### _emitRewardsChangedEvent

```solidity
function _emitRewardsChangedEvent(address indexer, uint256 eraNumber, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_extract for reuse emit RewardsChanged event_

### distributeRewards

```solidity
function distributeRewards(address indexer, uint256 reward) private
```

_Send the commission of the rewards to the indexer directly. Calculate and update
the accSQTPerStake of the Indexer._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | Indexer address |
| reward | uint256 | Rewards amount |

### _updateTotalStakingAmount

```solidity
function _updateTotalStakingAmount(contract IStaking staking, address indexer, uint256 currentEra) private
```

_Update the totalStakingAmount of the indexer with the state from Staking contract.
Called when applyStakeChange or applyICRChange._

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | contract IStaking | Staking contract interface |
| indexer | address | Indexer address |
| currentEra | uint256 | Current Era number |

### increaseAgreementRewards

```solidity
function increaseAgreementRewards(address indexer, address agreementContract) external
```

_Split rewards from agreemrnt into Eras:
Rewards split into one era;
Rewards split into two eras;
Rewards split into more then two eras handled by splitEraSpanMore;
Use eraRewardAddTable and eraRewardRemoveTable to store and track reward split info at RewardInfo.
Only be called by ServiceAgreementRegistry contract when new agreement accepted._

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexer | address | indexer adress |
| agreementContract | address | serviceAgreement address |

### addInstantRewards

```solidity
function addInstantRewards(address indexer, address sender, uint256 amount) external
```

### splitEraSpanMore

```solidity
function splitEraSpanMore(uint256 firstEraPortion, uint256 agreementValue, uint256 agreementPeriod, uint256 agreementStartEra, uint256 eraPeriod, struct RewardsDistributer.RewardInfo rewardInfo) private
```

_Handle split rewards into more then two Eras,
private method called by increaseAgreementRewards._

### collectAndDistributeRewards

```solidity
function collectAndDistributeRewards(address indexer) public
```

_check if the current Era is claimed._

### batchCollectAndDistributeRewards

```solidity
function batchCollectAndDistributeRewards(address indexer, uint256 batchSize) public
```

_collect and distribute rewards with specific indexer and batch size_

### _collectAndDistributeRewards

```solidity
function _collectAndDistributeRewards(uint256 currentEra, address indexer) private returns (uint256)
```

_Calculate and distribute the rewards for the next Era of the lastClaimEra.
Calculate by eraRewardAddTable and eraRewardRemoveTable.
Distribute by distributeRewards method._

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

### applyStakeChanges

```solidity
function applyStakeChanges(address indexer, address[] stakers) public
```

_Apply a list of stakers' StakeChanges, call applyStakeChange one by one._

### applyStakeChange

```solidity
function applyStakeChange(address indexer, address staker) public
```

_Apply the stake change and calaulate the new rewardDebt for staker._

### applyICRChange

```solidity
function applyICRChange(address indexer) public
```

_Apply the CommissionRate change and update the commissionRates stored in contract states._

### claim

```solidity
function claim(address indexer) public
```

_Claim rewards of msg.sender for specific indexer._

### _claim

```solidity
function _claim(address indexer, address user) internal returns (uint256)
```

_Claculate the Rewards for user and tranfrer token to user._

### userRewards

```solidity
function userRewards(address indexer, address user) public view returns (uint256)
```

_Use F1 Fee Distribution to calculate user rewards._

### checkAndReflectSettlement

```solidity
function checkAndReflectSettlement(uint256 currentEra, address indexer, uint256 lastClaimEra) private returns (bool)
```

_Check if the previous Era has been settled, also update lastSettledEra.
Require to be true when someone try to claimRewards() or onStakeChangeRequested()._

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

### _removePendingStake

```solidity
function _removePendingStake(address _indexer, address _staker) private
```

_Remove the pending stake change of the staker._

### getAccSQTPerStake

```solidity
function getAccSQTPerStake(address indexer) public view returns (uint256)
```

### getRewardDebt

```solidity
function getRewardDebt(address indexer, address staker) public view returns (uint256)
```

### getLastClaimEra

```solidity
function getLastClaimEra(address indexer) public view returns (uint256)
```

### getLastSettledEra

```solidity
function getLastSettledEra(address indexer) public view returns (uint256)
```

### getCommissionRateChangedEra

```solidity
function getCommissionRateChangedEra(address indexer) public view returns (uint256)
```

### getPendingStakers

```solidity
function getPendingStakers(address indexer) public view returns (address[])
```

### getEraReward

```solidity
function getEraReward(address indexer) public view returns (uint256)
```

### getTotalStakingAmount

```solidity
function getTotalStakingAmount(address _indexer) public view returns (uint256)
```

### getDelegationAmount

```solidity
function getDelegationAmount(address _source, address _indexer) public view returns (uint256)
```

### getRewardsAddTable

```solidity
function getRewardsAddTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

### getRewardsRemoveTable

```solidity
function getRewardsRemoveTable(address indexer, uint256 startEra, uint256 length) public view returns (uint256[])
```

