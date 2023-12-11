// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import './interfaces/IConsumer.sol';
import './interfaces/IEraManager.sol';
import './interfaces/ISettings.sol';
import './interfaces/IConsumerRegistry.sol';

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
    ISettings private settings;
    /// @notice The Signer account address
    address[] private signers;
    mapping(address => uint256) private signerIndex;

    /// @notice The fee charged from consumer payment service
    uint256 public fee;

    /// @notice The Percentage of FEE
    uint256 public feePercentage;

    /// @notice Consumers info that hosting in this contract
    mapping(address => Consumer) public consumers;

    /// @notice StateChannels' belongs to consumer
    mapping(uint256 => address) public channels;

    /// @notice controller account belongs to consumer
    mapping(address => address) public controllers;


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
    event Paid(uint256 channelId, address consumer, address caller, uint256 amount, uint256 balance, uint256 fee);

    /// @notice Emitted when consumer pay for open a state channel
    event Claimed(uint256 channelId, address consumer, address caller, uint256 amount, uint256 balance);

    /// @notice Emitted when consumer set the controller account.
    event SetControllerAccount(address consumer, address controller);

    /// @notice Emitted when consumer remove the controller account.
    event RemoveControllerAccount(address consumer, address controller);

    /**
     * @dev ### FUNCTIONS
     * @notice Initialize the contract, setup the SQT, StateChannel, and feePercentage.
     * @param _settings Settings contract address
     * @param _feePercentage fee percentage
     */
    function initialize(
        ISettings _settings,
        address _sqt,
        address _channel,
        uint256 _feePercentage
    ) external initializer {
        __Ownable_init();
        settings = _settings;
        feePercentage = _feePercentage;

        // Approve Token to State Channel.
        IERC20 sqt = IERC20(_sqt);
        sqt.approve(_channel, sqt.totalSupply());
    }

    /**
     * @notice Update setting state.
     * @param _settings ISettings contract
     */
    function setSettings(ISettings _settings) external onlyOwner {
        settings = _settings;
    }

    /**
     * @notice Update fee percentage
     * @param _feePercentage fee percentage
     */
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 100, 'C001');
        feePercentage = _feePercentage;
    }

    /**
     * @notice consumer call to set the controller account, since consumer only allowed to set one controller account, we need to remove the previous controller account.
     * @param controller The address of controller account, consumer to set
     */
    function setControllerAccount(address controller) external {
        controllers[msg.sender] = controller;

        emit SetControllerAccount(msg.sender, controller);
    }


    /**
     * @notice consumer call to remove the controller account. 
     */
    function removeControllerAccount() public {
        address controller = controllers[msg.sender];
        delete controllers[msg.sender];

        emit RemoveControllerAccount(msg.sender, controller);
    }

    /**
     * @notice Collect fee to account
     * @param account the receiver
     * @param amount the amount
     */
    function collectFee(address account, uint256 amount) external onlyOwner {
        require(fee >= amount, 'C002');
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(account, amount);
        fee -= amount;
    }

    /**
     * @notice Get contract signer
     * @return the signer account
     */
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /**
     * @notice Update contract signer
     * @param _signer new signer account
     */
    function addSigner(address _signer) external onlyOwner {
        signers.push(_signer);
        signerIndex[_signer] = signers.length; // start from 1, skip 0
    }

    /**
     * @notice Update contract signer
     * @param _signer new signer account
     */
    function removeSigner(address _signer) external onlyOwner {
        require(signers.length > 0, 'C003');
        uint256 index = signerIndex[_signer];
        require(index > 0, 'C004');

        address lastSigner = signers[signers.length - 1];
        signers[index - 1] = lastSigner;
        signerIndex[lastSigner] = index;

        signers.pop();
        delete signerIndex[_signer];
    }

    /**
     * @notice check sender is signer
     * @param signer the checked address
     */
    function isSigner(address signer) external view returns (bool) {
        return signerIndex[signer] > 0;
    }

    /**
     * @notice Approve host can use consumer balance
     */
    function approve() external {
        require(!(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()), 'G019');
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = true;
        emit Approve(msg.sender);
    }

    /**
     * @notice Disapprove host can use consumer balance
     */
    function disapprove() external {
        require(!(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()), 'G019');
        Consumer storage consumer = consumers[msg.sender];
        consumer.approved = false;
        emit Disapprove(msg.sender);
    }

    /**
     * @notice Deposit amount to hosting, consumer can choose approve or not
     * @param amount the amount
     */
    function deposit(uint256 amount, bool isApprove) external {
        require(!(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()), 'G019');
        // transfer the balance to contract
        IERC20 sqt = IERC20(settings.getContractAddress(SQContracts.SQToken));
        sqt.safeTransferFrom(msg.sender, address(this), amount);
        sqt.safeIncreaseAllowance(settings.getContractAddress(SQContracts.StateChannel), amount);

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
        require(!(IEraManager(settings.getContractAddress(SQContracts.EraManager)).maintenance()), 'G019');
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.balance >= amount, 'C002');

        // transfer the balance to consumer
        IERC20(settings.getContractAddress(SQContracts.SQToken)).safeTransfer(msg.sender, amount);
        consumer.balance -= amount;

        emit Withdraw(msg.sender, amount, consumer.balance);
    }

    /**
     * @notice Paied callback function, only support from StateChannel
     * @param channelId the opened channel ID
     * @param amount the amount need to pay
     * @param callback the info include consumer and signature(if approve, no signature))
     */
    function paid(
        uint256 channelId,
        address sender,
        uint256 amount,
        bytes memory callback
    ) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'G011');
        (address consumer, bytes memory sign) = abi.decode(callback, (address, bytes));
        if (channels[channelId] == address(0)) {
            channels[channelId] = consumer;
        } else {
            require(channels[channelId] == consumer, 'C005');
        }

        Consumer storage info = consumers[consumer];

        uint256 fixedFee = amount > 100 ? (amount * feePercentage) / 100 : 1;
        require(info.balance >= amount + fixedFee, 'C002');

        if (!info.approved) {
            uint256 nonce = info.nonce;
            bytes32 payload = keccak256(abi.encode(channelId, amount, nonce));
            bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
            address sConsumer = ECDSA.recover(hash, sign);
            require(sConsumer == consumer || IConsumerRegistry(settings.getContractAddress(SQContracts.ConsumerRegistry)).isController(consumer, sConsumer), 'C006');
            info.nonce = nonce + 1;

            require(sConsumer == sender, 'C010');
        } else {
            require(signerIndex[sender] > 0 || consumer == sender, 'C011');
        }

        info.balance -= (amount + fixedFee);
        fee += fixedFee;

        emit Paid(channelId, consumer, msg.sender, amount, info.balance, fixedFee);
    }

    /**
     * @notice Claimed callback function, only support from StateChannel
     * @param channelId the finalized channel ID
     * @param amount the amount back to consumer
     */
    function claimed(uint256 channelId, uint256 amount) external {
        require(msg.sender == settings.getContractAddress(SQContracts.StateChannel), 'G011');

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
    function checkSign(
        uint256 channelId,
        bytes32 payload,
        bytes memory sign
    ) external view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', payload));
        address sConsumer = ECDSA.recover(hash, sign);
        if (signerIndex[sConsumer] > 0) {
            return true;
        }
        return channels[channelId] == sConsumer || IConsumerRegistry(settings.getContractAddress(SQContracts.ConsumerRegistry)).isController(channels[channelId], sConsumer);
    }

    /**
     * @notice check the sender is from signer or valid consumer
     * @param channelId the finalized channel ID
     * @param sender the sender need to check
     * @return Result of check
     */
    function checkSender(uint256 channelId, address sender) external view returns (bool) {
        if (signerIndex[sender] > 0) {
            return true;
        }

        return channels[channelId] == sender;
    }

    /**
     * @notice return the consumer of a channel
     * @param channelId the finalized channel ID
     * @return Result of addresses
     */
    function channelConsumer(uint256 channelId) external view returns (address) {
        return channels[channelId];
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
