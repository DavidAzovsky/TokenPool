//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/tokens/ERC20/IERC20.sol";
import "@openzepplin/contracts/access/AccessControl.sol";

pragma solidity ^0.8.9;

contract TokenPool is AccessControl {
    address public rewardToken;
    address public assetToken;

    uint256 public lastRewardTime;
    mapping(address => uint256) public lastDepositTime;
    mapping(address => uint256) public rewardBalance;

    uint256 public depositorCount;
    mapping(uint256 => adddress) public depositors;
    mapping(address => uint256) public depositBalance;

    bytes32 constant REWARD_ROLE = keccak256("REWARD_ROLE");

    // event Deposit(address from, uint256 amount, uint256 depositTime)

    constructor(address _assetToken, address _rewardToken) {
        rewardToken = _rewardToken;
        assetToken = _assetToken;
        lastRewardTime = block.timeStamp;
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param Documents a parameter just like in doxygen (must be followed by parameter name)
    /// @return Documents the return variables of a contract’s function state variable
    /// @inheritdoc	Copies all missing tags from the base function (must be followed by the contract name)
    function deposit(uint256 _amount, bool _compound) external {
        require(
            IERC20(rewardToken).balanceOf(address(this)) != 0,
            "Cannot Deposit, Pool has no rewards"
        );
        if (_compound) {
            //change token using uniswap and build uniswap oracle
        }
        lastDepositTime[msg.sender] = block.timestamp;

        IERC20(assetToken).transferFrom(msg.sender, address(this), _amount);

        //Emit Deposit event
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param Documents a parameter just like in doxygen (must be followed by parameter name)
    /// @return Documents the return variables of a contract’s function state variable
    /// @inheritdoc	Copies all missing tags from the base function (must be followed by the contract name)
    function withdraw(uint256 _amount) external {
        require(
            depositBalance[msg.sender] >= _amount,
            "Invalid withdrawal amount"
        );

        IERC20(assetToken).transfer(msg.sender, _amount);
        IERC20(rewardToken).transfer(msg.sender, rewardBalance[msg.sender]);

        //Emit withdraw event
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param Documents a parameter just like in doxygen (must be followed by parameter name)
    /// @return Documents the return variables of a contract’s function state variable
    /// @inheritdoc	Copies all missing tags from the base function (must be followed by the contract name)
    function claimReward(uint256 _amount) external onlyRole(REWARD_ROLE) {
        require(lastRewardTime + 7 days <= block.timestamp, "Invalid time");
        require(_amount > 0, "Invalid Reward amount");

        address[] storage validUsers;
        uint256 totalValidUsersDeposit;
        for (uint i = 0; i < depositorCount; i++) {
            if (lastDepositTime[depositors[i]] > lastRewardTime) {
                validUsers.push(i);
                totalValidUserDeposit += depositBalance[depositors[i]];
            }
        }
        for (uint i = 0; i < validUsers.length; i++)
            rewardBalance[validUsers[i]] +=
                (depositBalance[validUsers[i]] * _amount) /
                totalValidUserDeposit;

        lastRewardTime = block.timestamp;
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param Documents a parameter just like in doxygen (must be followed by parameter name)
    /// @return Documents the return variables of a contract’s function state variable
    /// @inheritdoc	Copies all missing tags from the base function (must be followed by the contract name)
    function setRewardRole(addresss to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRole(REWARD_ROLE, to);
    }
}
