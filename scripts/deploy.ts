import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const RewardTokenFactory = await ethers.getContractFactory("RewardToken");
  const RewardToken = await RewardTokenFactory.deploy(
    ethers.utils.parseEther("10000")
  );
  await RewardToken.deployed();
  console.log("RewardToken address", RewardToken.address);

  // deploy to sepolia testnet
  const TokenPoolFactory = await ethers.getContractFactory("TokenPoolFactory");
  const PoolFactory = await TokenPoolFactory.deploy(
    RewardToken.address,
    "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
    "0x7E0987E5b3a30e3f2828572Bb659A548460a3003"
  );
  await PoolFactory.deployed();

  console.log("TokenPoolFactory address:", await PoolFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
