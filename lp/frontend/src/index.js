import { ethers } from "ethers"

import SpaceCoinJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json'
import SpaceCoinICOJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoinICO.json'


import SpaceCoinLPJSON from '../../artifacts/contracts/LP.sol/SpaceCoinLP.json'
import SpaceRouterJSON from '../../artifacts/contracts/LP.sol/SpaceRouter.json'


const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()

const icoAddr = '0x9a88caAbF39434AF276fc473d04cEB3cf401F914';
const icoContract = new ethers.Contract(icoAddr, SpaceCoinICOJSON.abi, provider);

const spaceCoinAddr = '0x76Bf96BcCd86721E035D15601A2958d22790F033';
const spaceCoinContract = new ethers.Contract(spaceCoinAddr, SpaceCoinJSON.abi, provider);

const lpAddr = '0x2dE125327482e8A64078995a0d66D53470f34F9F';
const lpContract = new ethers.Contract(lpAddr, SpaceCoinLPJSON.abi, provider);

const routerAddr = '0xb459cC344C546B3007468F1c6d120533Cd5CB9a6';
const routerContract = new ethers.Contract(routerAddr, SpaceRouterJSON.abi, provider);


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

  //Pool stats
  lp_spc_bal.innerText = await lpContract.spcTotal()/1e18;
  lp_eth_bal.innerText = await lpContract.ethTotal()/1e18;
  lp_total_supply.innerText = await lpContract.totalSupply()/1e18;
  console.log(lp_total_supply.innerText)
  if (lp_total_supply.innerText != 0) {
    lp_spot_price.innerText = await lpContract.idealQuote(ethers.utils.parseEther("1"), true)/1e18;
  }
  lp_user_bal.innerText = await lpContract.balanceOf(signer.getAddress())/1e18;

  var amt_eth
  var slippage
  var min_spc_out_val
}

spc_allow.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Allow router to spend SPC")
  await connectToMetamask()
  try {
    const txReceipt = await spaceCoinContract.connect(signer).approve(routerAddr, ethers.utils.parseEther("1000000000"));
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e)
    spc_allow_msg.innerText = e.error.message
  }
  go()
})

lp_allow.addEventListener('submit', async e => {
  e.preventDefault()
  console.log("Allow router to spend SPC-ETH LP")
  await connectToMetamask()
  try {
    const txReceipt = await lpContract.connect(signer).approve(routerAddr, ethers.utils.parseEther("1000000000"));
    await txReceipt.wait()
  } catch (e) {
    const errorDescription = e
    console.log(e)
    lp_allow_msg.innerText = e.error.message
  }
  go()
})

router_add_liq.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  const amt_eth = ethers.utils.parseEther(form.add_amt_eth.value)
  const amt_spc = ethers.utils.parseEther(form.add_amt_spc.value)
  const eth_min = ethers.utils.parseEther(form.add_eth_min.value)
  const spc_min = ethers.utils.parseEther(form.add_spc_min.value)

  console.log("Adding liquidity:", amt_eth, "eth,", "amt_spc", amt_spc)
  console.log("Liquidity mins:", eth_min, "eth,", "amt_spc_min", spc_min)

  await connectToMetamask()

  try {
    router_add_liq_msg.innerText = "waiting for tx approval..."
    //    function addLiquidity(uint256 amountSpcIn, uint256 amountSpcMin, uint256 amountEthMin) external payable {
    //      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"), ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
    const txReceipt = await routerContract.connect(signer).addLiquidity(amt_spc, spc_min, eth_min, {value: amt_eth});
    //const txReceipt = await routerContract.connect(signer).addLiquidity(ethers.utils.parseEther("1"), ethers.utils.parseEther("0"), ethers.utils.parseEther("0"), {value: ethers.utils.parseEther("0.2")});
    router_add_liq_msg.innerText = "confirming..."
    await txReceipt.wait()
    router_add_liq_msg.innerText = "tx succeeded!"
  } catch (e) {
    router_add_liq_msg.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    router_add_liq_msg.innerText = e.error.message
  }
  go()
})

router_remove_liq.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  const lp_to_burn = ethers.utils.parseEther(form.lp_to_burn.value)

  console.log("Removing liquidity:", lp_to_burn, "LP tokens,", lp_to_burn)

  await connectToMetamask()

  try {
    router_remove_liq_msg.innerText = "waiting for tx approval..."
    const txReceipt = await routerContract.connect(signer).removeLiquidity(lp_to_burn);
    router_remove_liq_msg.innerText = "confirming..."
    await txReceipt.wait()
    router_remove_liq_msg.innerText = "tx succeeded!"
  } catch (e) {
    router_remove_liq_msg.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    router_remove_liq_msg.innerText = e.error.message
  }
  go()
})

quote_eth.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  amt_eth = ethers.utils.parseEther(form.amt_eth.value)
  slippage = form.swap_slippage_eth.value

  console.log("Eth in:", amt_eth, ", Slippage %:", slippage)
 
  await connectToMetamask()

  const priceQuote = await lpContract.quoteEthForToken(amt_eth)
  amt_spc_out.innerText = priceQuote/1e18
  const idealQuote = await lpContract.idealQuote(amt_eth, false)/1e18
  const priceImpact = ((priceQuote/1e18 / idealQuote) - 1) * 100
  swap_eth_impact.innerText = priceImpact
  //min_spc_out_val = priceQuote*(100-slippage)/100
  //min_spc_out_val = priceQuote.mul(100-slippage).div(100)
  //let's add support for decimals..
  min_spc_out_val = priceQuote.mul(10000-Math.floor(slippage*100)).div(10000)
  min_spc_out.innerText = min_spc_out_val/1e18


  try {
    swap_eth_msg.innerText = "waiting for tx approval..."
    const txReceipt = await routerContract.connect(signer).swapExactEthForToken(min_spc_out_val, {value: ethers.utils.parseEther(form.amt_eth.value)});
    swap_eth_msg.innerText = "confirming..."
    await txReceipt.wait()
    swap_eth_msg.innerText = "tx succeeded!"
  } catch (e) {
    swap_eth_msg.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    swap_eth_msg.innerText = e.error.message
  }

  go()
})

quote_spc.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target
  const amt_spc = ethers.utils.parseEther(form.amt_spc.value)
  const spc_slippage = form.swap_slippage_spc.value

  console.log("Eth in:", amt_spc, ", Slippage %:", spc_slippage)
 
  await connectToMetamask()

  const priceQuote = await lpContract.quoteTokenForEth(amt_spc)
  amt_eth_out.innerText = priceQuote/1e18
  const idealQuote = await lpContract.idealQuote(amt_spc, true)/1e18
  const priceImpact = ((priceQuote/1e18 / idealQuote) - 1) * 100
  swap_spc_impact.innerText = priceImpact
  //min_eth_out_val = priceQuote*(100-spc_slippage)/100
  //min_eth_out_val = priceQuote.mul(100-spc_slippage).div(100)
  min_eth_out_val = priceQuote.mul(10000-Math.floor(spc_slippage*100)).div(10000)
  min_eth_out.innerText = min_eth_out_val/1e18

  try {
    swap_spc_msg.innerText = "waiting for tx approval..."
    const txReceipt = await routerContract.connect(signer).swapExactTokenForEth(ethers.utils.parseEther(form.amt_spc.value), min_eth_out_val);
    swap_spc_msg.innerText = "confirming..."
    await txReceipt.wait()
    swap_spc_msg.innerText = "tx succeeded!"
  } catch (e) {
    swap_spc_msg.innerText = "error"  
    const errorDescription = e
    console.log(e.error.message)
    swap_spc_msg.innerText = e.error.message
  }

  go()
})

