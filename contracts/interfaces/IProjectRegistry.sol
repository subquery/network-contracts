// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

enum IndexingServiceStatus {
    NOTINDEXING,
    INDEXING,
    READY
}

enum ProjectType {
    SUBQUERY,
    RPC
}

interface IProjectRegistry {

    function numberOfIndexingDeployments(address _address) external view returns (uint256);

    function isIndexingAvailable(bytes32 deploymentId, address indexer) external view returns (bool);

    function createProject(
        bytes32 metadata,
        bytes32 version,
        bytes32 deploymentId,
        ProjectType projectType
    ) external;

    function updateProjectMetadata(uint256 projectId, bytes32 metadata) external;

    function updateDeployment(
        uint256 projectId,
        bytes32 deploymentId,
        bytes32 version
    ) external;

    function startIndexing(bytes32 deploymentId) external;

    function updateIndexingStatusToReady(bytes32 deploymentId) external;

    function reportIndexingStatus(
        address indexer,
        bytes32 deploymentId,
        uint256 _blockheight,
        bytes32 _mmrRoot,
        uint256 _timestamp
    ) external;

    function stopIndexing(bytes32 deploymentId) external;

    function isOffline(bytes32 deploymentId, address indexer) external view returns (bool);
}
