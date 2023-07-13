// MerkleAirdrop.sol
pragma solidity ^0.8.9;

pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
	@title Paysenger Vesting
	@author OIS Solutions <https://www.ois.dev/>
	@author Barinov Nikita
	
	This contract is a ERC20 token vesting.

	@custom:date June 2th, 2023.
*/
contract Vesting {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public token;
    bytes32 public merkleRoot;

    struct UserData {
        uint256 userAddressToAmountClaimed;
        uint256 amountAvailableToClaim;
        uint256 vestingStartTime;
        uint256 vestingEndTime;
        uint256 startVestingPercentage;
    }

    // Total amount of tokens vested by this contract
    uint256 public totalAmountOfVesting;

    // Timestamp in which vesting starts
    uint256 public vestingStartTime;

    // Timestamp in which vesting ends
    uint256 public vestingEndTime;

    //Percent of total amount of user's tokens, which unlock at vestingStartTime
    uint256 public startVestingPercentage;

    //Percent of total amount of user's tokens, which unlock at vestingStartTime
    uint256 public vestingSlicePeriodSeconds = 60;

    //Shown amount of tokens claimed by the user
    mapping(address => uint256) public userAddressToAmountClaimed;

    //Shown that user claim vesting percent and started linear vesting
    mapping(address => bool) public isStartAmountClaimed;

    // This event is triggered whenever a call to claim succeeds.
    event Claimed(address account, uint256 amount);

    constructor(
        address token_,
        bytes32 merkleRoot_,
        uint256 startVestingPercentage_,
        uint256 totalAmountOfVesting_,
        uint256 vestingStartTime_,
        uint256 vestingEndTime_
    ) {
        require(startVestingPercentage_ <= 100, "Can not be greater than 100%");
        require(vestingEndTime_ > vestingStartTime, "Start time can not be grater than end time");
        require(vestingStartTime_ > block.timestamp, "Vesting start time must be in future");

        token = token_;
        merkleRoot = merkleRoot_;
        startVestingPercentage = startVestingPercentage_;
        vestingEndTime = vestingEndTime_;
        totalAmountOfVesting = totalAmountOfVesting_;
        vestingStartTime = vestingStartTime_;
    }

    /**
     * @notice Computes the releasable amount of tokens for a vesting schedule
     * @param totalAmountOfUser - total amount of tokens, which user can claim
     * @param merkleProof - array of proofs for merkle tree
     */
    function claim(uint256 totalAmountOfUser, bytes32[] calldata merkleProof) external {
        // Verify the merkle proof.
        require(block.timestamp > vestingStartTime, "Too early for claim");
        bytes32 node = keccak256(abi.encodePacked(msg.sender, totalAmountOfUser));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "MerkleDistributor: Invalid proof.");

        // Mark it claimed and send the token.
        uint256 _amount = _computeReleasableAmount(msg.sender, totalAmountOfUser);

        userAddressToAmountClaimed[msg.sender] += _amount;
        isStartAmountClaimed[msg.sender] = true;
        require(IERC20(token).transfer(msg.sender, _amount), "MerkleDistributor: Transfer failed.");

        emit Claimed(msg.sender, _amount);
    }

    /**
     * @notice Returns information about user
     * @param _account - address of user
     * @param totalAmountOfUser - total amount of tokens, vested to user
     */
    function getUserData(address _account, uint256 totalAmountOfUser) public view returns (UserData memory _userData) {
        _userData.userAddressToAmountClaimed = userAddressToAmountClaimed[_account];
        _userData.vestingStartTime = vestingStartTime;
        _userData.vestingEndTime = vestingEndTime;
        _userData.startVestingPercentage = startVestingPercentage;
        _userData.amountAvailableToClaim = getAmountAvailableToClaim(_account, totalAmountOfUser);
    }

    /**
     * @notice Returns amountof tokens available to claim
     * @param _account - address of user
     * @param totalAmountOfUser - total amount of tokens, vested to user
     */
    function getAmountAvailableToClaim(address _account, uint256 totalAmountOfUser)
        public
        view
        returns (uint256 _amount)
    {
        _amount = _computeReleasableAmount(_account, totalAmountOfUser);
    }

    /**
     * @notice Computes the releasable amount of tokens for a vesting schedule
     * @return The amount of releasable tokens
     */
    function _computeReleasableAmount(address _account, uint256 totalAmountOfUser) internal view returns (uint256) {
        uint256 currentTime = getCurrentTime();
        if (currentTime >= vestingEndTime) {
            return totalAmountOfUser - userAddressToAmountClaimed[_account];
        } else if (currentTime < vestingStartTime) {
            return 0;
        } else {
            uint256 timeFromStart = currentTime.sub(vestingStartTime);
            uint256 secondsPerSlice = vestingSlicePeriodSeconds;
            uint256 vestedSlicePeriods = timeFromStart.div(secondsPerSlice);
            uint256 vestedSeconds = vestedSlicePeriods.mul(secondsPerSlice);
            uint256 vestedAmount = (totalAmountOfUser.mul(vestedSeconds).div(vestingEndTime - vestingStartTime))
                .mul((100 - startVestingPercentage))
                .div(100);

            uint256 startAmount = claimStartAmount(totalAmountOfUser);
            if (!isStartAmountClaimed[_account]) {
                vestedAmount = vestedAmount.add(startAmount);
            } else {
                uint256 diff = userAddressToAmountClaimed[_account].sub(startAmount);
                vestedAmount = vestedAmount.sub(diff);
            }

            return vestedAmount;
        }
    }

    function claimStartAmount(uint256 _totalTokenAmount) private view returns (uint256) {
        return _totalTokenAmount.mul(startVestingPercentage).div(100);
    }

    /**
     * @notice Get current TimeMar-10-2023 04:31:56
     */
    function getCurrentTime() internal view returns (uint256) {
        return block.timestamp;
    }
}
