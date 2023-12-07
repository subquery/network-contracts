// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.15;

import '../contracts/Airdropper.sol';
import "../contracts/root/SQToken.sol";

contract AirdropperEchidnaTest {
    Airdropper internal airdropper;
    SQToken internal SQT;

    constructor() {
        SQT = new SQToken(address(this));
        airdropper = new Airdropper();
    }

    // --- Math ---
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x + y;
        assert(z >= x); // check if there is an addition overflow
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        assert(z <= x); // check if there is a subtraction overflow
    }

    function test_workflow(uint256 _start, uint256 _end, uint256 _amount) public {
        //test createRound
        uint256 roundId = test_createRound(_start, _end);
        //test batchAirdrop
        address[] memory addrs = new address[](1);
        addrs[0] = address(this);
        uint256[] memory roundIds = new uint256[](1);
        roundIds[0] = roundId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;

        (, , , uint256 unclaimedAmountBefore) = airdropper.roundRecord(roundId);
        test_batchAirdrop(addrs, roundIds, amounts);
        (, , , uint256 unclaimedAmount) = airdropper.roundRecord(roundId);
        assert(unclaimedAmount == add(unclaimedAmountBefore, _amount));
    }

    function test_createRound(uint256 _start, uint256 _end) public returns (uint256){
        uint256 roundId = airdropper.createRound(address(SQT), add(block.timestamp, _start), add(block.timestamp, _end));
        assert(roundId == sub(airdropper.nextRoundId(), 1));
        (address tokenAddress, uint256 roundStartTime, uint256 roundDeadline, uint256 unclaimedAmount ) = airdropper.roundRecord(roundId);
        assert(tokenAddress == address(SQT));
        assert(roundStartTime == add(block.timestamp, _start));
        assert(roundDeadline == add(block.timestamp, _end));
        assert(unclaimedAmount == 0);
        return roundId;
    }

    function test_batchAirdrop(
        address[] memory _addr,
        uint256[] memory _roundId,
        uint256[] memory _amount
    ) public {
        airdropper.batchAirdrop(_addr, _roundId, _amount);
        assert(airdropper.airdropRecord(_addr[0], _roundId[0]) == _amount[0]);
    }

}