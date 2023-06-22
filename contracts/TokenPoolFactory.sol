//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenPool.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.9;

contract TokenPoolFactory is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    address public uniswapRouter;
    address public rewardToken;

    EnumerableSet.AddressSet private poolList;
    EnumerableSet.AddressSet private assetList;

    constructor(address _reward, address _router) {
        rewardToken = _reward;
        uniswapRouter = _router;
    }

    function addPool(address _asset) external onlyOwner {
        require(!assetList.contains(_asset), "Pool already exists");
        TokenPool newPool = new TokenPool(_asset, rewardToken, uniswapRouter);
        assetList.add(_asset);
        poolList.add(address(newPool));
    }

    function getPoolAddress(uint index) external view returns (address) {
        return poolList.at(index);
    }
}
