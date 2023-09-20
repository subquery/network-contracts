// Copyright (C) 2020-2022 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IIndexerRegistry.sol';
import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IProjectRegistry.sol';
import './interfaces/IServiceAgreementRegistry.sol';

/**
 * @title Project Registry Contract
 * @notice ### Overview
 * This contract tracks all projects and their deployments. At the beginning of the network,
 * we will start with the restrict mode which only allow permissioned account to create and update project.
 * Indexers are able to start and stop indexing with a specific deployment from this conttact. Also Indexers can update and report
 * their indexing status from this contarct.
 */
contract ProjectRegistry is Initializable, OwnableUpgradeable, IProjectRegistry {
    /// @notice project information
    struct ProjectInfo {
        uint256 projectId;
        address owner;
        bytes32 latestVersion;
        bytes32 latestDeploymentId;
        bytes32 metadata;
        ProjectType projectType;
    }

    /// @notice indexing status for an indexer
    struct IndexingStatus {
        bytes32 deploymentId;
        uint256 timestamp;
        uint256 blockHeight;
        IndexingServiceStatus status;
    }

    /// @dev ### STATES
    /// @notice ISettings contract which stores SubProject network contracts address
    ISettings public settings;

    /// @notice next project id
    uint256 public nextProjectId;

    /// @notice is the contract run in creator restrict mode. If in creator restrict mode, only permissioned account allowed to create and update project
    bool public creatorRestricted;

    /// @notice Threshold to calculate is indexer offline
    uint256 private offlineCalcThreshold;

    /// @notice project ids -> ProjectInfo
    mapping(uint256 => ProjectInfo) public projectInfos;

    /// @notice account address -> is creator
    mapping(address => bool) public creatorWhitelist;

    /// @notice deployment id -> indexer -> IndexingStatus
    mapping(bytes32 => mapping(address => IndexingStatus)) public deploymentStatusByIndexer;

    /// @notice indexer -> deployment numbers
    mapping(address => uint256) public numberOfIndexingDeployments;

    /// @notice is the id a deployment
    mapping(bytes32 => bool) private deploymentIds;

    /// @dev EVENTS
    /// @notice Emitted when project created.
    event CreateProject(uint256 indexed projectId, address indexed creator, bytes32 metadata, bytes32 deploymentId, bytes32 version, ProjectType projectType);

    /// @notice Emitted when the metadata of the project updated.
    event UpdateProjectMetadata(address indexed owner, uint256 indexed projectId, bytes32 metadata);

    /// @notice Emitted when the latestDeploymentId of the project updated.
    event UpdateProjectDeployment(address indexed owner, uint256 indexed projectId, bytes32 deploymentId, bytes32 version);

    /// @notice Emitted when indexers start indexing.
    event StartIndexing(address indexed indexer, bytes32 indexed deploymentId);

    /// @notice Emitted when indexers report their indexing Status
    event UpdateDeploymentStatus(address indexed indexer, bytes32 indexed deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp);

    /// @notice Emitted when indexers update their indexing Status to ready
    event UpdateIndexingStatusToReady(address indexed indexer, bytes32 indexed deploymentId);

    /// @notice Emitted when indexers stop indexing
    event StopIndexing(address indexed indexer, bytes32 indexed deploymentId);

    /// @dev MODIFIER
    /// @notice only indexer can call
    modifier onlyIndexer() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isIndexer(msg.sender), 'G002');
        _;
    }

    /// @notice only creator can call if it is creatorRestricted
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
     * restrict mode -- only permissioned accounts allowed to create project
     */
    function setCreatorRestricted(bool _creatorRestricted) external onlyOwner {
        creatorRestricted = _creatorRestricted;
    }
    /**
     * @notice set account to creator account that allow to create project
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
        require(currentStatus.status != IndexingServiceStatus.NOTINDEXING, 'QR002');
        require(currentStatus.timestamp < _timestamp, 'QR003');
        require(_timestamp <= block.timestamp, 'QR004');
    }
    /**
     * @notice check if the IndexingStatus available to update BlockHeight
     */
    function canModifyBlockHeight(IndexingStatus memory currentStatus, uint256 blockheight) private pure {
        require(blockheight >= currentStatus.blockHeight, 'QR005');
    }

    /**
     * @notice create a project, if in the restrict mode, only creator allowed to call this function
     */
    function createProject(bytes32 metadata, bytes32 version, bytes32 deploymentId, ProjectType projectType) external onlyCreator {
        require(!deploymentIds[deploymentId], 'QR006');

        uint256 projectId = nextProjectId;
        projectInfos[projectId] = ProjectInfo(projectId, msg.sender, version, deploymentId, metadata, projectType);
        nextProjectId++;
        deploymentIds[deploymentId] = true;

        emit CreateProject(projectId, msg.sender, metadata, deploymentId, version, projectType);
    }

    /**
     * @notice update the Metadata of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateProjectMetadata(uint256 projectId, bytes32 metadata) external onlyCreator {
        address projectOwner = projectInfos[projectId].owner;
        require(projectOwner == msg.sender, 'QR007');

        projectInfos[projectId].metadata = metadata;

        emit UpdateProjectMetadata(projectOwner, projectId, metadata);
    }

    /**
     * @notice update the deployment of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateDeployment(uint256 projectId, bytes32 deploymentId, bytes32 version) external onlyCreator {
        address projectOwner = projectInfos[projectId].owner;
        require(projectOwner == msg.sender, 'QR008');
        require(!deploymentIds[deploymentId], 'QR006');

        projectInfos[projectId].latestDeploymentId = deploymentId;
        projectInfos[projectId].latestVersion = version;
        deploymentIds[deploymentId] = true;

        emit UpdateProjectDeployment(projectOwner, projectId, deploymentId, version);
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
    function reportIndexingStatus(address indexer, bytes32 deploymentId, uint256 blockheight, bytes32 mmrRoot, uint256 timestamp) external {
        require(indexer == msg.sender || IIndexerRegistry(settings.getIndexerRegistry()).getController(indexer) == msg.sender, 'IR007');

        IndexingStatus storage currentStatus = deploymentStatusByIndexer[deploymentId][indexer];
        canModifyStatus(currentStatus, timestamp);
        canModifyBlockHeight(currentStatus, blockheight);

        currentStatus.timestamp = timestamp;
        currentStatus.blockHeight = blockheight;

        emit UpdateDeploymentStatus(indexer, deploymentId, blockheight, mmrRoot, timestamp);
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
