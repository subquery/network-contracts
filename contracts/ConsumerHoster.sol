// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IConsumer.sol';

/**
 * @title Consumer Hoster Contract for DEMO
 * @dev
 * ## Overview
 * The ConsumerHoster contract store and track all registered Consumers.
 * Consumer can deposit and withdraw SQT.
 * Other contracts can verify the consumer and safeTransfer SQT.
 *
 */
contract ConsumerHoster is Initializable, OwnableUpgradeable, IConsumer, ERC165 {
    using SafeERC20 for IERC20;

    // -- Storage --

    // The SQT contract address
    address public SQT;

    // The Signer address
    address public signer;

    // The StateChannel address
    address public channel;

    // Consumers' balances that hosting in this contract.
    mapping(address => uint256) public balances;

    // StateChannels' belongs to consumer.
    mapping(uint256 => address) public channels;

    // -- Events --

    // Emitted when consumer deposit.
    event Deposit(address indexed consumer, uint256 amount);

    // Emitted when consumer withdraw.
    event Withdraw(address indexed consumer, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Paid(address indexed consumer, address target, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Claimed(address indexed consumer, address from, uint256 amount);

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
    }

    // Update signer.
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    // Update signer.
    function setChannel(address _channel) external onlyOwner {
        channel = _channel;
    }

    // Deposit amount to hosting.
    function deposit(uint256 amount) external {
        // transfer the balance to contract
        IERC20(SQT).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }

    // Withdraw amount to consumer.
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, 'Insufficient balance');

        // transfer the balance to consumer
        IERC20(SQT).safeTransferFrom(address(this), msg.sender, amount);
        balances[msg.sender] -= amount;

        emit Withdraw(msg.sender, amount);
    }

    // Paied callback function.
    function paid(
        uint256 channelId,
        uint256 amount,
        bytes memory callback
    ) external {
        require(msg.sender == channel, 'Only Channel Contract');
        (address consumer, bytes memory sign) = abi.decode(callback, (address, bytes));
        require(balances[consumer] >= amount, 'Insufficient balance');

        bytes32 payload = keccak256(abi.encode(channelId, amount));
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address msgSigner = ECDSA.recover(hash, sign);
        require(msgSigner == consumer, 'Invalid Hoster signature');

        balances[consumer] -= amount;
        channels[channelId] = consumer;

        emit Paid(consumer, msg.sender, amount);
    }

    // Claimed callback function.
    function claimed(uint256 channelId, uint256 amount) external {
        require(msg.sender == channel, 'Only Channel Contract');

        address consumer = channels[channelId];
        balances[consumer] += amount;
        channels[channelId] = address(0);

        emit Claimed(consumer, msg.sender, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IConsumer).interfaceId || super.supportsInterface(interfaceId);
    }
}
