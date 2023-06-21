//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/tokens/ERC20/IERC20.sol";
import "@openzepplin/contracts/access/AccessControl.sol";

pragma solidity ^0.8.9;

contract TokenPool is AccessControl {
    address public rewardToken;
    address public assetToken;

    uint256 public lastRewardTime;
    mapping(address => uint256) public lastDepoistTime;
    mapping(address => uint256) public rewardBalance;

    uint256 public depositorCount;
    mapping(uint256 => adddress) public depositors;

    bytes32 constant REWARD_ROLE = keccak256("REWARD_ROLE");

    // event Deposit(address from, uint256 amount, uint256 depositTime)

    constructor(address _assetToken, address _rewardToken) {
        rewardToken = _rewardToken;
        assetToken = _assetToken;
        lastRewardTime = block.timeStamp;
    }

    function deposit(uint256 _amount, bool _compound) external {
        IERC20(assetToken).transferFrom(msg.sender, address(this), _amount);

        if (_compound) {
            //change token using uniswap and build uniswap oracle
        }
        lastDepoistTime[msg.sender] = block.timestamp;

        //Emit Deposit event
    }

    function withdraw(uint256 _amount) external {
        IERC20(assetToken).transfer(msg.sender, _amount);
        IERC20(rewardToken).transfer(msg.sender, rewardBalance[msg.sender]);

        //Emit withdraw event
    }

    function claimReward(
        uint256 _amount
    ) external hasRole(REWARD_ROLE, msg.sender) {}

    function setRewardRole(addresss to) external onlyOwner {
        _setRole(REWARD_ROLE, to);
    }
}
