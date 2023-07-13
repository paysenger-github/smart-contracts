// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {DataTypes} from "./DataTypes.sol";

library Errors {
    error ItemDidNotListed();
    error InvalidFixedPriceMarketSaleState();
    error NotTokenOwner();
    error IncorrectProcessingOfTheAuctionResult();
    error InvalidAuctionState();
    error InvalidTimeForFunction();
    error InvalidBidAmount();
    error AmountCanNotBeZero();
    error TokenIsUnaccepted();
    error InstantBuyPriceMustBeGreaterThanMin();
    error BalanceOfContractIsTooLow();
    error RecipientMayHaveReverted();
    error FeePercentTooHigh();
    error CallerHasNoRole();
    error InsufficientBalance();
    error CanNotBeZeroAddress();
}
