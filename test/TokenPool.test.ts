import { artifacts, ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "alchemy-sdk";
import Web3 from "web3";
import {
  TokenPoolFactory__factory,
  TokenPool__factory,
} from "../typechain-types";
import { parseEther } from "alchemy-sdk/dist/src/api/utils";
import { util } from "prettier";

const { provider } = waffle;
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

async function increaseBlockTimestamp(provider: MockProvider, time: number) {
  await provider.send("evm_increaseTime", [time]);
  await provider.send("evm_mine", []);
}

describe("TokenPool", async () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let team: SignerWithAddress;

  let TokenPool1: Contract;
  let TokenPool2: Contract;
  let PoolFactory: Contract;
  let UniswapRouter: Contract;

  let RewardToken: Contract;
  let USDT: Contract;
  let DAI: Contract;

  beforeEach(async () => {
    [owner, user1, user2, team] = await ethers.getSigners();

    RewardToken = await ethers.getContractAt(
      "IERC20",
      "0x514910771AF9Ca656af840dff83E8264EcF986CA"
    );

    USDT = await ethers.getContractAt(
      "IERC20",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    );

    DAI = await ethers.getContractAt(
      "IERC20",
      "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    );

    const UniswapRouterABI = require("./ABI/UniswapRouter.json");
    UniswapRouter = await ethers.getContractAt(
      UniswapRouterABI,
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    );

    const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

    const _poolFactory = await ethers.getContractFactory("TokenPoolFactory");
    PoolFactory = await _poolFactory.deploy(
      RewardToken.address,
      UniswapRouter.address,
      uniswapFactoryAddress
    );
    await PoolFactory.deployed();

    // console.log("poolFactory", PoolFactory.address);

    await PoolFactory.connect(owner).addPool(USDT.address);
    const pool1Address = await PoolFactory.getPoolAddress(0);
    TokenPool1 = await ethers.getContractAt("TokenPool", pool1Address);

    await PoolFactory.connect(owner).addPool(DAI.address);
    const pool2Address = await PoolFactory.getPoolAddress(1);
    TokenPool2 = await ethers.getContractAt("TokenPool", pool2Address);

    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    await UniswapRouter.connect(team).swapETHForExactTokens(
      10000,
      [WETH, RewardToken.address],
      team.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user1).swapETHForExactTokens(
      10000,
      [WETH, DAI.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      10000,
      [WETH, DAI.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );

    await UniswapRouter.connect(user1).swapETHForExactTokens(
      10000,
      [WETH, USDT.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      10000,
      [WETH, USDT.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
  });

  it("create pool successfully", async () => {
    const assetToken1 = await TokenPool1.assetToken();
    const assetToken2 = await TokenPool2.assetToken();
    expect(assetToken1).to.be.eq(USDT.address);
    expect(assetToken2).to.be.eq(DAI.address);
  });

  describe("deposit successfully", async () => {
    it("should not deposit if pool has no reward", async () => {
      await expect(
        TokenPool1.connect(user1).deposit(ethers.utils.parseEther("5"), 0)
      ).revertedWith("Cannot Deposit, Pool has no rewards");
    });

    it("users should deposit successfully", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        10000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      const user1USDTBalancePoolBefore = await TokenPool1.depositorBalance(
        user1.address
      );

      const poolUSDTBalanceBefore = await USDT.balanceOf(TokenPool1.address);

      await USDT.connect(user1).approve(TokenPool1.address, 300);
      await TokenPool1.connect(user1).deposit(300, false);

      const user1USDTBalancePoolAfter = await TokenPool1.depositorBalance(
        user1.address
      );
      const poolUSDTBalanceAfter = await USDT.balanceOf(TokenPool1.address);

      expect(poolUSDTBalanceAfter.sub(poolUSDTBalanceBefore)).to.be.eq(300);
      expect(
        user1USDTBalancePoolAfter.sub(user1USDTBalancePoolBefore)
      ).to.be.eq(300);

      expect(await TokenPool1.getDepositorAddress(0)).to.be.eq(user1.address);
    });
    it("user1 should deposit successfully with compound", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        10000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await USDT.connect(user1).approve(TokenPool1.address, 500);
      await TokenPool1.connect(user1).deposit(300, false);

      await increaseBlockTimestamp(provider, 86400 * 7);

      await TokenPool1.setRewardRole(team.address);
      await RewardToken.connect(team).approve(TokenPool1.address, 100);
      await TokenPool1.connect(team).setRewardPerWeek(100);

      await TokenPool1.connect(user1).deposit(200, true);
    });
  });

  describe("SetRewardPerWeek", async () => {
    it("should set Reward successfully", async () => {
      await TokenPool1.connect(PoolFactory.signer).setRewardRole(team.address);
      const poolRewardBalanceBefore = await RewardToken.balanceOf(
        TokenPool1.address
      );

      await RewardToken.connect(team).approve(TokenPool1.address, 100);

      await increaseBlockTimestamp(provider, 86400 * 7);
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;

      await TokenPool1.connect(team).setRewardPerWeek(100);

      const poolRewardBalanceAfter = await RewardToken.balanceOf(
        TokenPool1.address
      );

      expect(poolRewardBalanceAfter.sub(poolRewardBalanceBefore)).to.be.eq(100);

      expect(
        Number(await TokenPool1.lastRewardTime())
      ).to.be.greaterThanOrEqual(Number(currentTime));
    });
  });

  describe("withdraw", async () => {
    beforeEach(async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        10000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await UniswapRouter.connect(user1).swapETHForExactTokens(
        10000,
        [WETH, RewardToken.address],
        TokenPool2.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await TokenPool1.connect(PoolFactory.signer).setRewardRole(team.address);
      await TokenPool2.connect(PoolFactory.signer).setRewardRole(team.address);

      //User1, User2 deposit to USDT_Pool
      await USDT.connect(user1).approve(TokenPool1.address, 300);
      await TokenPool1.connect(user1).deposit(300, false);
      await USDT.connect(user2).approve(TokenPool1.address, 100);
      await TokenPool1.connect(user2).deposit(100, false);

      //User1, User2 deposit to DAI_Pool
      await DAI.connect(user1).approve(TokenPool2.address, 300);
      await TokenPool2.connect(user1).deposit(300, false);
      await DAI.connect(user2).approve(100);
      await TokenPool2.connect(user2).deposit(100, false);

      await increaseBlockTimestamp(provider, 86400 * 7);

      await RewardToken.connect(team).approve(TokenPool1.address, 100);
      await RewardToken.connect(team).approve(TokenPool2.address, 100);
      await TokenPool1.connect(team).setRewardPerWeek(100);

      await TokenPool2.connect(team).setRewardPerWeek(100);
    });

    it("user should not withdraw if no depositor", async () => {
      await expect(
        TokenPool1.connect(team).withdraw(ethers.utils.parseEther("5"))
      ).to.be.revertedWith("Invalid withdrawal amount");
    });

    it("user should not withdraw with invalid amount", async () => {
      await expect(
        TokenPool1.connect(user1).withdraw(ethers.utils.parseEther("500"))
      ).to.be.revertedWith("Invalid withdrawal amount");
    });

    it("user1 should withdraw successfully from USDT_Pool", async () => {
      const user1USDTBalanceBefore = await USDT.balanceOf(user1.address);
      const user1RewardBalanceBefore = await RewardToken.balanceOf(
        user1.address
      );

      await TokenPool1.connect(user1).withdraw(ethers.utils.parseEther("30"));

      const user1USDTBalanceAfter = await USDT.balanceOf(user1.address);
      const user1RewardBalanceAfter = await RewardToken.balanceOf(
        user1.address
      );

      expect(user1USDTBalanceAfter.sub(user1USDTBalanceBefore)).to.be.eq(300);

      expect(user1RewardBalanceAfter.sub(user1RewardBalanceBefore)).to.be.eq(
        75
      );
    });

    it("user2 should withdraw successfully from DAI_Pool", async () => {
      const user2DAIBalanceBefore = await DAI.balanceOf(user2.address);
      const user2RewardBalanceBefore = await RewardToken.balanceOf(
        user2.address
      );

      await TokenPool2.connect(user2).withdraw(ethers.utils.parseEther("10"));

      const user2DAIBalanceAfter = await DAI.balanceOf(user2.address);
      const user2RewardBalanceAfter = await RewardToken.balanceOf(
        user2.address
      );

      expect(user2DAIBalanceAfter.sub(user2DAIBalanceBefore)).to.be.eq(100);

      expect(user2RewardBalanceAfter.sub(user2RewardBalanceBefore)).to.be.eq(
        25
      );
    });
  });
});
