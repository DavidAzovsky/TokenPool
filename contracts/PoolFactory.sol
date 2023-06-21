//SPDX-License-Identifier:MIT
import "@openzeppelin/contracts/tokens/ERC20/IERC20.sol";
import "@openzepplin/contracts/access/Ownable.sol";
import "./TokenPool";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
pragma solidity ^0.8.9;

contract PoolFactory is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    address public rewardToken;

    EnumerableSet.AddressSet private poolList;
    EnumerableSet.AddressSet private assetList;

    function addPool(address _asset) {
        require(!assetList.contain(_asset), "Pool already exists");
        TokenPool newPool = new TokenPool(_asset, rewardToken);
        assetList.add(_asset);
        poolList.add(address(newPool));
    }
}
