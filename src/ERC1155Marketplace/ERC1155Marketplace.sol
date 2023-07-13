// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC1155.sol";

contract ERC1155Market is Ownable {
    address public egoToken;
    address public levelsToken;
    address public receiver;

    mapping(uint256 => uint256) prices;

    event PriceChanged(uint256 tokenId, uint256 price);
    event Exchange(uint256 tokenId, uint256 amountOfERC1155, uint256 price);
    event AddressesChanged(address receiver, address egoToken, address levelsToken);

    constructor(
        address _receiver,
        address _egoToken,
        address _levelsToken
    ) {
        receiver = _receiver;
        egoToken = _egoToken;
        levelsToken = _levelsToken;
    }

    function setPrice(uint256 id, uint256 price) public onlyOwner {
        prices[id] = price;
        emit PriceChanged(id, price);
    }

    function setAddresses(
        address _receiver,
        address _egoToken,
        address _levelsToken
    ) public onlyOwner {
        receiver = _receiver;
        egoToken = _egoToken;
        levelsToken = _levelsToken;

        emit AddressesChanged(_receiver, _egoToken, _levelsToken);
    }

    function exchange(uint256 id, uint256 amountOfERC1155) public {
        require(prices[id] > 0, "Price for token is not set");

        IERC1155Mintable(levelsToken).mint(msg.sender, id, amountOfERC1155, "");
        IERC20(egoToken).transferFrom(msg.sender, receiver, prices[id] * amountOfERC1155);

        emit Exchange(id, amountOfERC1155, prices[id]);
    }
}
