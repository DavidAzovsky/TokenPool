//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./Oracle.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.9;

contract TokenPool is AccessControl, Ownable {
    // using EnumerableMap for EnumerableMap.UintToAddressMap;
    // using EnumerableMap for EnumerableMap.AddressToUintMap;
    using EnumerableSet for EnumerableSet.AddressSet;

    Oracle oracle;

    address public rewardToken;
    address public assetToken;
    address public uniswapRouter;

    uint256 public lastRewardTime;
    mapping(address => uint) public lastDepositTime;
    mapping(address => uint) public rewardBalance;

    EnumerableSet.AddressSet internal depositors;
    mapping(address => uint) public depositorBalance;

    bytes32 constant REWARD_ROLE = keccak256("REWARD_ROLE");

    event Deposit(
        address from,
        uint256 amount,
        bool compound,
        uint256 depositTime
    );
    event Withdrawal(
        address from,
        uint256 amount,
        uint256 rewardAmount,
        uint256 withdrawTime
    );

    constructor(
        address _assetToken,
        address _rewardToken,
        address _router,
        address _factory
    ) {
        rewardToken = _rewardToken;
        assetToken = _assetToken;
        uniswapRouter = _router;
        lastRewardTime = block.timestamp;
        oracle = new Oracle(_factory, _rewardToken, _assetToken);
        // _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice deposit determined token to the pool for rewards
    /// @dev deposit with decision to compound existing rewards  or not
    /// @param _amount the amount of asset token
    /// @param _compound the state to compound existing rewards or not
    function deposit(uint256 _amount, bool _compound) external {
        require(
            IERC20(rewardToken).balanceOf(address(this)) != 0,
            "Cannot Deposit, Pool has no rewards"
        );

        if (!depositors.contains(msg.sender)) depositors.add(msg.sender);
        if (_compound && rewardBalance[msg.sender] != 0) {
            //change token using uniswap and build uniswap oracle
            if (rewardToken != assetToken) {
                IERC20(rewardToken).approve(
                    uniswapRouter,
                    rewardBalance[msg.sender]
                );

                uint256 amountOut = oracle.consult(
                    rewardToken,
                    rewardBalance[msg.sender]
                );
                console.log("expected outAMount", amountOut);
                address[] memory path = new address[](2);
                path[0] = rewardToken;
                path[1] = assetToken;

                IERC20(rewardToken).approve(
                    uniswapRouter,
                    rewardBalance[msg.sender]
                );
                uint[] memory amounts = IUniswapV2Router01(uniswapRouter)
                    .swapExactTokensForTokens(
                        rewardBalance[msg.sender],
                        0,
                        path,
                        address(this),
                        block.timestamp + 600
                    );

                console.log("real out amout", amounts[1]);

                depositorBalance[msg.sender] += amounts[1];
            } else depositorBalance[msg.sender] += rewardBalance[msg.sender];
            rewardBalance[msg.sender] = 0;
            console.log("1");
        }
        lastDepositTime[msg.sender] = block.timestamp;
        depositorBalance[msg.sender] += _amount;

        IERC20(assetToken).transferFrom(msg.sender, address(this), _amount);

        //Emit Deposit event
        emit Deposit(msg.sender, _amount, _compound, block.timestamp);
    }

    /// @notice withdraw asset with rewards
    /// @dev depositors can withdraw asset with claimed rewards together
    /// @param _amount the amount of asset token to withdraw
    function withdraw(uint256 _amount) external {
        require(
            depositorBalance[msg.sender] >= _amount,
            "Invalid withdrawal amount"
        );

        uint256 reward = rewardBalance[msg.sender];
        rewardBalance[msg.sender] = 0;

        depositorBalance[msg.sender] -= _amount;

        IERC20(assetToken).transfer(msg.sender, _amount);
        IERC20(rewardToken).transfer(msg.sender, reward);

        //Emit withdraw event
        emit Withdrawal(msg.sender, _amount, reward, block.timestamp);
    }

    /// @notice team put reward to pool weekly
    /// @dev team put reward to pool so depositor can get reward from it as their share of portion
    /// @param _amount the mount of reward token deposited to pool by team
    function setRewardPerWeek(uint256 _amount) external onlyRole(REWARD_ROLE) {
        require(lastRewardTime + 7 days <= block.timestamp, "Invalid time");

        address[] memory validUsers;
        validUsers = new address[](depositors.length());
        uint256 validUsersLength;
        uint256 totalValidUserDeposit;

        for (uint i = 0; i < depositors.length(); i++) {
            if (lastDepositTime[depositors.at(i)] >= lastRewardTime) {
                validUsers[validUsersLength++] = depositors.at(i);
                totalValidUserDeposit += depositorBalance[depositors.at(i)];
            }
        }
        for (uint i = 0; i < validUsersLength; i++)
            rewardBalance[validUsers[i]] +=
                (depositorBalance[validUsers[i]] * _amount) /
                totalValidUserDeposit;

        lastRewardTime = block.timestamp;

        IERC20(rewardToken).transferFrom(msg.sender, address(this), _amount);
    }

    /// @notice set reward role to team
    /// @dev deployer gives team the role of put reward into pool
    /// @param _to the address of team member
    function setRewardRole(address _to) external {
        _grantRole(REWARD_ROLE, _to);
    }

    /// @notice get address of depositor
    /// @param index the index of depositorlist
    /// @return address of index
    function getDepositorAddress(uint index) external view returns (address) {
        return depositors.at(index);
    }
}
