# Solidity API

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

