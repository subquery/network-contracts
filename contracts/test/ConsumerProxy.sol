// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import '../interfaces/IConsumer.sol';

/**
 * @title Consumer Proxy Contract
 * @dev
 * ## Overview
 * The ConsumerProxy contract store and track all registered Consumers.
 * Consumer can deposit and withdraw SQT.
 * Other contracts can verify the consumer and safeTransfer SQT.
 *
 */
contract ConsumerProxy is Initializable, OwnableUpgradeable, IConsumer, ERC165 {
    using SafeERC20 for IERC20;

    // -- Storage --

    // The SQT contract address
    address public SQT;

    // The StateChannel address
    address public channel;

    // The Consumer address
    address public consumer;

    // The Signer address
    address public signer;

    // Emitted when consumer withdraw.
    event Withdraw(address indexed consumer, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Paid(address indexed consumer, uint256 amount);

    // Emitted when consumer pay for open a state channel
    event Claimed(address indexed consumer, uint256 amount);

    // Initialize this contract.
    function initialize(
        address _sqt,
        address _channel,
        address _consumer
    ) external initializer {
        __Ownable_init();
        SQT = _sqt;
        channel = _channel;
        consumer = _consumer;
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
    function setChannel(address _channel) external onlyOwner {
        channel = _channel;
    }

    // Update signer.
    function setConsumer(address _consumer) external onlyOwner {
        consumer = _consumer;
    }

    // Update signer.
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    // Withdraw amount to consumer.
    function withdraw(uint256 amount) external {
        require(msg.sender == consumer, 'Must Consumer');
        IERC20 sqt = IERC20(SQT);
        require(sqt.balanceOf(address(this)) >= amount, 'Insufficient balance');

        // transfer the balance to consumer
        sqt.safeTransferFrom(address(this), msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    // Paied callback function.
    function paid(
        uint256 channelId,
        uint256 amount,
        bytes memory sign
    ) external {
        require(msg.sender == channel, 'Only Channel Contract');

        bytes32 payload = keccak256(abi.encode(channelId, amount));
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address msgSigner = ECDSA.recover(hash, sign);
        require(msgSigner == consumer, 'Invalid Proxy signature');

        emit Paid(msg.sender, amount);
    }

    // Claimed callback function.
    function claimed(
        uint256, /* _channelId */
        uint256 amount
    ) external {
        emit Claimed(msg.sender, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IConsumer).interfaceId || super.supportsInterface(interfaceId);
    }
}
