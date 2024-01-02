// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/ISQTGift.sol';

contract SQTRedeem is Initializable, OwnableUpgradeable {

  address public sqtoken;

  bool public redeemable;

  mapping (address => bool) public allowlist;

  event SQTRedeemed(address indexed to, address nft, uint256 indexed tokenId, uint256 sqtValue);

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

  function addToAllowlist(address _address) public onlyOwner {
    allowlist[_address] = true;
  }

  function removeFromAllowlist(address _address) public onlyOwner {
    allowlist[_address] = false;
  }

  function setRedeemable(bool _redeemable) external onlyOwner {
    redeemable = _redeemable;
  }

  function redeem(address nft, uint256 tokenId) public {
    require(redeemable, "SQR002");
    require(allowlist[nft], "SQR003");

    IERC165Upgradeable nftContract = IERC165Upgradeable(nft);
    require(nftContract.supportsInterface(type(ISQTGift).interfaceId), "SQR004");
    
    ISQTGift sqtGift = ISQTGift(nft);
    require(sqtGift.getGiftRedeemable(tokenId), "SQG005");
    require(sqtGift.ownerOf(tokenId) == msg.sender, "SQG006");
    uint256 sqtValue = sqtGift.getSQTRedeemableValue(tokenId);
    require(sqtValue > 0, "SQG007");
    sqtGift.afterTokenRedeem(tokenId);

    require(IERC20(sqtoken).transfer(msg.sender, sqtValue), "SQR001");

    emit SQTRedeemed(msg.sender, nft, tokenId, sqtValue);
  }
}