// Copyright (C) 2020-2022 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
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
contract ProjectRegistry is Initializable, OwnableUpgradeable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable, IProjectRegistry {
    /// @dev ### STATES
    /// @notice ISettings contract which stores SubProject network contracts address
    ISettings public settings;

    /// @notice next project id
    uint256 public nextProjectId;

    /// @notice is the contract run in creator restrict mode. If in creator restrict mode, only permissioned account allowed to create and update project
    bool public creatorRestricted;

    /// @notice base URI for tokenURI
    string private baseURI;

    /// @notice account address -> is creator
    mapping(address => bool) public creatorWhitelist;

    /// @notice project ids -> ProjectInfo
    mapping(uint256 => ProjectInfo) public projectInfos;

    /// @notice deployment id -> deployment info
    mapping(bytes32 => DeploymentInfo) public deploymentInfos;

    /// @notice deployment id -> indexer -> IndexingServiceStatus
    mapping(bytes32 => mapping(address => IndexingServiceStatus)) public deploymentStatusByIndexer;

    /// @notice indexer -> deployment numbers
    mapping(address => uint256) public numberOfIndexingDeployments;

    /// @dev EVENTS
    /// @notice Emitted when project created.
    event CreateProject(address indexed creator, uint256 indexed projectId, string projectMetadata, ProjectType projectType, bytes32 deploymentId, bytes32 deploymentMetadata);

    /// @notice Emitted when the metadata of the project updated.
    event UpdateProjectMetadata(address indexed owner, uint256 indexed projectId, string metadata);

    /// @notice Emitted when the latestDeploymentId of the project updated.
    event UpdateProjectDeployment(address indexed owner, uint256 indexed projectId, bytes32 deploymentId, bytes32 metadata);

    /// @notice Emitted when indexing status changed with a specific deploymentId.
    event IndexingStatusChanged(address indexed indexer, bytes32 indexed deploymentId, IndexingServiceStatus status);

    /// @dev MODIFIER
    /// @notice only indexer can call
    modifier onlyIndexer() {
        require(IIndexerRegistry(settings.getIndexerRegistry()).isIndexer(msg.sender), 'G002');
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
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();

        settings = _settings;
        creatorRestricted = true;
        creatorWhitelist[msg.sender] = true;
        nextProjectId = 1;
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

    function setBaseURI(string memory baseURI_) external onlyOwner() {
        baseURI = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    /**
     * @notice create a project, if in the restrict mode, only creator allowed to call this function
     */
    function createProject(bytes32 deploymentId, bytes32 deploymentMetdata, string memory projectMetadataUri, ProjectType projectType) external {
        if (creatorRestricted) {
            require(creatorWhitelist[msg.sender], 'QR001');
        }

        require(deploymentInfos[deploymentId].projectId == 0, 'QR006');

        uint256 projectId = nextProjectId;
        projectInfos[projectId] = ProjectInfo(deploymentId, projectType);
        nextProjectId++;

        deploymentInfos[deploymentId] = DeploymentInfo(projectId, deploymentMetdata);

        // Mint the corresponding NFT
        _safeMint(msg.sender, projectId);
        _setTokenURI(projectId, projectMetadataUri);

        emit CreateProject(msg.sender, projectId, projectMetadataUri, projectType, deploymentId, deploymentMetdata);
    }

    /**
     * @notice update the Metadata of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateProjectMetadata(uint256 projectId, string memory metadataUri) external {
        require(ownerOf(projectId) == msg.sender, 'QR007');

        _setTokenURI(projectId, metadataUri);

        emit UpdateProjectMetadata(msg.sender, projectId, metadataUri);
    }

    /**
     * @notice update the deployment of a project, if in the restrict mode, only creator allowed call this function
     */
    function updateDeployment(uint256 projectId, bytes32 deploymentId, bytes32 metadata) external {
        require(ownerOf(projectId) == msg.sender, 'QR008');
        require(deploymentInfos[deploymentId].projectId != 0, 'QR006');

        projectInfos[projectId].latestDeploymentId = deploymentId;
        deploymentInfos[deploymentId] = DeploymentInfo(projectId, metadata);

        emit UpdateProjectDeployment(msg.sender, projectId, deploymentId, metadata);
    }

    /**
     * @notice Indexer update its indexing status to ready with a specific deploymentId
     */
    function updateIndexingStatusToReady(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender];
        require(currentStatus == IndexingServiceStatus.NOTINDEXING, 'QR002');

        deploymentStatusByIndexer[deploymentId][msg.sender] = IndexingServiceStatus.READY;

        emit IndexingStatusChanged(msg.sender, deploymentId, IndexingServiceStatus.READY);
    }

    /**
     * @notice Indexer stop indexing with a specific deploymentId
     */
    function stopIndexing(bytes32 deploymentId) external onlyIndexer {
        IndexingServiceStatus currentStatus = deploymentStatusByIndexer[deploymentId][msg.sender];

        require(currentStatus != IndexingServiceStatus.NOTINDEXING, 'QR010');
        require(
            !IServiceAgreementRegistry(settings.getServiceAgreementRegistry()).hasOngoingClosedServiceAgreement(
                msg.sender,
                deploymentId
            ),
            'QR011'
        );

        deploymentStatusByIndexer[deploymentId][msg.sender] = IndexingServiceStatus.NOTINDEXING;
        numberOfIndexingDeployments[msg.sender]--;
        emit IndexingStatusChanged(msg.sender, deploymentId, IndexingServiceStatus.NOTINDEXING);
    }

    /**
     * @notice is the indexer available to indexing with a specific deploymentId
     */
    function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool) {
        return deploymentStatusByIndexer[deploymentId][indexer] == IndexingServiceStatus.READY;
    }
}
