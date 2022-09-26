// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IConsumer.sol';

/**
 * @title Consumer Host Contract for host service.
 * @dev
 * ## Overview
 * The ConsumerHost contract store and track all registered Consumers.
 * Consumer can deposit and withdraw SQT.
 * Other contracts can verify the consumer and safeTransfer SQT.
 *
 */
contract ConsumerHost is Initializable, OwnableUpgradeable, IConsumer, ERC165 {
    using SafeERC20 for IERC20;

    // -- Structs --
    struct Consumer {
        uint256 balance;
        uint256 nonce;
        bool approved;
    }

    // -- Storage --

    // The Signer address
    address private signer;

    // The SQT contract address
    address public SQT;

    // The StateChannel address
    address public channel;

    // Consumers info that hosting in this contract.
    mapping(address => Consumer) public consumers;

    // StateChannels' belongs to consumer.
    mapping(uint256 => address) public channels;

    // -- Events --

    // Emitted when consumer approve host to manager the balance.
    event Approve(address consumer);

    // Emitted when consumer disapprove.
    event Disapprove(address consumer);

    // Emitted when consumer deposit.
    event Deposit(address consumer, uint256 amount);

    // Emitted when consumer withdraw.
    event Withdraw(address consumer, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Paid(uint256 channelId, address consumer, address caller, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Claimed(uint256 channelId, address consumer, address caller, uint256 amount);

    // Initialize this contract.
    function initialize(address _sqt, address _channel) external initializer {
        __Ownable_init();
        SQT = _sqt;
        channel = _channel;
        signer = msg.sender;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    // Update SQT.
    function setSQT(address _sqt) external onlyOwner {
        SQT = _sqt;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    // Update signer.
    function setChannel(address _channel) external onlyOwner {
        channel = _channel;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    // Get signer.
    function getSigner() external view returns (address) {
        return signer;
    }

    // Update signer.
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    // Approve host can use consumer balance.
    function approve() external {
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = true;
        emit Approve(msg.sender);
    }

    // Disapprove host.
    function disapprove() external {
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = false;
        emit Disapprove(msg.sender);
    }

    // Deposit amount to hosting.
    function deposit(uint256 amount) external {
        // transfer the balance to contract
        IERC20 sqt = IERC20(SQT);
        sqt.safeTransferFrom(msg.sender, address(this), amount);
        sqt.approve(channel, amount);

        Consumer storage consumer = consumers[msg.sender];
        consumer.balance += amount;

        emit Deposit(msg.sender, amount);
    }

    // Withdraw amount to consumer.
    function withdraw(uint256 amount) external {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.balance >= amount, 'Insufficient balance');

        // transfer the balance to consumer
        IERC20(SQT).safeTransfer(msg.sender, amount);
        consumer.balance -= amount;

        emit Withdraw(msg.sender, amount);
    }

    // Paied callback function.
    function paid(uint256 channelId, uint256 amount, bytes memory callback) external {
        require(msg.sender == channel, 'Only Channel Contract');
        (address consumer, bytes memory sign) = abi.decode(callback, (address, bytes));
        if (channels[channelId] == address(0)) {
            channels[channelId] = consumer;
        } else {
            require(channels[channelId] == consumer, 'Invalid Consumer');
        }

        Consumer storage info = consumers[consumer];
        require(info.balance >= amount, 'Insufficient balance');

        if (!info.approved) {
            uint256 nonce = info.nonce;
            bytes32 payload = keccak256(abi.encode(channelId, amount, nonce));
            bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
            address sConsumer = ECDSA.recover(hash, sign);
            require(sConsumer == consumer, 'Invalid signature');
            info.nonce = nonce + 1;
        }

        info.balance -= amount;

        emit Paid(channelId, consumer, msg.sender, amount);
    }

    // Claimed callback function.
    function claimed(uint256 channelId, uint256 amount) external {
        require(msg.sender == channel, 'Only Channel Contract');

        address consumer = channels[channelId];
        Consumer storage info = consumers[consumer];
        info.balance += amount;

        delete channels[channelId];

        emit Claimed(channelId, consumer, msg.sender, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IConsumer).interfaceId || super.supportsInterface(interfaceId);
    }
}
