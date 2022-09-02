import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Deploying contracts with the owner account:", owner.address);

  console.log("Deploying contracts with the treasury account:", owner.address);


  console.log("Account balance:", (await owner.getBalance()).toString());

  const ICO = await ethers.getContractFactory("SpaceCoinICO");
  const ico = await ICO.deploy(owner.address);
  await ico.deployed();
  const tokenAddress = await ico.tokenAddress();
  const spcToken = await ethers.getContractAt("SpaceCoin", tokenAddress);  

  console.log("ICO address:", ico.address);
  console.log("Token address:", tokenAddress);

  const LP = await ethers.getContractFactory("SpaceCoinLP");
  const lp = await LP.deploy(spcToken.address);
  await lp.deployed();

  console.log("LP Address: %s", lp.address);

  const Router = await ethers.getContractFactory("SpaceRouter");
  const router = await Router.deploy(spcToken.address, lp.address);
  await router.deployed();

  console.log("Router Address: %s", router.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });