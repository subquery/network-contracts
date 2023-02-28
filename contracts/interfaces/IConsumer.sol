// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

//import '@openzeppelin/contracts/utils/introspection/IERC165.sol';

interface IConsumer {
    // Params: channel id, msg sender, amount, callback info.
    function paid(uint256 channelId, uint256 amount, bytes memory callback) external;

    // Params: channel id, msg sender, amount.
    function claimed(uint256 channelId, uint256 amount) external;

    // Params: channel id, signature
    function checkSign(uint256 channelId, bytes32 payload, bytes memory sign) external view returns (bool);

    // Params: channel id, sender
    function checkSender(uint256 channelId, address sender) external view returns (bool);
}
