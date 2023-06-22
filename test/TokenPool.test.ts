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

  let TokenPool1: Contract;
  let TokenPool2: Contract;
  let PoolFactory: Contract;
  let UniswapRouter: Contract;

  let RewardToken: Contract;
  let USDT: Contract;
  let DAI: Contract;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

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

    await PoolFactory.addPool(USDT.address);
    const pool1Address = await PoolFactory.getPoolAddress(0);
    TokenPool1 = await ethers.getContractAt("TokenPool", pool1Address);

    await PoolFactory.addPool(DAI.address);
    const pool2Address = await PoolFactory.getPoolAddress(1);
    TokenPool2 = await ethers.getContractAt("TokenPool", pool2Address);
  });

  it("create pool successfully", async () => {
    const assetToken1 = await TokenPool1.assetToken();
    const assetToken2 = await TokenPool2.assetToken();
    expect(assetToken1).to.be.eq(USDT.address);
    expect(assetToken2).to.be.eq(DAI.address);
  });
});
