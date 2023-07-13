// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../utils/AcceptedTokensList.sol";

contract ConduitERC721 is AccessControl, ERC721Holder, AcceptedTokenList {
    
    /**
		An enum to track the possible sides of an order to be fulfilled.

		@param Buy A buy order is one in which an offer was made to buy an item.
		@param Sell A sell order is one in which a listing was made to sell an item.
	*/
	enum Side {
		Buy,
		Sell
	}

    struct Offer {
        Side side; //Is offer create for buy or sell
        bool executed;//Is offer executed
        address maker;
        address erc721Token;//Address of ERC721 token for which offer created
        uint256 tokenId;//Id of ERC721 token
        address erc20Token;//Address of ERC20 token, which will be paid for ERC721 token
        uint256 amount;//Amount of ERC20 tokens
        uint256 deadline;//Timestamp after which offer expired
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    bytes4 public constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    //Percent of fee taken from sales
    uint256 public feePercent;

    //Fee collected from every sale
    //collectedFee[addressOfERC20Token] = amountOfTokensTakenAsFee
    mapping(address => uint256) public collectedFee;

    // All offers of user
    // offers[userAddress][idOfOffer] = offer
    mapping(address => Offer[]) public offers;
    
    event OfferMade(
        Side side,
        address indexed _erc721Token, 
        uint256 indexed _tokenId,
        address _erc20Token,
        uint256 _amount,
        uint256 _deadline,
        uint256 indexed _offerId
        );

    // Emitted when admin "setFeePercent"
    event FeePercentChanged(uint256 feePercent, address admin);

    // Emitted when OFFER_EXECUTOR "executeOffer"
    event OfferExecuted(address offerCreator, uint256 offerId);

    /**
     * @dev Contract constructor
     */
    constructor(
        uint256 _feePercent,
        address _token
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);

        updateAcceptedTokenList(_token, TokenState.accepted);

        require(_feePercent <= 10000, "Fee percent must be less or equal to 10%");
        feePercent = _feePercent;
    }

    /** @notice Make offer for ERC721 token

        @param _erc721Token Address of ERC721 token
        @param _tokenId Id of ERC721 token
        @param _erc20Token Address of ERC20 Token which will be paid for ERC721 token
        @param _amount Amount of ERC20 tokens
        @param _deadline Timestamp after which Offer expired
     */
    function makeOffer(
        Side _side,
        address _erc721Token, 
        uint256 _tokenId,
        address _erc20Token,
        uint256 _amount,
        uint256 _deadline
    ) external {
        require(block.timestamp < _deadline, "Deadline must be in the future");
        require(
            IERC20(_erc20Token).allowance(msg.sender, address(this)) >= _amount && Side.Buy == _side 
            || IERC721(_erc721Token).isApprovedForAll(msg.sender, address(this)) && Side.Sell == _side && IERC721(_erc721Token).ownerOf(_tokenId) == msg.sender, 
            "Need to approve token");
        require(!hasStatus(_erc20Token, TokenState.unaccepted), "ERC20 token unaccepted");
        require(_erc721Token != address(0) && _erc20Token != address(0), "Can not be zero address");

        offers[msg.sender].push(Offer({
          side: _side,
          executed: false,
          maker: msg.sender,
          erc721Token: _erc721Token,  
          tokenId: _tokenId, 
          erc20Token: _erc20Token,  
          amount: _amount,
          deadline: _deadline
        }));

        emit OfferMade(
            _side,
          _erc721Token,  
          _tokenId,  
          _erc20Token,  
          _amount,  
          _deadline,
          offers[msg.sender].length - 1
          );
    }

    /** @notice Excutes offer from one of sides, if offer created for sell callable for buyer,
        if offer created for buy, callable for ERC721 token owner

        @param _offerCreator Address of offer creator 
        @param _offerId Id of offer of address to be executed
     */
    function executeOffer(address _offerCreator, uint256 _offerId) external {
        Offer storage offer = offers[_offerCreator][_offerId];
        require(offer.deadline >= block.timestamp, "Offer expired");
        require(offer.executed == false, "Offer already executed");
        require(msg.sender != _offerCreator && msg.sender != offer.maker, "Can not execute own offer");
        require(IERC721(offer.erc721Token).ownerOf(offer.tokenId) == offer.maker, "Token already sold");
        offer.executed = true;

        uint256 feeAmount;
        if (hasStatus(offer.erc20Token, TokenState.accepted)) {
                feeAmount += percentFrom(feePercent, offer.amount);
                collectedFee[offer.erc20Token] += feeAmount;
            }

        if(offer.side == Side.Buy) {
            IERC20(offer.erc20Token).transferFrom(_offerCreator, address(this), offer.amount);
            feeAmount += _payRoyalty(offer.erc721Token, offer.tokenId, offer.erc20Token, offer.amount);
            IERC20(offer.erc20Token).transfer(msg.sender, offer.amount - feeAmount);
        
            IERC721(offer.erc721Token).safeTransferFrom(msg.sender, _offerCreator, offer.tokenId);
        } else  if(offer.side == Side.Sell) {
            IERC20(offer.erc20Token).transferFrom(msg.sender, address(this), offer.amount);
            feeAmount += _payRoyalty(offer.erc721Token, offer.tokenId, offer.erc20Token, offer.amount);
            IERC20(offer.erc20Token).transfer(_offerCreator, offer.amount - feeAmount);

            IERC721(offer.erc721Token).safeTransferFrom(_offerCreator, msg.sender, offer.tokenId);
        }

        emit OfferExecuted(_offerCreator, _offerId);        
    }

    /** @notice Cancel offer by offer creator 

        @param _offerCreator Address of offer creator 
        @param _offerId Id of offer of address to be executed
     */
    function cancelOffer(address _offerCreator, uint256 _offerId) external {
        Offer storage offer = offers[_offerCreator][_offerId];
        require(offer.deadline >= block.timestamp, "Offer expired");
        require(offer.executed == false, "Offer already executed");
        require(msg.sender != _offerCreator, "Can not execute own offer");
        require(IERC721(offer.erc721Token).ownerOf(offer.tokenId) == offer.maker, "Token already sold");
        offer.executed = true;

        emit OfferExecuted(_offerCreator, _offerId);        
    }

    /** @notice Withdraw fee from contract
     * @param _token Address of token
     * @param _receiver Address of token receiver.
     * @param _amount Amount of tokens for transfer.
     */
    function withdrawToken(
        address _token,
        address _receiver,
        uint256 _amount
    ) external onlyRole(ADMIN_ROLE) {
        require(_receiver != address(0), "Invalid receiver address");

        IERC20(_token).transfer(_receiver, _amount);
    }

    /**
     * @dev Add or remove a token address from the list of allowed ERC20 tokens
     */
    function updateAcceptedTokenList(address _token, TokenState _status) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin.");

        _updateTokenList(_token, _status);
    }

    function setFeePercent(uint256 _feePercent) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin.");
        require(_feePercent <= 10000, "Fee percent must be less or equal to 10%");

        feePercent = _feePercent;

        emit FeePercentChanged(_feePercent, msg.sender);
    }

    /**
     * @dev returns offer struct of choisen offer
     */
    function getOffer(address _offerCreator, uint256 _offerId) external view  returns(Offer memory){
        return offers[_offerCreator][_offerId];
    }

    /**
     * @dev returns total amount of offers of choosen address
     */
    function getAmountOfOffersOfUser(address _user) external view returns(uint256 length) {
        return offers[_user].length;
    }

    /**
     * @dev Check for ERC2981 royalty and pay it if exist 
     */
    function _payRoyalty(
        address _erc721Token,
        uint256 _tokenId,
        address _erc20Token,
        uint256 _amount
    ) private returns (uint256 paidAmount) {
        if (checkRoyalties(_erc721Token)) {
            (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(_erc721Token).royaltyInfo(_tokenId, _amount);

            if (royaltyAmount > 0 && royaltyAmount <= _amount) {
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
        return ((_percent * _amount) / 100000);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}