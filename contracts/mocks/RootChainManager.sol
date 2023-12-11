// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../root/IRootChainManager.sol";


contract RootChainManager is IRootChainManager, Initializable
{
    address public constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    mapping(bytes32 => address) public typeToPredicate;
    mapping(address => address) public rootToChildToken;
    mapping(address => address) public childToRootToken;
    mapping(address => bytes32) public tokenToType;
    mapping(bytes32 => bool) public processedExits;
    address public exitBenificiary;
    uint256 public bridgedAmount;
    address public rootToken;

    /**
     * @notice Initialize the contract after it has been proxified
     * @dev meant to be called once immediately after deployment
     */
    function initialize() external initializer {
    }

    function setExitBenificiary(address _benificiary) external  {
        exitBenificiary = _benificiary;
    }

    function setBridgedAmount(uint256 _bridgedAmount) external  {
        bridgedAmount = _bridgedAmount;
    }

    function setRootToken(address _rootToken) external  {
        rootToken = _rootToken;
    }

    /**
     * @notice Register a token predicate address against its type, callable only by mappers
     * @dev A predicate is a contract responsible to process the token specific logic while locking or exiting tokens
     * @param tokenType bytes32 unique identifier for the token type
     * @param predicateAddress address of token predicate address
     */
    function registerPredicate(bytes32 tokenType, address predicateAddress)
    external
    override
    {
        typeToPredicate[tokenType] = predicateAddress;
        emit PredicateRegistered(tokenType, predicateAddress);
    }

    /**
     * @notice Map a token to enable its movement via the PoS Portal, callable only by mappers
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     * @param tokenType bytes32 unique identifier for the token type
     */
    function mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external override {
        // explicit check if token is already mapped to avoid accidental remaps
        require(
            rootToChildToken[rootToken] == address(0) &&
            childToRootToken[childToken] == address(0),
            "RootChainManager: ALREADY_MAPPED"
        );
        _mapToken(rootToken, childToken, tokenType);
    }

    /**
     * @notice Clean polluted token mapping
     * @param rootToken address of token on root chain. Since rename token was introduced later stage,
     * clean method is used to clean pollulated mapping
     */
    function cleanMapToken(
        address rootToken,
        address childToken
    ) external override {
        rootToChildToken[rootToken] = address(0);
        childToRootToken[childToken] = address(0);
        tokenToType[rootToken] = bytes32(0);

        emit TokenMapped(rootToken, childToken, tokenToType[rootToken]);
    }

    /**
     * @notice Remap a token that has already been mapped, properly cleans up old mapping
     * Callable only by mappers
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     * @param tokenType bytes32 unique identifier for the token type
     */
    function remapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external override {
        // cleanup old mapping
        address oldChildToken = rootToChildToken[rootToken];
        address oldRootToken = childToRootToken[childToken];

        if (rootToChildToken[oldRootToken] != address(0)) {
            rootToChildToken[oldRootToken] = address(0);
            tokenToType[oldRootToken] = bytes32(0);
        }

        if (childToRootToken[oldChildToken] != address(0)) {
            childToRootToken[oldChildToken] = address(0);
        }

        _mapToken(rootToken, childToken, tokenType);
    }

    function _mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) private {
        rootToChildToken[rootToken] = childToken;
        childToRootToken[childToken] = rootToken;
        tokenToType[rootToken] = tokenType;

        emit TokenMapped(rootToken, childToken, tokenType);
    }

    /**
     * @notice Move ether from root to child chain, accepts ether transfer
     * Keep in mind this ether cannot be used to pay gas on child chain
     * Use Matic tokens deposited using plasma mechanism for that
     * @param user address of account that should receive WETH on child chain
     */
    function depositEtherFor(address user) external override payable {
        _depositEtherFor(user);
    }

    /**
     * @notice Move tokens from root to child chain
     * @dev This mechanism supports arbitrary tokens as long as its predicate has been registered and the token is mapped
     * @param user address of account that should receive this deposit on child chain
     * @param rootToken address of token that is being deposited
     * @param depositData bytes data that is sent to predicate and child token contracts to handle deposit
     */
    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external override {
        require(
            rootToken != ETHER_ADDRESS,
            "RootChainManager: INVALID_ROOT_TOKEN"
        );
        _depositFor(user, rootToken, depositData);
    }

    function _depositEtherFor(address user) private {
        bytes memory depositData = abi.encode(msg.value);
        _depositFor(user, ETHER_ADDRESS, depositData);
    }

    function _depositFor(
        address user,
        address rootToken,
        bytes memory depositData
    ) private {
        IERC20(rootToken).transferFrom(msg.sender, address(this), bridgedAmount);
    }

    /**
     * @notice exit tokens by providing proof
     * @dev This function verifies if the transaction actually happened on child chain
     * the transaction log is then sent to token predicate to handle it accordingly
     */
    function exit(bytes calldata inputData) external override {
        IERC20(rootToken).transferFrom(address(this), exitBenificiary, bridgedAmount);
    }

}