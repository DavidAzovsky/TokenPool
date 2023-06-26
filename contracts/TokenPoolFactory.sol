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
    address public uniswapFactory;

    EnumerableSet.AddressSet private poolList;
    EnumerableSet.AddressSet private assetList;

    constructor(address _reward, address _router, address _factory) {
        rewardToken = _reward;
        uniswapRouter = _router;
        uniswapFactory = _factory;
    }

    /// @notice create token pool contract
    /// @dev token pool provides a service that people can deposit and withdraw with claimed reward
    /// @param _asset the address of asset token
    function addPool(address _asset) external onlyOwner {
        require(!assetList.contains(_asset), "Pool already exists");
        TokenPool newPool = new TokenPool(
            _asset,
            rewardToken,
            uniswapRouter,
            uniswapFactory
        );
        assetList.add(_asset);
        poolList.add(address(newPool));
    }

    /// @notice get the address of Pool from poolList with id
    /// @param _index of pool list
    /// @return address of pool contract
    function getPoolAddress(uint _index) external view returns (address) {
        return poolList.at(_index);
    }
}
