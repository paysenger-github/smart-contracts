// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

interface IERC721CrossChain {
    // function transferRemote(
    //     string calldata destinationChain,
    //     address destinationAddress,
    //     uint256 tokenId
    // ) external payable;

    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 _tokenId,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;
}
