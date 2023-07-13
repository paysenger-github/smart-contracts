// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../utils/AcceptedTokensList.sol";

contract DistributorERC721 is AccessControl, ERC721Holder, AcceptedTokenList {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OFFER_EXECUTOR_ROLE = keccak256("OFFER_EXECUTOR_ROLE");

    bytes4 public constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    //Percent of fee taken from sales
    uint256 public feePercent;

    //Fee collected from every sale
    //collectedFee[addressOfERC20Token] = amountOfTokensTakenAsFee
    mapping(address => uint256) public collectedFee;

    //Messages that have already been used
    //messages[messageHash] = true or false
    mapping(bytes32 => bool) public messages;

    //Emitted when User `claim` token
    event Claim(address _receiver, uint256 tokenId, address _erc721Token);

    //Emitted when User `claimAndSell` token
    event Bought(address seller, address buyer, uint256 price, address ERC20Token, uint256 tokenId);

    //Emitted when Users `swapTokens`
    event TokenSwapped(address _from, address _to);

    //Emitted when admin "setFeePErcent"
    event FeePercentChanged(uint256 feePercent, address admin);

    //Emitted when "swapERC20ForERC721"
    event ERC20ForERC721Swapped(
        address seller,
        address buyer,
        uint256 amount,
        address erc20Token,
        address erc721Token,
        uint256 tokenId
    );

    /**
     * @dev Contract constructor
     */
    constructor(address _validator, uint256 _feePercent) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(VALIDATOR_ROLE, _validator);

        require(_feePercent <= 10000, "Fee percent must be less or equal to 10%");
        feePercent = _feePercent;

        _setRoleAdmin(VALIDATOR_ROLE, ADMIN_ROLE);
    }

    /** @notice Claim function for token distribution
     * @param _tokenId Id of token for claim
     * @param v part of digital signature
     * @param r part of digital signature
     * @param s part of digital signature
     */
    function claim(
        uint256 _tokenId,
        address _erc721Token,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 message = keccak256(abi.encodePacked(msg.sender, _tokenId, _erc721Token, block.chainid, address(this)));
        require(messages[message] == false, "Transaction in process");
        require(
            hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
            "Validator address is invalid"
        );

        messages[message] = true;

        IERC721(_erc721Token).safeTransferFrom(address(this), msg.sender, _tokenId);

        emit Claim(msg.sender, _tokenId, _erc721Token);
    }

    function swapERC721ForERC721(
        uint256[] calldata _tokenIdTo,
        address[] calldata _erc721TokenTo,
        uint256[] calldata _tokenIdFrom,
        address[] calldata _erc721TokenFrom,
        address _buyer,
        address _seller
    ) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Validator address is invalid");

        for (uint256 i; i < _tokenIdFrom.length; i++) {
            IERC721(_erc721TokenFrom[i]).safeTransferFrom(_seller, _buyer, _tokenIdFrom[i]);
        }

        for (uint256 i; i < _tokenIdTo.length; i++) {
            IERC721(_erc721TokenTo[i]).safeTransferFrom(_buyer, _seller, _tokenIdTo[i]);
        }

        emit TokenSwapped(msg.sender, _buyer);
    }

    /** @notice Claim token and sell it to buyer for fixed price
     * @param _amountFrom Amount of ERC20 tokens taken from
     * @param _tokenId Id of token for sell
     * @param _erc20TokenFrom Address which buy token
     * @param _erc721TokenTo Address of token in which buyer pay for token
     * @param _salt Address of token in which buyer pay for token
     * @param _seller Address of token in which buyer pay for token
     * @param v part of digital signature
     * @param r part of digital signature
     * @param s part of digital signature
     */
    function swapERC20ForERC721(
        uint256 _amountFrom,
        uint256 _tokenId,
        address _erc20TokenFrom,
        address _erc721TokenTo,
        uint256 _salt,
        address _seller,
        address _buyer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 message = keccak256(
            abi.encodePacked(
                _amountFrom,
                _tokenId,
                _erc20TokenFrom,
                _erc721TokenTo,
                _seller,
                _buyer,
                _salt,
                block.chainid,
                address(this)
            )
        );

        require(messages[message] == false, "Transaction in process");
        require(
            hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
            "Validator address is invalid"
        );
        require(!hasStatus(_erc20TokenFrom, TokenState.unaccepted), "Token is unaccepted");

        messages[message] = true;
        {
            uint256 feeAmount;
            IERC20(_erc20TokenFrom).transferFrom(_buyer, address(this), _amountFrom);

            if (hasStatus(_erc20TokenFrom, TokenState.accepted)) {
                feeAmount += percentFrom(feePercent, _amountFrom);
                collectedFee[_erc20TokenFrom] += feeAmount;
            }

            feeAmount += _payRoyalty(_erc721TokenTo, _tokenId, _erc20TokenFrom, _amountFrom);

            IERC20(_erc20TokenFrom).transfer(_seller, _amountFrom - feeAmount);
        }
        IERC721(_erc721TokenTo).safeTransferFrom(_seller, _buyer, _tokenId);

        emit ERC20ForERC721Swapped(_seller, _buyer, _amountFrom, _erc20TokenFrom, _erc721TokenTo, _tokenId);
    }

    /** @notice Claim token and sell it to buyer for fixed price
     * @param _tokenId Id of token for sell
     * @param _price Price for sell
     * @param _buyer Address which buy token
     * @param _erc20Token Address of token in which buyer pay for token
     * @param v part of digital signature
     * @param r part of digital signature
     * @param s part of digital signature
     */
    function claimAndSell(
        uint256 _tokenId,
        uint256 _price,
        address _buyer,
        address _erc20Token,
        address _erc721Token,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 message = keccak256(
            abi.encodePacked(
                msg.sender,
                _erc721Token,
                _buyer,
                _price,
                _erc20Token,
                _tokenId,
                block.chainid,
                address(this),
                _salt
            )
        );

        require(messages[message] == false, "Transaction in process");
        require(
            hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
            "Validator address is invalid"
        );

        messages[message] = true;

        uint256 feeAmount;
        IERC20(_erc20Token).transferFrom(_buyer, address(this), _price);

        if (hasStatus(_erc20Token, TokenState.accepted)) {
            feeAmount += percentFrom(feePercent, _price);
            collectedFee[_erc20Token] += feeAmount;
        }

        feeAmount += _payRoyalty(_erc721Token, _tokenId, _erc20Token, _price);

        IERC20(_erc20Token).transfer(msg.sender, _price - feeAmount);

        IERC721(_erc721Token).safeTransferFrom(address(this), _buyer, _tokenId);

        emit Bought(msg.sender, _buyer, _price, _erc20Token, _tokenId);
    }

    /** @notice Withdraw tokens from contract
     * @param _token Address of token
     * @param _receiver Address of token receiver.
     * @param _amount Aount of tokens for transfer.
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
     * @dev Add or remove a token address from the list of allowed to be accepted for exchange
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
