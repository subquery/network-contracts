// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IStaking.sol';
import './interfaces/ISettings.sol';
import './interfaces/IEraManager.sol';
import './interfaces/ISQToken.sol';

contract DisputeManager is IDisputeManager, Initializable {
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
        uint256 stakingAmount;            // indexer staking amount
        uint256 depositAmount;            // fisherman deposit amount
        bytes32 metadata;                 // IPFS address of metadata payload	
        bytes32 deploymentId;             // project deployment id
        DisputeType dtype;                // dispute type (POI or Query)
        uint256 expireEra;                // dispute expired era number
        DisputeState state;               // dispute state, defult ongoing (ongoing, accept, reject, cancelled)
    }

    ISettings public settings;
    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256) public disputeIdByIndexer;

    event DisputeOpen(uint256 indexed disputeId, address fisherman, address indexer, bytes32 metadata, DisputeType _type);

    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        settings = _settings;
        nextDisputeId = 1;
    }

    function createDispute(
        address _indexer, 
        bytes32 _deploymentId; 
        uint256 _deposit, 
        bytes32 _metadata, 
        DisputeType _type
    ) external {
        require(disputeIdByIndexer[_indexer] == 0, 'indexer already on a dispute')
        require(_deposit >= minimumDeposit, 'Not meet the minimum deposit');
        IERC20(settings.getSQToken()).safeTransferFrom(msg.sender, address(this), _deposit);

        // initial the channel
        Dispute storage dispute = disputes[nextDisputeId];
        dispute.disputeId = nextDisputeId;
        dispute.indexer = _indexer;
        dispute.fisherman = msg.sender;
        dispute.stakingAmount = IStaking(settings.getStaking()).getAfterDelegationAmount(_indexer, _indexer);
        dispute.depositAmount = _deposit;
        dispute.metadata = _metadata;
        dispute.deploymentId = _deploymentId;
        dispute.dtype = _type;
        dispute.expireEra = IEraManager(settings.getEraManager()).eraNumber()+2;
        dispute.state = DisputeState.Ongoing;

        disputeIdByIndexer[_indexer] = nextDisputeId;

        emit DisputeOpen(nextDisputeId, msg.sender, _indexer, _metadata, _type);
        nextDisputeId++;
    }

    function extendDispute(uint256 disputeId, uint256 newExpireEra) external onlyOwner {
        Dispute storage dispute = disputes[disputeId];
        require(newExpireEra > dispute.expireEra, 'invalid newExpireEra');
        require(dispute.state == DisputeState.Ongoing, 'dispute already finalized');
        require(IEraManager(settings.getEraManager()).eraNumber() < dispute.expireEra, 'cannot extend expired dispute');

        dispute.expireEra = newExpireEra;
    }

    function finalizeDispute(uint256 disputeId, DisputeState state, uint256 newStake, uint256 newDeposit) external onlyOwner {
        require(state != DisputeState.Ongoing, 'invalid state')
        Dispute storage dispute = disputes[disputeId];
        require(IEraManager(settings.getEraManager()).eraNumber() > dispute.expireEra, 'dispute not expired');
        require(dispute.state == DisputeState.Ongoing, 'dispute already finalized');
        //accept dispute 
        //slash indexer
        //reward fisherman
        if(state == DisputeState.Accepted){
            require(newStake < dispute.stakingAmount, 'invalid newStake');
            uint256 slashAmount = dispute.stakingAmount - newStake;
            IStaking(settings.getStaking()).slashIndexer(dispute.indexer, slashAmount);

            require(newDeposit > dispute.depositAmount, 'invalid newDeposit');
            uint256 rewardAmount = newDeposit - dispute.depositAmount;
            require(rewardAmount < slashAmount, 'invalid newDeposit');
        }else if(state == DisputeState.Rejected){
            //reject dispute 
            //slash fisherman
            require(newDeposit < dispute.depositAmount, 'invalid newDeposit');
        }else if(state == DisputeState.Cancelled){
            //cancel dispute
            //return fisherman deposit
            require(newDeposit == dispute.depositAmount, 'invalid newDeposit');
        }

        dispute.state = state;
        IERC20(settings.getSQToken()).safeTransfer(dispute.fisherman, newDeposit);

        disputeIdByIndexer[dispute.indexer] = 0;
    }

}