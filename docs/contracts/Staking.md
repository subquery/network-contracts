# Solidity API

## Staking

### settings

```solidity
contract ISettings settings
```

### indexerLeverageLimit

```solidity
uint256 indexerLeverageLimit
```

The ratio of total stake amount to indexer self stake amount to limit the
total delegation amount. Initial value is set to 10, which means the total
stake amount cannot exceed 10 times the indexer self stake amount.

### unbondFeeRate

```solidity
uint256 unbondFeeRate
```

### lockPeriod

```solidity
uint256 lockPeriod
```

### indexerLength

```solidity
uint256 indexerLength
```

### indexers

```solidity
mapping(uint256 => address) indexers
```

### indexerNo

```solidity
mapping(address => uint256) indexerNo
```

### totalStakingAmount

```solidity
mapping(address => struct StakingAmount) totalStakingAmount
```

### unbondingAmount

```solidity
mapping(address => mapping(uint256 => struct UnbondAmount)) unbondingAmount
```

### unbondingLength

```solidity
mapping(address => uint256) unbondingLength
```

### withdrawnLength

```solidity
mapping(address => uint256) withdrawnLength
```

### delegation

```solidity
mapping(address => mapping(address => struct StakingAmount)) delegation
```

### lockedAmount

```solidity
mapping(address => uint256) lockedAmount
```

### stakingIndexers

```solidity
mapping(address => mapping(uint256 => address)) stakingIndexers
```

### stakingIndexerNos

```solidity
mapping(address => mapping(address => uint256)) stakingIndexerNos
```

### commissionRates

```solidity
mapping(address => struct CommissionRate) commissionRates
```

### stakingIndexerLengths

```solidity
mapping(address => uint256) stakingIndexerLengths
```

### DelegationAdded

```solidity
event DelegationAdded(address source, address indexer, uint256 amount)
```

_Emitted when stake to an Indexer._

### DelegationRemoved

```solidity
event DelegationRemoved(address source, address indexer, uint256 amount)
```

_Emitted when unstake to an Indexer._

### UnbondRequested

```solidity
event UnbondRequested(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when request unbond._

### UnbondWithdrawn

```solidity
event UnbondWithdrawn(address source, uint256 amount, uint256 index)
```

_Emitted when request withdraw._

### UnbondCancelled

```solidity
event UnbondCancelled(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when delegtor cancel unbond request._

### SetCommissionRate

```solidity
event SetCommissionRate(address indexer, uint256 amount)
```

_Emitted when Indexer set their commissionRate._

### initialize

```solidity
function initialize(uint256 _lockPeriod, contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setLockPeriod

```solidity
function setLockPeriod(uint256 _lockPeriod) external
```

### setIndexerLeverageLimit

```solidity
function setIndexerLeverageLimit(uint256 _indexerLeverageLimit) external
```

### setUnbondFeeRateBP

```solidity
function setUnbondFeeRateBP(uint256 _unbondFeeRate) external
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

_Set initial commissionRate only called by indexerRegistry contract,
when indexer do registration. The commissionRate need to apply at once._

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

_Set commissionRate only called by Indexer.
The commissionRate need to apply at two Eras after._

### reflectEraUpdate

```solidity
function reflectEraUpdate(address _source, address _indexer) public
```

_when Era update if valueAfter is the effective value, swap it to valueAt,
so later on we can update valueAfter without change current value
require it idempotent._

### _reflectEraUpdate

```solidity
function _reflectEraUpdate(uint256 eraNumber, address _source, address _indexer) private
```

### _reflectStakingAmount

```solidity
function _reflectStakingAmount(uint256 eraNumber, struct StakingAmount stakeAmount) private
```

### _checkDelegateLimitation

```solidity
function _checkDelegateLimitation(address _indexer, uint256 _amount) private view
```

### _addDelegation

```solidity
function _addDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _delegateToIndexer

```solidity
function _delegateToIndexer(address _source, address _indexer, uint256 _amount) internal
```

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

_Indexers stake to themself.
The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry._

### delegate

```solidity
function delegate(address _indexer, uint256 _amount) external
```

_Delegator stake to Indexer, Indexer cannot call this._

### _removeDelegation

```solidity
function _removeDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _onDelegationChange

```solidity
function _onDelegationChange(address _source, address _indexer) internal
```

_When the delegation change nodify rewardsStaking to deal with the change._

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

_Allow delegator transfer their delegation from an indexer to another.
Indexer's self delegations are not allow to redelegate._

### _startUnbond

```solidity
function _startUnbond(address _source, address _indexer, uint256 _amount) internal
```

### cancelUnbonding

```solidity
function cancelUnbonding(uint256 unbondReqId) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

_Unstake Indexer's self delegation. When this is called by indexer,
the existential amount should be greater than minimum staking amount
If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer._

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

_Request a unbond from an indexer for specific amount._

### _withdrawARequest

```solidity
function _withdrawARequest(uint256 _index) internal
```

_Withdraw a single request.
burn the withdrawn fees and transfer the rest to delegator._

### widthdraw

```solidity
function widthdraw() external
```

_Withdraw max 10 mature unbond requests from an indexer.
Each withdraw need to exceed lockPeriod._

### _isEmptyDelegation

```solidity
function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool)
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
function getAfterDelegationAmount(address _source, address _indexer) external view returns (uint256)
```

### getUnbondingAmounts

```solidity
function getUnbondingAmounts(address _source) external view returns (struct UnbondAmount[])
```

## Staking

### settings

```solidity
contract ISettings settings
```

### indexerLeverageLimit

```solidity
uint256 indexerLeverageLimit
```

The ratio of total stake amount to indexer self stake amount to limit the
total delegation amount. Initial value is set to 10, which means the total
stake amount cannot exceed 10 times the indexer self stake amount.

### unbondFeeRate

```solidity
uint256 unbondFeeRate
```

### lockPeriod

```solidity
uint256 lockPeriod
```

### indexerLength

```solidity
uint256 indexerLength
```

### indexers

```solidity
mapping(uint256 => address) indexers
```

### indexerNo

```solidity
mapping(address => uint256) indexerNo
```

### totalStakingAmount

```solidity
mapping(address => struct StakingAmount) totalStakingAmount
```

### unbondingAmount

```solidity
mapping(address => mapping(uint256 => struct UnbondAmount)) unbondingAmount
```

### unbondingLength

```solidity
mapping(address => uint256) unbondingLength
```

### withdrawnLength

```solidity
mapping(address => uint256) withdrawnLength
```

### delegation

```solidity
mapping(address => mapping(address => struct StakingAmount)) delegation
```

### lockedAmount

```solidity
mapping(address => uint256) lockedAmount
```

### stakingIndexers

```solidity
mapping(address => mapping(uint256 => address)) stakingIndexers
```

### stakingIndexerNos

```solidity
mapping(address => mapping(address => uint256)) stakingIndexerNos
```

### commissionRates

```solidity
mapping(address => struct CommissionRate) commissionRates
```

### stakingIndexerLengths

```solidity
mapping(address => uint256) stakingIndexerLengths
```

### DelegationAdded

```solidity
event DelegationAdded(address source, address indexer, uint256 amount)
```

_Emitted when stake to an Indexer._

### DelegationRemoved

```solidity
event DelegationRemoved(address source, address indexer, uint256 amount)
```

_Emitted when unstake to an Indexer._

### UnbondRequested

```solidity
event UnbondRequested(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when request unbond._

### UnbondWithdrawn

```solidity
event UnbondWithdrawn(address source, uint256 amount, uint256 index)
```

_Emitted when request withdraw._

### UnbondCancelled

```solidity
event UnbondCancelled(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when delegtor cancel unbond request._

### SetCommissionRate

```solidity
event SetCommissionRate(address indexer, uint256 amount)
```

_Emitted when Indexer set their commissionRate._

### initialize

```solidity
function initialize(uint256 _lockPeriod, contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setLockPeriod

```solidity
function setLockPeriod(uint256 _lockPeriod) external
```

### setIndexerLeverageLimit

```solidity
function setIndexerLeverageLimit(uint256 _indexerLeverageLimit) external
```

### setUnbondFeeRateBP

```solidity
function setUnbondFeeRateBP(uint256 _unbondFeeRate) external
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

_Set initial commissionRate only called by indexerRegistry contract,
when indexer do registration. The commissionRate need to apply at once._

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

_Set commissionRate only called by Indexer.
The commissionRate need to apply at two Eras after._

### reflectEraUpdate

```solidity
function reflectEraUpdate(address _source, address _indexer) public
```

_when Era update if valueAfter is the effective value, swap it to valueAt,
so later on we can update valueAfter without change current value
require it idempotent._

### _reflectEraUpdate

```solidity
function _reflectEraUpdate(uint256 eraNumber, address _source, address _indexer) private
```

### _reflectStakingAmount

```solidity
function _reflectStakingAmount(uint256 eraNumber, struct StakingAmount stakeAmount) private
```

### _checkDelegateLimitation

```solidity
function _checkDelegateLimitation(address _indexer, uint256 _amount) private view
```

### _addDelegation

```solidity
function _addDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _delegateToIndexer

```solidity
function _delegateToIndexer(address _source, address _indexer, uint256 _amount) internal
```

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

_Indexers stake to themself.
The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry._

### delegate

```solidity
function delegate(address _indexer, uint256 _amount) external
```

_Delegator stake to Indexer, Indexer cannot call this._

### _removeDelegation

```solidity
function _removeDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _onDelegationChange

```solidity
function _onDelegationChange(address _source, address _indexer) internal
```

_When the delegation change nodify rewardsDistributer to deal with the change._

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

_Allow delegator transfer their delegation from an indexer to another.
Indexer's self delegations are not allow to redelegate._

### _startUnbond

```solidity
function _startUnbond(address _source, address _indexer, uint256 _amount) internal
```

### cancelUnbonding

```solidity
function cancelUnbonding(uint256 unbondReqId) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

_Unstake Indexer's self delegation. When this is called by indexer,
the existential amount should be greater than minimum staking amount
If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer._

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

_Request a unbond from an indexer for specific amount._

### _withdrawARequest

```solidity
function _withdrawARequest(uint256 _index) internal
```

_Withdraw a single request.
burn the withdrawn fees and transfer the rest to delegator._

### widthdraw

```solidity
function widthdraw() external
```

_Withdraw max 10 mature unbond requests from an indexer.
Each withdraw need to exceed lockPeriod._

### _isEmptyDelegation

```solidity
function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool)
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
function getAfterDelegationAmount(address _source, address _indexer) external view returns (uint256)
```

### getUnbondingAmounts

```solidity
function getUnbondingAmounts(address _source) external view returns (struct UnbondAmount[])
```

## Staking

### settings

```solidity
contract ISettings settings
```

### indexerLeverageLimit

```solidity
uint256 indexerLeverageLimit
```

The ratio of total stake amount to indexer self stake amount to limit the
total delegation amount. Initial value is set to 10, which means the total
stake amount cannot exceed 10 times the indexer self stake amount.

### unbondFeeRate

```solidity
uint256 unbondFeeRate
```

### lockPeriod

```solidity
uint256 lockPeriod
```

### indexerLength

```solidity
uint256 indexerLength
```

### indexers

```solidity
mapping(uint256 => address) indexers
```

### indexerNo

```solidity
mapping(address => uint256) indexerNo
```

### totalStakingAmount

```solidity
mapping(address => struct StakingAmount) totalStakingAmount
```

### unbondingAmount

```solidity
mapping(address => mapping(uint256 => struct UnbondAmount)) unbondingAmount
```

### unbondingLength

```solidity
mapping(address => uint256) unbondingLength
```

### withdrawnLength

```solidity
mapping(address => uint256) withdrawnLength
```

### delegation

```solidity
mapping(address => mapping(address => struct StakingAmount)) delegation
```

### lockedAmount

```solidity
mapping(address => uint256) lockedAmount
```

### stakingIndexers

```solidity
mapping(address => mapping(uint256 => address)) stakingIndexers
```

### stakingIndexerNos

```solidity
mapping(address => mapping(address => uint256)) stakingIndexerNos
```

### commissionRates

```solidity
mapping(address => struct CommissionRate) commissionRates
```

### stakingIndexerLengths

```solidity
mapping(address => uint256) stakingIndexerLengths
```

### DelegationAdded

```solidity
event DelegationAdded(address source, address indexer, uint256 amount)
```

_Emitted when stake to an Indexer._

### DelegationRemoved

```solidity
event DelegationRemoved(address source, address indexer, uint256 amount)
```

_Emitted when unstake to an Indexer._

### UnbondRequested

```solidity
event UnbondRequested(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when request unbond._

### UnbondWithdrawn

```solidity
event UnbondWithdrawn(address source, uint256 amount, uint256 index)
```

_Emitted when request withdraw._

### UnbondCancelled

```solidity
event UnbondCancelled(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when delegtor cancel unbond request._

### SetCommissionRate

```solidity
event SetCommissionRate(address indexer, uint256 amount)
```

_Emitted when Indexer set their commissionRate._

### initialize

```solidity
function initialize(uint256 _lockPeriod, contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setLockPeriod

```solidity
function setLockPeriod(uint256 _lockPeriod) external
```

### setIndexerLeverageLimit

```solidity
function setIndexerLeverageLimit(uint256 _indexerLeverageLimit) external
```

### setUnbondFeeRateBP

```solidity
function setUnbondFeeRateBP(uint256 _unbondFeeRate) external
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) external
```

_Set initial commissionRate only called by indexerRegistry contract,
when indexer do registration. The commissionRate need to apply at once._

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

_Set commissionRate only called by Indexer.
The commissionRate need to apply at two Eras after._

### reflectEraUpdate

```solidity
function reflectEraUpdate(address _source, address _indexer) public
```

_when Era update if valueAfter is the effective value, swap it to valueAt,
so later on we can update valueAfter without change current value
require it idempotent._

### _reflectEraUpdate

```solidity
function _reflectEraUpdate(uint256 eraNumber, address _source, address _indexer) private
```

### _reflectStakingAmount

```solidity
function _reflectStakingAmount(uint256 eraNumber, struct StakingAmount stakeAmount) private
```

### _checkDelegateLimitation

```solidity
function _checkDelegateLimitation(address _indexer, uint256 _amount) private view
```

### _addDelegation

```solidity
function _addDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _delegateToIndexer

```solidity
function _delegateToIndexer(address _source, address _indexer, uint256 _amount) internal
```

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

_Indexers stake to themself.
The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry._

### delegate

```solidity
function delegate(address _indexer, uint256 _amount) external
```

_Delegator stake to Indexer, Indexer cannot call this._

### _removeDelegation

```solidity
function _removeDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _onDelegationChange

```solidity
function _onDelegationChange(address _source, address _indexer) internal
```

_When the delegation change nodify rewardsDistributer to deal with the change._

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

_Allow delegator transfer their delegation from an indexer to another.
Indexer's self delegations are not allow to redelegate._

### _startUnbond

```solidity
function _startUnbond(address _source, address _indexer, uint256 _amount) internal
```

### cancelUnbonding

```solidity
function cancelUnbonding(uint256 unbondReqId) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

_Unstake Indexer's self delegation. When this is called by indexer,
the existential amount should be greater than minimum staking amount
If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer._

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

_Request a unbond from an indexer for specific amount._

### _withdrawARequest

```solidity
function _withdrawARequest(uint256 _index) internal
```

_Withdraw a single request.
burn the withdrawn fees and transfer the rest to delegator._

### widthdraw

```solidity
function widthdraw() external
```

_Withdraw max 10 mature unbond requests from an indexer.
Each withdraw need to exceed lockPeriod._

### _isEmptyDelegation

```solidity
function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool)
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
function getAfterDelegationAmount(address _source, address _indexer) external view returns (uint256)
```

### getUnbondingAmounts

```solidity
function getUnbondingAmounts(address _source) external view returns (struct UnbondAmount[])
```

## Staking

### StakingAmount

```solidity
struct StakingAmount {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

### UnbondAmount

```solidity
struct UnbondAmount {
  address indexer;
  uint256 amount;
  uint256 startTime;
}
```

### CommissionRate

```solidity
struct CommissionRate {
  uint256 era;
  uint256 valueAt;
  uint256 valueAfter;
}
```

### settings

```solidity
contract ISettings settings
```

### indexerLeverageLimit

```solidity
uint256 indexerLeverageLimit
```

The ratio of total stake amount to indexer self stake amount to limit the
total delegation amount. Initial value is set to 10, which means the total
stake amount cannot exceed 10 times the indexer self stake amount.

### unbondFeeRate

```solidity
uint256 unbondFeeRate
```

### lockPeriod

```solidity
uint256 lockPeriod
```

### indexerLength

```solidity
uint256 indexerLength
```

### indexers

```solidity
mapping(uint256 => address) indexers
```

### indexerNo

```solidity
mapping(address => uint256) indexerNo
```

### totalStakingAmount

```solidity
mapping(address => struct Staking.StakingAmount) totalStakingAmount
```

### unbondingAmount

```solidity
mapping(address => mapping(uint256 => struct Staking.UnbondAmount)) unbondingAmount
```

### unbondingLength

```solidity
mapping(address => uint256) unbondingLength
```

### withdrawnLength

```solidity
mapping(address => uint256) withdrawnLength
```

### delegation

```solidity
mapping(address => mapping(address => struct Staking.StakingAmount)) delegation
```

### stakingIndexers

```solidity
mapping(address => mapping(uint256 => address)) stakingIndexers
```

### stakingIndexerNos

```solidity
mapping(address => mapping(address => uint256)) stakingIndexerNos
```

### stakingIndexerLengths

```solidity
mapping(address => uint256) stakingIndexerLengths
```

### commissionRates

```solidity
mapping(address => struct Staking.CommissionRate) commissionRates
```

### DelegationAdded

```solidity
event DelegationAdded(address source, address indexer, uint256 amount)
```

_Emitted when stake to an Indexer._

### DelegationRemoved

```solidity
event DelegationRemoved(address source, address indexer, uint256 amount)
```

_Emitted when unstake to an Indexer._

### UnbondRequested

```solidity
event UnbondRequested(address source, address indexer, uint256 amount, uint256 index)
```

_Emitted when request unbond._

### UnbondWithdrawn

```solidity
event UnbondWithdrawn(address source, uint256 amount, uint256 index)
```

_Emitted when request withdraw._

### SetCommissionRate

```solidity
event SetCommissionRate(address indexer, uint256 amount)
```

_Emitted when Indexer set their commissionRate._

### initialize

```solidity
function initialize(uint256 _lockPeriod, contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setLockPeriod

```solidity
function setLockPeriod(uint256 _lockPeriod) external
```

### setIndexerLeverageLimit

```solidity
function setIndexerLeverageLimit(uint256 _indexerLeverageLimit) external
```

### setUnbondFeeRateBP

```solidity
function setUnbondFeeRateBP(uint256 _unbondFeeRate) external
```

### setInitialCommissionRate

```solidity
function setInitialCommissionRate(address indexer, uint256 rate) public
```

_Set initial commissionRate only called by indexerRegistry contract,
when indexer do registration. The commissionRate need to apply at once._

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) public
```

_Set commissionRate only called by Indexer.
The commissionRate need to apply at two Eras after._

### reflectEraUpdate

```solidity
function reflectEraUpdate(address _source, address _indexer) public
```

_when Era update if valueAfter is the effective value, swap it to valueAt,
so later on we can update valueAfter without change current value
require it idempotent._

### _reflectEraUpdate

```solidity
function _reflectEraUpdate(uint256 eraNumber, address _source, address _indexer) private
```

### _reflectStakingAmount

```solidity
function _reflectStakingAmount(uint256 eraNumber, struct Staking.StakingAmount stakeAmount) private
```

### _addDelegation

```solidity
function _addDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _delegateToIndexer

```solidity
function _delegateToIndexer(address _source, address _indexer, uint256 _amount) internal
```

### stake

```solidity
function stake(address _indexer, uint256 _amount) external
```

_Indexers stake to themself.
The caller can be either an existing indexer or IndexerRegistry contract. The staking change will be applied immediately if the caller is IndexerRegistry._

### delegate

```solidity
function delegate(address _indexer, uint256 _amount) external
```

_Delegator stake to Indexer, Indexer cannot call this._

### _removeDelegation

```solidity
function _removeDelegation(address _source, address _indexer, uint256 _amount) internal
```

### _onDelegationChange

```solidity
function _onDelegationChange(address _source, address _indexer) internal
```

_When the delegation change nodify rewardsDistributer to deal with the change._

### redelegate

```solidity
function redelegate(address from_indexer, address to_indexer, uint256 _amount) external
```

_Allow delegator transfer their delegation from an indexer to another.
Indexer's self delegations are not allow to redelegate._

### _startUnbond

```solidity
function _startUnbond(address _source, address _indexer, uint256 _amount) internal
```

### cancelUnbonding

```solidity
function cancelUnbonding(uint256 unbondReqId) external
```

### unstake

```solidity
function unstake(address _indexer, uint256 _amount) external
```

_Unstake Indexer's self delegation. When this is called by indexer,
the existential amount should be greater than minimum staking amount
If the caller is from IndexerRegistry, this function will unstake all the staking token for the indexer._

### undelegate

```solidity
function undelegate(address _indexer, uint256 _amount) external
```

_Request a unbond from an indexer for specific amount._

### _withdrawARequest

```solidity
function _withdrawARequest(uint256 _index) internal
```

_Withdraw a single request.
burn the withdrawn fees and transfer the rest to delegator._

### widthdraw

```solidity
function widthdraw() external
```

_Withdraw max 10 mature unbond requests from an indexer.
Each withdraw need to exceed lockPeriod._

### _isEmptyDelegation

```solidity
function _isEmptyDelegation(address _source, address _indexer) internal view returns (bool)
```

### _parseStakingAmount

```solidity
function _parseStakingAmount(struct Staking.StakingAmount amount) internal view returns (uint256)
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
function getDelegationAmount(address _source, address _indexer) external view returns (uint256)
```

### getStakingIndexersLength

```solidity
function getStakingIndexersLength(address _address) external view returns (uint256)
```

### getStakingAmount

```solidity
function getStakingAmount(address _source, address _indexer) external view returns (struct Staking.StakingAmount)
```

### getUnbondingAmount

```solidity
function getUnbondingAmount(address _source, uint256 _id) external view returns (struct Staking.UnbondAmount)
```

### getUnbondingAmounts

```solidity
function getUnbondingAmounts(address _source) external view returns (struct Staking.UnbondAmount[])
```

### getCommissionRate

```solidity
function getCommissionRate(address indexer) external view returns (uint256)
```

