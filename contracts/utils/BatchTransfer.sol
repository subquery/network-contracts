// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BatchTransfer {
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts,
        address tokenAddress
    ) external payable {
        require(recipients.length == amounts.length, "invalid parameters");
        require(tokenAddress != address(0), "invalid token");
        IERC20 token = IERC20(tokenAddress);

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            token.transferFrom(msg.sender, recipient, amounts[i]);
        }

    }
}