import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "alchemy-sdk";

const { provider } = waffle;

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
  let TokenPool3: Contract;
  let PoolFactory: Contract;
  let UniswapRouter: Contract;

  let RewardToken: Contract;
  let UNIToken: Contract;
  let WETH: Contract;

  let Oracle1: Contract;
  let Oracle2: Contract;

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

    const DAI = await ethers.getContractAt(
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

    WETH = await ethers.getContractAt(
      "IERC20",
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    );

    await PoolFactory.connect(owner).addPool(WETH.address);
    const pool2Address = await PoolFactory.getPoolAddress(1);
    TokenPool2 = await ethers.getContractAt("TokenPool", pool2Address);

    await PoolFactory.connect(owner).addPool(RewardToken.address);
    const pool3Address = await PoolFactory.getPoolAddress(2);
    TokenPool3 = await ethers.getContractAt("TokenPool", pool3Address);

    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;

    await UniswapRouter.connect(team).swapETHForExactTokens(
      1000000,
      [WETH.address, RewardToken.address],
      team.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user1).swapETHForExactTokens(
      1000000,
      [WETH.address, DAI.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      1000000,
      [WETH.address, DAI.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );

    await UniswapRouter.connect(user1).swapETHForExactTokens(
      1000000,
      [WETH.address, UNIToken.address],
      user1.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );
    await UniswapRouter.connect(user2).swapETHForExactTokens(
      1000000,
      [WETH.address, UNIToken.address],
      user2.address,
      currentTime + 100000,
      { value: ethers.utils.parseEther("100") }
    );

    const oracle1Addr = await TokenPool1.getOracleAddress();
    Oracle1 = await ethers.getContractAt("Oracle", oracle1Addr);
    const oracle2Addr = await TokenPool2.getOracleAddress();
    Oracle2 = await ethers.getContractAt("Oracle", oracle2Addr);
  });

  it("create pool successfully", async () => {
    const assetToken1 = await TokenPool1.assetToken();
    const assetToken2 = await TokenPool2.assetToken();
    expect(assetToken1).to.be.eq(UNIToken.address);
    expect(assetToken2).to.be.eq(WETH.address);
  });

  it("should not create pool if not owner", async () => {
    await expect(PoolFactory.connect(user1).addPool(UNIToken.address)).to.be
      .reverted;
  });
  it("should not create pool if already exist", async () => {
    await expect(PoolFactory.addPool(UNIToken.address)).to.be.revertedWith(
      "Pool already exists"
    );
  });

  describe("deposit", async () => {
    it("should not deposit if pool has no reward", async () => {
      await expect(
        TokenPool2.connect(user2).depositETH(0, { value: 100 })
      ).revertedWith("Cannot Deposit, Pool has no rewards");
    });
    it("user1 should not depoist eth to asset pool", async () => {
      await expect(TokenPool1.connect(user1).depositETH(false, { value: 1000 }))
        .to.be.reverted;
    });
    it("user1 should not depoist asset to eth pool", async () => {
      await expect(TokenPool2.connect(user1).depositToken(1000, false)).to.be
        .reverted;
    });

    it("users should deposit successfully", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;

      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
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

      await TokenPool1.connect(user1).depositToken(300000, false);

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
    it("user1 should deposit successfully with compound to AssetPool", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await UNIToken.connect(user1).approve(TokenPool1.address, 1000000);
      await TokenPool1.connect(user1).depositToken(300000, false);

      await increaseBlockTimestamp(provider, 86400 * 7);
      await TokenPool1.setRewardRole(team.address);

      await RewardToken.connect(team).approve(
        TokenPool1.address,
        ethers.utils.parseEther("100")
      );
      await TokenPool1.connect(team).setRewardPerWeek(1000000);

      await increaseBlockTimestamp(provider, 86400);

      const expectAmount = await Oracle1.consult(RewardToken.address, 1000000);
      const user1UNIBalancePoolBefore = await TokenPool1.depositorBalance(
        user1.address
      );
      await increaseBlockTimestamp(provider, 86400);

      await TokenPool1.connect(user1).depositToken(200000, true);

      const user1UNIBalancePoolAfter = await TokenPool1.depositorBalance(
        user1.address
      );

      expect(
        Number(
          user1UNIBalancePoolAfter.sub(user1UNIBalancePoolBefore).sub(200000)
        )
      ).to.be.greaterThanOrEqual(Number(expectAmount));
    });
    it("users should depositToken successfully to the Reward token Pool", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        TokenPool3.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        user1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await RewardToken.connect(user1).approve(TokenPool3.address, 100000);
      await TokenPool3.connect(user1).depositToken(100000, false);

      await increaseBlockTimestamp(provider, 86400 * 7);

      await TokenPool3.setRewardRole(team.address);
      await RewardToken.connect(team).approve(TokenPool3.address, 100000);
      await TokenPool3.connect(team).setRewardPerWeek(100000);

      await RewardToken.connect(user1).approve(TokenPool3.address, 100000);
      await TokenPool3.connect(user1).depositToken(100000, true);

      const user1PoolBalance = await TokenPool3.depositorBalance(user1.address);
      await expect(user1PoolBalance).to.be.eq(300000);
    });

    it("user1 should deposit successfully with compound to ETHPool", async () => {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        TokenPool2.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await TokenPool2.connect(user1).depositETH(false, {
        value: ethers.utils.parseEther("300"),
      });

      await increaseBlockTimestamp(provider, 86400 * 7);
      await TokenPool2.setRewardRole(team.address);

      await RewardToken.connect(team).approve(
        TokenPool2.address,
        ethers.utils.parseEther("100")
      );
      await TokenPool2.connect(team).setRewardPerWeek(1000000);

      await increaseBlockTimestamp(provider, 86400);

      const expectAmount = await Oracle2.consult(RewardToken.address, 1000000);
      const user1UNIBalancePoolBefore = await TokenPool2.depositorBalance(
        user1.address
      );
      await increaseBlockTimestamp(provider, 86400);

      await expect(
        TokenPool2.connect(user1).depositETH(true, {
          value: ethers.utils.parseEther("200"),
        })
      ).to.be.reverted;
    });
  });
  describe("SetRewardPerWeek", async () => {
    it("should not put reward to pool if not team", async () => {
      await expect(TokenPool1.connect(user1).setRewardPerWeek(1000)).to.be
        .reverted;
    });
    it("should only put once per week", async () => {
      await TokenPool1.connect(PoolFactory.signer).setRewardRole(team.address);

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
      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        TokenPool1.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("1000") }
      );

      await UniswapRouter.connect(user1).swapETHForExactTokens(
        1000000,
        [WETH.address, RewardToken.address],
        TokenPool2.address,
        currentTime + 100000,
        { value: ethers.utils.parseEther("100") }
      );

      await TokenPool1.setRewardRole(team.address);
      await TokenPool2.setRewardRole(team.address);

      //User1, User2 deposit to UNI_Pool
      await UNIToken.connect(user1).approve(TokenPool1.address, 300000);
      await TokenPool1.connect(user1).depositToken(300000, false);
      await UNIToken.connect(user2).approve(TokenPool1.address, 100000);
      await TokenPool1.connect(user2).depositToken(100000, false);

      //User1, User2 deposit to ETH_Pool
      await TokenPool2.connect(user1).depositETH(true, {
        value: ethers.utils.parseEther("300"),
      });
      await TokenPool2.connect(user2).depositETH(true, {
        value: ethers.utils.parseEther("100"),
      });

      await increaseBlockTimestamp(provider, 86400 * 7);

      await RewardToken.connect(team).approve(TokenPool1.address, 100000);
      await RewardToken.connect(team).approve(TokenPool2.address, 100000);

      await TokenPool1.connect(team).setRewardPerWeek(100000);
      await TokenPool2.connect(team).setRewardPerWeek(100000);
    });

    it("user should not withdraw if no depositor", async () => {
      await expect(
        TokenPool1.connect(team).withdrawToken(ethers.utils.parseEther("5"))
      ).to.be.revertedWith("Invalid withdrawal amount");
    });

    it("user should not withdraw with invalid amount", async () => {
      await expect(
        TokenPool1.connect(user1).withdrawToken(ethers.utils.parseEther("500"))
      ).to.be.revertedWith("Invalid withdrawal amount");
    });
    it("user should not call withdrawETH from asset pool", async () => {
      await expect(TokenPool1.connect(user1).withdrawETH(100)).to.be.reverted;
    });
    it("user should not call withdrawToken from eth pool", async () => {
      await expect(TokenPool2.connect(user1).withdrawToken(100)).to.be.reverted;
    });
    it("user1 should withdraw asset successfully from UNI Pool", async () => {
      const user1UNIBalanceBefore = await UNIToken.balanceOf(user1.address);
      const user1RewardBalanceBefore = await RewardToken.balanceOf(
        user1.address
      );

      await TokenPool1.connect(user1).withdrawToken(200000);

      const user1UNIBalanceAfter = await UNIToken.balanceOf(user1.address);
      const user1RewardBalanceAfter = await RewardToken.balanceOf(
        user1.address
      );

      expect(user1UNIBalanceAfter.sub(user1UNIBalanceBefore)).to.be.eq(200000);

      expect(user1RewardBalanceAfter.sub(user1RewardBalanceBefore)).to.be.eq(
        75000
      );
    });

    it("user2 should withdraw ETH successfully from ETH Pool", async () => {
      const user2ETHBalanceBefore = await ethers.provider.getBalance(
        user2.address
      );
      const user2RewardBalanceBefore = await RewardToken.balanceOf(
        user2.address
      );

      const tx = await TokenPool2.connect(user2).withdrawETH(
        ethers.utils.parseEther("100")
      );
      const receipt = await tx.wait();
      const gasAmount = receipt.gasUsed.mul(tx.gasPrice);

      const user2ETHBalanceAfter = await ethers.provider.getBalance(
        user2.address
      );
      const user2RewardBalanceAfter = await RewardToken.balanceOf(
        user2.address
      );

      expect(
        user2ETHBalanceAfter.sub(user2ETHBalanceBefore).add(gasAmount)
      ).to.be.eq(ethers.utils.parseEther("100"));

      expect(user2RewardBalanceAfter.sub(user2RewardBalanceBefore)).to.be.eq(
        25000
      );
    });
    describe("oracle", async () => {
      it("should only update once a day", async () => {
        await Oracle1.update();
        await expect(Oracle1.update()).to.be.revertedWith(
          "Oracle: PERIOD_NOT_ELAPSED"
        );
      });
      it("should not consult with invalid token", async () => {
        await expect(Oracle1.consult(WETH.address, 1000)).to.be.revertedWith(
          "racle: INVALID_TOKEN"
        );
      });
      it("should get amount successfully", async () => {
        const amountOut = await Oracle1.consult(UNIToken.address, 10000);
        await expect(amountOut).to.be.eq(0);
      });
    });
  });
});
