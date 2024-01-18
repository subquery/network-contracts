// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISQTGift.sol';

contract SQTRedeem is Initializable, OwnableUpgradeable {
    address public sqtoken;

    /// @notice redeemable status of the contract
    bool public redeemable;

    /// @notice seriesId => redeemable amount for each NFT in the series
    mapping(uint256 => uint256) public redeemableAmount;

    event SQTRedeemed(address indexed to, uint256 indexed tokenId, uint256 seriesId, address nft, uint256 sqtValue);

    function initialize(address _sqtoken) external initializer {
        __Ownable_init();

        sqtoken = _sqtoken;
    }

    function desposit(uint256 amount) public onlyOwner {
        require(IERC20(sqtoken).transferFrom(msg.sender, address(this), amount), 'SQR001');
    }

    function withdraw(uint256 amount) public onlyOwner {
        require(IERC20(sqtoken).transfer(msg.sender, amount), 'SQR001');
    }

    function setRedeemable(bool _redeemable) external onlyOwner {
        redeemable = _redeemable;
    }

    function setRedeemableAmount(uint256 seriesId, uint256 amount) public onlyOwner {
        // this is to set the redeemable amount for per NFT in the series
        redeemableAmount[seriesId] = amount;
    }

    function redeem(address nft, uint256 tokenId) public {
        require(redeemable, 'SQR002');

        IERC165Upgradeable nftContract = IERC165Upgradeable(nft);
        require(nftContract.supportsInterface(type(ISQTGift).interfaceId), 'SQR003');

        ISQTGift sqtGift = ISQTGift(nft);
        require(sqtGift.ownerOf(tokenId) == msg.sender, 'SQG005');

        uint256 seriesId = sqtGift.getSeries(tokenId);
        uint256 sqtValue = redeemableAmount[sqtGift.getSeries(tokenId)];
        require(redeemableAmount[seriesId] > 0, 'SQG004');

        require(IERC20(sqtoken).transfer(msg.sender, sqtValue), 'SQR001');

        emit SQTRedeemed(msg.sender, tokenId, seriesId, nft, sqtValue);
    }
}
