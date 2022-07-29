// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IIndexerRegistry.sol';
import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IServiceAgreementRegistry.sol';

enum IndexingServiceStatus {
    NOTINDEXING,
    INDEXING,
    READY
}

contract QueryRegistry is Initializable, OwnableUpgradeable, IQueryRegistry {
    ISettings public settings;

    // mapping(string => bool) public isQueryId;
    mapping(address => uint256[]) public queryInfoIdsByOwner;
    mapping(uint256 => QueryInfo) public queryInfos;
    uint256 public nextQueryId;
    uint256 offlineCalcThreshold;

    mapping(bytes32 => mapping(address => IndexingStatus)) public deploymentStatusByIndexer;
    mapping(address => uint256) public numberOfIndexingDeployments;
    mapping(bytes32 => bool) deploymentIds;

    // TODO: 1:1 match between queryId and deploymentId, should we just separate it?

    // query info
    struct QueryInfo {
        uint256 queryId;
        address owner;
        bytes32 latestVersion;
        bytes32 latestDeploymentId;
        bytes32 metadata;
    }

    struct IndexingStatus {
        bytes32 deploymentId;
        uint256 timestamp;
        uint256 blockHeight;
        IndexingServiceStatus status;
    }

    event CreateQuery(
        uint256 indexed queryId,
        address indexed creator,
        bytes32 metadata,
        bytes32 deploymentId,
        bytes32 version
    );
    event UpdateQueryMetadata(address indexed owner, uint256 indexed queryId, bytes32 metadata);
    event UpdateQueryDeployment(address indexed owner, uint256 indexed queryId, bytes32 deploymentId, bytes32 version);

    event StartIndexing(address indexed indexer, bytes32 indexed deploymentId);

    event UpdateDeploymentStatus(
        address indexed indexer,
        bytes32 indexed deploymentId,
        uint256 blockheight,
        bytes32 mmrRoot,
        uint256 timestamp
    );

    event UpdateIndexingStatusToReady(address indexed indexer, bytes32 indexed deploymentId);

    event StopIndexing(address indexed indexer, bytes32 indexed deploymentId);

    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        offlineCalcThreshold = 1 days;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external onlyOwner {
        offlineCalcThreshold = _offlineCalcThreshold;
    }

    modifier onlyIndexer() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isIndexer(msg.sender), 'caller is not an indexer');
        _;
    }

    modifier onlyIndexerController() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isController(msg.sender), 'caller is not a controller');
        _;
    }

    function canModifyStatus(IndexingStatus memory currentStatus, uint256 _timestamp) private view {
        require(
            currentStatus.status != IndexingServiceStatus.NOTINDEXING,
            'can not update status for NOTINDEXING services'
        );
        require(currentStatus.timestamp < _timestamp, 'only timestamp that is after previous timestamp is valid');
        require(_timestamp <= block.timestamp, 'timestamp cannot be in the future');
    }

    function canModifyBlockHeight(IndexingStatus memory currentStatus, uint256 blockheight) private pure {
        require(
            blockheight >= currentStatus.blockHeight,
            'can not update status when blockheight submitted < current value'
        );
    }

    // project creator function
    function createQueryProject(
        bytes32 metadata,
        bytes32 version,
        bytes32 deploymentId
    ) external {
        uint256 queryId = nextQueryId;
        require(deploymentIds[deploymentId] == false, 'Deployment Id already registered');
        queryInfos[queryId] = QueryInfo(queryId, msg.sender, version, deploymentId, metadata);
        queryInfoIdsByOwner[msg.sender].push(queryId);
        nextQueryId++;
        deploymentIds[deploymentId] = true;
        emit CreateQuery(queryId, msg.sender, metadata, deploymentId, version);
    }

    // project creator function
    function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external {
        address owner = queryInfos[queryId].owner;
        require(owner == msg.sender, 'no permission to update query project metadata');
        queryInfos[queryId].metadata = metadata;
        emit UpdateQueryMetadata(owner, queryId, metadata);
    }

    // project creator function
    function updateDeployment(
        uint256 queryId,
        bytes32 deploymentId,
        bytes32 version
    ) external {
        address owner = queryInfos[queryId].owner;
        require(owner == msg.sender, 'no permission to update query project deployment');
        require(deploymentIds[deploymentId] == false, 'Deployment Id already registered');
        queryInfos[queryId].latestDeploymentId = deploymentId;
        queryInfos[queryId].latestVersion = version;
        deploymentIds[deploymentId] = true;
        emit UpdateQueryDeployment(owner, queryId, deploymentId, version);
    }

    // indexer function
    function startIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender].status;
        require(currentStatus == IndexingServiceStatus.NOTINDEXING, 'indexing status should be NOTINDEXING status');
        require(deploymentIds[deploymentId], 'Deployment Id not registered');
        deploymentStatusByIndexer[deploymentId][msg.sender] = IndexingStatus(
            deploymentId,
            0,
            0,
            IndexingServiceStatus.INDEXING
        );
        numberOfIndexingDeployments[msg.sender]++;
        emit StartIndexing(msg.sender, deploymentId);
    }

    // indexer function
    function updateIndexingStatusToReady(bytes32 deploymentId) external onlyIndexer {
        address indexer = msg.sender;
        uint256 timestamp = block.timestamp;

        IndexingStatus storage currentStatus = deploymentStatusByIndexer[deploymentId][indexer];
        canModifyStatus(currentStatus, timestamp);

        currentStatus.status = IndexingServiceStatus.READY;
        currentStatus.timestamp = timestamp;
        emit UpdateIndexingStatusToReady(indexer, deploymentId);
    }

    // indexer controller function
    function reportIndexingStatus(
        bytes32 deploymentId,
        uint256 _blockheight,
        bytes32 _mmrRoot,
        uint256 _timestamp
    ) external onlyIndexerController {
        address indexer = IIndexerRegistry(settings.getIndexerRegistry()).controllerToIndexer(msg.sender);

        IndexingStatus storage currentStatus = deploymentStatusByIndexer[deploymentId][indexer];
        canModifyStatus(currentStatus, _timestamp);
        canModifyBlockHeight(currentStatus, _blockheight);

        currentStatus.timestamp = _timestamp;
        currentStatus.blockHeight = _blockheight;

        emit UpdateDeploymentStatus(indexer, deploymentId, _blockheight, _mmrRoot, _timestamp);
    }

    function stopIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender].status;

        require(currentStatus != IndexingServiceStatus.NOTINDEXING, 'can not stop indexing for NOTINDEXING services');

        require(
            !IServiceAgreementRegistry(settings.getServiceAgreementRegistry()).hasOngoingClosedServiceAgreement(
                msg.sender,
                deploymentId
            ),
            'cannot stop indexing with an ongoing service agreement'
        );

        deploymentStatusByIndexer[deploymentId][msg.sender].status = IndexingServiceStatus.NOTINDEXING;
        numberOfIndexingDeployments[msg.sender]--;
        emit StopIndexing(msg.sender, deploymentId);
    }

    function queryInfoCountByOwner(address user) external view returns (uint256) {
        return queryInfoIdsByOwner[user].length;
    }

    function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool) {
        return deploymentStatusByIndexer[deploymentId][indexer].status == IndexingServiceStatus.READY;
    }

    function isOffline(bytes32 deploymentId, address indexer) external view returns (bool) {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][indexer].status;
        if (currentStatus == IndexingServiceStatus.NOTINDEXING) {
            return false;
        }

        return deploymentStatusByIndexer[deploymentId][indexer].timestamp + offlineCalcThreshold < block.timestamp;
    }

    // TODO: in case multiple indexers do same query project, the latest status could be used.
    // This should be handled on contract side?

    // user function - view
    // users can view deployment status by indexer from deploymentStatusByIndexer
    // users can get projects with metadata with queryInfo public variable
    // users can get indexers' status for deployment from logs by indexer
    // users can search projects by some rules via database
}
