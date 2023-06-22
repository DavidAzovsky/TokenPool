import { artifacts, ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "alchemy-sdk";
import Web3 from "web3";

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
  let UNIToken: Contract;
  let DAI: Contract;

  beforeEach(async () => {
    [owner, user1, user2, team] = await ethers.getSigners();

    RewardToken = await ethers.getContractAt(
      "IERC20",
      "0x514910771AF9Ca656af840dff83E8264EcF986CA"
    );

    UNIToken = await ethers.getContractAt(
      "IERC20",
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
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

    await PoolFactory.connect(owner).addPool(UNIToken.address);
    const pool1Address = await PoolFactory.getPoolAddress(0);
    TokenPool1 = await ethers.getContractAt("TokenPool", pool1Address);

    await PoolFactory.connect(owner).addPool(DAI.address);
    const pool2Address = await PoolFactory.getPoolAddress(1);
    TokenPool2 = await ethers.getContractAt("TokenPool", pool2Address);

    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    await UniswapRouter.connect(team).swapETHForExactTokens(
      1000000,
      [WETH, RewardToken.address],
      team.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user1).swapETHForExactTokens(
      1000000,
      [WETH, DAI.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      1000000,
      [WETH, DAI.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );

    await UniswapRouter.connect(user1).swapETHForExactTokens(
      1000000,
      [WETH, UNIToken.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      1000000,
      [WETH, UNIToken.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
  });

  it("create pool successfully", async () => {
    const assetToken1 = await TokenPool1.assetToken();
    const assetToken2 = await TokenPool2.assetToken();
    expect(assetToken1).to.be.eq(UNIToken.address);
    expect(assetToken2).to.be.eq(DAI.address);
  });

  describe("deposit successfully", async () => {
    it("should not deposit if pool has no reward", async () => {
      await expect(
        TokenPool2.connect(user2).deposit(ethers.utils.parseEther("5"), 0)
      ).revertedWith("Cannot Deposit, Pool has no rewards");
    });

    it("users should deposit successfully", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("1000") }
      );

      const user1UNIBalancePoolBefore = await TokenPool1.depositorBalance(
        user1.address
      );

      const poolUNIBalanceBefore = await UNIToken.balanceOf(TokenPool1.address);

      await UNIToken.connect(user1).approve(
        TokenPool1.address,
        ethers.utils.parseEther("30")
      );

      await TokenPool1.connect(user1).deposit(300000, false);

      const user1UNIBalancePoolAfter = await TokenPool1.depositorBalance(
        user1.address
      );
      const poolUNIBalanceAfter = await UNIToken.balanceOf(TokenPool1.address);

      expect(poolUNIBalanceAfter.sub(poolUNIBalanceBefore)).to.be.eq(300000);
      expect(user1UNIBalancePoolAfter.sub(user1UNIBalancePoolBefore)).to.be.eq(
        300000
      );

      expect(await TokenPool1.getDepositorAddress(0)).to.be.eq(user1.address);
    });
    it("user1 should deposit successfully with compound", async () => {
      const oracleAddr = await TokenPool1.getOracleAddress();
      const Oracle = await ethers.getContractAt("Oracle", oracleAddr);
      await Oracle.update();
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await UNIToken.connect(user1).approve(TokenPool1.address, 1000000);
      await TokenPool1.connect(user1).deposit(300000, false);

      await increaseBlockTimestamp(provider, 86400 * 7);

      await TokenPool1.setRewardRole(team.address);
      await RewardToken.connect(team).approve(
        TokenPool1.address,
        ethers.utils.parseEther("100")
      );
      await TokenPool1.connect(team).setRewardPerWeek(1000000);

      await Oracle.update();

      await increaseBlockTimestamp(provider, 86400);

      const expectAmount = await Oracle.consult(RewardToken.address, 1000000);
      const user1UNIBalancePoolBefore = await TokenPool1.depositorBalance(
        user1.address
      );

      await TokenPool1.connect(user1).deposit(200000, true);

      const user1UNIBalancePoolAfter = await TokenPool1.depositorBalance(
        user1.address
      );

      expect(
        Number(
          user1UNIBalancePoolAfter.sub(user1UNIBalancePoolBefore).sub(200000)
        )
      ).to.be.greaterThanOrEqual(Number(expectAmount));
    });
  });

  describe("SetRewardPerWeek", async () => {
    it("should not put reward to pool if not team", async () => {
      await expect(TokenPool1.connect(user1).setRewardPerWeek(1000)).to.be
        .reverted;
    });
    it("should only put once per week", async () => {
      await expect(
        TokenPool1.connect(team).setRewardPerWeek(1000)
      ).to.be.revertedWith("Invalid time");
    });
    it("should set Reward successfully", async () => {
      await TokenPool1.connect(PoolFactory.signer).setRewardRole(team.address);
      const poolRewardBalanceBefore = await RewardToken.balanceOf(
        TokenPool1.address
      );

      await RewardToken.connect(team).approve(
        TokenPool1.address,
        ethers.utils.parseEther("100")
      );

      await increaseBlockTimestamp(provider, 86400 * 7);
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;

      await TokenPool1.connect(team).setRewardPerWeek(1000000);

      const poolRewardBalanceAfter = await RewardToken.balanceOf(
        TokenPool1.address
      );

      expect(poolRewardBalanceAfter.sub(poolRewardBalanceBefore)).to.be.eq(
        1000000
      );

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
        1000000,
        [WETH, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("1000") }
      );

      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH, RewardToken.address],
        TokenPool2.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await TokenPool1.setRewardRole(team.address);
      await TokenPool2.setRewardRole(team.address);

      //User1, User2 deposit to UNI_Pool
      await UNIToken.connect(user1).approve(TokenPool1.address, 300000);
      await TokenPool1.connect(user1).deposit(300000, false);
      await UNIToken.connect(user2).approve(TokenPool1.address, 100000);
      await TokenPool1.connect(user2).deposit(100000, false);

      //User1, User2 deposit to DAI_Pool
      await DAI.connect(user1).approve(TokenPool2.address, 300000);
      await TokenPool2.connect(user1).deposit(300000, false);
      await DAI.connect(user2).approve(TokenPool2.address, 100000);
      await TokenPool2.connect(user2).deposit(100000, false);

      await increaseBlockTimestamp(provider, 86400 * 7);

      await RewardToken.connect(team).approve(TokenPool1.address, 100000);
      await RewardToken.connect(team).approve(TokenPool2.address, 100000);

      await TokenPool1.connect(team).setRewardPerWeek(100000);
      await TokenPool2.connect(team).setRewardPerWeek(100000);
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

    it("user1 should withdraw successfully from UNI Pool", async () => {
      const user1UNIBalanceBefore = await UNIToken.balanceOf(user1.address);
      const user1RewardBalanceBefore = await RewardToken.balanceOf(
        user1.address
      );

      await TokenPool1.connect(user1).withdraw(300000);

      const user1UNIBalanceAfter = await UNIToken.balanceOf(user1.address);
      const user1RewardBalanceAfter = await RewardToken.balanceOf(
        user1.address
      );

      expect(user1UNIBalanceAfter.sub(user1UNIBalanceBefore)).to.be.eq(300000);

      expect(user1RewardBalanceAfter.sub(user1RewardBalanceBefore)).to.be.eq(
        75000
      );
    });

    it("user2 should withdraw successfully from DAI Pool", async () => {
      const user2DAIBalanceBefore = await DAI.balanceOf(user2.address);
      const user2RewardBalanceBefore = await RewardToken.balanceOf(
        user2.address
      );

      await TokenPool2.connect(user2).withdraw(100000);

      const user2DAIBalanceAfter = await DAI.balanceOf(user2.address);
      const user2RewardBalanceAfter = await RewardToken.balanceOf(
        user2.address
      );

      expect(user2DAIBalanceAfter.sub(user2DAIBalanceBefore)).to.be.eq(100000);

      expect(user2RewardBalanceAfter.sub(user2RewardBalanceBefore)).to.be.eq(
        25000
      );
    });
  });
});
