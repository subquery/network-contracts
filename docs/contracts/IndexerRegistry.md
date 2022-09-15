# Solidity API

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

## IndexerRegistry

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

