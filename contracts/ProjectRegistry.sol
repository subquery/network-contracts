// Copyright (C) 2020-2022 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
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
contract ProjectRegistry is Initializable, OwnableUpgradeable, IProjectRegistry, ERC721Enumerable, ERC721URIStorage {
    /// @notice project information
    struct ProjectInfo {
        bytes32 latestDeploymentId;
        ProjectType projectType;
    }

    /// @notice deployment information
    struct DeploymentInfo {
        uint256 projectId;
        bytes32 metadata;
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

    /// @notice account address -> is creator
    mapping(address => bool) public creatorWhitelist;

    /// @notice project ids -> ProjectInfo
    mapping(uint256 => ProjectInfo) public projectInfos;

    /// @notice deployment id -> deployment info
    mapping(bytes32 => DeploymentInfo) private deploymentInfos;

    /// @notice deployment id -> indexer -> IndexingStatus
    mapping(bytes32 => mapping(address => IndexingStatus)) public deploymentStatusByIndexer;

    /// @notice indexer -> deployment numbers
    mapping(address => uint256) public numberOfIndexingDeployments;

    /// @dev EVENTS
    /// @notice Emitted when project created.
    event CreateProject(uint256 indexed projectId, address indexed creator, bytes32 projectMetadata, bytes32 deploymentId, bytes32 deploymentMetadata, ProjectType projectType);

    /// @notice Emitted when the metadata of the project updated.
    event UpdateProjectMetadata(address indexed owner, uint256 indexed projectId, bytes32 metadata);

    /// @notice Emitted when the latestDeploymentId of the project updated.
    event UpdateProjectDeployment(address indexed owner, uint256 indexed projectId, bytes32 deploymentId, bytes32 metadata);

    /// @notice Emitted when indexers start indexing.
    event StartIndexing(address indexed indexer, bytes32 indexed deploymentId);

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
        __ERC721_init("SuqueryProject", "SP");

        settings = _settings;
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
     * @notice check if the IndexingStatus available to update ststus
     */
    function canModifyStatus(IndexingStatus memory currentStatus, uint256 _timestamp) private view {
        require(currentStatus.status != IndexingServiceStatus.NOTINDEXING, 'QR002');
        require(currentStatus.timestamp < _timestamp, 'QR003');
        require(_timestamp <= block.timestamp, 'QR004');
    }

    /**
     * @notice create a project, if in the restrict mode, only creator allowed to call this function
     */
    function createProject(bytes32 deploymentId, bytes32 deploymentMetdata, string memory projectMetadataUri, ProjectType projectType) external onlyCreator {
        require(!deploymentInfos[deploymentId], 'QR006');

        uint256 projectId = nextProjectId;
        projectInfos[projectId] = ProjectInfo(deploymentId, projectType);
        nextProjectId++;

        deploymentInfos[deploymentId] = DeploymentInfo(projectId, deploymentMetdata);

        // Mint the corresponding NFT
        _safeMint(msg.sender, projectId);
        _setTokenURI(projectId, projectMetadataUri);

        emit CreateProject(projectId, msg.sender, projectMetadataUri, deploymentId, deploymentMetdata, projectType);
    }

    /**
     * @notice update the Metadata of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateProjectMetadata(uint256 projectId, string memory metadataUri) external onlyCreator {
        require(ownerOf(projectId) == msg.sender, 'QR007');

        _setTokenURI(projectId, metadataUri);

        emit UpdateProjectMetadata(projectOwner, projectId, metadata);
    }

    /**
     * @notice update the deployment of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateDeployment(uint256 projectId, bytes32 deploymentId, bytes32 metadata) external onlyCreator {
        address projectOwner = ownerOf(projectId);
        require(projectOwner == msg.sender, 'QR008');
        require(!deploymentInfos[deploymentId], 'QR006');

        projectInfos[projectId].latestDeploymentId = deploymentId;
        deploymentInfos[deploymentId] = DeploymentInfo(projectId, metadata);

        emit UpdateProjectDeployment(projectOwner, projectId, deploymentId, metadata);
    }

    /**
     * @notice Indexer start indexing with a specific deploymentId
     */
    function startIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender].status;
        require(currentStatus == IndexingServiceStatus.NOTINDEXING, 'QR009');
        require(deploymentInfos[deploymentId], 'QR006');

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
}
