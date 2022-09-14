# Solidity API

## Constants

### PER_MILL

```solidity
uint256 PER_MILL
```

### PER_BILL

```solidity
uint256 PER_BILL
```

### PER_TRILL

```solidity
uint256 PER_TRILL
```

### ZERO_ADDRESS

```solidity
address ZERO_ADDRESS
```

## EraManager

_Produce epochs based on a period to coordinate contracts_

### settings

```solidity
contract ISettings settings
```

### eraPeriod

```solidity
uint256 eraPeriod
```

### eraNumber

```solidity
uint256 eraNumber
```

### eraStartTime

```solidity
uint256 eraStartTime
```

### EraPeriodUpdate

```solidity
event EraPeriodUpdate(uint256 era, uint256 eraPeriod)
```

### NewEraStart

```solidity
event NewEraStart(uint256 era, address caller)
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _eraPeriod) external
```

### startNewEra

```solidity
function startNewEra() public
```

_Start a new era if time already passed - anyone can call it_

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

### updateEraPeriod

```solidity
function updateEraPeriod(uint256 newEraPeriod) external
```

_Update era period - only admin can call it_

## IndexerRegistry

_## Overview
The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers.
It also provide the entry for Indexers to register, unregister, and config their metedata.

 ## Terminology
Indexer metadata -- The metadata of Indexer stored on IPFS include Indexer nickname, service endpoint...

## Detail
Each Indexer has two accounts:
Main Account:
 The main account is stored in the indexer’s own wallet.
 The indexer can use the main account to make the following actions:
     - staking/unstaking
     - register/unregisterIndexer
     - set/remove a controller account
     - start an indexing for a query project with specific controller account

Controller Account:
 The controller account is set by the main account which can execute some
 actions on the behalf of the main account.
 These actions include:
     - reporting / updating the status of the indexing service on chain

Indexer must set a appropriate commission rate and stake enough SQT Token when registering.
Indexer need to make sure all the query projects with NOT INDEXING status before unregister._

### settings

```solidity
contract ISettings settings
```

### isIndexer

```solidity
mapping(address => bool) isIndexer
```

### metadataByIndexer

```solidity
mapping(address => bytes32) metadataByIndexer
```

### indexerToController

```solidity
mapping(address => address) indexerToController
```

### controllerToIndexer

```solidity
mapping(address => address) controllerToIndexer
```

### minimumStakingAmount

```solidity
uint256 minimumStakingAmount
```

### RegisterIndexer

```solidity
event RegisterIndexer(address indexer, uint256 amount, bytes32 metadata)
```

_Emitted when user register to an Indexer._

### UnregisterIndexer

```solidity
event UnregisterIndexer(address indexer)
```

_Emitted when user unregister to an Indexer._

### UpdateMetadata

```solidity
event UpdateMetadata(address indexer, bytes32 metadata)
```

_Emitted when Indexers update their Metadata._

### SetControllerAccount

```solidity
event SetControllerAccount(address indexer, address controller)
```

_Emitted when Indexer set the controller account._

### RemoveControllerAccount

```solidity
event RemoveControllerAccount(address indexer, address controller)
```

_Emitted when Indexer remove the controller account._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setminimumStakingAmount

```solidity
function setminimumStakingAmount(uint256 _amount) external
```

_set the Indexer minimum staking amount only by owner._

### registerIndexer

```solidity
function registerIndexer(uint256 _amount, bytes32 _metadata, uint256 _rate) external
```

_call to register to an Indexer, this function will interacte with
staking contract to handle the Indexer first stake and commission rate setup._

### unregisterIndexer

```solidity
function unregisterIndexer() external
```

_Indexer call to unregister, need to check no running indexing projects on this Indexer
from QueryRegistry contract.
This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after
unregister._

### updateMetadata

```solidity
function updateMetadata(bytes32 _metadata) external
```

_Indexers call to update their Metadata._

### setControllerAccount

```solidity
function setControllerAccount(address _controller) external
```

_Indexers call to set the controller account, since indexer only allowed to set one controller account,
 we need to remove the previous controller account._

### removeControllerAccount

```solidity
function removeControllerAccount() public
```

_Indexers call to remove the controller account.
need to remove both indexerToController and controllerToIndexer._

### isController

```solidity
function isController(address _address) external view returns (bool)
```

## InflationController

### settings

```solidity
contract ISettings settings
```

### inflationRate

```solidity
uint256 inflationRate
```

### inflationDestination

```solidity
address inflationDestination
```

### lastInflationTimestamp

```solidity
uint256 lastInflationTimestamp
```

### YEAR_SECONDS

```solidity
uint256 YEAR_SECONDS
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _inflationRate, address _inflationDestination) external
```

### setInflationRate

```solidity
function setInflationRate(uint256 _inflationRate) external
```

### setInflationDestination

```solidity
function setInflationDestination(address _inflationDestination) external
```

### mintInflatedTokens

```solidity
function mintInflatedTokens() external
```

### mintSQT

```solidity
function mintSQT(address _destination, uint256 _amount) external
```

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 pairOrderId;
  uint256 tokenGiveBalance;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _pairId, uint256 _tokenGiveBalance) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### createPairOrders

```solidity
function createPairOrders(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _tokenGiveBalance) public
```

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PlanManager

### Plan

```solidity
struct Plan {
  uint256 price;
  uint256 planTemplateId;
  bytes32 deploymentId;
  bool active;
}
```

### PlanTemplate

```solidity
struct PlanTemplate {
  uint256 period;
  uint256 dailyReqCap;
  uint256 rateLimit;
  bytes32 metadata;
  bool active;
}
```

### settings

```solidity
contract ISettings settings
```

### planTemplateIds

```solidity
uint256 planTemplateIds
```

### planTemplates

```solidity
mapping(uint256 => struct PlanManager.PlanTemplate) planTemplates
```

### nextPlanId

```solidity
mapping(address => uint256) nextPlanId
```

### plans

```solidity
mapping(address => mapping(uint256 => struct PlanManager.Plan)) plans
```

### planIds

```solidity
mapping(address => mapping(bytes32 => uint256[])) planIds
```

### indexerPlanLimit

```solidity
uint16 indexerPlanLimit
```

### PlanTemplateCreated

```solidity
event PlanTemplateCreated(uint256 planTemplateId)
```

_Emitted when owner create a PlanTemplate._

### PlanTemplateMetadataChanged

```solidity
event PlanTemplateMetadataChanged(uint256 planTemplateId, bytes32 metadata)
```

_Emitted when owner change the Metadata of a PlanTemplate._

### PlanTemplateStatusChanged

```solidity
event PlanTemplateStatusChanged(uint256 planTemplateId, bool active)
```

_Emitted when owner change the status of a PlanTemplate. active or not_

### PlanCreated

```solidity
event PlanCreated(address creator, bytes32 deploymentId, uint256 planTemplateId, uint256 planId, uint256 price)
```

_Emitted when Indexer create a Plan._

### PlanRemoved

```solidity
event PlanRemoved(address source, uint256 id, bytes32 deploymentId)
```

_Emitted when Indexer remove a Plan._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setIndexerPlanLimit

```solidity
function setIndexerPlanLimit(uint16 _indexerPlanLimit) external
```

### createPlanTemplate

```solidity
function createPlanTemplate(uint256 _period, uint256 _dailyReqCap, uint256 _rateLimit, bytes32 _metadata) external
```

_Allow Owner to create a PlanTemplate._

### updatePlanTemplateMetadata

```solidity
function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external
```

_Allow Owner to update the Metadata of a PlanTemplate._

### updatePlanTemplateStatus

```solidity
function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external
```

_Allow Owner to update the status of a PlanTemplate.
active or not_

### createPlan

```solidity
function createPlan(uint256 _price, uint256 _planTemplateId, bytes32 _deploymentId) external
```

_Allow Indexer to create a Plan basing on a specific plan template_

### removePlan

```solidity
function removePlan(uint256 _planId) external
```

_Allow Indexer to remove actived Plan._

### acceptPlan

```solidity
function acceptPlan(address _indexer, bytes32 _deploymentId, uint256 _planId) external
```

_Allow Consumer to accept a plan created by an indexer. Consumer transfer token to
ServiceAgreementRegistry contract and a service agreement will be created
when they accept the plan._

### templates

```solidity
function templates() external view returns (struct PlanManager.PlanTemplate[])
```

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## PurchaseOfferMarket

### PurchaseOffer

```solidity
struct PurchaseOffer {
  uint256 deposit;
  uint256 minimumAcceptHeight;
  uint256 planTemplateId;
  bytes32 deploymentId;
  uint256 expireDate;
  address consumer;
  bool active;
  uint16 limit;
  uint16 numAcceptedContracts;
}
```

### settings

```solidity
contract ISettings settings
```

### offers

```solidity
mapping(uint256 => struct PurchaseOfferMarket.PurchaseOffer) offers
```

### numOffers

```solidity
uint256 numOffers
```

### penaltyRate

```solidity
uint256 penaltyRate
```

### penaltyDestination

```solidity
address penaltyDestination
```

### acceptedOffer

```solidity
mapping(uint256 => mapping(address => bool)) acceptedOffer
```

### offerMmrRoot

```solidity
mapping(uint256 => mapping(address => bytes32)) offerMmrRoot
```

### PurchaseOfferCreated

```solidity
event PurchaseOfferCreated(address consumer, uint256 offerId, bytes32 deploymentId, uint256 planTemplateId, uint256 deposit, uint16 limit, uint256 minimumAcceptHeight, uint256 expireDate)
```

_Emitted when Consumer create a purchase offer_

### PurchaseOfferCancelled

```solidity
event PurchaseOfferCancelled(address creator, uint256 offerId, uint256 penalty)
```

_Emitted when Consumer cancel a purchase offer_

### OfferAccepted

```solidity
event OfferAccepted(address indexer, uint256 offerId, uint256 agreementId)
```

_Emitted when Indexer accept an offer_

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _penaltyRate, address _penaltyDestination) external
```

_Initialize this contract._

### setPenaltyRate

```solidity
function setPenaltyRate(uint256 _penaltyRate) external
```

_allow owner the set the Penalty Rate for cancel unexpired offer._

### setPenaltyDestination

```solidity
function setPenaltyDestination(address _penaltyDestination) external
```

_allow owner to set the Penalty Destination address.
All Penalty will transfer to this address, if penalty destination address is 0x00,
then burn the penalty_

### createPurchaseOffer

```solidity
function createPurchaseOffer(bytes32 _deploymentId, uint256 _planTemplateId, uint256 _deposit, uint16 _limit, uint256 _minimumAcceptHeight, uint256 _expireDate) external
```

_Allow Consumer to create a Purchase Offer._

### cancelPurchaseOffer

```solidity
function cancelPurchaseOffer(uint256 _offerId) external
```

_Allow Consumer to cancel their Purchase Offer.
Consumer transfer all tokens to this contract when they create the offer.
We will charge a Penalty to cancel unexpired Offer.
And the Penalty will transfer to a configured address.
If the address not configured, then we burn the Penalty._

### acceptPurchaseOffer

```solidity
function acceptPurchaseOffer(uint256 _offerId, bytes32 _mmrRoot) external
```

_Allow Indexer to accept the offer and make the service agreement.
The corresponding part of the money will transfer to serviceAgrementRegistry contract
and wait rewardDistributer contract take and distribute as long as Indexer accept the offer.
When Indexer accept the offer we need to ensure Indexer's deployment reaches the minimumAcceptHeight,
So we ask indexers to pass the latest mmr value when accepting the purchase offer,
and save this mmr value when agreement create._

### isExpired

```solidity
function isExpired(uint256 _offerId) public view returns (bool)
```

## QueryRegistry

### settings

```solidity
contract ISettings settings
```

### queryInfoIdsByOwner

```solidity
mapping(address => uint256[]) queryInfoIdsByOwner
```

### queryInfos

```solidity
mapping(uint256 => struct QueryRegistry.QueryInfo) queryInfos
```

### creatorWhitelist

```solidity
mapping(address => bool) creatorWhitelist
```

### nextQueryId

```solidity
uint256 nextQueryId
```

### offlineCalcThreshold

```solidity
uint256 offlineCalcThreshold
```

### creatorRestricted

```solidity
bool creatorRestricted
```

### deploymentStatusByIndexer

```solidity
mapping(bytes32 => mapping(address => struct QueryRegistry.IndexingStatus)) deploymentStatusByIndexer
```

### numberOfIndexingDeployments

```solidity
mapping(address => uint256) numberOfIndexingDeployments
```

### deploymentIds

```solidity
mapping(bytes32 => bool) deploymentIds
```

### QueryInfo

```solidity
struct QueryInfo {
  uint256 queryId;
  address owner;
  bytes32 latestVersion;
  bytes32 latestDeploymentId;
  bytes32 metadata;
}
```

### IndexingStatus

```solidity
struct IndexingStatus {
  bytes32 deploymentId;
  uint256 timestamp;
  uint256 blockHeight;
  enum IndexingServiceStatus status;
}
```

### CreateQuery

```solidity
event CreateQuery(uint256 queryId, address creator, bytes32 metadata, bytes32 deploymentId, bytes32 version)
```

_Emitted when query project created._

### UpdateQueryMetadata

```solidity
event UpdateQueryMetadata(address owner, uint256 queryId, bytes32 metadata)
```

_Emitted when the metadata of the query project updated._

### UpdateQueryDeployment

```solidity
event UpdateQueryDeployment(address owner, uint256 queryId, bytes32 deploymentId, bytes32 version)
```

_Emitted when the latestDeploymentId of the query project updated._

### StartIndexing

```solidity
event StartIndexing(address indexer, bytes32 deploymentId)
```

_Emitted when indexers start indexing._

### UpdateDeploymentStatus

```solidity
event UpdateDeploymentStatus(address indexer, bytes32 deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp)
```

_Emitted when indexers report their indexing Status_

### UpdateIndexingStatusToReady

```solidity
event UpdateIndexingStatusToReady(address indexer, bytes32 deploymentId)
```

_Emitted when indexers update their indexing Status to ready_

### StopIndexing

```solidity
event StopIndexing(address indexer, bytes32 deploymentId)
```

_Emitted when indexers stop indexing_

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setCreatorRestricted

```solidity
function setCreatorRestricted(bool _creatorRestricted) external
```

_set the mode to restrict or not 
restrict mode -- only permissioned accounts allowed to create query project_

### addCreator

```solidity
function addCreator(address creator) external
```

_set account to creator account that allow to create query project_

### removeCreator

```solidity
function removeCreator(address creator) external
```

_remove creator account_

### setOfflineCalcThreshold

```solidity
function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external
```

_set the threshold to calculate whether the indexer is offline_

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### onlyIndexerController

```solidity
modifier onlyIndexerController()
```

### onlyCreator

```solidity
modifier onlyCreator()
```

### canModifyStatus

```solidity
function canModifyStatus(struct QueryRegistry.IndexingStatus currentStatus, uint256 _timestamp) private view
```

_check if the IndexingStatus available to update ststus_

### canModifyBlockHeight

```solidity
function canModifyBlockHeight(struct QueryRegistry.IndexingStatus currentStatus, uint256 blockheight) private pure
```

_check if the IndexingStatus available to update BlockHeight_

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

_create a QueryProject, if in the restrict mode, only creator allowed to call this function_

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

_update the Metadata of a QueryProject, if in the restrict mode, only creator allowed call this function_

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

_update the deployment of a QueryProject, if in the restrict mode, only creator allowed call this function_

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

_Indexer start indexing with a specific deploymentId_

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

_Indexer update its indexing status to ready with a specific deploymentId_

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

_Indexer report its indexing status with a specific deploymentId_

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

_Indexer stop indexing with a specific deploymentId_

### queryInfoCountByOwner

```solidity
function queryInfoCountByOwner(address user) external view returns (uint256)
```

_the number of query projects create by the account_

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

_is the indexer available to indexing with a specific deploymentId_

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
```

_is the indexer offline on a specific deploymentId_

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

## ServiceAgreementRegistry

### settings

```solidity
contract ISettings settings
```

### nextServiceAgreementId

```solidity
uint256 nextServiceAgreementId
```

### closedServiceAgreements

```solidity
mapping(uint256 => struct ClosedServiceAgreementInfo) closedServiceAgreements
```

### closedServiceAgreementIds

```solidity
mapping(address => mapping(uint256 => uint256)) closedServiceAgreementIds
```

### indexerCsaLength

```solidity
mapping(address => uint256) indexerCsaLength
```

### indexerDeploymentCsaLength

```solidity
mapping(address => mapping(bytes32 => uint256)) indexerDeploymentCsaLength
```

### establisherWhitelist

```solidity
mapping(address => bool) establisherWhitelist
```

### sumDailyReward

```solidity
mapping(address => uint256) sumDailyReward
```

### consumerAuthAllows

```solidity
mapping(address => mapping(address => bool)) consumerAuthAllows
```

### threshold

```solidity
uint256 threshold
```

### SECONDS_IN_DAY

```solidity
uint256 SECONDS_IN_DAY
```

### ClosedAgreementCreated

```solidity
event ClosedAgreementCreated(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when closed service agreement established_

### ClosedAgreementRemoved

```solidity
event ClosedAgreementRemoved(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when expired closed service agreement removed._

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _threshold, address[] _whitelist) external
```

_Initialize this contract. Load establisherWhitelist._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setThreshold

```solidity
function setThreshold(uint256 _threshold) external
```

_We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
setting the value of threshold.
A smaller threshold value means that the Indexer can get higher sumDailyRewards with
a smaller totalStakedAmount，vice versa.
If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards._

### addUser

```solidity
function addUser(address consumer, address user) external
```

_Consumer add users can request access token from indexer.
We are using the statu `consumerAuthAllows` offchain._

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

_Consumer remove users can request access token from indexer._

### addEstablisher

```solidity
function addEstablisher(address establisher) external
```

### removeEstablisher

```solidity
function removeEstablisher(address establisher) external
```

### periodInDay

```solidity
function periodInDay(uint256 period) private pure returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

_Establish the generated service agreement.
For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
distribute these Token.
All agreements register to this contract through this method.
When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
at the same time, it also encourages Indexer to provide better more stable services._

### renewAgreement

```solidity
function renewAgreement(uint256 agreementId) external
```

_A function allow Consumer call to renew its unexpired closed service agreement.
We only allow the the agreement generated from PlanManager renewable which is created
by Indexer and accepted by Consumer. We use the status planId in agreement to determine
whether the agreement is renewable, since only the agreement generated from PlanManager
come with the PlanId.
Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
Consumer must renew befor the agreement expired._

### clearEndedAgreement

```solidity
function clearEndedAgreement(address indexer, uint256 id) public
```

### clearAllEndedAgreements

```solidity
function clearAllEndedAgreements(address indexer) public
```

### closedServiceAgreementExpired

```solidity
function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool)
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

## Settings

### sqToken

```solidity
address sqToken
```

### staking

```solidity
address staking
```

### indexerRegistry

```solidity
address indexerRegistry
```

### queryRegistry

```solidity
address queryRegistry
```

### eraManager

```solidity
address eraManager
```

### planManager

```solidity
address planManager
```

### serviceAgreementRegistry

```solidity
address serviceAgreementRegistry
```

### rewardsDistributer

```solidity
address rewardsDistributer
```

### rewardsPool

```solidity
address rewardsPool
```

### rewardsStaking

```solidity
address rewardsStaking
```

### rewardsHelper

```solidity
address rewardsHelper
```

### inflationController

```solidity
address inflationController
```

### vesting

```solidity
address vesting
```

### permissionedExchange

```solidity
address permissionedExchange
```

### constructor

```solidity
constructor() public
```

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsStaking, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsStaking

```solidity
function setRewardsStaking(address _rewardsStaking) external
```

### getRewardsStaking

```solidity
function getRewardsStaking() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## VSQToken

### _name

```solidity
string _name
```

### _symbol

```solidity
string _symbol
```

### _decimals

```solidity
uint8 _decimals
```

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### name

```solidity
function name() public view returns (string)
```

### symbol

```solidity
function symbol() public view returns (string)
```

### decimals

```solidity
function decimals() public pure returns (uint8)
```

### balanceOf

```solidity
function balanceOf(address account) public view returns (uint256)
```

## IConsumer

### signer

```solidity
function signer() external view returns (address)
```

### paid

```solidity
function paid(uint256 channelId, uint256 amount, bytes callback) external
```

### claimed

```solidity
function claimed(uint256 channelId, uint256 amount) external
```

## IEraManager

### eraStartTime

```solidity
function eraStartTime() external view returns (uint256)
```

### eraPeriod

```solidity
function eraPeriod() external view returns (uint256)
```

### eraNumber

```solidity
function eraNumber() external view returns (uint256)
```

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

## IIndexerRegistry

### isIndexer

```solidity
function isIndexer(address _address) external view returns (bool)
```

### isController

```solidity
function isController(address _address) external view returns (bool)
```

### controllerToIndexer

```solidity
function controllerToIndexer(address _address) external view returns (address)
```

### indexerToController

```solidity
function indexerToController(address _address) external view returns (address)
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### minimumStakingAmount

```solidity
function minimumStakingAmount() external view returns (uint256)
```

## IInflationController

### setInflationRate

```solidity
function setInflationRate(uint256 _inflationRateBP) external
```

### setInflationDestination

```solidity
function setInflationDestination(address _inflationDestination) external
```

### mintInflatedTokens

```solidity
function mintInflatedTokens() external
```

## IInflationDestination

### afterReceiveInflatedTokens

```solidity
function afterReceiveInflatedTokens(uint256 tokenAmount) external
```

## IPermissionedExchange

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

## IPlanManager

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## IPurchaseOfferMarket

### createPurchaseOffer

```solidity
function createPurchaseOffer(bytes32 _deploymentId, uint256 _planTemplateId, uint256 _deposit, uint16 _limit, uint256 _minimumAcceptHeight, uint256 _expireDate) external
```

### cancelPurchaseOffer

```solidity
function cancelPurchaseOffer(uint256 _offerId) external
```

### acceptPurchaseOffer

```solidity
function acceptPurchaseOffer(uint256 _offerId, bytes32 _mmrRoot) external
```

## IndexingServiceStatus

```solidity
enum IndexingServiceStatus {
  NOTINDEXING,
  INDEXING,
  READY
}
```

## IQueryRegistry

### numberOfIndexingDeployments

```solidity
function numberOfIndexingDeployments(address _address) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
```

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

## IRewardsPool

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) external returns (uint256, uint256)
```

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

### collectEra

```solidity
function collectEra(uint256 era, bytes32 deploymentId, address indexer) external
```

### batchCollectEra

```solidity
function batchCollectEra(uint256 era, address indexer) external
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external returns (bool)
```

### getUnclaimDeployments

```solidity
function getUnclaimDeployments(uint256 era, address indexer) external view returns (bytes32[])
```

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

## ISQToken

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### burn

```solidity
function burn(uint256 amount) external
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ISettings

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsStaking, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsStaking

```solidity
function setRewardsStaking(address _rewardsStaking) external
```

### getRewardsStaking

```solidity
function getRewardsStaking() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## IVesting

### allocations

```solidity
function allocations(address _account) external view returns (uint256)
```

### claimed

```solidity
function claimed(address _account) external view returns (uint256)
```

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

## MathUtil

### min

```solidity
function min(uint256 x, uint256 y) internal pure returns (uint256)
```

### divUp

```solidity
function divUp(uint256 x, uint256 y) internal pure returns (uint256)
```

### mulDiv

```solidity
function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256)
```

### sub

```solidity
function sub(uint256 x, uint256 y) internal pure returns (uint256)
```

## StakingUtil

### currentStaking

```solidity
function currentStaking(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

### currentCommission

```solidity
function currentCommission(struct CommissionRate rate, uint256 era) internal pure returns (uint256)
```

### currentDelegation

```solidity
function currentDelegation(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

## Constants

### PER_MILL

```solidity
uint256 PER_MILL
```

### PER_BILL

```solidity
uint256 PER_BILL
```

### PER_TRILL

```solidity
uint256 PER_TRILL
```

### ZERO_ADDRESS

```solidity
address ZERO_ADDRESS
```

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 pairOrderId;
  uint256 tokenGiveBalance;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _pairId, uint256 _tokenGiveBalance) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### createPairOrders

```solidity
function createPairOrders(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate, uint256 _tokenGiveBalance) public
```

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

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

## ServiceAgreementRegistry

### settings

```solidity
contract ISettings settings
```

### nextServiceAgreementId

```solidity
uint256 nextServiceAgreementId
```

### closedServiceAgreements

```solidity
mapping(uint256 => struct ClosedServiceAgreementInfo) closedServiceAgreements
```

### closedServiceAgreementIds

```solidity
mapping(address => mapping(uint256 => uint256)) closedServiceAgreementIds
```

### indexerCsaLength

```solidity
mapping(address => uint256) indexerCsaLength
```

### indexerDeploymentCsaLength

```solidity
mapping(address => mapping(bytes32 => uint256)) indexerDeploymentCsaLength
```

### establisherWhitelist

```solidity
mapping(address => bool) establisherWhitelist
```

### sumDailyReward

```solidity
mapping(address => uint256) sumDailyReward
```

### consumerAuthAllows

```solidity
mapping(address => mapping(address => bool)) consumerAuthAllows
```

### threshold

```solidity
uint256 threshold
```

### SECONDS_IN_DAY

```solidity
uint256 SECONDS_IN_DAY
```

### ClosedAgreementCreated

```solidity
event ClosedAgreementCreated(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when closed service agreement established_

### ClosedAgreementRemoved

```solidity
event ClosedAgreementRemoved(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when expired closed service agreement removed._

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _threshold, address[] _whitelist) external
```

_Initialize this contract. Load establisherWhitelist._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setThreshold

```solidity
function setThreshold(uint256 _threshold) external
```

_We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
setting the value of threshold.
A smaller threshold value means that the Indexer can get higher sumDailyRewards with
a smaller totalStakedAmount，vice versa.
If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards._

### addUser

```solidity
function addUser(address consumer, address user) external
```

_Consumer add users can request access token from indexer.
We are using the statu `consumerAuthAllows` offchain._

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

_Consumer remove users can request access token from indexer._

### addEstablisher

```solidity
function addEstablisher(address establisher) external
```

### removeEstablisher

```solidity
function removeEstablisher(address establisher) external
```

### periodInDay

```solidity
function periodInDay(uint256 period) private pure returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

_Establish the generated service agreement.
For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
distribute these Token.
All agreements register to this contract through this method.
When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
at the same time, it also encourages Indexer to provide better more stable services._

### renewAgreement

```solidity
function renewAgreement(uint256 agreementId) external
```

_A function allow Consumer call to renew its unexpired closed service agreement.
We only allow the the agreement generated from PlanManager renewable which is created
by Indexer and accepted by Consumer. We use the status planId in agreement to determine
whether the agreement is renewable, since only the agreement generated from PlanManager
come with the PlanId.
Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
Consumer must renew befor the agreement expired._

### clearEndedAgreement

```solidity
function clearEndedAgreement(address indexer, uint256 id) public
```

### clearAllEndedAgreements

```solidity
function clearAllEndedAgreements(address indexer) public
```

### closedServiceAgreementExpired

```solidity
function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool)
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
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

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## IConsumer

### signer

```solidity
function signer() external view returns (address)
```

### paid

```solidity
function paid(uint256 channelId, uint256 amount, bytes callback) external
```

### claimed

```solidity
function claimed(uint256 channelId, uint256 amount) external
```

## IEraManager

### eraStartTime

```solidity
function eraStartTime() external view returns (uint256)
```

### eraPeriod

```solidity
function eraPeriod() external view returns (uint256)
```

### eraNumber

```solidity
function eraNumber() external view returns (uint256)
```

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

## IIndexerRegistry

### isIndexer

```solidity
function isIndexer(address _address) external view returns (bool)
```

### isController

```solidity
function isController(address _address) external view returns (bool)
```

### controllerToIndexer

```solidity
function controllerToIndexer(address _address) external view returns (address)
```

### indexerToController

```solidity
function indexerToController(address _address) external view returns (address)
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### minimumStakingAmount

```solidity
function minimumStakingAmount() external view returns (uint256)
```

## IPermissionedExchange

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

## IPlanManager

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## IndexingServiceStatus

```solidity
enum IndexingServiceStatus {
  NOTINDEXING,
  INDEXING,
  READY
}
```

## IQueryRegistry

### numberOfIndexingDeployments

```solidity
function numberOfIndexingDeployments(address _address) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## IRewardsPool

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) external returns (uint256, uint256)
```

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

### collectEra

```solidity
function collectEra(uint256 era, bytes32 deploymentId, address indexer) external
```

### batchCollectEra

```solidity
function batchCollectEra(uint256 era, address indexer) external
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external returns (bool)
```

### getUnclaimDeployments

```solidity
function getUnclaimDeployments(uint256 era, address indexer) external view returns (bytes32[])
```

## ISQToken

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### burn

```solidity
function burn(uint256 amount) external
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ISettings

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

## MathUtil

### min

```solidity
function min(uint256 x, uint256 y) internal pure returns (uint256)
```

### divUp

```solidity
function divUp(uint256 x, uint256 y) internal pure returns (uint256)
```

### mulDiv

```solidity
function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256)
```

### sub

```solidity
function sub(uint256 x, uint256 y) internal pure returns (uint256)
```

## StakingUtil

### currentStaking

```solidity
function currentStaking(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

### currentCommission

```solidity
function currentCommission(struct CommissionRate rate, uint256 era) internal pure returns (uint256)
```

### currentDelegation

```solidity
function currentDelegation(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

## Constants

### PER_MILL

```solidity
uint256 PER_MILL
```

### PER_BILL

```solidity
uint256 PER_BILL
```

### PER_TRILL

```solidity
uint256 PER_TRILL
```

### ZERO_ADDRESS

```solidity
address ZERO_ADDRESS
```

## IndexerRegistry

_## Overview
The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers.
It also provide the entry for Indexers to register, unregister, and config their metedata.

 ## Terminology
Indexer metadata -- The metadata of Indexer stored on IPFS include Indexer nickname, service endpoint...

## Detail
Each Indexer has two accounts:
Main Account:
 The main account is stored in the indexer’s own wallet.
 The indexer can use the main account to make the following actions:
     - staking/unstaking
     - register/unregisterIndexer
     - set/remove a controller account
     - start an indexing for a query project with specific controller account

Controller Account:
 The controller account is set by the main account which can execute some
 actions on the behalf of the main account.
 These actions include:
     - reporting / updating the status of the indexing service on chain

Indexer must set a appropriate commission rate and stake enough SQT Token when registering.
Indexer need to make sure all the query projects with NOT INDEXING status before unregister._

### settings

```solidity
contract ISettings settings
```

### isIndexer

```solidity
mapping(address => bool) isIndexer
```

### metadataByIndexer

```solidity
mapping(address => bytes32) metadataByIndexer
```

### indexerToController

```solidity
mapping(address => address) indexerToController
```

### controllerToIndexer

```solidity
mapping(address => address) controllerToIndexer
```

### minimumStakingAmount

```solidity
uint256 minimumStakingAmount
```

### RegisterIndexer

```solidity
event RegisterIndexer(address indexer, uint256 amount, bytes32 metadata)
```

_Emitted when user register to an Indexer._

### UnregisterIndexer

```solidity
event UnregisterIndexer(address indexer)
```

_Emitted when user unregister to an Indexer._

### UpdateMetadata

```solidity
event UpdateMetadata(address indexer, bytes32 metadata)
```

_Emitted when Indexers update their Metadata._

### SetControllerAccount

```solidity
event SetControllerAccount(address indexer, address controller)
```

_Emitted when Indexer set the controller account._

### RemoveControllerAccount

```solidity
event RemoveControllerAccount(address indexer, address controller)
```

_Emitted when Indexer remove the controller account._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setminimumStakingAmount

```solidity
function setminimumStakingAmount(uint256 _amount) external
```

_set the Indexer minimum staking amount only by owner._

### registerIndexer

```solidity
function registerIndexer(uint256 _amount, bytes32 _metadata, uint256 _rate) external
```

_call to register to an Indexer, this function will interacte with
staking contract to handle the Indexer first stake and commission rate setup._

### unregisterIndexer

```solidity
function unregisterIndexer() external
```

_Indexer call to unregister, need to check no running indexing projects on this Indexer
from QueryRegistry contract.
This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after
unregister._

### updateMetadata

```solidity
function updateMetadata(bytes32 _metadata) external
```

_Indexers call to update their Metadata._

### setControllerAccount

```solidity
function setControllerAccount(address _controller) external
```

_Indexers call to set the controller account, since indexer only allowed to set one controller account,
 we need to remove the previous controller account._

### removeControllerAccount

```solidity
function removeControllerAccount() public
```

_Indexers call to remove the controller account.
need to remove both indexerToController and controllerToIndexer._

### isController

```solidity
function isController(address _address) external view returns (bool)
```

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### QuotaAdded

```solidity
event QuotaAdded(address token, address account, uint256 amount)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## QueryRegistry

### settings

```solidity
contract ISettings settings
```

### queryInfoIdsByOwner

```solidity
mapping(address => uint256[]) queryInfoIdsByOwner
```

### queryInfos

```solidity
mapping(uint256 => struct QueryRegistry.QueryInfo) queryInfos
```

### creatorWhitelist

```solidity
mapping(address => bool) creatorWhitelist
```

### nextQueryId

```solidity
uint256 nextQueryId
```

### offlineCalcThreshold

```solidity
uint256 offlineCalcThreshold
```

### creatorRestricted

```solidity
bool creatorRestricted
```

### deploymentStatusByIndexer

```solidity
mapping(bytes32 => mapping(address => struct QueryRegistry.IndexingStatus)) deploymentStatusByIndexer
```

### numberOfIndexingDeployments

```solidity
mapping(address => uint256) numberOfIndexingDeployments
```

### deploymentIds

```solidity
mapping(bytes32 => bool) deploymentIds
```

### QueryInfo

```solidity
struct QueryInfo {
  uint256 queryId;
  address owner;
  bytes32 latestVersion;
  bytes32 latestDeploymentId;
  bytes32 metadata;
}
```

### IndexingStatus

```solidity
struct IndexingStatus {
  bytes32 deploymentId;
  uint256 timestamp;
  uint256 blockHeight;
  enum IndexingServiceStatus status;
}
```

### CreateQuery

```solidity
event CreateQuery(uint256 queryId, address creator, bytes32 metadata, bytes32 deploymentId, bytes32 version)
```

_Emitted when query project created._

### UpdateQueryMetadata

```solidity
event UpdateQueryMetadata(address owner, uint256 queryId, bytes32 metadata)
```

_Emitted when the metadata of the query project updated._

### UpdateQueryDeployment

```solidity
event UpdateQueryDeployment(address owner, uint256 queryId, bytes32 deploymentId, bytes32 version)
```

_Emitted when the latestDeploymentId of the query project updated._

### StartIndexing

```solidity
event StartIndexing(address indexer, bytes32 deploymentId)
```

_Emitted when indexers start indexing._

### UpdateDeploymentStatus

```solidity
event UpdateDeploymentStatus(address indexer, bytes32 deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp)
```

_Emitted when indexers report their indexing Status_

### UpdateIndexingStatusToReady

```solidity
event UpdateIndexingStatusToReady(address indexer, bytes32 deploymentId)
```

_Emitted when indexers update their indexing Status to ready_

### StopIndexing

```solidity
event StopIndexing(address indexer, bytes32 deploymentId)
```

_Emitted when indexers stop indexing_

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setCreatorRestricted

```solidity
function setCreatorRestricted(bool _creatorRestricted) external
```

_set the mode to restrict or not 
restrict mode -- only permissioned accounts allowed to create query project_

### addCreator

```solidity
function addCreator(address creator) external
```

_set account to creator account that allow to create query project_

### removeCreator

```solidity
function removeCreator(address creator) external
```

_remove creator account_

### setOfflineCalcThreshold

```solidity
function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external
```

_set the threshold to calculate whether the indexer is offline_

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### onlyIndexerController

```solidity
modifier onlyIndexerController()
```

### onlyCreator

```solidity
modifier onlyCreator()
```

### canModifyStatus

```solidity
function canModifyStatus(struct QueryRegistry.IndexingStatus currentStatus, uint256 _timestamp) private view
```

_check if the IndexingStatus available to update ststus_

### canModifyBlockHeight

```solidity
function canModifyBlockHeight(struct QueryRegistry.IndexingStatus currentStatus, uint256 blockheight) private pure
```

_check if the IndexingStatus available to update BlockHeight_

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

_create a QueryProject, if in the restrict mode, only creator allowed to call this function_

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

_update the Metadata of a QueryProject, if in the restrict mode, only creator allowed call this function_

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

_update the deployment of a QueryProject, if in the restrict mode, only creator allowed call this function_

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

_Indexer start indexing with a specific deploymentId_

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

_Indexer update its indexing status to ready with a specific deploymentId_

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

_Indexer report its indexing status with a specific deploymentId_

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

_Indexer stop indexing with a specific deploymentId_

### queryInfoCountByOwner

```solidity
function queryInfoCountByOwner(address user) external view returns (uint256)
```

_the number of query projects create by the account_

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

_is the indexer available to indexing with a specific deploymentId_

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
```

_is the indexer offline on a specific deploymentId_

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

## ServiceAgreementRegistry

### settings

```solidity
contract ISettings settings
```

### nextServiceAgreementId

```solidity
uint256 nextServiceAgreementId
```

### closedServiceAgreements

```solidity
mapping(uint256 => struct ClosedServiceAgreementInfo) closedServiceAgreements
```

### closedServiceAgreementIds

```solidity
mapping(address => mapping(uint256 => uint256)) closedServiceAgreementIds
```

### indexerCsaLength

```solidity
mapping(address => uint256) indexerCsaLength
```

### indexerDeploymentCsaLength

```solidity
mapping(address => mapping(bytes32 => uint256)) indexerDeploymentCsaLength
```

### establisherWhitelist

```solidity
mapping(address => bool) establisherWhitelist
```

### sumDailyReward

```solidity
mapping(address => uint256) sumDailyReward
```

### consumerAuthAllows

```solidity
mapping(address => mapping(address => bool)) consumerAuthAllows
```

### threshold

```solidity
uint256 threshold
```

### SECONDS_IN_DAY

```solidity
uint256 SECONDS_IN_DAY
```

### ClosedAgreementCreated

```solidity
event ClosedAgreementCreated(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when closed service agreement established_

### ClosedAgreementRemoved

```solidity
event ClosedAgreementRemoved(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when expired closed service agreement removed._

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _whitelist) external
```

_Initialize this contract. Load establisherWhitelist._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setThreshold

```solidity
function setThreshold(uint256 _threshold) external
```

_We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
setting the value of threshold.
A smaller threshold value means that the Indexer can get higher sumDailyRewards with
a smaller totalStakedAmount，vice versa.
If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards._

### addUser

```solidity
function addUser(address consumer, address user) external
```

_Consumer add users can request access token from indexer.
We are using the statu `consumerAuthAllows` offchain._

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

_Consumer remove users can request access token from indexer._

### addEstablisher

```solidity
function addEstablisher(address establisher) external
```

### removeEstablisher

```solidity
function removeEstablisher(address establisher) external
```

### periodInDay

```solidity
function periodInDay(uint256 period) private pure returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

_Establish the generated service agreement.
For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
distribute these Token.
All agreements register to this contract through this method.
When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
at the same time, it also encourages Indexer to provide better more stable services._

### renewAgreement

```solidity
function renewAgreement(uint256 agreementId) external
```

_A function allow Consumer call to renew its unexpired closed service agreement.
We only allow the the agreement generated from PlanManager renewable which is created
by Indexer and accepted by Consumer. We use the status planId in agreement to determine
whether the agreement is renewable, since only the agreement generated from PlanManager
come with the PlanId.
Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
Consumer must renew befor the agreement expired._

### clearEndedAgreement

```solidity
function clearEndedAgreement(address indexer, uint256 id) public
```

### clearAllEndedAgreements

```solidity
function clearAllEndedAgreements(address indexer) public
```

### closedServiceAgreementExpired

```solidity
function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool)
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

## IEraManager

### eraStartTime

```solidity
function eraStartTime() external view returns (uint256)
```

### eraPeriod

```solidity
function eraPeriod() external view returns (uint256)
```

### eraNumber

```solidity
function eraNumber() external view returns (uint256)
```

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

## IIndexerRegistry

### isIndexer

```solidity
function isIndexer(address _address) external view returns (bool)
```

### isController

```solidity
function isController(address _address) external view returns (bool)
```

### controllerToIndexer

```solidity
function controllerToIndexer(address _address) external view returns (address)
```

### indexerToController

```solidity
function indexerToController(address _address) external view returns (address)
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### minimumStakingAmount

```solidity
function minimumStakingAmount() external view returns (uint256)
```

## IPermissionedExchange

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

## IPlanManager

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## IndexingServiceStatus

```solidity
enum IndexingServiceStatus {
  NOTINDEXING,
  INDEXING,
  READY
}
```

## IQueryRegistry

### numberOfIndexingDeployments

```solidity
function numberOfIndexingDeployments(address _address) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## IRewardsPool

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) external returns (uint256, uint256)
```

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external returns (bool)
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ISettings

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## MathUtil

### min

```solidity
function min(uint256 x, uint256 y) internal pure returns (uint256)
```

### divUp

```solidity
function divUp(uint256 x, uint256 y) internal pure returns (uint256)
```

### mulDiv

```solidity
function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256)
```

### sub

```solidity
function sub(uint256 x, uint256 y) internal pure returns (uint256)
```

## Constants

## EraManager

## IndexerRegistry

## InflationController

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _controllers) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## PlanManager

## PurchaseOfferMarket

## IndexingServiceStatus

```solidity
enum IndexingServiceStatus {
  NOTINDEXING,
  INDEXING,
  READY
}
```

## QueryRegistry

### settings

```solidity
contract ISettings settings
```

### queryInfoIdsByOwner

```solidity
mapping(address => uint256[]) queryInfoIdsByOwner
```

### queryInfos

```solidity
mapping(uint256 => struct QueryRegistry.QueryInfo) queryInfos
```

### creatorWhitelist

```solidity
mapping(address => bool) creatorWhitelist
```

### nextQueryId

```solidity
uint256 nextQueryId
```

### offlineCalcThreshold

```solidity
uint256 offlineCalcThreshold
```

### creatorRestricted

```solidity
bool creatorRestricted
```

### deploymentStatusByIndexer

```solidity
mapping(bytes32 => mapping(address => struct QueryRegistry.IndexingStatus)) deploymentStatusByIndexer
```

### numberOfIndexingDeployments

```solidity
mapping(address => uint256) numberOfIndexingDeployments
```

### deploymentIds

```solidity
mapping(bytes32 => bool) deploymentIds
```

### QueryInfo

```solidity
struct QueryInfo {
  uint256 queryId;
  address owner;
  bytes32 latestVersion;
  bytes32 latestDeploymentId;
  bytes32 metadata;
}
```

### IndexingStatus

```solidity
struct IndexingStatus {
  bytes32 deploymentId;
  uint256 timestamp;
  uint256 blockHeight;
  enum IndexingServiceStatus status;
}
```

### CreateQuery

```solidity
event CreateQuery(uint256 queryId, address creator, bytes32 metadata, bytes32 deploymentId, bytes32 version)
```

### UpdateQueryMetadata

```solidity
event UpdateQueryMetadata(address owner, uint256 queryId, bytes32 metadata)
```

### UpdateQueryDeployment

```solidity
event UpdateQueryDeployment(address owner, uint256 queryId, bytes32 deploymentId, bytes32 version)
```

### StartIndexing

```solidity
event StartIndexing(address indexer, bytes32 deploymentId)
```

### UpdateDeploymentStatus

```solidity
event UpdateDeploymentStatus(address indexer, bytes32 deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp)
```

### UpdateIndexingStatusToReady

```solidity
event UpdateIndexingStatusToReady(address indexer, bytes32 deploymentId)
```

### StopIndexing

```solidity
event StopIndexing(address indexer, bytes32 deploymentId)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setCreatorRestricted

```solidity
function setCreatorRestricted(bool _creatorRestricted) external
```

### addCreator

```solidity
function addCreator(address creator) external
```

### removeCreator

```solidity
function removeCreator(address creator) external
```

### setOfflineCalcThreshold

```solidity
function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external
```

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### onlyIndexerController

```solidity
modifier onlyIndexerController()
```

### onlyCreator

```solidity
modifier onlyCreator()
```

### canModifyStatus

```solidity
function canModifyStatus(struct QueryRegistry.IndexingStatus currentStatus, uint256 _timestamp) private view
```

### canModifyBlockHeight

```solidity
function canModifyBlockHeight(struct QueryRegistry.IndexingStatus currentStatus, uint256 blockheight) private pure
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### queryInfoCountByOwner

```solidity
function queryInfoCountByOwner(address user) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## ServiceAgreementRegistry

### settings

```solidity
contract ISettings settings
```

### nextServiceAgreementId

```solidity
uint256 nextServiceAgreementId
```

### closedServiceAgreements

```solidity
mapping(uint256 => struct ClosedServiceAgreementInfo) closedServiceAgreements
```

### closedServiceAgreementIds

```solidity
mapping(address => mapping(uint256 => uint256)) closedServiceAgreementIds
```

### indexerCsaLength

```solidity
mapping(address => uint256) indexerCsaLength
```

### indexerDeploymentCsaLength

```solidity
mapping(address => mapping(bytes32 => uint256)) indexerDeploymentCsaLength
```

### establisherWhitelist

```solidity
mapping(address => bool) establisherWhitelist
```

### sumDailyReward

```solidity
mapping(address => uint256) sumDailyReward
```

### consumerAuthAllows

```solidity
mapping(address => mapping(address => bool)) consumerAuthAllows
```

### threshold

```solidity
uint256 threshold
```

### SECONDS_IN_DAY

```solidity
uint256 SECONDS_IN_DAY
```

### ClosedAgreementCreated

```solidity
event ClosedAgreementCreated(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when closed service agreement established_

### ClosedAgreementRemoved

```solidity
event ClosedAgreementRemoved(address consumer, address indexer, bytes32 deploymentId, uint256 serviceAgreementId)
```

_Emitted when expired closed service agreement removed._

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _whitelist) external
```

_Initialize this contract. Load establisherWhitelist._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setThreshold

```solidity
function setThreshold(uint256 _threshold) external
```

_We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
setting the value of threshold.
A smaller threshold value means that the Indexer can get higher sumDailyRewards with
a smaller totalStakedAmount，vice versa.
If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards._

### addUser

```solidity
function addUser(address consumer, address user) external
```

_Consumer add users can request access token from indexer.
We are using the statu `consumerAuthAllows` offchain._

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

_Consumer remove users can request access token from indexer._

### addEstablisher

```solidity
function addEstablisher(address establisher) external
```

### removeEstablisher

```solidity
function removeEstablisher(address establisher) external
```

### periodInDay

```solidity
function periodInDay(uint256 period) private pure returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

_Establish the generated service agreement.
For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
distribute these Token.
All agreements register to this contract through this method.
When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
at the same time, it also encourages Indexer to provide better more stable services._

### renewAgreement

```solidity
function renewAgreement(uint256 agreementId) external
```

_A function allow Consumer call to renew its unexpired closed service agreement.
We only allow the the agreement generated from PlanManager renewable which is created
by Indexer and accepted by Consumer. We use the status planId in agreement to determine
whether the agreement is renewable, since only the agreement generated from PlanManager
come with the PlanId.
Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
Consumer must renew befor the agreement expired._

### clearEndedAgreement

```solidity
function clearEndedAgreement(address indexer, uint256 id) public
```

### clearAllEndedAgreements

```solidity
function clearAllEndedAgreements(address indexer) public
```

### closedServiceAgreementExpired

```solidity
function closedServiceAgreementExpired(uint256 agreementId) public view returns (bool)
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

## Settings

### sqToken

```solidity
address sqToken
```

### staking

```solidity
address staking
```

### indexerRegistry

```solidity
address indexerRegistry
```

### queryRegistry

```solidity
address queryRegistry
```

### eraManager

```solidity
address eraManager
```

### planManager

```solidity
address planManager
```

### serviceAgreementRegistry

```solidity
address serviceAgreementRegistry
```

### rewardsDistributer

```solidity
address rewardsDistributer
```

### rewardsPool

```solidity
address rewardsPool
```

### rewardsHelper

```solidity
address rewardsHelper
```

### inflationController

```solidity
address inflationController
```

### vesting

```solidity
address vesting
```

### permissionedExchange

```solidity
address permissionedExchange
```

### constructor

```solidity
constructor() public
```

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 total;
  uint256 spent;
  uint256 expirationAt;
  uint256 challengeAt;
  bytes32 deploymentId;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  uint256 spent;
  bool isFinal;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer, uint256 total, uint256 expiration, bytes32 deploymentId)
```

### ChannelExtend

```solidity
event ChannelExtend(uint256 channelId, uint256 expiration)
```

### ChannelFund

```solidity
event ChannelFund(uint256 channelId, uint256 total)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 spent)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 spent, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 spent)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address indexer, address consumer, uint256 amount, uint256 expiration, bytes32 deploymentId, bytes callback, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

### _isContract

```solidity
function _isContract(address _addr) private view returns (bool)
```

## VSQToken

### _name

```solidity
string _name
```

### _symbol

```solidity
string _symbol
```

### _decimals

```solidity
uint8 _decimals
```

### settings

```solidity
contract ISettings settings
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### name

```solidity
function name() public view returns (string)
```

### symbol

```solidity
function symbol() public view returns (string)
```

### decimals

```solidity
function decimals() public pure returns (uint8)
```

### balanceOf

```solidity
function balanceOf(address account) public view returns (uint256)
```

## Vesting

### VestingPlan

```solidity
struct VestingPlan {
  uint256 lockPeriod;
  uint256 vestingPeriod;
  uint256 initialUnlockPercent;
}
```

### token

```solidity
address token
```

### vestingStartDate

```solidity
uint256 vestingStartDate
```

### plans

```solidity
struct Vesting.VestingPlan[] plans
```

### userPlanId

```solidity
mapping(address => uint256) userPlanId
```

### allocations

```solidity
mapping(address => uint256) allocations
```

### claimed

```solidity
mapping(address => uint256) claimed
```

### totalAllocation

```solidity
uint256 totalAllocation
```

### totalClaimed

```solidity
uint256 totalClaimed
```

### AddVestingPlan

```solidity
event AddVestingPlan(uint256 planId, uint256 lockPeriod, uint256 vestingPeriod, uint256 initialUnlockPercent)
```

### constructor

```solidity
constructor(address _token) public
```

### addVestingPlan

```solidity
function addVestingPlan(uint256 _lockPeriod, uint256 _vestingPeriod, uint256 _initialUnlockPercent) public
```

### allocateVesting

```solidity
function allocateVesting(address addr, uint256 _planId, uint256 _allocation) public
```

### batchAllocateVesting

```solidity
function batchAllocateVesting(uint256 planId, address[] addrs, uint256[] _allocations) external
```

### depositByAdmin

```solidity
function depositByAdmin(uint256 amount) external
```

### withdrawAllByAdmin

```solidity
function withdrawAllByAdmin() external
```

### startVesting

```solidity
function startVesting(uint256 _vestingStartDate) external
```

### claim

```solidity
function claim() external
```

### claimableAmount

```solidity
function claimableAmount(address user) public view returns (uint256)
```

## IConsumer

## IEraManager

## IIndexerRegistry

## IInflationController

## IInflationDestination

## IPermissionedExchange

## IPlanManager

## IPurchaseOfferMarket

## IQueryRegistry

### numberOfIndexingDeployments

```solidity
function numberOfIndexingDeployments(address _address) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## IRewardsPool

### getReward

```solidity
function getReward(bytes32 deploymentId, uint256 era, address indexer) external returns (uint256, uint256)
```

### labor

```solidity
function labor(bytes32 deploymentId, address indexer, uint256 amount) external
```

### collect

```solidity
function collect(bytes32 deploymentId, address indexer) external
```

### isClaimed

```solidity
function isClaimed(uint256 era, address indexer) external returns (bool)
```

## ISQToken

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### burn

```solidity
function burn(uint256 amount) external
```

## ClosedServiceAgreementInfo

```solidity
struct ClosedServiceAgreementInfo {
  address consumer;
  address indexer;
  bytes32 deploymentId;
  uint256 lockedAmount;
  uint256 startDate;
  uint256 period;
  uint256 planId;
  uint256 planTemplateId;
}
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(uint256 agreementId) external
```

### hasOngoingClosedServiceAgreement

```solidity
function hasOngoingClosedServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

### getClosedServiceAgreement

```solidity
function getClosedServiceAgreement(uint256 agreementId) external view returns (struct ClosedServiceAgreementInfo)
```

### nextServiceAgreementId

```solidity
function nextServiceAgreementId() external view returns (uint256)
```

### createClosedServiceAgreement

```solidity
function createClosedServiceAgreement(struct ClosedServiceAgreementInfo agreement) external returns (uint256)
```

## ISettings

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
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

## IVesting

### allocations

```solidity
function allocations(address _account) external view returns (uint256)
```

### claimed

```solidity
function claimed(address _account) external view returns (uint256)
```

## FixedMath

### FIXED_1

```solidity
int256 FIXED_1
```

### FIXED_1_SQUARED

```solidity
int256 FIXED_1_SQUARED
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### one

```solidity
function one() internal pure returns (int256 f)
```

_Get one as a fixed-point number._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the addition of two fixed point numbers, reverting on overflow._

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the multiplication of two fixed point numbers, reverting on overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256 c)
```

_Returns the division of two fixed point numbers._

### mulDiv

```solidity
function mulDiv(int256 a, int256 n, int256 d) internal pure returns (int256 c)
```

_Performs (a * n) / d, without scaling for precision._

### uintMul

```solidity
function uintMul(int256 f, uint256 u) internal pure returns (uint256)
```

_Returns the unsigned integer result of multiplying a fixed-point
     number with an integer, reverting if the multiplication overflows.
     Negative results are clamped to zero._

### abs

```solidity
function abs(int256 f) internal pure returns (int256 c)
```

_Returns the absolute value of a fixed point number._

### invert

```solidity
function invert(int256 f) internal pure returns (int256 c)
```

_Returns 1 / `x`, where `x` is a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n) internal pure returns (int256 f)
```

_Convert signed `n` / 1 to a fixed-point number._

### toFixed

```solidity
function toFixed(int256 n, int256 d) internal pure returns (int256 f)
```

_Convert signed `n` / `d` to a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n) internal pure returns (int256 f)
```

_Convert unsigned `n` / 1 to a fixed-point number.
     Reverts if `n` is too large to fit in a fixed-point number._

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256 f)
```

_Convert unsigned `n` / `d` to a fixed-point number.
     Reverts if `n` / `d` is too large to fit in a fixed-point number._

### toInteger

```solidity
function toInteger(int256 f) internal pure returns (int256 n)
```

_Convert a fixed-point number to an integer._

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

### _mul

```solidity
function _mul(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the multiplication two numbers, reverting on overflow._

### _div

```solidity
function _div(int256 a, int256 b) private pure returns (int256 c)
```

_Returns the division of two numbers, reverting on division by zero._

### _add

```solidity
function _add(int256 a, int256 b) private pure returns (int256 c)
```

_Adds two numbers, reverting on overflow._

## MathUtil

### min

```solidity
function min(uint256 x, uint256 y) internal pure returns (uint256)
```

### divUp

```solidity
function divUp(uint256 x, uint256 y) internal pure returns (uint256)
```

### mulDiv

```solidity
function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256)
```

### sub

```solidity
function sub(uint256 x, uint256 y) internal pure returns (uint256)
```

## StakingUtil

### currentStaking

```solidity
function currentStaking(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

### currentCommission

```solidity
function currentCommission(struct CommissionRate rate, uint256 era) internal pure returns (uint256)
```

### currentDelegation

```solidity
function currentDelegation(struct StakingAmount amount, uint256 era) internal pure returns (uint256)
```

## PermissionedExchange

### ExchangeOrder

```solidity
struct ExchangeOrder {
  address tokenGive;
  address tokenGet;
  uint256 amountGive;
  uint256 amountGet;
  address sender;
  uint256 expireDate;
  uint256 amountGiveLeft;
}
```

### settings

```solidity
contract ISettings settings
```

### nextOrderId

```solidity
uint256 nextOrderId
```

### tradeQuota

```solidity
mapping(address => mapping(address => uint256)) tradeQuota
```

### exchangeController

```solidity
mapping(address => bool) exchangeController
```

### orders

```solidity
mapping(uint256 => struct PermissionedExchange.ExchangeOrder) orders
```

### ExchangeOrderSent

```solidity
event ExchangeOrderSent(uint256 orderId, address sender, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, uint256 expireDate)
```

### Trade

```solidity
event Trade(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### OrderSettled

```solidity
event OrderSettled(uint256 orderId, address tokenGive, uint256 amountGive, address tokenGet, uint256 amountGet)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setController

```solidity
function setController(address _controller, bool _isController) external
```

_Set controller role for this contract, controller have the permission to addQuota for trader_

### addQuota

```solidity
function addQuota(address _token, address _account, uint256 _amount) external
```

_allow controllers to add the trade quota to traders on specific token_

### sendOrder

```solidity
function sendOrder(address _tokenGive, address _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _expireDate) public
```

_only onwer have the permission to send the order for now,
traders can do exchanges on onwer sent order_

### trade

```solidity
function trade(uint256 _orderId, uint256 _amount) public
```

_traders do exchange on traders order, but need to trade under the trade quota._

### settleExpiredOrder

```solidity
function settleExpiredOrder(uint256 _orderId) public
```

_everyone allowed to call settleExpiredOrder to settled expired order
this will return left given token back to order sender._

### cancelOrder

```solidity
function cancelOrder(uint256 _orderId) public
```

_order sender can cancel the sent order anytime, and this will return left
given token back to order sender._

## ISettings

### setProjectAddresses

```solidity
function setProjectAddresses(address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry) external
```

### setTokenAddresses

```solidity
function setTokenAddresses(address _sqToken, address _staking, address _rewardsDistributer, address _rewardsPool, address _rewardsHelper, address _inflationController, address _vesting, address _permissionedExchange) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### setPlanManager

```solidity
function setPlanManager(address _planManager) external
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setRewardsPool

```solidity
function setRewardsPool(address _rewardsPool) external
```

### getRewardsPool

```solidity
function getRewardsPool() external view returns (address)
```

### setRewardsHelper

```solidity
function setRewardsHelper(address _rewardsHelper) external
```

### getRewardsHelper

```solidity
function getRewardsHelper() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
```

### setVesting

```solidity
function setVesting(address _vesting) external
```

### getVesting

```solidity
function getVesting() external view returns (address)
```

### setPermissionedExchange

```solidity
function setPermissionedExchange(address _permissionedExchange) external
```

### getPermissionedExchange

```solidity
function getPermissionedExchange() external view returns (address)
```

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

## ClosedServiceAgreement

### settings

```solidity
address settings
```

### consumer

```solidity
address consumer
```

### indexer

```solidity
address indexer
```

### deploymentId

```solidity
bytes32 deploymentId
```

### lockedAmount

```solidity
uint256 lockedAmount
```

### contractPeriod

```solidity
uint256 contractPeriod
```

### startDate

```solidity
uint256 startDate
```

### planId

```solidity
uint256 planId
```

### planTemplateId

```solidity
uint256 planTemplateId
```

### agreementType

```solidity
enum AgreementType agreementType
```

### constructor

```solidity
constructor(address _settings, address _consumer, address _indexer, bytes32 _deploymentId, uint256 _lockedAmount, uint256 _startDate, uint256 _contractPeriod, uint256 _planId, uint256 _planTemplateId) public
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

_See {IERC165-supportsInterface}._

### hasEnded

```solidity
function hasEnded() external view returns (bool)
```

### fireDispute

```solidity
function fireDispute() external
```

### period

```solidity
function period() external view returns (uint256)
```

### value

```solidity
function value() external view returns (uint256)
```

## Constants

### PER_MILL

```solidity
uint256 PER_MILL
```

### PER_BILL

```solidity
uint256 PER_BILL
```

### PER_TRILL

```solidity
uint256 PER_TRILL
```

### ZERO_ADDRESS

```solidity
address ZERO_ADDRESS
```

## EraManager

_Produce epochs based on a period to coordinate contracts_

### settings

```solidity
contract ISettings settings
```

### eraPeriod

```solidity
uint256 eraPeriod
```

### eraNumber

```solidity
uint256 eraNumber
```

### eraStartTime

```solidity
uint256 eraStartTime
```

### EraPeriodUpdate

```solidity
event EraPeriodUpdate(uint256 era, uint256 eraPeriod)
```

### NewEraStart

```solidity
event NewEraStart(uint256 era, address caller)
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _eraPeriod) external
```

### startNewEra

```solidity
function startNewEra() public
```

_Start a new era if time already passed - anyone can call it_

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

### updateEraPeriod

```solidity
function updateEraPeriod(uint256 newEraPeriod) external
```

_Update era period - only admin can call it_

## IndexerRegistry

_## Overview
The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers.
It also provide the entry for Indexers to register, unregister, and config their metedata.

 ## Terminology
Indexer metadata -- The metadata of Indexer stored on IPFS include Indexer nickname, service endpoint...

## Detail
Each Indexer has two accounts:
Main Account:
 The main account is stored in the indexer’s own wallet.
 The indexer can use the main account to make the following actions:
     - staking/unstaking
     - register/unregisterIndexer
     - set/remove a controller account
     - start an indexing for a query project with specific controller account

Controller Account:
 The controller account is set by the main account which can execute some
 actions on the behalf of the main account.
 These actions include:
     - reporting / updating the status of the indexing service on chain

Indexer must set a appropriate commission rate and stake enough SQT Token when registering.
Indexer need to make sure all the query projects with NOT INDEXING status before unregister._

### settings

```solidity
contract ISettings settings
```

### isIndexer

```solidity
mapping(address => bool) isIndexer
```

### metadataByIndexer

```solidity
mapping(address => bytes32) metadataByIndexer
```

### indexerToController

```solidity
mapping(address => address) indexerToController
```

### controllerToIndexer

```solidity
mapping(address => address) controllerToIndexer
```

### minimumStakingAmount

```solidity
uint256 minimumStakingAmount
```

### RegisterIndexer

```solidity
event RegisterIndexer(address indexer, uint256 amount, bytes32 metadata)
```

_Emitted when user register to an Indexer._

### UnregisterIndexer

```solidity
event UnregisterIndexer(address indexer)
```

_Emitted when user unregister to an Indexer._

### UpdateMetadata

```solidity
event UpdateMetadata(address indexer, bytes32 metadata)
```

_Emitted when Indexers update their Metadata._

### SetControllerAccount

```solidity
event SetControllerAccount(address indexer, address controller)
```

_Emitted when Indexer set the controller account._

### RemoveControllerAccount

```solidity
event RemoveControllerAccount(address indexer, address controller)
```

_Emitted when Indexer remove the controller account._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setminimumStakingAmount

```solidity
function setminimumStakingAmount(uint256 _amount) external
```

_set the Indexer minimum staking amount only by owner._

### registerIndexer

```solidity
function registerIndexer(uint256 _amount, bytes32 _metadata, uint256 _rate) external
```

_call to register to an Indexer, this function will interacte with
staking contract to handle the Indexer first stake and commission rate setup._

### unregisterIndexer

```solidity
function unregisterIndexer() external
```

_Indexer call to unregister, need to check no running indexing projects on this Indexer
from QueryRegistry contract.
This function will call unstake for Indexer to make sure indexer unstaking all staked SQT Token after
unregister._

### updateMetadata

```solidity
function updateMetadata(bytes32 _metadata) external
```

_Indexers call to update their Metadata._

### setControllerAccount

```solidity
function setControllerAccount(address _controller) external
```

_Indexers call to set the controller account, since indexer only allowed to set one controller account,
 we need to remove the previous controller account._

### removeControllerAccount

```solidity
function removeControllerAccount() public
```

_Indexers call to remove the controller account.
need to remove both indexerToController and controllerToIndexer._

### isController

```solidity
function isController(address _address) external view returns (bool)
```

## InflationController

### settings

```solidity
contract ISettings settings
```

### inflationRate

```solidity
uint256 inflationRate
```

### inflationDestination

```solidity
address inflationDestination
```

### lastInflationTimestamp

```solidity
uint256 lastInflationTimestamp
```

### YEAR_SECONDS

```solidity
uint256 YEAR_SECONDS
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _inflationRate, address _inflationDestination) external
```

### setInflationRate

```solidity
function setInflationRate(uint256 _inflationRate) external
```

### setInflationDestination

```solidity
function setInflationDestination(address _inflationDestination) external
```

### mintInflatedTokens

```solidity
function mintInflatedTokens() external
```

## MathUtil

### min

```solidity
function min(uint256 x, uint256 y) internal pure returns (uint256)
```

### divUp

```solidity
function divUp(uint256 x, uint256 y) internal pure returns (uint256)
```

### mulDiv

```solidity
function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256)
```

### sub

```solidity
function sub(uint256 x, uint256 y) internal pure returns (uint256)
```

## PlanManager

### Plan

```solidity
struct Plan {
  uint256 price;
  uint256 planTemplateId;
  bytes32 deploymentId;
  bool active;
}
```

### PlanTemplate

```solidity
struct PlanTemplate {
  uint256 period;
  uint256 dailyReqCap;
  uint256 rateLimit;
  bytes32 metadata;
  bool active;
}
```

### settings

```solidity
contract ISettings settings
```

### planTemplateIds

```solidity
uint256 planTemplateIds
```

### planTemplates

```solidity
mapping(uint256 => struct PlanManager.PlanTemplate) planTemplates
```

### planCount

```solidity
mapping(address => uint256) planCount
```

### plans

```solidity
mapping(address => mapping(uint256 => struct PlanManager.Plan)) plans
```

### planIds

```solidity
mapping(address => mapping(bytes32 => uint256[])) planIds
```

### indexerPlanLimit

```solidity
uint16 indexerPlanLimit
```

### PlanTemplateCreated

```solidity
event PlanTemplateCreated(uint256 planTemplateId)
```

_Emitted when owner create a PlanTemplate._

### PlanTemplateMetadataChanged

```solidity
event PlanTemplateMetadataChanged(uint256 planTemplateId, bytes32 metadata)
```

_Emitted when owner change the Metadata of a PlanTemplate._

### PlanTemplateStatusChanged

```solidity
event PlanTemplateStatusChanged(uint256 planTemplateId, bool active)
```

_Emitted when owner change the status of a PlanTemplate. active or not_

### PlanCreated

```solidity
event PlanCreated(address creator, bytes32 deploymentId, uint256 planTemplateId, uint256 planId, uint256 price)
```

_Emitted when Indexer create a Plan._

### PlanRemoved

```solidity
event PlanRemoved(address source, uint256 id, bytes32 deploymentId)
```

_Emitted when Indexer remove a Plan._

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

_Initialize this contract._

### setIndexerPlanLimit

```solidity
function setIndexerPlanLimit(uint16 _indexerPlanLimit) external
```

### createPlanTemplate

```solidity
function createPlanTemplate(uint256 _period, uint256 _dailyReqCap, uint256 _rateLimit, bytes32 _metadata) external
```

_Allow Owner to create a PlanTemplate._

### updatePlanTemplateMetadata

```solidity
function updatePlanTemplateMetadata(uint256 _planTemplateId, bytes32 _metadata) external
```

_Allow Owner to update the Metadata of a PlanTemplate._

### updatePlanTemplateStatus

```solidity
function updatePlanTemplateStatus(uint256 _planTemplateId, bool _active) external
```

_Allow Owner to update the status of a PlanTemplate.
active or not_

### createPlan

```solidity
function createPlan(uint256 _price, uint256 _planTemplateId, bytes32 _deploymentId) external
```

_Allow Indexer to create a Plan basing on a specific plan template_

### removePlan

```solidity
function removePlan(uint256 _planId) external
```

_Allow Indexer to remove actived Plan._

### acceptPlan

```solidity
function acceptPlan(address _indexer, bytes32 _deploymentId, uint256 _planId) external
```

_Allow Consumer to accept a plan created by an indexer. Consumer transfer token to
ServiceAgreementRegistry contract and a service agreement will be created
when they accept the plan._

### templates

```solidity
function templates() external view returns (struct PlanManager.PlanTemplate[])
```

### indexerPlans

```solidity
function indexerPlans(address indexer) external view returns (struct PlanManager.Plan[])
```

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

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

## PurchaseOfferMarket

### PurchaseOffer

```solidity
struct PurchaseOffer {
  uint256 deposit;
  uint256 minimumAcceptHeight;
  uint256 planTemplateId;
  bytes32 deploymentId;
  uint256 expireDate;
  address consumer;
  bool cancelled;
  uint16 limit;
  uint16 numAcceptedContracts;
}
```

### settings

```solidity
contract ISettings settings
```

### offers

```solidity
mapping(uint256 => struct PurchaseOfferMarket.PurchaseOffer) offers
```

### numOffers

```solidity
uint256 numOffers
```

### penaltyRate

```solidity
uint256 penaltyRate
```

### penaltyDestination

```solidity
address penaltyDestination
```

### acceptedOffer

```solidity
mapping(uint256 => mapping(address => bool)) acceptedOffer
```

### offerMmrRoot

```solidity
mapping(uint256 => mapping(address => bytes32)) offerMmrRoot
```

### PurchaseOfferCreated

```solidity
event PurchaseOfferCreated(address consumer, uint256 offerId, bytes32 deploymentId, uint256 planTemplateId, uint256 deposit, uint16 limit, uint256 minimumAcceptHeight, uint256 expireDate)
```

_Emitted when Consumer create a purchase offer_

### PurchaseOfferCancelled

```solidity
event PurchaseOfferCancelled(address creator, uint256 offerId, uint256 penalty)
```

_Emitted when Consumer cancel a purchase offer_

### OfferAccepted

```solidity
event OfferAccepted(address indexer, uint256 offerId, address agreement)
```

_Emitted when Indexer accept an offer_

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### initialize

```solidity
function initialize(contract ISettings _settings, uint256 _penaltyRate, address _penaltyDestination) external
```

_Initialize this contract._

### setPenaltyRate

```solidity
function setPenaltyRate(uint256 _penaltyRate) external
```

_allow owner the set the Penalty Rate for cancel unexpired offer._

### setPenaltyDestination

```solidity
function setPenaltyDestination(address _penaltyDestination) external
```

_allow owner to set the Penalty Destination address.
All Penalty will transfer to this address, if penalty destination address is 0x00,
then burn the penalty_

### createPurchaseOffer

```solidity
function createPurchaseOffer(bytes32 _deploymentId, uint256 _planTemplateId, uint256 _deposit, uint16 _limit, uint256 _minimumAcceptHeight, uint256 _expireDate) external
```

_Allow Consumer to create a Purchase Offer._

### cancelPurchaseOffer

```solidity
function cancelPurchaseOffer(uint256 _offerId) external
```

_Allow Consumer to cancel their Purchase Offer.
Consumer transfer all tokens to this contract when they create the offer.
We will charge a Penalty to cancel unexpired Offer.
And the Penalty will transfer to a configured address.
If the address not configured, then we burn the Penalty._

### acceptPurchaseOffer

```solidity
function acceptPurchaseOffer(uint256 _offerId, bytes32 _mmrRoot) external
```

_Allow Indexer to accept the offer and make the service agreement.
The corresponding part of the money will transfer to serviceAgrementRegistry contract
and wait rewardDistributer contract take and distribute as long as Indexer accept the offer.
When Indexer accept the offer we need to ensure Indexer's deployment reaches the minimumAcceptHeight,
So we ask indexers to pass the latest mmr value when accepting the purchase offer,
and save this mmr value when agreement create._

### isExpired

```solidity
function isExpired(uint256 _offerId) public view returns (bool)
```

## IndexingServiceStatus

```solidity
enum IndexingServiceStatus {
  NOTINDEXING,
  INDEXING,
  READY
}
```

## QueryRegistry

### settings

```solidity
contract ISettings settings
```

### queryInfoIdsByOwner

```solidity
mapping(address => uint256[]) queryInfoIdsByOwner
```

### queryInfos

```solidity
mapping(uint256 => struct QueryRegistry.QueryInfo) queryInfos
```

### nextQueryId

```solidity
uint256 nextQueryId
```

### offlineCalcThreshold

```solidity
uint256 offlineCalcThreshold
```

### deploymentStatusByIndexer

```solidity
mapping(bytes32 => mapping(address => struct QueryRegistry.IndexingStatus)) deploymentStatusByIndexer
```

### numberOfIndexingDeployments

```solidity
mapping(address => uint256) numberOfIndexingDeployments
```

### deploymentIds

```solidity
mapping(bytes32 => bool) deploymentIds
```

### QueryInfo

```solidity
struct QueryInfo {
  uint256 queryId;
  address owner;
  bytes32 latestVersion;
  bytes32 latestDeploymentId;
  bytes32 metadata;
}
```

### IndexingStatus

```solidity
struct IndexingStatus {
  bytes32 deploymentId;
  uint256 timestamp;
  uint256 blockHeight;
  enum IndexingServiceStatus status;
}
```

### CreateQuery

```solidity
event CreateQuery(uint256 queryId, address creator, bytes32 metadata, bytes32 deploymentId, bytes32 version)
```

### UpdateQueryMetadata

```solidity
event UpdateQueryMetadata(address owner, uint256 queryId, bytes32 metadata)
```

### UpdateQueryDeployment

```solidity
event UpdateQueryDeployment(address owner, uint256 queryId, bytes32 deploymentId, bytes32 version)
```

### StartIndexing

```solidity
event StartIndexing(address indexer, bytes32 deploymentId)
```

### UpdateDeploymentStatus

```solidity
event UpdateDeploymentStatus(address indexer, bytes32 deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp)
```

### UpdateIndexingStatusToReady

```solidity
event UpdateIndexingStatusToReady(address indexer, bytes32 deploymentId)
```

### StopIndexing

```solidity
event StopIndexing(address indexer, bytes32 deploymentId)
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setOfflineCalcThreshold

```solidity
function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external
```

### onlyIndexer

```solidity
modifier onlyIndexer()
```

### onlyIndexerController

```solidity
modifier onlyIndexerController()
```

### canModifyStatus

```solidity
function canModifyStatus(struct QueryRegistry.IndexingStatus currentStatus, uint256 _timestamp) private view
```

### canModifyBlockHeight

```solidity
function canModifyBlockHeight(struct QueryRegistry.IndexingStatus currentStatus, uint256 blockheight) private pure
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### queryInfoCountByOwner

```solidity
function queryInfoCountByOwner(address user) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## SQToken

### minter

```solidity
address minter
```

### isMinter

```solidity
modifier isMinter()
```

### constructor

```solidity
constructor(address _minter) public
```

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### setMinter

```solidity
function setMinter(address _minter) external
```

#if_succeeds {:msg "minter should be set"} minter == _minter;
#if_succeeds {:msg "owner functionality"} old(msg.sender == address(owner));

### getMinter

```solidity
function getMinter() external view returns (address)
```

## ServiceAgreementRegistry

### settings

```solidity
contract ISettings settings
```

### serviceAgreements

```solidity
mapping(address => mapping(uint256 => address)) serviceAgreements
```

### indexerSaLength

```solidity
mapping(address => uint256) indexerSaLength
```

### indexerDeploymentSaLength

```solidity
mapping(address => mapping(bytes32 => uint256)) indexerDeploymentSaLength
```

### establisherWhitelist

```solidity
mapping(address => bool) establisherWhitelist
```

### sumDailyReward

```solidity
mapping(address => uint256) sumDailyReward
```

### consumerAuthAllows

```solidity
mapping(address => mapping(address => bool)) consumerAuthAllows
```

### threshold

```solidity
uint256 threshold
```

### SECONDS_IN_DAY

```solidity
uint256 SECONDS_IN_DAY
```

### ClosedAgreementCreated

```solidity
event ClosedAgreementCreated(address consumer, address indexer, bytes32 deploymentId, address serviceAgreement)
```

_Emitted when closed service agreement established_

### ClosedAgreementRemoved

```solidity
event ClosedAgreementRemoved(address consumer, address indexer, bytes32 deploymentId, address serviceAgreement)
```

_Emitted when expired closed service agreement removed._

### initialize

```solidity
function initialize(contract ISettings _settings, address[] _whitelist) external
```

_Initialize this contract. Load establisherWhitelist._

### setSettings

```solidity
function setSettings(contract ISettings _settings) external
```

### setThreshold

```solidity
function setThreshold(uint256 _threshold) external
```

_We adjust the ratio of Indexer‘s totalStakedAmount and sumDailyRewards by
setting the value of threshold.
A smaller threshold value means that the Indexer can get higher sumDailyRewards with
a smaller totalStakedAmount，vice versa.
If the threshold is less than PER_MILL, we will not limit the indexer's sumDailyRewards._

### addUser

```solidity
function addUser(address consumer, address user) external
```

_Consumer add users can request access token from indexer._

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

_Consumer remove users can request access token from indexer._

### addEstablisher

```solidity
function addEstablisher(address establisher) external
```

### removeEstablisher

```solidity
function removeEstablisher(address establisher) external
```

### periodInDay

```solidity
function periodInDay(uint256 period) private pure returns (uint256)
```

### establishServiceAgreement

```solidity
function establishServiceAgreement(address agreementContract) external
```

_Establish the generated service agreement.
For now only establish the close service agreement generated from PlanManager and PurchsaseOfferMarket.
This function is called by PlanManager or PurchsaseOfferMarket when close service agreement generated,
it temporary hold the SQT Token from these agreements, approve and nodify reward distributor contract to take and
distribute these Token.
All agreements register to this contract through this method.
When new agreement come we need to track the sumDailyReward of Indexer. In our design there is an upper limit
on the rewards indexer can earn every day, and the limit will increase with the increase of the total staked
amount of that indexer. This design can ensure our Customer to obtain high quality of service from Indexer，
at the same time, it also encourages Indexer to provide better more stable services._

### renewAgreement

```solidity
function renewAgreement(address agreementContract) external
```

_A function allow Consumer call to renew its unexpired closed service agreement.
We only allow the the agreement generated from PlanManager renewable which is created
by Indexer and accepted by Consumer. We use the status planId in agreement to determine
whether the agreement is renewable, since only the agreement generated from PlanManager
come with the PlanId.
Indexer can be prevente the agreement rennew by inactive the plan which bound to it.
Consumer must renew befor the agreement expired._

### clearEndedAgreement

```solidity
function clearEndedAgreement(address indexer, uint256 id) public
```

### clearAllEndedAgreements

```solidity
function clearAllEndedAgreements(address indexer) public
```

### getServiceAgreement

```solidity
function getServiceAgreement(address indexer, uint256 id) public view returns (address)
```

### serviceAgreementExpired

```solidity
function serviceAgreementExpired(address agreement) public view returns (bool)
```

### hasOngoingServiceAgreement

```solidity
function hasOngoingServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### getIndexerDeploymentSaLength

```solidity
function getIndexerDeploymentSaLength(address indexer, bytes32 deploymentId) public view returns (uint256)
```

## Settings

### sqToken

```solidity
address sqToken
```

### staking

```solidity
address staking
```

### indexerRegistry

```solidity
address indexerRegistry
```

### queryRegistry

```solidity
address queryRegistry
```

### eraManager

```solidity
address eraManager
```

### planManager

```solidity
address planManager
```

### serviceAgreementRegistry

```solidity
address serviceAgreementRegistry
```

### rewardsDistributer

```solidity
address rewardsDistributer
```

### inflationController

```solidity
address inflationController
```

### constructor

```solidity
constructor() public
```

### setAllAddresses

```solidity
function setAllAddresses(address _sqToken, address _staking, address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry, address _rewardsDistributer, address _inflationController) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
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

## ChannelStatus

```solidity
enum ChannelStatus {
  Finalized,
  Open,
  Challenge
}
```

## ChannelState

```solidity
struct ChannelState {
  enum ChannelStatus status;
  address indexer;
  address consumer;
  uint256 count;
  uint256 balance;
  uint256 expirationAt;
  uint256 challengeAt;
}
```

## QueryState

```solidity
struct QueryState {
  uint256 channelId;
  bool isFinal;
  uint256 count;
  uint256 price;
  bytes indexerSign;
  bytes consumerSign;
}
```

## StateChannel

### settings

```solidity
contract ISettings settings
```

### challengeExpiration

```solidity
uint256 challengeExpiration
```

### ChannelOpen

```solidity
event ChannelOpen(uint256 channelId, address indexer, address consumer)
```

### ChannelCheckpoint

```solidity
event ChannelCheckpoint(uint256 channelId, uint256 count)
```

### ChannelChallenge

```solidity
event ChannelChallenge(uint256 channelId, uint256 count, uint256 expiration)
```

### ChannelRespond

```solidity
event ChannelRespond(uint256 channelId, uint256 count)
```

### ChannelFinalize

```solidity
event ChannelFinalize(uint256 channelId)
```

### channels

```solidity
mapping(uint256 => struct ChannelState) channels
```

### initialize

```solidity
function initialize(contract ISettings _settings) external
```

### setChallengeExpiration

```solidity
function setChallengeExpiration(uint256 expiration) public
```

### channel

```solidity
function channel(uint256 channelId) public view returns (struct ChannelState)
```

### open

```solidity
function open(uint256 channelId, address payable indexer, address payable consumer, uint256 amount, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### extend

```solidity
function extend(uint256 channelId, uint256 preExpirationAt, uint256 expiration, bytes indexerSign, bytes consumerSign) public
```

### fund

```solidity
function fund(uint256 channelId, uint256 amount, bytes sign) public
```

### checkpoint

```solidity
function checkpoint(struct QueryState query) public
```

### challenge

```solidity
function challenge(struct QueryState query) public
```

### respond

```solidity
function respond(struct QueryState query) public
```

### claim

```solidity
function claim(uint256 channelId) public
```

### _checkStateSign

```solidity
function _checkStateSign(uint256 channelId, bytes32 payload, bytes indexerSign, bytes consumerSign) private view
```

### _checkSign

```solidity
function _checkSign(bytes32 payload, bytes indexerSign, bytes consumerSign, address channelIndexer, address channelController, address channelConsumer) private pure
```

### _settlement

```solidity
function _settlement(struct QueryState query) private
```

### _finalize

```solidity
function _finalize(uint256 channelId) private
```

## IEraManager

### eraStartTime

```solidity
function eraStartTime() external view returns (uint256)
```

### eraPeriod

```solidity
function eraPeriod() external view returns (uint256)
```

### eraNumber

```solidity
function eraNumber() external view returns (uint256)
```

### safeUpdateAndGetEra

```solidity
function safeUpdateAndGetEra() external returns (uint256)
```

### timestampToEraNumber

```solidity
function timestampToEraNumber(uint256 timestamp) external view returns (uint256)
```

## IIndexerRegistry

### isIndexer

```solidity
function isIndexer(address _address) external view returns (bool)
```

### isController

```solidity
function isController(address _address) external view returns (bool)
```

### controllerToIndexer

```solidity
function controllerToIndexer(address _address) external view returns (address)
```

### indexerToController

```solidity
function indexerToController(address _address) external view returns (address)
```

### setCommissionRate

```solidity
function setCommissionRate(uint256 rate) external
```

### minimumStakingAmount

```solidity
function minimumStakingAmount() external view returns (uint256)
```

## IInflationController

### setInflationRate

```solidity
function setInflationRate(uint256 _inflationRateBP) external
```

### setInflationDestination

```solidity
function setInflationDestination(address _inflationDestination) external
```

### mintInflatedTokens

```solidity
function mintInflatedTokens() external
```

## IInflationDestination

### afterReceiveInflatedTokens

```solidity
function afterReceiveInflatedTokens(uint256 tokenAmount) external
```

## IPlanManager

### getPlan

```solidity
function getPlan(address indexer, uint256 planId) external view returns (uint256 price, uint256 planTemplateId, bytes32 deploymentId, bool active)
```

### getPlanTemplate

```solidity
function getPlanTemplate(uint256 planTemplateId) external view returns (uint256 period, uint256 dailyReqCap, uint256 rateLimit, bytes32 metadata, bool active)
```

## IPurchaseOfferMarket

### createPurchaseOffer

```solidity
function createPurchaseOffer(bytes32 _deploymentId, uint256 _planTemplateId, uint256 _deposit, uint16 _limit, uint256 _minimumAcceptHeight, uint256 _expireDate) external
```

### cancelPurchaseOffer

```solidity
function cancelPurchaseOffer(uint256 _offerId) external
```

### acceptPurchaseOffer

```solidity
function acceptPurchaseOffer(uint256 _offerId, bytes32 _mmrRoot) external
```

## IQueryRegistry

### numberOfIndexingDeployments

```solidity
function numberOfIndexingDeployments(address _address) external view returns (uint256)
```

### isIndexingAvailable

```solidity
function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool)
```

### createQueryProject

```solidity
function createQueryProject(bytes32 metadata, bytes32 version, bytes32 deploymentId) external
```

### updateQueryProjectMetadata

```solidity
function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external
```

### updateDeployment

```solidity
function updateDeployment(uint256 queryId, bytes32 deploymentId, bytes32 version) external
```

### startIndexing

```solidity
function startIndexing(bytes32 deploymentId) external
```

### updateIndexingStatusToReady

```solidity
function updateIndexingStatusToReady(bytes32 deploymentId) external
```

### reportIndexingStatus

```solidity
function reportIndexingStatus(bytes32 deploymentId, uint256 _blockheight, bytes32 _mmrRoot, uint256 _timestamp) external
```

### stopIndexing

```solidity
function stopIndexing(bytes32 deploymentId) external
```

### isOffline

```solidity
function isOffline(bytes32 deploymentId, address indexer) external view returns (bool)
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

## ISQToken

### mint

```solidity
function mint(address destination, uint256 amount) external
```

### burn

```solidity
function burn(uint256 amount) external
```

## AgreementType

```solidity
enum AgreementType {
  Closed,
  Open
}
```

## IServiceAgreement

### hasEnded

```solidity
function hasEnded() external view returns (bool)
```

### deploymentId

```solidity
function deploymentId() external view returns (bytes32)
```

### period

```solidity
function period() external view returns (uint256)
```

### startDate

```solidity
function startDate() external view returns (uint256)
```

### value

```solidity
function value() external view returns (uint256)
```

### agreementType

```solidity
function agreementType() external view returns (enum AgreementType)
```

## IClosedServiceAgreement

### indexer

```solidity
function indexer() external view returns (address)
```

### consumer

```solidity
function consumer() external view returns (address)
```

### planId

```solidity
function planId() external view returns (uint256)
```

### planTemplateId

```solidity
function planTemplateId() external view returns (uint256)
```

## IOpenServiceAgreement

### indexers

```solidity
function indexers() external view returns (address[])
```

### consumers

```solidity
function consumers() external view returns (address[])
```

## IServiceAgreementRegistry

### establishServiceAgreement

```solidity
function establishServiceAgreement(address agreementContract) external
```

### hasOngoingServiceAgreement

```solidity
function hasOngoingServiceAgreement(address indexer, bytes32 deploymentId) external view returns (bool)
```

### addUser

```solidity
function addUser(address consumer, address user) external
```

### removeUser

```solidity
function removeUser(address consumer, address user) external
```

## ISettings

### setAllAddresses

```solidity
function setAllAddresses(address _sqToken, address _staking, address _indexerRegistry, address _queryRegistry, address _eraManager, address _planManager, address _serviceAgreementRegistry, address _rewardsDistributer, address _inflationController) external
```

### setSQToken

```solidity
function setSQToken(address _sqToken) external
```

### getSQToken

```solidity
function getSQToken() external view returns (address)
```

### setStaking

```solidity
function setStaking(address _staking) external
```

### getStaking

```solidity
function getStaking() external view returns (address)
```

### setIndexerRegistry

```solidity
function setIndexerRegistry(address _indexerRegistry) external
```

### getIndexerRegistry

```solidity
function getIndexerRegistry() external view returns (address)
```

### setQueryRegistry

```solidity
function setQueryRegistry(address _queryRegistry) external
```

### getQueryRegistry

```solidity
function getQueryRegistry() external view returns (address)
```

### setEraManager

```solidity
function setEraManager(address _eraManager) external
```

### getEraManager

```solidity
function getEraManager() external view returns (address)
```

### getPlanManager

```solidity
function getPlanManager() external view returns (address)
```

### setServiceAgreementRegistry

```solidity
function setServiceAgreementRegistry(address _serviceAgreementRegistry) external
```

### getServiceAgreementRegistry

```solidity
function getServiceAgreementRegistry() external view returns (address)
```

### setRewardsDistributer

```solidity
function setRewardsDistributer(address _rewardsDistributer) external
```

### getRewardsDistributer

```solidity
function getRewardsDistributer() external view returns (address)
```

### setInflationController

```solidity
function setInflationController(address _inflationController) external
```

### getInflationController

```solidity
function getInflationController() external view returns (address)
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

