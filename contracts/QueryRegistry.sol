// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IIndexerRegistry.sol';
import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IQueryRegistry.sol';
import './interfaces/IServiceAgreementRegistry.sol';

/**
 * @title Query Registry Contract
 * @notice ### Overview
 * This contract tracks all query projects and their deployments. At the beginning of the network,
 * we will start with the restrict mode which only allow permissioned account to create and update query project.
 * Indexers are able to start and stop indexing with a specific deployment from this conttact. Also Indexers can update and report
 * their indexing status from this contarct.
 */
contract QueryRegistry is Initializable, OwnableUpgradeable, IQueryRegistry {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubQuery network contracts address
    ISettings public settings;
    /// @notice creator address -> query project ids
    mapping(address => uint256[]) public queryInfoIdsByOwner;
    /// @notice query project ids -> QueryInfo
    mapping(uint256 => QueryInfo) public queryInfos;
    /// @notice account address -> is creator
    mapping(address => bool) public creatorWhitelist;
    /// @notice next query project id
    uint256 public nextQueryId;
    /// @notice Threshold to calculate is indexer offline
    uint256 private offlineCalcThreshold;
    /// @notice is the contract run in creator restrict mode. If in creator restrict mode, only permissioned account allowed to create and update query project
    bool public creatorRestricted;
    /// @notice deployment id -> indexer -> IndexingStatus
    mapping(bytes32 => mapping(address => IndexingStatus)) public deploymentStatusByIndexer;
    /// @notice indexer -> deployment numbers
    mapping(address => uint256) public numberOfIndexingDeployments;
    /// @notice is the id a deployment
    mapping(bytes32 => bool) private deploymentIds;

    /// @notice query project information
    struct QueryInfo {
        uint256 queryId;
        address owner;
        bytes32 latestVersion;
        bytes32 latestDeploymentId;
        bytes32 metadata;
    }

    /// @notice indexing status for an indexer
    struct IndexingStatus {
        bytes32 deploymentId;
        uint256 timestamp;
        uint256 blockHeight;
        IndexingServiceStatus status;
    }

    /// @dev EVENTS
    /// @notice Emitted when query project created.
    event CreateQuery(
        uint256 indexed queryId,
        address indexed creator,
        bytes32 metadata,
        bytes32 deploymentId,
        bytes32 version
    );
    /// @notice Emitted when the metadata of the query project updated.
    event UpdateQueryMetadata(address indexed owner, uint256 indexed queryId, bytes32 metadata);
    /// @notice Emitted when the latestDeploymentId of the query project updated.
    event UpdateQueryDeployment(address indexed owner, uint256 indexed queryId, bytes32 deploymentId, bytes32 version);
    /// @notice Emitted when indexers start indexing.
    event StartIndexing(address indexed indexer, bytes32 indexed deploymentId);
    /// @notice Emitted when indexers report their indexing Status
    event UpdateDeploymentStatus(
        address indexed indexer,
        bytes32 indexed deploymentId,
        uint256 blockheight,
        bytes32 mmrRoot,
        uint256 timestamp
    );
    /// @notice Emitted when indexers update their indexing Status to ready
    event UpdateIndexingStatusToReady(address indexed indexer, bytes32 indexed deploymentId);
    /// @notice Emitted when indexers stop indexing
    event StopIndexing(address indexed indexer, bytes32 indexed deploymentId);

    modifier onlyIndexer() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isIndexer(msg.sender), 'G002');
        _;
    }

    modifier onlyIndexerController() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isController(msg.sender), 'IR007');
        _;
    }

    modifier onlyCreator() {
        if (creatorRestricted) {
            require(creatorWhitelist[msg.sender], 'QR001');
        }
        _;
    }

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract
     * @param _settings ISettings contract
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        offlineCalcThreshold = 1 days;
        creatorRestricted = true;
        creatorWhitelist[msg.sender] = true;
    }

    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }
    /**
     * @notice set the mode to restrict or not
     * restrict mode -- only permissioned accounts allowed to create query project
     */
    function setCreatorRestricted(bool _creatorRestricted) external onlyOwner {
        creatorRestricted = _creatorRestricted;
    }
    /**
     * @notice set account to creator account that allow to create query project
     */
    function addCreator(address creator) external onlyOwner {
        creatorWhitelist[creator] = true;
    }
    /**
     * @notice remove creator account
     */
    function removeCreator(address creator) external onlyOwner {
        creatorWhitelist[creator] = false;
    }
    /**
     * @notice set the threshold to calculate whether the indexer is offline
     */
    function setOfflineCalcThreshold(uint256 _offlineCalcThreshold) external onlyOwner {
        offlineCalcThreshold = _offlineCalcThreshold;
    }

    /**
     * @notice check if the IndexingStatus available to update ststus
     */
    function canModifyStatus(IndexingStatus memory currentStatus, uint256 _timestamp) private view {
        require(
            currentStatus.status != IndexingServiceStatus.NOTINDEXING,
            'QR002'
        );
        require(currentStatus.timestamp < _timestamp, 'QR003');
        require(_timestamp <= block.timestamp, 'QR004');
    }
    /**
     * @notice check if the IndexingStatus available to update BlockHeight
     */
    function canModifyBlockHeight(IndexingStatus memory currentStatus, uint256 blockheight) private pure {
        require(
            blockheight >= currentStatus.blockHeight,
            'QR005'
        );
    }

    /**
     * @notice create a QueryProject, if in the restrict mode, only creator allowed to call this function
     */
    function createQueryProject(
        bytes32 metadata,
        bytes32 version,
        bytes32 deploymentId
    ) external onlyCreator {
        uint256 queryId = nextQueryId;
        require(!deploymentIds[deploymentId], 'QR006');
        queryInfos[queryId] = QueryInfo(queryId, msg.sender, version, deploymentId, metadata);
        queryInfoIdsByOwner[msg.sender].push(queryId);
        nextQueryId++;
        deploymentIds[deploymentId] = true;
        emit CreateQuery(queryId, msg.sender, metadata, deploymentId, version);
    }

    /**
     * @notice update the Metadata of a QueryProject, if in the restrict mode, only creator allowed call this function
     */
    function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external onlyCreator {
        address queryOwner = queryInfos[queryId].owner;
        require(queryOwner == msg.sender, 'QR007');
        queryInfos[queryId].metadata = metadata;
        emit UpdateQueryMetadata(queryOwner, queryId, metadata);
    }

    /**
     * @notice update the deployment of a QueryProject, if in the restrict mode, only creator allowed call this function
     */
    function updateDeployment(
        uint256 queryId,
        bytes32 deploymentId,
        bytes32 version
    ) external onlyCreator {
        address queryOwner = queryInfos[queryId].owner;
        require(queryOwner == msg.sender, 'QR008');
        require(!deploymentIds[deploymentId], 'QR006');
        queryInfos[queryId].latestDeploymentId = deploymentId;
        queryInfos[queryId].latestVersion = version;
        deploymentIds[deploymentId] = true;
        emit UpdateQueryDeployment(queryOwner, queryId, deploymentId, version);
    }

    /**
     * @notice Indexer start indexing with a specific deploymentId
     */
    function startIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender].status;
        require(currentStatus == IndexingServiceStatus.NOTINDEXING, 'QR009');
        require(deploymentIds[deploymentId], 'QR006');
        deploymentStatusByIndexer[deploymentId][msg.sender] = IndexingStatus(
            deploymentId,
            0,
            0,
            IndexingServiceStatus.INDEXING
        );
        numberOfIndexingDeployments[msg.sender]++;
        emit StartIndexing(msg.sender, deploymentId);
    }

    /**
     * @notice Indexer update its indexing status to ready with a specific deploymentId
     */
    function updateIndexingStatusToReady(bytes32 deploymentId) external onlyIndexer {
        address indexer = msg.sender;
        uint256 timestamp = block.timestamp;

        IndexingStatus storage currentStatus = deploymentStatusByIndexer[deploymentId][indexer];
        canModifyStatus(currentStatus, timestamp);

        currentStatus.status = IndexingServiceStatus.READY;
        currentStatus.timestamp = timestamp;
        emit UpdateIndexingStatusToReady(indexer, deploymentId);
    }

    /**
     * @notice Indexer report its indexing status with a specific deploymentId
     */
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

    /**
     * @notice Indexer stop indexing with a specific deploymentId
     */
    function stopIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender].status;

        require(currentStatus != IndexingServiceStatus.NOTINDEXING, 'QR010');

        require(
            !IServiceAgreementRegistry(settings.getServiceAgreementRegistry()).hasOngoingClosedServiceAgreement(
                msg.sender,
                deploymentId
            ),
            'QR011'
        );

        deploymentStatusByIndexer[deploymentId][msg.sender].status = IndexingServiceStatus.NOTINDEXING;
        numberOfIndexingDeployments[msg.sender]--;
        emit StopIndexing(msg.sender, deploymentId);
    }

    /**
     * @notice the number of query projects create by the account
     */
    function queryInfoCountByOwner(address user) external view returns (uint256) {
        return queryInfoIdsByOwner[user].length;
    }
    /**
     * @notice is the indexer available to indexing with a specific deploymentId
     */
    function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool) {
        return deploymentStatusByIndexer[deploymentId][indexer].status == IndexingServiceStatus.READY;
    }
    /**
     * @notice is the indexer offline on a specific deploymentId
     */
    function isOffline(bytes32 deploymentId, address indexer) external view returns (bool) {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][indexer].status;
        if (currentStatus == IndexingServiceStatus.NOTINDEXING) {
            return false;
        }

        return deploymentStatusByIndexer[deploymentId][indexer].timestamp + offlineCalcThreshold < block.timestamp;
    }
}
