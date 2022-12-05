// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IConsumer.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IRewardsPool.sol';

/**
 * @title State Channel Contract
 * @notice ### Overview
 * The contact for Pay-as-you-go service for Indexer and Consumer.
 * The consumer is not only a account, but also a contract
 */
contract StateChannel is Initializable, OwnableUpgradeable {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;

    /**
    * @notice The channel status.
    * When channel is Open, it can checkpoint/terminate/claim/fund.
    * When channle is Challenging, it can respond/claim.
    * When channel is Finalized. it is over.
    */
    enum ChannelStatus {
        Finalized,
        Open,
        Terminating
    }

    /// @notice The state of channel
    struct ChannelState {
        ChannelStatus status;
        address indexer;
        address consumer;
        uint256 total;
        uint256 spent;
        uint256 expiredAt;
        uint256 terminatedAt;
        bytes32 deploymentId;
        bool terminateByIndexer;
    }

    /// @notice The state for checkpoint Query
    struct QueryState {
        uint256 channelId;
        uint256 spent;
        bool isFinal;
        bytes indexerSign;
        bytes consumerSign;
    }

    /// @dev ### STATES
    /// @notice Settings info
    ISettings public settings;
    /// @notice The expiration of the terminate. Default is 24 * 60 * 60 = 86400s
    uint256 public terminateExpiration;
    /// @notice The states of the channels
    mapping(uint256 => ChannelState) public channels;

    /// @dev ### EVENTS
    /// @notice Emitted when open a channel for Pay-as-you-go service
    event ChannelOpen(uint256 indexed channelId, address indexer, address consumer, uint256 total, uint256 price, uint256 expiredAt, bytes32 deploymentId, bytes callback);
    /// @notice Emitted when extend the channel
    event ChannelExtend(uint256 indexed channelId, uint256 expiredAt);
    /// @notice Emitted when deposit more amount to the channel
    event ChannelFund(uint256 indexed channelId, uint256 total);
    /// @notice Emitted when indexer send a checkpoint to claim the part-amount
    event ChannelCheckpoint(uint256 indexed channelId, uint256 spent);
    /// @notice Emitted when consumer start a terminate on channel to finalize in advance
    event ChannelTerminate(uint256 indexed channelId, uint256 spent, uint256 terminatedAt, bool terminateByIndexer);
    /// @notice Emitted when finalize the channel
    event ChannelFinalize(uint256 indexed channelId, uint256 total, uint256 remain);
    /// @notice Emitted when Settle the channel with new state
    event ChannelLabor(bytes32 deploymentId, address indexer, uint256 amount);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the terminateExpiration
     * @param _settings settings contract address
     */
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        terminateExpiration = 86400;
        settings = _settings;
    }

    /**
     * @notice Update the expiration of the terminate
     * @param expiration terminate expiration time in seconds
     */
    function setTerminateExpiration(uint256 expiration) public onlyOwner {
        terminateExpiration = expiration;
    }

    /**
     * @notice Get the channel info
     * @param channelId channel id
     * @return ChannelState channel info
     */
    function channel(uint256 channelId) public view returns (ChannelState memory) {
        return channels[channelId];
    }

    /**
     * @notice Indexer and Consumer open a channel for Pay-as-you-go service.
     * It will lock the amount of consumer and start a new channel.
     * Need consumer approve amount first. If consumer is contract, use callback to call paid
     * @param channelId channel id
     * @param indexer indexer address
     * @param consumer consumer address
     * @param amount SQT amount deposit in channel
     * @param expiration channel expiration time in seconds
     * @param deploymentId deployment id
     * @param callback callback info for contract, if consumer not a contract, set null: "0x"
     * @param indexerSign indexer's signature
     * @param consumerSign consumer's signature
     */
    function open(
        uint256 channelId,
        address indexer,
        address consumer,
        uint256 amount,
        uint256 price,
        uint256 expiration,
        bytes32 deploymentId,
        bytes memory callback,
        bytes memory indexerSign,
        bytes memory consumerSign
    ) public {
        // check channel exist
        require(channels[channelId].status == ChannelStatus.Finalized, 'ChannelId already existed');

        // check indexer registered
        IIndexerRegistry indexerRegistry = IIndexerRegistry(settings.getIndexerRegistry());
        require(indexerRegistry.isIndexer(indexer), 'indexer is not registered');
        address controller = indexerRegistry.indexerToController(indexer);

        // check sign
        bytes32 payload = keccak256(
            abi.encode(channelId, indexer, consumer, amount, price, expiration, deploymentId, callback)
        );
        if (_isContract(consumer)) {
            require(consumer.supportsInterface(type(IConsumer).interfaceId), 'Contract is not IConsumer');
            IConsumer cConsumer = IConsumer(consumer);
            require(cConsumer.checkSign(channelId, payload, consumerSign), 'Invalid consumer signature');
            cConsumer.paid(channelId, amount, callback);
        } else {
            _checkSign(payload, consumerSign, consumer, address(0));
        }

        _checkSign(payload, indexerSign, indexer, controller);

        // transfer the balance to contract
        IERC20(settings.getSQToken()).safeTransferFrom(consumer, address(this), amount);

        // initial the channel
        ChannelState storage state = channels[channelId];
        state.status = ChannelStatus.Open;
        state.indexer = indexer;
        state.consumer = consumer;
        state.expiredAt = block.timestamp + expiration;
        state.total = amount;
        state.spent = 0;
        state.terminatedAt = 0;
        state.deploymentId = deploymentId;
        state.terminateByIndexer = false;

        emit ChannelOpen(channelId, indexer, consumer, amount, price, block.timestamp + expiration, deploymentId, callback);
    }

    /**
     * @notice Extend the channel expiredAt
     * @param channelId channel id
     * @param preExpirationAt previous ExpirationAt timestamp
     * @param expiration Extend tiem in seconds
     * @param indexerSign indexer's signature
     * @param consumerSign consumer's signature
     */
    function extend(
        uint256 channelId,
        uint256 preExpirationAt,
        uint256 expiration,
        bytes memory indexerSign,
        bytes memory consumerSign
    ) public {
        address indexer = channels[channelId].indexer;
        address consumer = channels[channelId].consumer;
        address controller = IIndexerRegistry(settings.getIndexerRegistry()).indexerToController(indexer);
        require(channels[channelId].expiredAt == preExpirationAt, 'Request is expired');

        // check sign
        bytes32 payload = keccak256(abi.encode(channelId, indexer, consumer, preExpirationAt, expiration));
        if (_isContract(consumer)) {
            require(IConsumer(consumer).checkSign(channelId, payload, consumerSign), 'Invalid consumer signature');
        } else {
            _checkSign(payload, consumerSign, consumer, address(0));
        }
        _checkSign(payload, indexerSign, indexer, controller);

        channels[channelId].expiredAt = preExpirationAt + expiration;
        emit ChannelExtend(channelId, channels[channelId].expiredAt);
    }

    /**
     * @notice Deposit more amount to this channel. need consumer approve amount first
     * @param channelId channel id
     * @param amount SQT amount to deposit
     * @param callback callback info for contract
     * @param sign the signature of the consumer
     */
    function fund(uint256 channelId, uint256 amount, bytes memory callback, bytes memory sign) public {
        require(
            channels[channelId].status == ChannelStatus.Open && channels[channelId].expiredAt > block.timestamp,
            'Channel lost efficacy'
        );

        address indexer = channels[channelId].indexer;
        address consumer = channels[channelId].consumer;
        bytes32 payload = keccak256(abi.encode(channelId, indexer, consumer, amount, callback));

        // check sign
        if (_isContract(consumer)) {
            IConsumer cConsumer = IConsumer(consumer);
            require(cConsumer.checkSign(channelId, payload, sign), 'Invalid consumer signature');
            cConsumer.paid(channelId, amount, callback);
        } else {
            bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
            address sConsumer = ECDSA.recover(hash, sign);
            require(sConsumer == consumer, 'Invalid consumer signature');
        }

        // transfer the balance to contract
        IERC20(settings.getSQToken()).safeTransferFrom(consumer, address(this), amount);
        channels[channelId].total += amount;
        emit ChannelFund(channelId, channels[channelId].total);
    }

    /**
     * @notice Indexer can send a checkpoint to claim the part-amount.
     * This amount will send to RewardDistributer for staking
     * @param query the state of the channel
     */
    function checkpoint(QueryState calldata query) public {
        // check channel status
        require(channels[query.channelId].status == ChannelStatus.Open, 'Channel must be actived');

        // check spent
        require(query.spent > channels[query.channelId].spent, 'Query state must bigger than channel state');

        // check sign
        bytes32 payload = keccak256(abi.encode(query.channelId, query.spent, query.isFinal));

        _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);

        // update channel state
        _settlement(query);

        emit ChannelCheckpoint(query.channelId, query.spent);
    }

    /**
     * @notice When indexer/consumer what to finalize in advance, can start a terminate.
     * If terminate success, consumer will claim the rest of the locked amount.
     * Indexer can respond to this terminate within the time limit
     * @param query the state of the channel
     */
    function terminate(QueryState calldata query) public {
        ChannelState storage state = channels[query.channelId];

        // check sender
        bool isIndexer = msg.sender == state.indexer;
        bool isConsumer = msg.sender == state.consumer;
        if (_isContract(state.consumer)) {
            isConsumer = IConsumer(state.consumer).checkSender(query.channelId, msg.sender);
        }
        require(isIndexer || isConsumer, 'Invalid sender');

        // check state
        bool allowState = state.expiredAt > block.timestamp && query.spent >= state.spent && query.spent < state.total;
        require(allowState, 'Query state must bigger than channel state');

        // check sign
        if (query.spent > 0) {
            bytes32 payload = keccak256(abi.encode(query.channelId, query.spent, query.isFinal));
            _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);
        } else {
            require(!query.isFinal, 'Unspent need expiration');
        }

        // update channel state.
        _settlement(query);

        // set state to terminate
        state.status = ChannelStatus.Terminating;
        uint256 expiration = block.timestamp + terminateExpiration;
        state.terminatedAt = expiration;
        state.terminateByIndexer = isIndexer;

        emit ChannelTerminate(query.channelId, query.spent, expiration, isIndexer);
    }

    /**
     * @notice Indexer respond the terminate by send the service proof after the terminate
     * @param query the state of the channel
     */
    function respond(QueryState calldata query) public {
        ChannelState storage state = channels[query.channelId];

        // check state and sender
        require(state.status == ChannelStatus.Terminating, 'Not terminating');
        if (state.terminateByIndexer) {
            bool isConsumer = msg.sender == state.consumer;
            if (_isContract(state.consumer)) {
                isConsumer = IConsumer(state.consumer).checkSender(query.channelId, msg.sender);
            }
            require(isConsumer, 'Invalid sender');
        } else {
            require(msg.sender == state.indexer, 'Invalid sender');
        }

        // check count
        require(query.spent >= state.spent, 'Query state must bigger than channel state');

        // check sign
        bytes32 payload = keccak256(abi.encode(query.channelId, query.spent, query.isFinal));
        _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);

        // update channel state
        _settlement(query);

        // finalize the channel status
        _finalize(query.channelId);
    }

    /**
     * @notice When terminate success (Overdue did not respond) or expiration, consumer can claim the amount
     * @param channelId channel id
     */
    function claim(uint256 channelId) public {
        // check if terminate success
        bool isClaimable1 = channels[channelId].status == ChannelStatus.Terminating &&
            channels[channelId].terminatedAt < block.timestamp;

        // check if channel expiration
        bool isClaimable2 = isClaimable1 ||
            (channels[channelId].status == ChannelStatus.Open && channels[channelId].expiredAt < block.timestamp);

        require(isClaimable2, 'Channel not expired');
        _finalize(channelId);
    }

    /// @dev PRIVATE FUNCTIONS
    /// @notice Check the signature of the hash with channel info
    function _checkStateSign(
        uint256 channelId,
        bytes32 payload,
        bytes memory indexerSign,
        bytes memory consumerSign
    ) private view {
        address indexer = channels[channelId].indexer;
        address controller = IIndexerRegistry(settings.getIndexerRegistry()).indexerToController(indexer);
        address consumer = channels[channelId].consumer;
        if (_isContract(consumer)) {
            require(IConsumer(consumer).checkSign(channelId, payload, consumerSign), 'Invalid consumer signature');
        } else {
            _checkSign(payload, consumerSign, consumer, address(0));
        }
        _checkSign(payload, indexerSign, indexer, controller);
    }

    /// @notice Check the signature of the hash with given addresses
    function _checkSign(
        bytes32 payload,
        bytes memory indexerSign,
        address channelIndexer,
        address channelController
    ) private pure {
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address signIndexer = ECDSA.recover(hash, indexerSign);
        require(signIndexer == channelIndexer || signIndexer == channelController, 'Invalid signature');
    }

    /// @notice Settlement the new state
    function _settlement(QueryState calldata query) private {
        // update channel state
        uint256 amount = query.spent - channels[query.channelId].spent;

        if (channels[query.channelId].total > query.spent) {
            channels[query.channelId].spent = query.spent;
        } else {
            amount = channels[query.channelId].total - channels[query.channelId].spent;
            channels[query.channelId].spent = channels[query.channelId].total;
        }

        // reward pool
        if (amount > 0) {
            address indexer = channels[query.channelId].indexer;
            bytes32 deploymentId = channels[query.channelId].deploymentId;
            address rewardPoolAddress = settings.getRewardsPool();
            IERC20(settings.getSQToken()).approve(rewardPoolAddress, amount);
            IRewardsPool rewardsPool = IRewardsPool(rewardPoolAddress);
            rewardsPool.labor(deploymentId, indexer, amount);
            emit ChannelLabor(deploymentId, indexer, amount);
        }

        // check is finish
        bool isFinish1 = query.isFinal;
        bool isFinish2 = isFinish1 || amount == 0;
        bool isFinish3 = isFinish2 || block.timestamp > channels[query.channelId].expiredAt;

        // finalise channel if meet the requirements
        if (isFinish3) {
            _finalize(query.channelId);
        }
    }

    /// @notice Finalize the channel
    function _finalize(uint256 channelId) private {
        // claim the rest of amount to balance
        address consumer = channels[channelId].consumer;
        uint256 total = channels[channelId].total;
        uint256 remain = total - channels[channelId].spent;

        if (remain > 0) {
            IERC20(settings.getSQToken()).safeTransfer(consumer, remain);
        }

        if (_isContract(consumer)) {
            IConsumer(consumer).claimed(channelId, remain);
        }

        // delete the channel
        delete channels[channelId];

        emit ChannelFinalize(channelId, total, remain);
    }

    /// @notice Determine the input address is contract or not
    function _isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}
