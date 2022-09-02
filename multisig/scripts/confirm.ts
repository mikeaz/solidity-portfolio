import { ethers } from "hardhat";
import { experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";
import { Logic, LogicImproved, Proxy } from "../typechain-types";

async function main() {

  //TO DEPLOY: Proxy.sol, a Logic.sol, and a LogicImproved.sol

  const [owner] = await ethers.getSigners();
  console.log("Owner address: %s", owner.address);
  //Owner address: 0xf969261b7986Ae1EaB0C0A0cb2d561bA9479FAe6


  const gnosisAddr = "0xfB85A54a134C9c23A5363afD15F2913E616D762E"
  console.log("Multisig: %s", gnosisAddr);

  const Logic = await ethers.getContractFactory("Logic");

  //https://ethereum.stackexchange.com/questions/96437/how-can-i-use-a-proxy-contract-with-ethers-js
  const myLogic = Logic.attach("0x0d494EEB91375D7418730E5BD452587224D3A5F0") as Logic;

  const proxyOwner = await myLogic.owner();
  console.log("ProxyOwner: %s", proxyOwner);
  const logicAddress = await myLogic.getLogicAddress() 
  console.log("Proxy logic address: %s", logicAddress);

  const LogicImproved = await ethers.getContractFactory("LogicImproved");
  const myLogicImproved = LogicImproved.attach("0x0d494EEB91375D7418730E5BD452587224D3A5F0") as LogicImproved;
  const logicImprovedAddress = await myLogicImproved.getLogicAddress();
  console.log("ProxyImproved logic address: %s", logicImprovedAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
