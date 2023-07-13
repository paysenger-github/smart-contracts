// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {IERC721CrossChain} from "./interfaces/IERC721CrossChain.sol";
import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executables/AxelarExecutable.sol";
import {StringToAddress, AddressToString} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/StringAddressUtils.sol";

contract ERC721ReqCreator is
    AxelarExecutable,
    IERC721CrossChain,
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Pausable,
    AccessControl,
    ERC2981
{
    using StringToAddress for string;
    using ECDSA for bytes32;
    using AddressToString for address;
    using Counters for Counters.Counter;

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IAxelarGasService public immutable gasReceiver;

    Counters.Counter public _tokenIdCounter;

    //chain id of main chain, mint allowed only in this chain
    uint256 mainChainId = 97;

    //Messages that have already been used
    //messages[messageHash] = true or false
    mapping(bytes32 => bool) public messages;

    //Contain networks accepted for cross-chain transfer
    //trustedRemote[nameOfChain] = isAccepted
    mapping(string => bool) public trustedRemotes;

    //Token id with locked uri
    mapping(uint256 => bool) public lockedTokens;

    mapping(string => uint256) public nameOfNetworkToChainId;

    event TokenLocked(bool status);

    event RemoteStatusChanged(string _chainName, bool _status, uint256 _chainId);

    event FalseSender(string sourceChain, string sourceAddress);

    event TokenMetadataChanged(uint256 tokenId, string uri);

    constructor(
        string memory _name,
        string memory _symbol,
        address gateway_,
        address gasReceiver_,
        string[] memory _trustedRemotes,
        uint256[] memory _chainIds,
        address rolesReceiver
    ) ERC721(_name, _symbol) AxelarExecutable(gateway_) {
        gasReceiver = IAxelarGasService(gasReceiver_);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, rolesReceiver);
        _grantRole(VALIDATOR_ROLE, rolesReceiver);
        _grantRole(ADMIN_ROLE, rolesReceiver);
        _grantRole(MINTER_ROLE, rolesReceiver);

        require(_trustedRemotes.length == _chainIds.length, "Length mismatch");
        for (uint256 i = 0; i < _trustedRemotes.length; i++) {
            trustedRemotes[_trustedRemotes[i]] = true;
            nameOfNetworkToChainId[_trustedRemotes[i]] = _chainIds[i];
        }
    }

    /** @notice Creates tokens by `MINTER`
     * @param _requestors address of request creator
     * @param _uri uri of token
     * @param _feeNumerators numerator for token royalty
     * @param _creators address of creator of content, this address receives royalty
     */
    function safeMintBatch(
        address[] calldata _requestors,
        string[] calldata _uri,
        uint96[] calldata _feeNumerators,
        address[] calldata _creators
    ) public onlyRole(MINTER_ROLE) {
        require(mainChainId == block.chainid, "Mint only allowed in main chain");
        require(
            _requestors.length == _uri.length &&
                _feeNumerators.length == _creators.length &&
                _creators.length == _requestors.length,
            "NFTGallery: arrays should be in the same length."
        );

        for (uint256 i = 0; i < _uri.length; i++) {
            safeMint(_requestors[i], _uri[i], _feeNumerators[i], _creators[i]);
        }
    }

    /** @notice Creates token by `MINTER`
     * @param _requestor address of request creator
     * @param uri uri of token
     * @param _feeNumerator numerator for token royalty
     * @param _creator address of creator of content, this address receives royalty
     */
    function safeMint(
        address _requestor,
        string calldata uri,
        uint96 _feeNumerator,
        address _creator
    ) public onlyRole(MINTER_ROLE) {
        require(_feeNumerator <= 1000, "Token royalty can be set up to 10 percent");
        require(mainChainId == block.chainid, "Mint only allowed in main chain");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(_requestor, tokenId);
        _setTokenRoyalty(tokenId, _creator, _feeNumerator);
        _setTokenURI(tokenId, uri);
    }

    /** @notice Create token using digital signature for validation
     * @param _requestor address of request creator
     * @param uri uri of token
     * @param _feeNumerator numerator for token royalty
     * @param _creator address of creator of content, this address receives royalty
     * @param _salt random number for digital signature
     * @param v part of digital signature
     * @param r part of digital signature
     * @param s part of digital signature
     */
    function safeMintSignature(
        address _requestor,
        string calldata uri,
        uint96 _feeNumerator,
        address _creator,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(mainChainId == block.chainid, "Mint only allowed in main chain");
        require(_feeNumerator <= 1000, "Token royalty can be set up to 10 percent");

        {
            bytes32 message = keccak256(
                abi.encodePacked(
                    _requestor,
                    uri,
                    _feeNumerator,
                    _creator,
                    _salt,
                    block.chainid,
                    msg.sender,
                    address(this)
                )
            );
            require(messages[message] == false, "Transaction in process");
            require(
                hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
                "Validator address is invalid"
            );

            messages[message] = true;
        }
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(_requestor, tokenId);
        _setTokenRoyalty(tokenId, _creator, _feeNumerator);
        _setTokenURI(tokenId, uri);
    }

    /** @notice Transfer tokens from current chain to choosen chain
     * @param destinationChain Name of chain to which tokens transfer
     * @param destinationAddress Address of tokens receiver in destination chain(do not used here)
     * @param _tokenId Id of token for transfer
     */
    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 _tokenId,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable override {
        {
            bytes32 message = keccak256(abi.encodePacked(block.chainid, msg.sender, _tokenId, address(this), _salt));
            require(messages[message] == false, "Transaction in process");
            require(
                hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
                "Validator address is invalid"
            );

            messages[message] = true;
            require(trustedRemotes[destinationChain], "Chain does not supported");
            require(ownerOf(_tokenId) == msg.sender, "Not otken owner");
        }
        bytes memory payload;
        {
            (address royaltyReceiver, uint256 fraction) = royaltyInfo(_tokenId, _feeDenominator());

            payload = abi.encode(
                destinationAddress,
                _tokenId,
                tokenURI(_tokenId),
                royaltyReceiver,
                fraction,
                _salt,
                v,
                r,
                s
            );
        }

        string memory stringAddress = address(this).toString();

        if (msg.value > 0) {
            gasReceiver.payNativeGasForContractCall{value: msg.value}(
                address(this),
                destinationChain,
                stringAddress,
                payload,
                destinationAddress
            );
        }

        _burn(_tokenId);

        gateway.callContract(destinationChain, stringAddress, payload);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /** @notice Sets status for chain and allow to execute messages from it and send messages to
     * @param _chainName Name of chain accepted for transferRemote and execute
     * @param _status Is chain accepted for transferRemote and execute
     * @param _chainId Chain id of chain
     */
    function setTrustedRemote(
        string calldata _chainName,
        bool _status,
        uint256 _chainId
    ) public onlyRole(ADMIN_ROLE) {
        trustedRemotes[_chainName] = _status;
        nameOfNetworkToChainId[_chainName] = _chainId;

        emit RemoteStatusChanged(_chainName, _status, _chainId);
    }

    /** @notice Lock token uri of choosen token id, we use this function for blocking unacceptable content
     * @param tokenId id of token
     */
    function lockToken(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        lockedTokens[tokenId] = !lockedTokens[tokenId];
        emit TokenLocked(lockedTokens[tokenId]);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        if (lockedTokens[tokenId]) {
            return "Token locked";
        }
        return super.tokenURI(tokenId);
    }

    /** @notice Internal function for cross chain messages execution
     */
    function _execute(
        string calldata sourceChain, /*sourceChain*/
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        require(trustedRemotes[sourceChain], "Chain does not supported");

        if (sourceAddress.toAddress() != address(this)) {
            emit FalseSender(sourceAddress, sourceAddress);
            return;
        }

        uint256 chainId = nameOfNetworkToChainId[sourceChain];

        (
            address to,
            uint256 _tokenId,
            string memory uri,
            address royaltyReceiver,
            uint96 fraction,
            uint256 salt,
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = abi.decode(payload, (address, uint256, string, address, uint96, uint256, uint8, bytes32, bytes32));

        {
            bytes32 message = keccak256(abi.encodePacked(chainId, to, _tokenId, address(this), salt));

            require(messages[message] == false, "Transaction in process");
            require(
                hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
                "Validator address is invalid"
            );

            messages[message] = true;
        }

        require(!_exists(_tokenId), "Token already exist in this network");

        _safeMint(to, _tokenId);
        _setTokenRoyalty(_tokenId, royaltyReceiver, fraction);
        _setTokenURI(_tokenId, uri);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
