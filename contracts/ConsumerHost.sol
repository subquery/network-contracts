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
 * @title Consumer Host Contract
 * @notice ### Overview
 * The ConsumerHost contract store and track all registered Consumers.
 * Consumer can deposit and withdraw SQT.
 * Consumer can approve contract, and then don't have to sign for every payment.
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

    /// @dev ### STATES
    /// @notice The Signer account address
    address private signer;

    /// @notice The SQT contract address
    address public SQT;

    /// @notice The StateChannel contract address
    address public channel;

    /// @notice The fee charged from consumer payment service
    uint256 public fee;

    /// @notice The Percentage of FEE
    uint256 public feePercentage;

    /// @notice Consumers info that hosting in this contract
    mapping(address => Consumer) public consumers;

    /// @notice StateChannels' belongs to consumer
    mapping(uint256 => address) public channels;

    /// @dev ### EVENTS
    /// @notice Emitted when consumer approve host to manager the balance.
    event Approve(address consumer);

    /// @notice Emitted when consumer disapprove.
    event Disapprove(address consumer);

    /// @notice Emitted when consumer deposit.
    event Deposit(address consumer, uint256 amount, uint256 balance);

    /// @notice Emitted when consumer withdraw.
    event Withdraw(address consumer, uint256 amount, uint256 balance);

    /// @notice Emitted when consumer pay for open a state channel
    event Paid(uint256 channelId, address consumer, address caller, uint256 amount, uint256 balance);

    /// @notice Emitted when consumer pay for open a state channel
    event Claimed(uint256 channelId, address consumer, address caller, uint256 amount, uint256 balance);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the SQT, StateChannel, and feePercentage.
     * @param _sqt SQT contract address
     * @param _channel StateChannel contract address
     * @param _feePercentage fee percentage
     */
    function initialize(address _sqt, address _channel, uint256 _feePercentage) external initializer {
        __Ownable_init();
        SQT = _sqt;
        channel = _channel;
        feePercentage = _feePercentage;
        signer = msg.sender;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    /**
     * @notice Update SQT contract
     * @param _sqt SQT contract address
     */
    function setSQT(address _sqt) external onlyOwner {
        SQT = _sqt;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    /**
     * @notice Update StateChannel contract
     * @param _channel StateChannel contract address
     */
    function setChannel(address _channel) external onlyOwner {
        channel = _channel;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(SQT);
        sqt.approve(channel, sqt.totalSupply());
    }

    /**
     * @notice Update fee percentage
     * @param _feePercentage fee percentage
     */
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 100, 'Invalid feePercentage');
        feePercentage = _feePercentage;
    }

    /**
     * @notice Collect fee to account
     * @param account the receiver
     * @param amount the amount
     */
    function collectFee(address account, uint256 amount) external onlyOwner {
        require(fee >= amount, 'Insufficient balance');
        IERC20(SQT).safeTransfer(account, amount);
        fee -= amount;
    }

    /**
     * @notice Get contract signer
     * @return the signer account
     */
    function getSigner() external view returns (address) {
        return signer;
    }

    /**
     * @notice Update contract signer
     * @param _signer new signer account
     */
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    /**
     * @notice Approve host can use consumer balance
     */
    function approve() external {
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = true;
        emit Approve(msg.sender);
    }

    /**
     * @notice Disapprove host can use consumer balance
     */
    function disapprove() external {
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = false;
        emit Disapprove(msg.sender);
    }

    /**
     * @notice Deposit amount to hosting, consumer can choose approve or not
     * @param amount the amount
     */
    function deposit(uint256 amount, bool isApprove) external {
        // transfer the balance to contract
        IERC20 sqt = IERC20(SQT);
        sqt.safeTransferFrom(msg.sender, address(this), amount);
        sqt.approve(channel, amount);

        Consumer storage consumer = consumers[msg.sender];
        consumer.balance += amount;
        if (isApprove && !consumer.approved) {
            consumer.approved = true;
            emit Approve(msg.sender);
        }

        emit Deposit(msg.sender, amount, consumer.balance);
    }

    /**
     * @notice Withdraw amount to the consumer(sender)
     * @param amount the amount
     */
    function withdraw(uint256 amount) external {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.balance >= amount, 'Insufficient balance');

        // transfer the balance to consumer
        IERC20(SQT).safeTransfer(msg.sender, amount);
        consumer.balance -= amount;

        emit Withdraw(msg.sender, amount, consumer.balance);
    }

    /**
     * @notice Paied callback function, only support from StateChannel
     * @param channelId the opened channel ID
     * @param amount the amount need to pay
     * @param callback the info include consumer and signature(if approve, no signature))
     */
    function paid(uint256 channelId, uint256 amount, bytes memory callback) external {
        require(msg.sender == channel, 'Only Channel Contract');
        (address consumer, bytes memory sign) = abi.decode(callback, (address, bytes));
        if (channels[channelId] == address(0)) {
            channels[channelId] = consumer;
        } else {
            require(channels[channelId] == consumer, 'Invalid Consumer');
        }

        Consumer storage info = consumers[consumer];

        uint256 fixedFee = amount > 100 ? amount * feePercentage / 100 : 1;
        require(info.balance >= amount + fixedFee, 'Insufficient balance');

        if (!info.approved) {
            uint256 nonce = info.nonce;
            bytes32 payload = keccak256(abi.encode(channelId, amount, nonce));
            bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
            address sConsumer = ECDSA.recover(hash, sign);
            require(sConsumer == consumer, 'Invalid signature');
            info.nonce = nonce + 1;
        }

        info.balance -= (amount + fixedFee);
        fee += fixedFee;

        emit Paid(channelId, consumer, msg.sender, amount, info.balance);
    }

    /**
     * @notice Claimed callback function, only support from StateChannel
     * @param channelId the finalized channel ID
     * @param amount the amount back to consumer
     */
    function claimed(uint256 channelId, uint256 amount) external {
        require(msg.sender == channel, 'Only Channel Contract');

        address consumer = channels[channelId];
        Consumer storage info = consumers[consumer];
        info.balance += amount;

        delete channels[channelId];

        emit Claimed(channelId, consumer, msg.sender, amount, info.balance);
    }

    /**
     * @notice check the signature from signer or valid consumer
     * @param channelId the finalized channel ID
     * @param payload the message signed by sender
     * @param sign the signature
     * @return Result of check
     */
    function checkSign(uint256 channelId, bytes32 payload, bytes memory sign) external view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address sConsumer = ECDSA.recover(hash, sign);
        if (sConsumer == signer) {
            return true;
        }
        return channels[channelId] == sConsumer;
    }

    /**
     * @notice check the sender is from signer or valid consumer
     * @param channelId the finalized channel ID
     * @param sender the sender need to check
     * @return Result of check
     */
    function checkSender(uint256 channelId, address sender) external view returns (bool) {
        if (sender == signer) {
            return true;
        }

        return channels[channelId] == sender;
    }

    /**
     * @notice check the sender is from signer or valid consumer
     * @param channelId the finalized channel ID
     * @return Result of addresses
     */
    function validSigners(uint256 channelId) external view returns (address[] memory) {
        if (channels[channelId] != address(0)) {
            address[] memory signers = new address[](2);
            signers[0] = signer;
            signers[1] = channels[channelId];
            return signers;
        } else {
            address[] memory signers = new address[](1);
            signers[0] = signer;
            return signers;
        }
    }

    /**
     * @notice Check ERC165 interface
     * @param interfaceId interface ID
     * @return Result of support or not
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IConsumer).interfaceId || super.supportsInterface(interfaceId);
    }
}
