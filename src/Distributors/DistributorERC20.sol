// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract DistributorERC20 is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    bytes32 public constant DISTRIBUTION_CREATOR_ROLE = keccak256("DISTRIBUTION_CREATOR_ROLE");

    //Address of token which will be distrbuted
    address public token;

    //Messages that have already been used
    //messages[messageHash] = true or false
    mapping(bytes32 => bool) public messages;

    //Emitted when `DISTRIBUTION_CREATOR_ROLE` create new distribution
    event DistributionStarted(address distributor, uint256 amount);

    //Emitted when User `claim` reward
    event Claim(address _receiver, uint256 amount, uint256 salt);

    /**
     * @dev Contract constructor
     */
    constructor(
        address _token,
        address _distributionCreator,
        address _validator
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(DISTRIBUTION_CREATOR_ROLE, _distributionCreator);
        _setupRole(VALIDATOR_ROLE, _validator);

        _setRoleAdmin(VALIDATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(DISTRIBUTION_CREATOR_ROLE, ADMIN_ROLE);

        token = _token;
    }

    /** @notice Function for tokens distribution creation
     * @param _amount Amount of tokens for distribution
     */
    function createDistribution(uint256 _amount) external {
        require(hasRole(DISTRIBUTION_CREATOR_ROLE, msg.sender), "Caller is not a distribution creator.");

        IERC20(token).transferFrom(msg.sender, address(this), _amount);

        emit DistributionStarted(msg.sender, _amount);
    }

    /** @notice Claim function for token distribution
     * @param _amount Amount of tokens for cliam
     * @param _salt unique identifier for message
     * @param v part of digital signature
     * @param r part of digital signature
     * @param s part of digital signature
     */
    function claim(
        uint256 _amount,
        uint256 _salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 message = keccak256(abi.encodePacked(msg.sender, _amount, block.chainid, _salt, address(this)));

        require(messages[message] == false, "Transaction in process");
        require(
            hasRole(VALIDATOR_ROLE, message.toEthSignedMessageHash().recover(v, r, s)),
            "Validator address is invalid"
        );

        messages[message] = true;

        IERC20(token).transfer(msg.sender, _amount);

        emit Claim(msg.sender, _amount, _salt);
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
}
