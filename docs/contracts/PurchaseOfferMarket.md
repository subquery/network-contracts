# Solidity API

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

## PurchaseOfferMarket

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

