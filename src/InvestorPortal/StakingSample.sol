//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
	@title Paysenger Staking
	@author OIS Solutions <https://www.ois.dev/>
	@author Barinov Nikita
	
	This contract is a ERC20 token staking.

	@custom:date June 2th, 2023.
*/
contract Staking is Ownable {
    using SafeERC20 for IERC20;

    /**
     * @notice Shows that the user stake some tokens to contract.
     * @param user the address of user.
     * @param amount an amount of tokens which user stakes to contract.
     */
    event Stake(address user, uint256 amount);

    /**
     * @notice Shows that the user unstake some tokens from contract.
     * @param user the address of user.
     * @param amount an amount of tokens which user unstakes from contract.
     */
    event Unstake(address user, uint256 amount);

    /**
     * @notice Shows that the user claim some reward tokens from contract.
     * @param user the address of user.
     * @param amount an amount of reward tokens which user claim from contract.
     */
    event Claim(address user, uint256 amount);

    /**
     * @notice Shows that the staking is locked and new deposits does not accepted.
     * @param sender the address of user, who lock stake.
     * @param status status for stake function.
     */
    event StakingLocked(address sender, bool status);

    /**
     * @notice Shows that stking rules changed.
     * @param epochDuration The duration of epoch.
     * @param rewardPerEpoch The amount of rewards distributed per epoch.
     * @param rewardDistibutionPeriod Period of time per which awards accrue.
     */
    event StakingRuleChanged(uint256 epochDuration, uint256 rewardPerEpoch, uint256 rewardDistibutionPeriod);

    struct Account {
        uint256 amountStake; //the number of tokens that the user has staked
        uint256 missedReward; //the number of reward tokens that the user missed
        uint256 lockedUntil; //timestamp at which staked token unlocked
    }

    struct UserInfo {
        uint256 amountStake; //the number of tokens that the user has staked
        uint256 missedReward; //the number of reward tokens that the user missed
        uint256 lockedUntil; //timestamp at which staked token unlocked
        uint256 availableReward;
    }

    struct ViewData {
        address stakeTokenAddress; //Address of stake and reward token
        address rewardTokenAddress; //Address of stake and reward token
        uint256 rewardPerEpoch; //Amount of reward distributed per epoch
        uint256 epochDuration; //Duration of epoch
        uint256 rewardDistibutionPeriod; //Period of time per which awards accrue
        uint256 lockPeriod; //Period for which tokens of user locked
        uint256 totalAmountStake; //Total amount of staked tokens
    }

    // Status of staking. Is new deposited not accepted?
    bool public stakingLocked;

    uint256 public constant precision = 1e18;

    //Current reward token per stake token
    uint256 private tokenPerStake;

    //The amount of rewards distributed per epoch
    uint256 public rewardPerEpoch;

    //The duration of epoch
    uint256 public epochDuration;

    //The period of time for which the currency is locked
    uint256 public lockPeriod;

    //Address of stake token
    address public stakeTokenAddress;

    //Address of reward token
    address public rewardTokenAddress;

    //Total amount of staked tokens
    uint256 public totalAmountStake;

    // The last timestamp in which token per stake changed
    uint256 private lastTimeTPSChanged;

    //Period of time per which awards accrue
    uint256 private rewardDistibutionPeriod;

    //This mapping contains information about users stake
    //accounts[userAddress] = Account
    mapping(address => Account) public accounts;

    constructor(
        address _stakeTokenAddress,
        address _rewardTokenAddress,
        uint256 _rewardPerEpoch,
        uint256 _epochDuration,
        uint256 _rewardDistibutionPeriod,
        uint256 _lockPeriod
    ) {
        require(_epochDuration >= _rewardDistibutionPeriod);

        rewardPerEpoch = _rewardPerEpoch;
        epochDuration = _epochDuration;
        stakeTokenAddress = _stakeTokenAddress;
        rewardTokenAddress = _rewardTokenAddress;
        rewardDistibutionPeriod = _rewardDistibutionPeriod;
        lastTimeTPSChanged = block.timestamp;
        lockPeriod = _lockPeriod;
    }

    /**
     * @notice With this function user can stake some amount of token to contract.
     * @dev Users can not unstake and claim tokens before their lock time ends
     * @param _amount is an amount of tokens which user stakes to contract.
     */
    function stake(uint256 _amount) external {
        require(!stakingLocked, "Deposit locked, can only withdraw");
        require(_amount > 0, "Not enough to deposite");
        Account storage account = accounts[msg.sender];
        IERC20(stakeTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        totalAmountStake += _amount;

        update();

        account.lockedUntil = block.timestamp + lockPeriod;
        account.amountStake += _amount;
        account.missedReward += _amount * tokenPerStake;

        emit Stake(msg.sender, _amount);
    }

    /**
     * @notice With this function user can unstake some amount of token from contract.
     * @dev User claim rewards instantly in unstake
     * @param _amount Amount of tokens which user want to unstake.
     */
    function unstake(uint256 _amount) external {
        require(_amount > 0, "Not enough to unstake");
        Account storage account = accounts[msg.sender];
        require(account.amountStake >= _amount, "Too much to unstake");
        require(account.lockedUntil < block.timestamp, "The time to unlock has not yet come");

        update();

        IERC20(stakeTokenAddress).safeTransfer(msg.sender, _amount);
        IERC20(rewardTokenAddress).safeTransfer(msg.sender, _availableReward(msg.sender));

        account.amountStake -= _amount;

        account.missedReward = tokenPerStake * account.amountStake;

        totalAmountStake -= _amount;

        emit Unstake(msg.sender, _amount);
    }

    /**
     * @notice With this function user can claim his rewards.
     * @dev User get amount of tokens depends on time which he stake and amount of staked tokens
     */
    function claim() external {
        update();
        Account storage account = accounts[msg.sender];
        require(account.lockedUntil < block.timestamp, "The time to unlock has not yet come");

        uint256 amount = _availableReward(msg.sender);

        IERC20(rewardTokenAddress).safeTransfer(msg.sender, amount);

        account.missedReward += amount * precision;

        emit Claim(msg.sender, amount);
    }

    /**
     * @notice With this function we can lock stake function to lock new deposites
     * @param status - true - lock stake function, false - unlock stake function
     */
    function lockStake(bool status) external onlyOwner {
        stakingLocked = status;
        emit StakingLocked(msg.sender, status);
    }

    /** @notice Set parameters of staking by Owner.
     * @dev  emit `StakingRuleChфnged` event.
     * @param _rewardPerEpoch New amount reward tokens which will available in epoch.
     * @param _epochDuration New duration of epoch.
     * @param _rewardDistibutionPeriod Min amount of time for receive reward.
     */
    function setStakingRules(
        uint256 _rewardPerEpoch,
        uint256 _epochDuration,
        uint256 _rewardDistibutionPeriod
    ) external onlyOwner {
        require(_epochDuration >= _rewardDistibutionPeriod, "Incorrect parametres");
        update();

        epochDuration = _epochDuration;
        rewardPerEpoch = _rewardPerEpoch;
        rewardDistibutionPeriod = _rewardDistibutionPeriod;

        emit StakingRuleChanged(_epochDuration, _rewardPerEpoch, _rewardDistibutionPeriod);
    }

    /**
    * @notice With this function user can see information 
    about contract, including tokens addresses,
    amount of reward tokens, that will be paid to all of user in some epoch,
    duration of epoch and the minimum period of time for which the reward is received.
    * @return viewData - structure with information about contract.
    */
    function getViewData() external view returns (ViewData memory viewData) {
        viewData = (
            ViewData(
                stakeTokenAddress,
                rewardTokenAddress,
                rewardPerEpoch,
                epochDuration,
                rewardDistibutionPeriod,
                lockPeriod,
                totalAmountStake
            )
        );
    }

    /** 
    * @notice With this function user can see information 
    of user with certain address, including amount of staked tokens,
    missed rewards and timestamp in which stake unlocks.
    * @param _account is the address of some user.
    * @return account - structure with information about user.
    */
    function getAccount(address _account) external view returns (Account memory account) {
        account = (
            Account(accounts[_account].amountStake, accounts[_account].missedReward, accounts[_account].lockedUntil)
        );
    }

    /** 
    * @notice With this function user can see information 
    of user with certain address, including amount of staked tokens,
    missed rewards and how many reward tokens can be claimed.
    * @param _account is the address of some user.
    * @return userInfo - structure with information about user.
    */
    function getUserInfo(address _account) external view returns (UserInfo memory userInfo) {
        userInfo = UserInfo(
            accounts[_account].amountStake,
            accounts[_account].missedReward,
            accounts[_account].lockedUntil,
            _availableReward(_account)
        );
    }

    /**
     * @notice With this function user can see amount of tokens which address cant get after claim
     * @param _account is the address of some user.
     * @return amount - amount of tokens available for claim after unlock.
     */
    function availableReward(address _account) public view returns (uint256 amount) {
        amount = _availableReward(_account);
    }

    /**
    * @notice With this function contract can previously see how many reward tokens 
    can be claimed by user with certain address.
    * @param _account is the address of some user.
    * @return amount - An amount reward tokens that can be claimed.
    */
    function _availableReward(address _account) internal view returns (uint256 amount) {
        uint256 amountOfDurations = (block.timestamp - lastTimeTPSChanged) / rewardDistibutionPeriod;
        uint256 currentTokenPerStake = tokenPerStake +
            ((rewardPerEpoch * rewardDistibutionPeriod * precision) / (totalAmountStake * epochDuration)) *
            amountOfDurations;
        amount = (currentTokenPerStake * accounts[_account].amountStake - accounts[_account].missedReward) / precision;
    }

    /**
     * @notice This function update value of tokenPerStake.
     */
    function update() private {
        uint256 amountOfDurations = (block.timestamp - lastTimeTPSChanged) / rewardDistibutionPeriod;
        lastTimeTPSChanged += rewardDistibutionPeriod * amountOfDurations;
        if (totalAmountStake > 0)
            tokenPerStake =
                tokenPerStake +
                ((rewardPerEpoch * rewardDistibutionPeriod * precision) / (totalAmountStake * epochDuration)) *
                amountOfDurations;
    }
}
