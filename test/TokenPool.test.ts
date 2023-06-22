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

    const rewardFactory = await ethers.getContractFactory("RewardToken");
    RewardToken = await rewardFactory.deploy(ethers.utils.parseEther("1000"));
    await RewardToken.deployed();

    const usdtFactory = await ethers.getContractFactory("USDT");
    USDT = await usdtFactory.deploy(ethers.utils.parseEther("1000"));
    await USDT.deployed();

    const daiFactory = await ethers.getContractFactory("DAI");
    DAI = await daiFactory.deploy(ethers.utils.parseEther("1000"));
    await DAI.deployed();

    const UniswapRouterABI = require("./ABI/UniswapRouter.json");
    UniswapRouter = await ethers.getContractAt(
      UniswapRouterABI,
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    );

    const _poolFactory = await ethers.getContractFactory("TokenPoolFactory");
    PoolFactory = await _poolFactory.deploy(
      RewardToken.address,
      UniswapRouter.address
    );
    await PoolFactory.deployed();

    await PoolFactory.connect(owner).addPool(USDT.address);
    const pool1Address = await PoolFactory.getPoolAddress(0);
    TokenPool1 = await ethers.getContractAt("TokenPool", pool1Address);

    await PoolFactory.connect(owner).addPool(DAI.address);
    const pool2Address = await PoolFactory.getPoolAddress(1);
    TokenPool2 = await ethers.getContractAt("TokenPool", pool2Address);

    await RewardToken.mint(team.address, ethers.utils.parseEther("100"));

    await DAI.mint(user1.address, ethers.utils.parseEther("100"));
    await DAI.mint(user2.address, ethers.utils.parseEther("100"));

    await USDT.mint(user1.address, ethers.utils.parseEther("100"));
    await USDT.mint(user2.address, ethers.utils.parseEther("100"));
  });

  it("create pool successfully", async () => {
    const assetToken1 = await TokenPool1.assetToken();
    const assetToken2 = await TokenPool2.assetToken();
    expect(assetToken1).to.be.eq(USDT.address);
    expect(assetToken2).to.be.eq(DAI.address);
  });

  describe("token pool", async () => {
    describe("deposit successfully", async () => {
      it("should not deposit if pool has no reward", async () => {
        await expect(
          TokenPool1.connect(user1).deposit(ethers.utils.parseEther("5"), 0)
        ).revertedWith("Cannot Deposit, Pool has no rewards");
      });

      it("users should deposit successfully", async () => {
        await RewardToken.mint(
          TokenPool1.address,
          ethers.utils.parseEther("100")
        );

        const user1USDTBalancePoolBefore = await TokenPool1.depositorBalance(
          user1.address
        );

        const poolUSDTBalanceBefore = await USDT.balanceOf(TokenPool1.address);

        await USDT.connect(user1).approve(
          TokenPool1.address,
          ethers.utils.parseEther("30")
        );
        await TokenPool1.connect(user1).deposit(
          ethers.utils.parseEther("30"),
          false
        );

        const user1USDTBalancePoolAfter = await TokenPool1.depositorBalance(
          user1.address
        );
        const poolUSDTBalanceAfter = await USDT.balanceOf(TokenPool1.address);

        expect(poolUSDTBalanceAfter.sub(poolUSDTBalanceBefore)).to.be.eq(
          ethers.utils.parseEther("30")
        );
        expect(
          user1USDTBalancePoolAfter.sub(user1USDTBalancePoolBefore)
        ).to.be.eq(ethers.utils.parseEther("30"));

        expect(await TokenPool1.getDepositorAddress(0)).to.be.eq(user1.address);
      });
    });

    describe("SetRewardPerWeek", async () => {
      it("should set Reward successfully", async () => {
        await TokenPool1.connect(PoolFactory.signer).setRewardRole(
          team.address
        );
        const poolRewardBalanceBefore = await RewardToken.balanceOf(
          TokenPool1.address
        );

        await RewardToken.connect(team).approve(
          TokenPool1.address,
          ethers.utils.parseEther("100")
        );

        await increaseBlockTimestamp(provider, 86400 * 7);
        const currentTime = (await ethers.provider.getBlock("latest"))
          .timestamp;

        await TokenPool1.connect(team).setRewardPerWeek(
          ethers.utils.parseEther("100")
        );

        const poolRewardBalanceAfter = await RewardToken.balanceOf(
          TokenPool1.address
        );

        expect(poolRewardBalanceAfter.sub(poolRewardBalanceBefore)).to.be.eq(
          ethers.utils.parseEther("100")
        );

        expect(
          Number(await TokenPool1.lastRewardTime())
        ).to.be.greaterThanOrEqual(Number(currentTime));
      });
    });

    describe("withdraw", async () => {
      beforeEach(async () => {
        await RewardToken.mint(
          TokenPool1.address,
          ethers.utils.parseEther("100")
        );
        await RewardToken.mint(
          TokenPool2.address,
          ethers.utils.parseEther("100")
        );

        await TokenPool1.connect(PoolFactory.signer).setRewardRole(
          team.address
        );
        await TokenPool2.connect(PoolFactory.signer).setRewardRole(
          team.address
        );

        await USDT.connect(user1).approve(
          TokenPool1.address,
          ethers.utils.parseEther("30")
        );
        await TokenPool1.connect(user1).deposit(
          ethers.utils.parseEther("30"),
          false
        );
        await USDT.connect(user2).approve(
          TokenPool1.address,
          ethers.utils.parseEther("10")
        );
        await TokenPool1.connect(user2).deposit(
          ethers.utils.parseEther("10"),
          false
        );
      });
    });
  });
});
