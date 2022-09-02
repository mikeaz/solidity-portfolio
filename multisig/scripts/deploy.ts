import { ethers } from "hardhat";
import { Logic } from "../typechain-types";

async function main() {

  //TO DEPLOY: Proxy.sol, a Logic.sol, and a LogicImproved.sol

  const [owner] = await ethers.getSigners();
  console.log("Owner address: %s", owner.address);
  //Owner address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

  const Logic = await ethers.getContractFactory("Logic");
  const logic = await Logic.deploy();
  await logic.deployed();
  console.log("Logic deployed to:", logic.address);
  //Logic deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

  /*
  const logicOwner = await logic.owner();
  console.log ("logicOwner: %s", logicOwner);
  //logicOwner: 0x0000000000000000000000000000000000000000
  */
 
  /*
  logic.initialize("12345");
  const logicOwner2 = await logic.owner();
  console.log ("logicOwner: %s", logicOwner2);
  */

  //You must deploy these last 3 contracts 
  //(Proxiable.sol is inherited by the logic contracts) 
  //such that Proxy will delegate all function calls to Logic. 
  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.deploy(logic.address);
  await proxy.deployed();
  console.log("Proxy deployed to:", proxy.address);

  //LogicImproved must also be deployed, 
  //because this will be the contract you upgrade Proxy to, using your Gnosis Safe Wallet.
  const LogicImproved = await ethers.getContractFactory("LogicImproved");
  const logicImproved = await LogicImproved.deploy();
  await logicImproved.deployed();
  console.log("LogicImproved deployed to:", logicImproved.address);

  //In addition, you must set your Proxy contract's owner to 
  //be the recently-deployed Gnosis multisig contract's address.

  //My safe: https://gnosis-safe.io/app/rin:0xfB85A54a134C9c23A5363afD15F2913E616D762E/home

  //The Logic.sol and LogicImproved.sol both inherit from OwnableUpgradeable, 
  //so if you setup your Proxy to use either of those contract as the logic contract, 
  //you'll get ownership functionality.

  //When you deploy the Proxy.sol and pass the Logic.sol's address as the sole argument 
  //to the Proxy's constructor, it means that any calls to the Proxy will be forwarded 
  //to and handled by the Logic.sol.

  //In your script you'll need to call transferOwnership on the Proxy, which will 
  //under-the-hood forward it to the logic contract (where transferOwnership is actually implemented)

  const gnosisAddr = "0xfB85A54a134C9c23A5363afD15F2913E616D762E"
  console.log("Multisig: %s", gnosisAddr);

  //https://ethereum.stackexchange.com/questions/96437/how-can-i-use-a-proxy-contract-with-ethers-js
  const myLogic = Logic.attach(proxy.address) as Logic;

  const txReceipt = await myLogic.initialize("12345");
  await txReceipt.wait();

  const proxyOwner1 = await myLogic.owner();
  console.log("ProxyOwner1: %s", proxyOwner1);

  await myLogic.connect(owner).transferOwnership(gnosisAddr);

  const proxyOwner2 = await myLogic.owner();
  console.log("ProxyOwner2: %s", proxyOwner2);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
