//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./Oracle.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.9;

contract TokenPool is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    Oracle oracle;
    address public owner;

    address public rewardToken;
    address public assetToken;
    address public uniswapRouter;

    uint256 public lastRewardTime;
    mapping(address => uint) public lastRewardPerToken;
    mapping(address => uint) public rewardBalance;

    uint256 public currentRewardPerToken;
    uint256 public rewardRateDecimals = 18;

    EnumerableSet.AddressSet internal depositors;
    mapping(address => uint) public depositorBalance;
    uint256 public totalDeposit;

    bytes32 constant REWARD_ROLE = keccak256("REWARD_ROLE");

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

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
        if (rewardToken != assetToken)
            oracle = new Oracle(_factory, _rewardToken, _assetToken);

        owner = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
    }

    modifier onlyWETH() {
        require(assetToken == WETH);
        _;
    }

    modifier notWETH() {
        require(assetToken != WETH);
        _;
    }

    /// @notice deposit ether to pool for WETH pool
    /// @dev deposit with decision to compound existing rewards  or not
    /// @param _compound the state to compound existing rewards or not
    function depositETH(bool _compound) external payable onlyWETH {
        _deposit(msg.value, _compound);
    }

    /// @notice deposit determined token to the pool for rewards
    /// @dev deposit with decision to compound existing rewards  or not
    /// @param _amount the amount of asset token
    /// @param _compound the state to compound existing rewards or not
    function depositToken(uint256 _amount, bool _compound) external notWETH {
        _deposit(_amount, _compound);
        IERC20(assetToken).transferFrom(msg.sender, address(this), _amount);
    }

    /// @notice withdraw asset with rewards
    /// @dev depositors can withdraw asset with claimed rewards together
    /// @param _amount the amount of asset token to withdraw
    function withdrawETH(uint256 _amount) external onlyWETH {
        _withdraw(_amount);
        payable(msg.sender).transfer(_amount);
    }

    /// @notice withdraw asset with rewards
    /// @dev depositors can withdraw asset with claimed rewards together
    /// @param _amount the amount of asset token to withdraw
    function withdrawToken(uint256 _amount) external notWETH {
        _withdraw(_amount);
        IERC20(assetToken).transfer(msg.sender, _amount);
    }

    /// @notice team put reward to pool weekly
    /// @dev team put reward to pool so depositor can get reward from it as their share of portion
    /// @param _amount the mount of reward token deposited to pool by team
    function setRewardPerWeek(uint256 _amount) external onlyRole(REWARD_ROLE) {
        require(lastRewardTime + 7 days <= block.timestamp, "Invalid time");
        if (totalDeposit != 0)
            currentRewardPerToken +=
                (_amount * (10 ** rewardRateDecimals)) /
                totalDeposit;
        lastRewardTime = block.timestamp;

        IERC20(rewardToken).transferFrom(msg.sender, address(this), _amount);
    }

    /// @notice set reward role to team
    /// @dev deployer gives team reward role that can put reward into pool
    /// @param _to the address of team member
    function setRewardRole(address _to) external {
        _setupRole(REWARD_ROLE, _to);
    }

    /// @notice get the address of depositor
    /// @param _index the index of depositorlist
    /// @return address of depositor
    function getDepositorAddress(uint _index) external view returns (address) {
        return depositors.at(_index);
    }

    /// @notice get the address of Uniswap Oracle contract
    /// @return address of Oracle
    function getOracleAddress() external view returns (address) {
        return address(oracle);
    }

    /// @notice internal function for depositToken, and depositETH
    /// @dev deposit with decision to compound existing rewards  or not
    /// @param _amount the amount of asset token
    /// @param _compound the state to compound existing rewards or not
    function _deposit(uint256 _amount, bool _compound) internal {
        require(
            IERC20(rewardToken).balanceOf(address(this)) != 0,
            "Cannot Deposit, Pool has no rewards"
        );

        if (!depositors.contains(msg.sender)) depositors.add(msg.sender);

        // update reward
        _updateReward(msg.sender);

        if (_compound && rewardBalance[msg.sender] != 0) {
            if (rewardToken != assetToken) _compoundReward();
            else {
                depositorBalance[msg.sender] += rewardBalance[msg.sender];
                totalDeposit += rewardBalance[msg.sender];
            }
            rewardBalance[msg.sender] = 0;
        }
        depositorBalance[msg.sender] += _amount;
        totalDeposit += _amount;
        //Emit Deposit event
        emit Deposit(msg.sender, _amount, _compound, block.timestamp);
    }

    /// @notice internal function for withdrawETH and withdrawToken
    /// @dev depositors can withdraw asset with claimed rewards together
    /// @param _amount the amount of asset token to withdraw
    function _withdraw(uint256 _amount) internal {
        require(
            depositorBalance[msg.sender] >= _amount,
            "Invalid withdrawal amount"
        );

        _updateReward(msg.sender);

        uint256 reward = rewardBalance[msg.sender];
        rewardBalance[msg.sender] = 0;

        depositorBalance[msg.sender] -= _amount;
        if (depositorBalance[msg.sender] == 0) {
            depositors.remove(msg.sender);
        }

        IERC20(rewardToken).transfer(msg.sender, reward);

        //Emit withdraw event
        emit Withdrawal(msg.sender, _amount, reward, block.timestamp);
    }

    function _compoundReward() internal {
        oracle.update();
        uint256 amountOut = oracle.consult(
            rewardToken,
            rewardBalance[msg.sender]
        );
        address[] memory path;
        if (address(address(assetToken)) == WETH || rewardToken == WETH) {
            path = new address[](2);
            path[0] = rewardToken;
            path[1] = assetToken;
        } else {
            path = new address[](3);
            path[0] = address(address(rewardToken));
            path[1] = WETH;
            path[2] = assetToken;
        }

        IERC20(rewardToken).approve(uniswapRouter, rewardBalance[msg.sender]);
        uint[] memory amounts;
        if (assetToken == WETH) {
            amounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForETH(
                rewardBalance[msg.sender],
                // amountOut,
                0,
                path,
                address(this),
                block.timestamp + 600
            );
        } else
            amounts = IUniswapV2Router02(uniswapRouter)
                .swapExactTokensForTokens(
                    rewardBalance[msg.sender],
                    amountOut,
                    path,
                    address(this),
                    block.timestamp + 600
                );
        depositorBalance[msg.sender] += amounts[amounts.length - 1];
        totalDeposit += amounts[amounts.length - 1];
    }

    /// @notice update rewardPerToken rate of user and claim rewards of their portion
    /// @param _to the address of depositor
    function _updateReward(address _to) internal {
        rewardBalance[_to] +=
            ((currentRewardPerToken - lastRewardPerToken[_to]) *
                depositorBalance[_to]) /
            (10 ** rewardRateDecimals);

        lastRewardPerToken[_to] = currentRewardPerToken;
    }
}
