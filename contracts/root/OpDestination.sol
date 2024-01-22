// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@eth-optimism/contracts/L1/messaging/IL1ERC20Bridge.sol";


import {IInflationDestination} from "./IInflationDestination.sol";
import "../interfaces/ISettings.sol";

contract OpDestination is IInflationDestination, Ownable, ERC165 {
    /// @dev ### STATES

    /// @notice Address of the ERC20 on layer 1 chain
    address public l1Token;

    /// @notice Address of the ERC20 on layer 2 chain
    address public l2Token;

    /// @notice Address of the L1 token bridge contract
    address public l1StandardBridge;

    /// @notice Address of token recipient on layer 2 chain
    address public xcRecipient;

    constructor(address _l1Token, address _l2Token, address _l1StandardBridge) Ownable() {
        l1Token = _l1Token;
        l2Token = _l2Token;
        l1StandardBridge = _l1StandardBridge;
    }

    /**
     * @notice Set the address of token address on layer 2 chain
     * @param _l2Token Address of l2 token
     */
    function setL2Token(address _l2Token) external onlyOwner {
        l2Token = _l2Token;
    }
    
    /**
     * @notice Set the address of token recipient on layer 2 chain
     * @param _xcRecipient Address of token recipient on layer 2 chain
     */
    function setXcRecipient(address _xcRecipient) external onlyOwner {
        xcRecipient = _xcRecipient;
    }

    /**
     * @notice Check ERC165 interface
     * @param interfaceId interface ID
     * @return Result of support or not
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IInflationDestination).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Deposit tokens to layer 2 chain recipient
     * @param amount Amount of tokens
     */
    function afterReceiveInflatedTokens(uint256 amount) external {
        require(l2Token != address(0), "OPD01");
        ERC20(l1Token).increaseAllowance(l1StandardBridge, amount);
        IL1ERC20Bridge(l1StandardBridge).depositERC20To(l1Token, l2Token, xcRecipient, amount, 300000, new bytes(0));
    }

    function withdraw(address _token) external onlyOwner {
        uint256 amount = ERC20(_token).balanceOf(address(this));
        ERC20(_token).transfer(owner(), amount);
    }
}