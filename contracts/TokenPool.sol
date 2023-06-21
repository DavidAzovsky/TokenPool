//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/tokens/ERC20/IERC20.sol";
import "@openzepplin/contracts/access/AccessControl.sol";
import "@uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

pragma solidity ^0.8.9;

contract TokenPool is AccessControl {
    // using EnumerableMap for EnumerableMap.UintToAddressMap;
    // using EnumerableMap for EnumerableMap.AddressToUintMap;
    using EnumerableSet for EnumerableSet.AddressSet;


    address public rewardToken;
    address public assetToken;
    address public uniswapRouter;

    uint256 public lastRewardTime;
    mapping(address => uint) public lastDepositTime;
    mapping(address => uint) public rewardBalance;

    // uint256 public depositorCount
    EnumerableSet.AddressSet public depositors;
    mapping(address => uint) public depositBalance;

    bytes32 constant REWARD_ROLE = keccak256("REWARD_ROLE");

    event Deposit(
        address from,
        uint256 amount,
        bool compound,
        uint256 depositTime,
    );
    event Withdrawal(
        address from,
        uint256 amount,
        uint256 rewardAmount,
        uint256 withdrawTime
    );

    constructor(address _assetToken, address _rewardToken, address _router) {
        rewardToken = _rewardToken;
        assetToken = _assetToken;
        uniswapRouter = _router;
        lastRewardTime = block.timeStamp;

        _setRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice deposit determined token to the pool for rewards
    /// @dev deposit with decision to compound existing rewards  or not
    /// @param _amount the amount of asset token
    /// @param _compound the state to compound existing rewards or not
    /// @return Documents the return variables of a contract’s function state variable
    function deposit(uint256 _amount, bool _compound) external {
        require(
            IERC20(rewardToken).balanceOf(address(this)) != 0,
            "Cannot Deposit, Pool has no rewards"
        );

        if(!depositors.contains(msg.sender))
            depositors.add(msg.sender);
        if (_compound) {
            //change token using uniswap and build uniswap oracle
            if (rewardToken != assetToken) {
                IERC20(rewardToken).approve(
                    uniswapRouter,
                    rewardBalance[msg.sender]
                );

                address[] memory path = new address[](2);
                path[0] = rewardToken;
                path[1] = assetToken;

                IERC20(rewardToken).approve(
                    uniswapRouter,
                    rewardBalance[msg.sender]
                );
                uint[] memory amount = IUniswapRouter(uniswapRouter)
                    .swapExactTokensForTokens(
                        rewardBalance[msg.sender],
                        0,
                        path,
                        address(this),
                        block.timestamp
                    );

                depositorBalance[msg.sender] += amount[0];
            } else depositorBalance[msg.sender] += rewardBalance[msg.sender];
            rewardBalance[msg.sender] = 0;
        }
        lastDepositTime[msg.sender] = block.timestamp;
        depositorBalance[msg.sender] += _amount;

        IERC20(assetToken).transferFrom(msg.sender, address(this), _amount);

        //Emit Deposit event
        emit Deposit(msg.sender, _amount, _compound,block.timestamp);
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

        uint256 reward = rewardBalance[msg.sender];
        rewardBalance[msg.sender] = 0;

        depositorBalance[msg.sender] -= assetToken;

        IERC20(assetToken).transfer(msg.sender, _amount);
        IERC20(rewardToken).transfer(msg.sender, reward);

        //Emit withdraw event
        emit Withdrawal(msg.sender, _amount, reward, block.timestamp);
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param Documents a parameter just like in doxygen (must be followed by parameter name)
    /// @return Documents the return variables of a contract’s function state variable
    /// @inheritdoc	Copies all missing tags from the base function (must be followed by the contract name)
    function setRewardPerWeek(uint256 _amount) external onlyRole(REWARD_ROLE) {
        require(lastRewardTime + 7 days <= block.timestamp, "Invalid time");

        address[] storage validUsers;
        uint256 totalValidUsersDeposit;

        for (uint i = 0; i < depositors.length; i++) {
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

        IERC20(rewardToken).transferFrom(msg.sender, address(this), _amount);
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
