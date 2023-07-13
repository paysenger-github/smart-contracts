// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol"; // security for non-reentrant
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "../utils/AcceptedTokensList.sol";

import {Errors} from "../utils/Errors.sol";
import {DataTypes} from "../utils/DataTypes.sol";

contract ERC721Market is ReentrancyGuard, AccessControl, AcceptedTokenList {
    using Counters for Counters.Counter;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    //Percent of fee taken from sales
    uint256 public feePercent;

    //Fee collected from every sale
    //collectedFee[addressOfERC20Token] = amountOfTokensTakenAsFee
    mapping(address => uint256) public collectedFee;

    //marketItem[addressOfToken][tokenId] = array of item orders
    mapping(address => mapping(uint256 => DataTypes.MarketItem[])) public marketItems;

    //englishAuctions[addressOfToken][tokenId] = arrey of item auctions
    mapping(address => mapping(uint256 => DataTypes.EnglishAuctionConfig[])) public englishAuctions;

    //Emitted when some address "listMarketItemOnEnglishAuction"
    event EnglishAuctionStarted(
        uint256 startPrice,
        uint256 minIncreaseInterval,
        uint256 instantBuyPrice,
        uint256 tokenId,
        uint256 endDate,
        address erc20Token,
        address erc721Token,
        address tokenOwner
    );

    //Emitted when some address "makeBidAtEnglishAuction"
    event BidMade(address bidder, uint256 currentPrice, address erc721Token, uint256 tokenId);

    //Emitted when auction finished
    event AuctionFinished(address seller, address winner, address erc721Address, uint256 tokenId, uint256 price);

    //Emitted when some address "listFixedPriceMarketItem"
    event FixedPriceMarketItemListed(address erc721Token, uint256 tokenId, uint256 price, address erc20Token);

    //Emitted when some address "buyItemOnFixedPriceMarket"
    event ItemBoughtAtFixedPrice(address buyer, address erc721Token, uint256 tokenId, uint256 price);

    //Emitted when owner of token "delistFixedPriceMarketItem"
    event Delisted(address erc721Token, uint256 tokenId);

    //Emitted when contract "receive" value
    event ValueReceived(address user, uint amount);

    //Emitted when admin "setFeePErcent"
    event FeePercentChanged(uint256 feePercent, address admin);

    constructor(uint256 _feePercent) {
        _setFeePercent(_feePercent);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _grantRole(ADMIN_ROLE, msg.sender);

        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /** @notice Create fixed price market sale for ERC721 token, set price for it and transfer ERC721 token to contract
     * @param _erc721Token Address of ERC721 token for sale
     * @param _tokenId Id of token for sale
     * @param _price Amount of tokens which seller whant to get for ERC721 token
     * @param _erc20Token Address of token in which seller whant to get payment
     */
    function listFixedPriceMarketItem(
        address _erc721Token,
        uint256 _tokenId,
        uint256 _price,
        address _erc20Token
    ) public {
        if (_price == 0) {
            revert Errors.AmountCanNotBeZero();
        }

        if (hasStatus(_erc20Token, TokenState.unaccepted)) {
            revert Errors.TokenIsUnaccepted();
        }

        marketItems[_erc721Token][_tokenId].push(
            DataTypes.MarketItem({price: _price, erc20Token: _erc20Token, seller: payable(msg.sender), isActive: true})
        );

        IERC721(_erc721Token).safeTransferFrom(msg.sender, address(this), _tokenId);

        emit FixedPriceMarketItemListed(_erc721Token, _tokenId, _price, _erc20Token);
    }

    /** @notice Function for buy token on fixed price market sale, transfer ERC20 tokens to seller and transfer ERC721 token to buyer
     * @param _erc721Token Address of ERC721 token for sale
     * @param _tokenId Id of token for sale
     */
    function buyItemOnFixedPriceMarket(address _erc721Token, uint256 _tokenId) public payable {
        if (marketItems[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        DataTypes.MarketItem storage marketItem = marketItems[_erc721Token][_tokenId][
            marketItems[_erc721Token][_tokenId].length - 1
        ];

        if (marketItem.isActive != true) {
            revert Errors.InvalidFixedPriceMarketSaleState();
        }

        IERC20(marketItem.erc20Token).transferFrom(msg.sender, address(this), marketItem.price);

        _payWithRoyalty(marketItem.erc20Token, marketItem.price, _erc721Token, _tokenId, marketItem.seller);

        marketItem.isActive = false;

        emit ItemBoughtAtFixedPrice(msg.sender, _erc721Token, _tokenId, marketItem.price);
    }

    /** @notice Delist ERC721 token from fixed price market sale and transfer ERC721 token back to seller
     * @param _erc721Token Address of ERC721 token for sale
     * @param _tokenId Id of token for sale
     */
    function delistFixedPriceMarketItem(address _erc721Token, uint256 _tokenId) public payable {
        if (marketItems[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        DataTypes.MarketItem storage marketItem = marketItems[_erc721Token][_tokenId][
            marketItems[_erc721Token][_tokenId].length - 1
        ];

        if (marketItem.isActive != true) {
            revert Errors.InvalidFixedPriceMarketSaleState();
        }

        if (marketItem.seller != msg.sender) {
            revert Errors.NotTokenOwner();
        }

        require(marketItem.seller == msg.sender, "Not token owner");

        marketItem.isActive = false;

        IERC721(_erc721Token).safeTransferFrom(address(this), msg.sender, _tokenId);

        emit Delisted(_erc721Token, _tokenId);
    }

    /** @notice Function for listing token on auction, transfer ERC721 token to contract address and create auction struct
     * @param _startPrice Amount of token from which auction price will start
     * @param _minIncreaseInterval Amount of tokens by which the price should increase with each bid
     * @param _instantBuyPrice Amount of tokens for which address can buy a token instantly
     * @param _tokenId Id of token that will be sold at the auction
     * @param _endDate Block timestamp in which auction will be finished
     * @param _erc20Token Address of ERC20 token in which payment will be made
     * @param _erc721Token Address of ERC721 token which will be sold at auction
     */
    function listMarketItemOnEnglishAuction(
        uint256 _startPrice,
        uint256 _minIncreaseInterval,
        uint256 _instantBuyPrice,
        uint256 _tokenId,
        uint256 _endDate,
        address _erc20Token,
        address _erc721Token
    ) public {
        DataTypes.EnglishAuctionConfig[] storage auction = englishAuctions[_erc721Token][_tokenId];
        if (auction.length > 0 && auction[auction.length - 1].state == DataTypes.AuctionState.STARTED) {
            revert Errors.InvalidAuctionState();
        }

        if (_minIncreaseInterval == 0 || _startPrice == 0) {
            revert Errors.AmountCanNotBeZero();
        }

        if (_endDate < block.timestamp) {
            revert Errors.InvalidTimeForFunction();
        }

        if (hasStatus(_erc20Token, TokenState.unaccepted)) {
            revert Errors.TokenIsUnaccepted();
        }

        if (_startPrice + _minIncreaseInterval >= _instantBuyPrice) {
            revert Errors.InstantBuyPriceMustBeGreaterThanMin();
        }

        auction.push(
            DataTypes.EnglishAuctionConfig({
                tokenOwner: msg.sender,
                minIncreaseInterval: _minIncreaseInterval,
                endDate: _endDate,
                instantBuyPrice: _instantBuyPrice,
                latestBidder: address(0),
                erc20Token: _erc20Token,
                erc721Token: _erc721Token,
                tokenId: _tokenId,
                currentPrice: _startPrice - _minIncreaseInterval,
                state: DataTypes.AuctionState.STARTED
            })
        );

        IERC721(_erc721Token).safeTransferFrom(msg.sender, address(this), _tokenId);

        emit EnglishAuctionStarted(
            _startPrice,
            _minIncreaseInterval,
            _instantBuyPrice,
            _tokenId,
            _endDate,
            _erc20Token,
            _erc721Token,
            msg.sender
        );
    }

    /** @notice Create bid at auction, transfer tokens of bidder to contract and send tokens to latest bidder back
     * @param _erc721Token Address of ERC721 token for sale
     * @param _tokenId Id of token for sale
     * @param _bidAmount Amount of token which address want to bid
     */
    function makeBidAtEnglishAuction(
        address _erc721Token,
        uint256 _tokenId,
        uint256 _bidAmount
    ) public {
        DataTypes.EnglishAuctionConfig storage auction = englishAuctions[_erc721Token][_tokenId][
            englishAuctions[_erc721Token][_tokenId].length - 1
        ];
        if (_bidAmount < (auction.currentPrice + auction.minIncreaseInterval)) {
            revert Errors.InvalidBidAmount();
        }
        if (auction.endDate < block.timestamp) {
            revert Errors.InvalidTimeForFunction();
        }
        if (auction.state != DataTypes.AuctionState.STARTED) {
            revert Errors.InvalidAuctionState();
        }

        if (_bidAmount < auction.instantBuyPrice) {
            IERC20(auction.erc20Token).transferFrom(msg.sender, address(this), _bidAmount);

            if (auction.latestBidder != address(0)) {
                IERC20(auction.erc20Token).transfer(auction.latestBidder, auction.currentPrice);
            }

            auction.currentPrice = _bidAmount;
            auction.latestBidder = msg.sender;

            emit BidMade(msg.sender, auction.currentPrice, _erc721Token, _tokenId);
        } else if (_bidAmount >= auction.instantBuyPrice) {
            IERC20(auction.erc20Token).transferFrom(msg.sender, address(this), auction.instantBuyPrice);

            if (auction.latestBidder != address(0)) {
                IERC20(auction.erc20Token).transfer(auction.latestBidder, auction.currentPrice);
            }

            _payWithRoyalty(
                auction.erc20Token,
                auction.instantBuyPrice,
                auction.erc721Token,
                auction.tokenId,
                auction.tokenOwner
            );

            auction.currentPrice = auction.instantBuyPrice;
            auction.latestBidder = msg.sender;

            auction.state = DataTypes.AuctionState.FINISHED;

            emit AuctionFinished(
                auction.tokenOwner,
                msg.sender,
                auction.erc721Token,
                auction.tokenId,
                auction.instantBuyPrice
            );
        }
    }

    /** @notice Buy token for fixed price
     * @param _erc721Token Address of ERC721 token which sold at auction
     * @param _tokenId Id of token that will be sold at the auction
     */
    function instantBuyAtEnglishAuction(address _erc721Token, uint256 _tokenId) public {
        DataTypes.EnglishAuctionConfig storage auction = englishAuctions[_erc721Token][_tokenId][
            englishAuctions[_erc721Token][_tokenId].length - 1
        ];

        if (auction.state != DataTypes.AuctionState.STARTED) {
            revert Errors.InvalidAuctionState();
        }
        if (auction.endDate <= block.timestamp) {
            revert Errors.InvalidTimeForFunction();
        }

        IERC20(auction.erc20Token).transferFrom(msg.sender, address(this), auction.instantBuyPrice);

        if (auction.latestBidder != address(0)) {
            IERC20(auction.erc20Token).transfer(auction.latestBidder, auction.currentPrice);
        }

        _payWithRoyalty(
            auction.erc20Token,
            auction.instantBuyPrice,
            auction.erc721Token,
            auction.tokenId,
            auction.tokenOwner
        );

        auction.state = DataTypes.AuctionState.FINISHED;

        emit AuctionFinished(
            auction.tokenOwner,
            msg.sender,
            auction.erc721Token,
            auction.tokenId,
            auction.instantBuyPrice
        );
    }

    /** @notice Function for finish auction if amount of bids is zero
     * @param _erc721Token Address of ERC721 token which will be sold at auction
     * @param _tokenId Id of token that will be sold at the auction
     */
    function finishUnsuccessfulAuction(address _erc721Token, uint256 _tokenId) public {
        DataTypes.EnglishAuctionConfig storage auction = englishAuctions[_erc721Token][_tokenId][
            englishAuctions[_erc721Token][_tokenId].length - 1
        ];
        if (auction.state != DataTypes.AuctionState.STARTED) {
            revert Errors.InvalidAuctionState();
        }
        if (auction.latestBidder != address(0)) {
            revert Errors.IncorrectProcessingOfTheAuctionResult();
        }

        IERC721(auction.erc721Token).safeTransferFrom(address(this), auction.tokenOwner, _tokenId);

        auction.state = DataTypes.AuctionState.UNSUCESSFUL;

        emit AuctionFinished(auction.tokenOwner, auction.tokenOwner, auction.erc721Token, auction.tokenId, 0);
    }

    /** @notice Function for finish auction after end date
     * @param _erc721Token Address of ERC721 token which will be sold at auction
     * @param _tokenId Id of token that will be sold at the auction
     */
    function finishEnglishAuction(address _erc721Token, uint256 _tokenId) public {
        DataTypes.EnglishAuctionConfig storage auction = englishAuctions[_erc721Token][_tokenId][
            englishAuctions[_erc721Token][_tokenId].length - 1
        ];
        if (auction.endDate > block.timestamp) {
            revert Errors.InvalidTimeForFunction();
        }

        if (auction.state != DataTypes.AuctionState.STARTED) {
            revert Errors.InvalidAuctionState();
        }

        if (auction.latestBidder == address(0)) {
            revert Errors.IncorrectProcessingOfTheAuctionResult();
        }

        uint256 feeAmount;
        if (acceptedTokenList[auction.erc20Token] == TokenState.accepted) {
            feeAmount += percentFrom(feePercent, auction.currentPrice);
            collectedFee[auction.erc20Token] += feeAmount;
        }

        feeAmount += _payRoyalty(_erc721Token, _tokenId, auction.erc20Token, auction.currentPrice);

        IERC20(auction.erc20Token).transfer(auction.tokenOwner, auction.currentPrice - feeAmount);
        IERC721(auction.erc721Token).safeTransferFrom(address(this), auction.latestBidder, _tokenId);

        auction.state = DataTypes.AuctionState.FINISHED;

        emit AuctionFinished(
            auction.tokenOwner,
            auction.latestBidder,
            auction.erc721Token,
            auction.tokenId,
            auction.currentPrice
        );
    }

    /**
     * @dev Add or remove a token address from the list of allowed to be accepted for exchange
     */
    function updateTokenList(address _token, TokenState _state) external {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert Errors.CallerHasNoRole();
        }

        _updateTokenList(_token, _state);
    }

    /**
     * @dev Sets fee percent taken from sales
     * @param _feePercent percent multiplied by 1000, cannot be greater than 10000
     */
    function setFeePercent(uint256 _feePercent) public {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert Errors.CallerHasNoRole();
        }
        _setFeePercent(_feePercent);
    }

    /**
     * @dev Withdrawn native currency received by contract
     * @param _recipient address which receive native currency
     * @param _amount Amount of currewncy for withdrawn
     */
    function sendValue(address payable _recipient, uint256 _amount) public {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert Errors.CallerHasNoRole();
        }
        if (_recipient == address(0)) {
            revert Errors.CanNotBeZeroAddress();
        }
        if (address(this).balance < _amount) {
            revert Errors.IncorrectProcessingOfTheAuctionResult();
        }

        (bool success, ) = _recipient.call{value: _amount}("");

        if (!success) {
            revert Errors.RecipientMayHaveReverted();
        }
    }

    /** @notice Withdraw fee tokens from contract
     * @param _token Address of token
     * @param _receiver Address of token receiver.
     * @param _amount Aount of tokens for transfer.
     */
    function withdrawFee(
        address _token,
        address _receiver,
        uint256 _amount
    ) public onlyRole(ADMIN_ROLE) {
        if (_receiver == address(0)) {
            revert Errors.CanNotBeZeroAddress();
        }

        IERC20(_token).transfer(_receiver, _amount);
        collectedFee[_token] -= _amount; //back
    }

    receive() external payable {
        emit ValueReceived(msg.sender, msg.value);
    }

    function getLatestMarketItem(address _erc721Token, uint256 _tokenId)
        external
        view
        returns (DataTypes.MarketItem memory)
    {
        if (marketItems[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        return marketItems[_erc721Token][_tokenId][marketItems[_erc721Token][_tokenId].length - 1];
    }

    function getMarketItem(
        address _erc721Token,
        uint256 _tokenId,
        uint256 _id
    ) external view returns (DataTypes.MarketItem memory) {
        if (marketItems[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        return marketItems[_erc721Token][_tokenId][_id];
    }

    function getLatestEnglishAuction(address _erc721Token, uint256 _tokenId)
        external
        view
        returns (DataTypes.EnglishAuctionConfig memory)
    {
        if (englishAuctions[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        return englishAuctions[_erc721Token][_tokenId][englishAuctions[_erc721Token][_tokenId].length - 1];
    }

    function getEnglishAuction(
        address _erc721Token,
        uint256 _tokenId,
        uint256 _id
    ) external view returns (DataTypes.EnglishAuctionConfig memory) {
        if (englishAuctions[_erc721Token][_tokenId].length == 0) {
            revert Errors.ItemDidNotListed();
        }

        return englishAuctions[_erc721Token][_tokenId][_id];
    }

    function _setFeePercent(uint256 _feePercent) private {
        if (_feePercent > 10000) {
            revert Errors.FeePercentTooHigh();
        }

        feePercent = _feePercent;

        emit FeePercentChanged(_feePercent, msg.sender);
    }

    /**
     * @dev Pays the receiver the selected amount;
     * @param _erc20Token the sender of the payament
     * @param _amount Total amount of tokens paid
     * @param _erc721Token Address of purchased token
     * @param _tokenId Id of purchased token
     * @param _receiver Receiver of payment in ERC20 tokens
     */
    function _payWithRoyalty(
        address _erc20Token,
        uint256 _amount,
        address _erc721Token,
        uint256 _tokenId,
        address _receiver
    ) private {
        uint256 feeAmount;
        if (acceptedTokenList[_erc20Token] == TokenState.accepted) {
            feeAmount += percentFrom(feePercent, _amount);
            collectedFee[_erc20Token] += feeAmount;
        }

        feeAmount += _payRoyalty(_erc721Token, _tokenId, _erc20Token, _amount);

        IERC20(_erc20Token).transfer(_receiver, _amount - feeAmount);
        IERC721(_erc721Token).safeTransferFrom(address(this), msg.sender, _tokenId);
    }

    function _payRoyalty(
        address _erc721Token,
        uint256 _tokenId,
        address _erc20Token,
        uint256 _amount
    ) private returns (uint256 paidAmount) {
        if (checkRoyalties(_erc721Token)) {
            (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(_erc721Token).royaltyInfo(_tokenId, _amount);

            if (royaltyAmount > 0) {
                paidAmount = royaltyAmount;
                IERC20(_erc20Token).transfer(royaltyReceiver, royaltyAmount);
            }
        }
    }

    function checkRoyalties(address _contract) internal view returns (bool) {
        bool success = IERC165(_contract).supportsInterface(_INTERFACE_ID_ERC2981);
        return success;
    }

    function percentFrom(uint256 _percent, uint256 _amount) private pure returns (uint256) {
        return ((_percent * _amount) / 10000);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
