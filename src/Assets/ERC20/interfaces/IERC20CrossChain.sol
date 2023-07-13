// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20CrossChain is IERC20 {
    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 amount,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;
}
