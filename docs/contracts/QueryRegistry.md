# Solidity API

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

