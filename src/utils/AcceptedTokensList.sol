// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

abstract contract AcceptedTokenList {
    enum TokenState {
        unaccepted,
        accepted,
        feeFree
    }

    //List the status of the tokens
    //acceptedTokenList[tokenAddress] = TokenState
    mapping(address => TokenState) public acceptedTokenList;

    /**
     * @dev Emitted when `updateTokenList` change state of token
     */
    event TokenListUpdated(address indexed token, TokenState state);

    /**
     * @dev Add or remove a token address from the list of allowed to be accepted for exchange
     */
    function _updateTokenList(address _token, TokenState _state) internal {
        require(_token != address(0), "Token address can't be address(0).");

        acceptedTokenList[_token] = _state;

        emit TokenListUpdated(_token, _state);
    }

    function hasStatus(address _token, TokenState _status) public view returns (bool) {
        return acceptedTokenList[_token] == _status;
    }

    function getTokenStatus(address token) public view returns (TokenState) {
        return acceptedTokenList[token];
    }
}
