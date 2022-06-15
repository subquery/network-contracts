// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';

import './interfaces/IConsumer.sol';
import './interfaces/IIndexerRegistry.sol';
import './interfaces/ISettings.sol';
import './interfaces/IRewardsDistributer.sol';

// The channel status.
// When channel is Open, it can checkpoint/challenge/claim/fund.
// When channle is Challenging, it can respond/claim.
// When channel is Finalized. it is over.
enum ChannelStatus {
    Finalized,
    Open,
    Challenge
}

// The state of channel.
struct ChannelState {
    ChannelStatus status;
    address indexer;
    address consumer;
    uint256 count;
    uint256 balance;
    uint256 expirationAt;
    uint256 challengeAt;
}

// The state for checkpoint Query.
struct QueryState {
    uint256 channelId;
    bool isFinal;
    uint256 count;
    uint256 price;
    bytes indexerSign;
    bytes consumerSign;
}

// The contact for Pay-as-you-go service for Indexer and Consumer.
contract StateChannel is Initializable, OwnableUpgradeable {
    using ERC165CheckerUpgradeable for address;
    using SafeERC20 for IERC20;

    // Settings info.
    ISettings public settings;

    // The expiration of the challenge.
    // Default is 24 * 60 * 60 = 86400s.
    uint256 public challengeExpiration;

    event ChannelOpen(uint256 indexed channelId, address indexer, address consumer);
    event ChannelCheckpoint(uint256 indexed channelId, uint256 count);
    event ChannelChallenge(uint256 indexed channelId, uint256 count, uint256 expiration);
    event ChannelRespond(uint256 indexed channelId, uint256 count);
    event ChannelFinalize(uint256 indexed channelId);

    // The states of the channels.
    mapping(uint256 => ChannelState) public channels;

    // Initial.
    function initialize(ISettings _settings) external initializer {
        __Ownable_init();

        challengeExpiration = 86400;
        settings = _settings;
    }

    // Update the expiration of the challenge.
    function setChallengeExpiration(uint256 expiration) public onlyOwner {
        challengeExpiration = expiration;
    }

    // Return the channel info.
    function channel(uint256 channelId) public view returns (ChannelState memory) {
        return channels[channelId];
    }

    // Indexer and Consumer open a channel for Pay-as-you-go service.
    // It will lock the amount of consumer and start a new channel.
    // Need consumer approve amount first.
    // If consumer is contract, use callback to call paid.
    function open(
        uint256 channelId,
        address indexer,
        address consumer,
        uint256 amount,
        uint256 expiration,
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
        bytes32 payload = keccak256(abi.encode(channelId, indexer, consumer, amount, expiration, callback));
        if (_isContract(consumer)) {
            require(consumer.supportsInterface(type(IConsumer).interfaceId), 'Contract is not IConsumer');
            IConsumer cConsumer = IConsumer(consumer);
            address signer = cConsumer.signer();
            _checkSign(payload, indexerSign, consumerSign, indexer, controller, signer);
            // transfer the balance to contract
            IERC20(settings.getSQToken()).safeTransferFrom(consumer, address(this), amount);
            cConsumer.paid(channelId, amount, callback);
        } else {
            _checkSign(payload, indexerSign, consumerSign, indexer, controller, consumer);
            // transfer the balance to contract
            IERC20(settings.getSQToken()).safeTransferFrom(consumer, address(this), amount);
        }

        // initial the channel
        channels[channelId].status = ChannelStatus.Open;
        channels[channelId].indexer = indexer;
        channels[channelId].consumer = consumer;
        channels[channelId].expirationAt = block.timestamp + expiration;
        channels[channelId].count = 0;
        channels[channelId].balance = amount;
        channels[channelId].challengeAt = 0;

        emit ChannelOpen(channelId, indexer, consumer);
    }

    // Extend the channel expirationAt.
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
        require(channels[channelId].expirationAt == preExpirationAt, 'Request is expired');

        // check sign
        bytes32 payload = keccak256(abi.encode(channelId, indexer, consumer, preExpirationAt, expiration));
        _checkSign(payload, indexerSign, consumerSign, indexer, controller, consumer);

        channels[channelId].expirationAt = preExpirationAt + expiration;
    }

    // Deposit more amount to this channel. need consumer approve amount first.
    function fund(
        uint256 channelId,
        uint256 amount,
        bytes memory sign
    ) public {
        require(
            channels[channelId].status == ChannelStatus.Open && channels[channelId].expirationAt > block.timestamp,
            'Channel lost efficacy'
        );

        address indexer = channels[channelId].indexer;
        address consumer = channels[channelId].consumer;

        // check sign
        bytes32 payload = keccak256(abi.encode(channelId, indexer, consumer, amount));
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address s_consumer = ECDSA.recover(hash, sign);
        require(s_consumer == consumer, 'Consumer signature invalid');

        // transfer the balance to contract
        IERC20(settings.getSQToken()).safeTransferFrom(consumer, address(this), amount);
        channels[channelId].balance += amount;
    }

    // Indexer can send a checkpoint to claim the part-amount.
    // This amount will send to RewardDistributer for staking.
    function checkpoint(QueryState calldata query) public {
        // check channel status
        require(channels[query.channelId].status == ChannelStatus.Open, 'Channel must be actived');

        // check count
        require(query.count > channels[query.channelId].count, 'Query state must bigger than channel state');

        // check sign
        bytes32 payload = keccak256(abi.encode(query.channelId, query.count, query.price, query.isFinal));
        _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);

        // update channel state
        _settlement(query);

        emit ChannelCheckpoint(query.channelId, query.count);
    }

    // When consumer what to finalize in advance, can start a challenge.
    // If challenge success, consumer will claim the rest of the locked
    // amount. Indexer can respond to this challenge within the time limit.
    function challenge(QueryState calldata query) public {
        // check count
        require(query.count > channels[query.channelId].count, 'Query state must bigger than channel state');

        // check sign
        bytes32 payload = keccak256(abi.encode(query.channelId, query.count, query.price, query.isFinal));
        _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);

        // update channel state.
        _settlement(query);

        // set state to challenge and add count
        channels[query.channelId].status = ChannelStatus.Challenge;
        uint256 expiration = block.timestamp + challengeExpiration;
        channels[query.channelId].challengeAt = expiration;

        emit ChannelChallenge(query.channelId, query.count, expiration);
    }

    // Indexer respond the challenge by send the service proof after
    // the challenge.
    function respond(QueryState calldata query) public {
        // check count
        require(query.count > channels[query.channelId].count, 'Query state must bigger than channel state');

        // check sign
        bytes32 payload = keccak256(abi.encode(query.channelId, query.count, query.price, query.isFinal));
        _checkStateSign(query.channelId, payload, query.indexerSign, query.consumerSign);

        // reset the channel status
        channels[query.channelId].status = ChannelStatus.Open;

        // update channel state
        _settlement(query);

        emit ChannelRespond(query.channelId, query.count);
    }

    // When challenge success (Overdue did not respond) or expiration,
    // consumer can claim the amount.
    function claim(uint256 channelId) public {
        // check if challenge success
        bool isClaimable1 = channels[channelId].status == ChannelStatus.Challenge &&
            channels[channelId].challengeAt < block.timestamp;

        // check if channel expiration
        bool isClaimable2 = isClaimable1 ||
            (channels[channelId].status == ChannelStatus.Open && channels[channelId].expirationAt < block.timestamp);

        require(isClaimable2, 'Channel not expired');
        _finalize(channelId);
    }

    // Check the signature of the hash with channel info.
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
            address signer = IConsumer(consumer).signer();
            _checkSign(payload, indexerSign, consumerSign, indexer, controller, signer);
        } else {
            _checkSign(payload, indexerSign, consumerSign, indexer, controller, consumer);
        }
    }

    // Check the signature of the hash with given addresses.
    function _checkSign(
        bytes32 payload,
        bytes memory indexerSign,
        bytes memory consumerSign,
        address channelIndexer,
        address channelController,
        address channelConsumer
    ) private pure {
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address signIndexer = ECDSA.recover(hash, indexerSign);
        require(signIndexer == channelIndexer || signIndexer == channelController, 'Indexer signature invalid');

        address signConsumer = ECDSA.recover(hash, consumerSign);
        require(signConsumer == channelConsumer, 'Consumer signature invalid');
    }

    // Settlement the new state.
    function _settlement(QueryState calldata query) private {
        // update channel state
        uint256 oldCount = channels[query.channelId].count;
        uint256 amount = (query.count - oldCount) * query.price;
        channels[query.channelId].count = query.count;

        if (channels[query.channelId].balance > amount) {
            channels[query.channelId].balance -= amount;
        } else {
            amount = channels[query.channelId].balance;
            channels[query.channelId].balance = 0;
        }

        // check is finish
        bool isFinish1 = query.isFinal;
        bool isFinish2 = isFinish1 || channels[query.channelId].balance == 0;
        bool isFinish3 = isFinish2 || block.timestamp > channels[query.channelId].expirationAt;

        // check expirationAt
        if (isFinish3) {
            _finalize(query.channelId);
        }

        // reward distributer
        address indexer = channels[query.channelId].indexer;
        address rewardDistributerAddress = settings.getRewardsDistributer();
        IERC20(settings.getSQToken()).approve(rewardDistributerAddress, amount);
        IRewardsDistributer rewardsDistributer = IRewardsDistributer(rewardDistributerAddress);
        rewardsDistributer.addInstantRewards(indexer, address(this), amount);
    }

    // Finalize the channel.
    function _finalize(uint256 channelId) private {
        // claim the rest of amount to balance
        address consumer = channels[channelId].consumer;
        uint256 remain = channels[channelId].balance;

        if (remain > 0) {
            IERC20(settings.getSQToken()).safeTransfer(consumer, remain);
            if (_isContract(consumer)) {
                IConsumer(consumer).claimed(channelId, remain);
            }
        }

        // set the channel to Finalized status
        channels[channelId].status = ChannelStatus.Finalized;
        channels[channelId].balance = 0;

        emit ChannelFinalize(channelId);
    }

    function _isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}
