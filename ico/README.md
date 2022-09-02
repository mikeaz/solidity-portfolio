# SpaceCoinICO Project

## Technical Spec
<!-- Here you should list the technical requirements of the project. These should include the points given in the project spec, but will go beyond what is given in the spec because that was written by a non-technical client who leaves it up to you to fill in the spec's details -->

### SPC Token
- Implemented using ERC-20 library
- 500_000 max total supply
- 2% tax on every transfer that goes to treasury account
- Flag to toggle transfer tax on/off, controllable by owner, initialized to false
- Treasury account set as address variable

- Treasury account address can be changed by owner
- Additional SPC tokens cannot be minted by anyone after deployment
- ICO contract should start deployment with SPC token balance of 150_000
- Treasury address should be transferred remaining 350_000 SPC token

### SpaceCoin ICO
- The smart contract aims to raise 30,000 Ether by performing an ICO
- The ICO should only be available to private investors added to the ICO's allowlist starting in Phase Seed with a maximum total private contribution limit of 15,000 Ether and an individual contribution limit of 1,500 Ether
- The ICO should become available to the general public during Phase General, with a total contribution limit equal to 30,000 Ether, inclusive of funds raised from the private phase
- During Phase General, the individual contribution limit should be 1,000 Ether
- In Phase Open, the individual contribution limit should be removed, but the total contribution limit should remain at 30,000 Ether
- Additionally in Phase Open, the ICO contract should release SpaceCoin tokens at an exchange rate of 5 tokens to 1 Ether
- The owner of the contract should have the ability to pause and resume fundraising at any time, as well as move a phase forwards (but not backwards) at will

- Whitelist addresses can be added or removed by the owner
- SPC tokens can only be claimed by seed phase or general phase investors during open phase
- The contract will remain in open phase once it is advanced to open phase
- Pause function only affects ability to invest, and not ability to claim SPC tokens
- There is no minimum investment amount, and no maximum number of investors
- Whether or not a phase individual or total contribution limit has been reached has no effect on owner's ability to move contract to next phase
- Events should be emitted on invest, claim, advance, and pause. 

## Deployment Notes
SpaceCoin ICO deployment also deploys the SPC token contract at time of deployment. Deployment constructor requires one argument: the treasury address. Owner address for both ICO contract and SPC token contract are set to whichever address deploys the ICO contract. The ICO deploys in seed phase immediately, however the whitelist contains no entries at deployment. A second transaction setting the whitelist address(es) must be made in order to effectively allow the ICO to start accepting investments. Treasury address may be changed in the token contract by the owner. Once deployed, owner address in token and ICO contracts may not be changed. 

## Implementation Notes
### SpaceCoinICO Contract
Whitelist control functions are based directly on OpenZeppelin WhitelistedCrowdsale code. The code has functionally not changed as to leverage battle-tested code. I have chosen to include all the functionality of WhitelistedCrowdsale, assuming that any whitelisted crowdsale would expect at least this same functionality. That functionality is adding a single address to whitelist, adding multiple addresses to whitelist, and removing a single address from whitelist. 

### SPC Token
The token is implemented using OpenZeppelin ERC20 library. It includes override functions for transfer and transferFrom, which are the same as the original ERC20 functions, other than that they include logic for the transfer tax. If the transfer tax is enabled, 98% of the requested transfer value goes to the specified recipient, and 2% is sent directly to the treasury address.

## Frontend Notes
Frontend includes useful information and ability to buy and claim SPC. As well, useful status and error information is displayed on the page next to whichever function the user executes. Tx status is displayed from "waiting for tx approval..." to "confirming..." to "tx succeeded!". Any errors or reverts are shown here as well, in detail for user to see and understand. 

The frontend currently includes owner functions to whitelist an address, pause, resume the contract, and advance the phase. These owner-specific functions should be removed from the frontend given to end-users. However, they are useful for testing. Non-owners will be reverted if trying to use owner functions.   

## Unfinished Features
The ICO does not yet include a method for the owner or treasury to claim the ETH raised from the ICO. Any ETH contributed to this ICO contract will be lost forever! This is an essential feature and the contract should not be used as-is. 

## Design Exercise Answer
<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->
> The base requirements give contributors their SPC tokens immediately. How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?

As the contract is currently designed, contributors from seed phase and general phase do not receive their tokens immediately, but can claim their full SPC token balance once the ICO contract is in phase open. Open phase investors receive their full SPC tokens in one transaction that also includes their investment. In order to implement time vesting, I would include such logic in the claimToken function. I would have to change how invest function works in open phase so that it would not transfer SPC tokens immediately, but rather goes through "totalClaimableContrib" accounting variable to be later claimed with function claimToken. 

I would want to ask some clarifying questions for the design exercise spec:
- How does the vesting schedule work? Is there a set date which all tokens are locked and unclaimable until? And is there a set date which all tokens are considered fully vested and claimable? 

Let's assume yes. I want to leverage as much of the existing codebase as possible. I would want to change variable name "totalClaimableContrib" to "totalClaimableContribFullyVested" to be clear. And then also track totalClaimedSoFar using a new storage variable mapped to address. Also track the start and end date to calculate amount claimable at time of function call. 

```
uint vestStartDate = 1000
uint vestEndDate = 2000
now = 1500
if (now <= vestStartDate) {revert "not yet claimable"}
if (now <= vestEndDate) {
    totalPercentClaimable = (now - vestStartDate)*100 / (vestEndDate - vestStartDate)
    }
if (now > vestEndDate) {totalPercentClaimable = 100}
amountToSend = totalClaimableContrib * (totalPercentClaimable / 100) - totalClaimedSoFar
totalClaimedSoFar += amountToSend
spaceCoin.transfer(msg.sender, amountToSend)
```
Note: this pseudocode is rough with regards to handling percentages! As-is it would contain 100 vesting ticks/cliffs. Could specify a much higher value for it to be more linear. Just a quick psuedo example!

## Testnet Deploy Information

| Contract | Address Etherscan Link |
| -------- | ------- |
| SpaceCoin | https://rinkeby.etherscan.io/address/0xC9f6019E2b92dD5eF430E9BA23932249666f439d#code |
| SpaceCoinICO | https://rinkeby.etherscan.io/address/0xbcc0bED95E3B3Dc05E76aD8c63f607F15a715498#code |

## Useful Commands

Try running some of the following commands:

```shell
npx hardhat help
npx hardhat compile              # compile your contracts
npx hardhat test                 # run your tests
npm run test                     # watch for test file changes and automatically run tests
npx hardhat coverage             # generate a test coverage report at coverage/index.html
GAS_REPORT=true npx hardhat test # run your tests and output gas usage metrics
npx hardhat node                 # spin up a fresh in-memory instance of the Ethereum blockchain
npx prettier '**/*.{json,sol,md}' --write # format your Solidity and TS files
```
