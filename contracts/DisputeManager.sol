// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStakingManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/ISQToken.sol';
import './interfaces/IDisputeManager.sol';

contract DisputeManager is IDisputeManager, Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    enum DisputeType {
        POI,
        Query
    }

    enum DisputeState {
        Ongoing,
        Accepted,
        Rejected,
        Cancelled
    }

    struct Dispute {
        uint256 disputeId;
        address indexer;                  // indexer address
        address fisherman;                // fisherman address
        uint256 depositAmount;            // fisherman deposit amount
        bytes32 deploymentId;             // project deployment id
        DisputeType dtype;                // dispute type (POI or Query)
        DisputeState state;               // dispute state, defult ongoing (ongoing, accept, reject, cancelled)
    }

    ISettings public settings;
    uint256 public nextDisputeId;
    uint256 public minimumDeposit;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public disputeIdByIndexer;

    event DisputeOpen(uint256 indexed disputeId, address fisherman, address indexer, DisputeType _type);

    event DisputeFinalized(uint256 indexed disputeId, DisputeState state, uint256 slashAmount, uint256 returnAmount);

    function initialize(ISettings _settings, uint256 _minimumDeposit) external initializer {
        __Ownable_init();

        settings = _settings;
        nextDisputeId = 1;
        minimumDeposit = _minimumDeposit;
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    function setMinimumDeposit(uint256 _minimumDeposit) external onlyOwner {
        minimumDeposit = _minimumDeposit;
    }

    function createDispute(
        address _indexer, 
        bytes32 _deploymentId,
        uint256 _deposit,  
        DisputeType _type
    ) external {
        require(disputeIdByIndexer[_indexer].length <= 20, 'D001');
        require(_deposit >= minimumDeposit, 'D002');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransferFrom(msg.sender, address(this), _deposit);

        Dispute storage dispute = disputes[nextDisputeId];
        dispute.disputeId = nextDisputeId;
        dispute.indexer = _indexer;
        dispute.fisherman = msg.sender;
        dispute.depositAmount = _deposit;
        dispute.deploymentId = _deploymentId;
        dispute.dtype = _type;
        dispute.state = DisputeState.Ongoing;

        disputeIdByIndexer[_indexer].push(nextDisputeId);

        emit DisputeOpen(nextDisputeId, msg.sender, _indexer, _type);
        nextDisputeId++;
    }

    function finalizeDispute(uint256 disputeId, DisputeState state, uint256 indexerSlashAmount, uint256 newDeposit) external onlyOwner {
        require(state != DisputeState.Ongoing, 'D003');
        Dispute storage dispute = disputes[disputeId];
        require(dispute.state == DisputeState.Ongoing, 'D004');
        //accept dispute, slash indexer, reward fisherman
        if (state == DisputeState.Accepted) {
            require(newDeposit > dispute.depositAmount, 'D005');
            uint256 rewardAmount = newDeposit - dispute.depositAmount;
            require(rewardAmount <= indexerSlashAmount, 'D005');
            IStakingManager(settings.getContractAddress(SQContracts.StakingManager)).slashIndexer(dispute.indexer, indexerSlashAmount);
        } else if (state == DisputeState.Rejected) {
            //reject dispute, slash fisherman
            require(newDeposit < dispute.depositAmount, 'D005');
        } else if (state == DisputeState.Cancelled) {
            //cancel dispute, return fisherman deposit
            require(newDeposit == dispute.depositAmount, 'D005');
        }

        dispute.state = state;
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(dispute.fisherman, newDeposit);

        uint256[] memory ids = disputeIdByIndexer[dispute.indexer];
        delete disputeIdByIndexer[dispute.indexer];
        for (uint256 i; i < ids.length; i++) {
            if (disputeId != ids[i]) {
                disputeIdByIndexer[dispute.indexer].push(ids[i]);
            }
        }

        emit DisputeFinalized(disputeId, state, indexerSlashAmount, newDeposit);
    }

    function isOnDispute(address indexer) external view returns (bool) {
        return disputeIdByIndexer[indexer].length > 0;
    }
}