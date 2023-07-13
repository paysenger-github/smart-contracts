// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

library DataTypes {
    struct MarketItem {
        address payable seller;
        uint256 price;
        address erc20Token;
        bool isActive;
    }

    struct EnglishAuctionConfig {
        uint256 currentPrice;
        uint256 instantBuyPrice;
        uint256 minIncreaseInterval;
        uint256 tokenId;
        uint256 endDate;
        address tokenOwner;
        address erc20Token;
        address erc721Token;
        address latestBidder;
        AuctionState state;
    }

    enum AuctionState {
        UNSPECIFIED,
        STARTED,
        FINISHED,
        UNSUCESSFUL
    }
}
