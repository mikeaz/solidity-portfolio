import { ethers } from "ethers"
// import IcoJSON from '../../artifacts/contracts/Ico.sol/Ico.json';
// import SpaceCoinJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json';
import SpaceCoinJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json'
import SpaceCoinICOJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoinICO.json'


const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()

const icoAddr = '0xbcc0bED95E3B3Dc05E76aD8c63f607F15a715498';
const icoContract = new ethers.Contract(icoAddr, SpaceCoinICOJSON.abi, provider);

const spaceCoinAddr = '0xC9f6019E2b92dD5eF430E9BA23932249666f439d';
const spaceCoinContract = new ethers.Contract(spaceCoinAddr, SpaceCoinJSON.abi, provider);

async function connectToMetamask() {
  try {
    console.log("Signed in as", await signer.getAddress())
  }
  catch(err) {
    console.log("Not signed in")
    await provider.send("eth_requestAccounts", [])
  }
}

ico_spc_whitelist.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  //const eth = ethers.utils.parseEther(form.eth.value)
  console.log("Whitelisting", form.address.value, "address")

  await connectToMetamask()

  //1) whitelist this address
  try {
    ico_spc_whitelist_err.innerText = "waiting for tx approval..."
    const txReceipt = await icoContract.connect(signer).addToWhitelist(form.address.value);
    ico_spc_whitelist_err.innerText = "confirming..."
    await txReceipt.wait()
    ico_spc_whitelist_err.innerText = "tx succeeded!"
  } catch (e) {
    ico_spc_whitelist_err.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    ico_spc_whitelist_err.innerText = e.error.message  
  }
  go()
})

ico_spc_unwhitelist.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  //const eth = ethers.utils.parseEther(form.eth.value)
  console.log("Un-Whitelisting", form.address.value, "address")

  await connectToMetamask()

  //1) un-whitelist this address
  try {
    ico_spc_unwhitelist_err.innerText = "waiting for tx approval..."
    const txReceipt = await icoContract.connect(signer).removeFromWhitelist(form.address.value);
    ico_spc_unwhitelist_err.innerText = "confirming..."
    await txReceipt.wait()
    ico_spc_unwhitelist_err.innerText = "tx succeeded!"
  } catch (e) {
    ico_spc_unwhitelist_err.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    ico_spc_unwhitelist_err.innerText = e.error.message  
  }
  go()
})

ico_spc_buy.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  const eth = ethers.utils.parseEther(form.eth.value)
  console.log("Buying", eth, "eth")

  await connectToMetamask()

  try {
    ico_spc_buy_err.innerText = "waiting for tx approval..."
    const txReceipt = await icoContract.connect(signer).invest({ value: eth});
    ico_spc_buy_err.innerText = "confirming..."
    await txReceipt.wait()
    ico_spc_buy_err.innerText = "tx succeeded!"
  } catch (e) {
    ico_spc_buy_err.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    ico_spc_buy_err.innerText = e.error.message
  }
  go()
})

advance_phase.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Advancing Phase")

  await connectToMetamask()

  try {
    const txReceipt = await icoContract.connect(signer).advancePhase();
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e.error.message)
    advance_phase_err.innerText = e.error.message
  }

  go()
})

pause.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Advancing Phase")

  await connectToMetamask()

  try {
    const txReceipt = await icoContract.connect(signer).pause(true);
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e.error.message)
    pause_err.innerText = e.error.message
  }

  go()
})

claim.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Advancing Phase")

  await connectToMetamask()

  try {
    const txReceipt = await icoContract.connect(signer).claimToken();
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e.error.message)
    claim_spc_err.innerText = e.error.message
  }

  go()
})

resume.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Advancing Phase")

  await connectToMetamask()

  try {
    const txReceipt = await icoContract.connect(signer).pause(false);
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e.error.message)
    resume_err.innerText = e.error.message
  }

  go()
})

go()

async function go() {
  await connectToMetamask()

  eth_address.innerText = (await signer.getAddress())
  eth_balance.innerText = (await provider.getBalance(await signer.getAddress()))/1e18;

  ico_spc_phase.innerText = await icoContract.currentPhase()
  ico_spc_pause.innerText = await icoContract.isPaused()


  //spc_left = maxIndividualContrib - totalClaimableContrib(signer.address)
  ico_spc_left.innerText = (ethers.utils.parseEther("30000") - await icoContract.totalPrivateContrib())*5/1e18

  ico_spc_purchased.innerText = await icoContract.totalPrivateContrib()*5/1e18

  account_whitelisted.innerText = await icoContract.whitelist(signer.getAddress())

  claimable_contrib.innerText = await icoContract.totalClaimableContrib(signer.getAddress())*5/1e18

  token_balance.innerText = await spaceCoinContract.balanceOf(signer.getAddress())/1e18

  owner_address.innerText = await icoContract.owner()

  token_owner_address.innerText = await spaceCoinContract.owner()

  treasury_address.innerText = await spaceCoinContract.treasury()

  transfer_tax.innerText = await spaceCoinContract.transferTaxOn()

}
