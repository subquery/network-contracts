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
 * @dev
 * ## Overview
 * This contract tracks all query projects and their deployments. At the beginning of the network,
 * we will start with the restrict mode which only allow permissioned account to create and update query project.
 * Indexers are able to start and stop indexing with a specific deployment from this conttact. Also Indexers can update and report 
 * their indexing status from this contarct.
 */
contract QueryRegistry is Initializable, OwnableUpgradeable, IQueryRegistry {
    ISettings public settings;

    //creator address -> query project ids
    mapping(address => uint256[]) public queryInfoIdsByOwner;
    //query project ids -> QueryInfo
    mapping(uint256 => QueryInfo) public queryInfos;
    //account address -> is creator
    mapping(address => bool) public creatorWhitelist;
    //next query project id 
    uint256 public nextQueryId;
    //Threshold to calculate is indexer offline
    uint256 private offlineCalcThreshold;
    //is the contract run in creator restrict mode.
    //If in creator restrict mode, only permissioned account allowed to create and update query project
    bool public creatorRestricted;
    //deployment id -> indexer -> IndexingStatus
    mapping(bytes32 => mapping(address => IndexingStatus)) public deploymentStatusByIndexer;
    //indexer -> deployment numbers
    mapping(address => uint256) public numberOfIndexingDeployments;
    //is the id a deployment
    mapping(bytes32 => bool) private deploymentIds;

    // TODO: 1:1 match between queryId and deploymentId, should we just separate it?

    //query project information 
    struct QueryInfo {
        uint256 queryId;
        address owner;
        bytes32 latestVersion;
        bytes32 latestDeploymentId;
        bytes32 metadata;
    }
    
    //indexing status for an indexer
    struct IndexingStatus {
        bytes32 deploymentId;
        uint256 timestamp;
        uint256 blockHeight;
        IndexingServiceStatus status;
    }

    /**
     * @dev Emitted when query project created.
     */
    event CreateQuery(
        uint256 indexed queryId,
        address indexed creator,
        bytes32 metadata,
        bytes32 deploymentId,
        bytes32 version
    );
    /**
     * @dev Emitted when the metadata of the query project updated.
     */
    event UpdateQueryMetadata(address indexed owner, uint256 indexed queryId, bytes32 metadata);
    /**
     * @dev Emitted when the latestDeploymentId of the query project updated.
     */
    event UpdateQueryDeployment(address indexed owner, uint256 indexed queryId, bytes32 deploymentId, bytes32 version);
    /**
     * @dev Emitted when indexers start indexing.
     */
    event StartIndexing(address indexed indexer, bytes32 indexed deploymentId);
    /**
     * @dev Emitted when indexers report their indexing Status 
     */
    event UpdateDeploymentStatus(
        address indexed indexer,
        bytes32 indexed deploymentId,
        uint256 blockheight,
        bytes32 mmrRoot,
        uint256 timestamp
    );
    /**
     * @dev Emitted when indexers update their indexing Status to ready
     */
    event UpdateIndexingStatusToReady(address indexed indexer, bytes32 indexed deploymentId);
    /**
     * @dev Emitted when indexers stop indexing
     */
    event StopIndexing(address indexed indexer, bytes32 indexed deploymentId);

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
     * @dev set the mode to restrict or not 
     * restrict mode -- only permissioned accounts allowed to create query project
     */
    function setCreatorRestricted(bool _creatorRestricted) external onlyOwner {
        creatorRestricted = _creatorRestricted;
    }
    /**
     * @dev set account to creator account that allow to create query project
     */
    function addCreator(address creator) external onlyOwner {
        creatorWhitelist[creator] = true;
    }
    /**
     * @dev remove creator account
     */
    function removeCreator(address creator) external onlyOwner {
        creatorWhitelist[creator] = false;
    }
    /**
     * @dev set the threshold to calculate whether the indexer is offline
     */
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

    modifier onlyCreator() {
        if (creatorRestricted) {
            require(creatorWhitelist[msg.sender], 'Address is not authorised to operate query project');
        }
        _;
    }
    /**
     * @dev check if the IndexingStatus available to update ststus
     */
    function canModifyStatus(IndexingStatus memory currentStatus, uint256 _timestamp) private view {
        require(
            currentStatus.status != IndexingServiceStatus.NOTINDEXING,
            'can not update status for NOTINDEXING services'
        );
        require(currentStatus.timestamp < _timestamp, 'only timestamp that is after previous timestamp is valid');
        require(_timestamp <= block.timestamp, 'timestamp cannot be in the future');
    }
    /**
     * @dev check if the IndexingStatus available to update BlockHeight
     */
    function canModifyBlockHeight(IndexingStatus memory currentStatus, uint256 blockheight) private pure {
        require(
            blockheight >= currentStatus.blockHeight,
            'can not update status when blockheight submitted < current value'
        );
    }

    /**
     * @dev create a QueryProject, if in the restrict mode, only creator allowed call this function
     */
    function createQueryProject(
        bytes32 metadata,
        bytes32 version,
        bytes32 deploymentId
    ) external onlyCreator {
        uint256 queryId = nextQueryId;
        require(!deploymentIds[deploymentId], 'Deployment Id already registered');
        queryInfos[queryId] = QueryInfo(queryId, msg.sender, version, deploymentId, metadata);
        queryInfoIdsByOwner[msg.sender].push(queryId);
        nextQueryId++;
        deploymentIds[deploymentId] = true;
        emit CreateQuery(queryId, msg.sender, metadata, deploymentId, version);
    }

    /**
     * @dev update the Metadata of a QueryProject, if in the restrict mode, only creator allowed call this function
     */
    function updateQueryProjectMetadata(uint256 queryId, bytes32 metadata) external onlyCreator {
        address queryOwner = queryInfos[queryId].owner;
        require(queryOwner == msg.sender, 'no permission to update query project metadata');
        queryInfos[queryId].metadata = metadata;
        emit UpdateQueryMetadata(queryOwner, queryId, metadata);
    }

    /**
     * @dev update the deployment of a QueryProject, if in the restrict mode, only creator allowed call this function
     */
    function updateDeployment(
        uint256 queryId,
        bytes32 deploymentId,
        bytes32 version
    ) external onlyCreator {
        address queryOwner = queryInfos[queryId].owner;
        require(queryOwner == msg.sender, 'no permission to update query project deployment');
        require(!deploymentIds[deploymentId], 'Deployment Id already registered');
        queryInfos[queryId].latestDeploymentId = deploymentId;
        queryInfos[queryId].latestVersion = version;
        deploymentIds[deploymentId] = true;
        emit UpdateQueryDeployment(queryOwner, queryId, deploymentId, version);
    }

    /**
     * @dev Indexer start indexing with a specific deploymentId
     */
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

    /**
     * @dev Indexer update its indexing status to ready with a specific deploymentId
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
     * @dev Indexer report its indexing status with a specific deploymentId
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
     * @dev Indexer stop indexing with a specific deploymentId
     */
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

    /**
     * @dev the number of query projects create by the account
     */
    function queryInfoCountByOwner(address user) external view returns (uint256) {
        return queryInfoIdsByOwner[user].length;
    }
    /**
     * @dev is the indexer available to indexing with a specific deploymentId
     */
    function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool) {
        return deploymentStatusByIndexer[deploymentId][indexer].status == IndexingServiceStatus.READY;
    }
    /**
     * @dev is the indexer offline on a specific deploymentId
     */
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
