import { ethers } from "hardhat";

async function main() {

  const DAO = await ethers.getContractFactory("CollectorDAO");
  const dao = await DAO.deploy();
  await dao.deployed();

  console.log("DAO deployed to:", dao.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
