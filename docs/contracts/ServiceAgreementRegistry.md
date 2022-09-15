# Solidity API

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

