# DAO Project

## Technical Spec
<!-- Here you should list your DAO specification. You have some flexibility on how you want your DAO's voting system to work and Proposals should be stored, and you need to document that here so that your staff micro-auditor knows what spec to compare your implementation to.  -->

### Proposal System Spec

* Are duplicate proposals allowed: Yes. As long as their descriptions, and thus resulting “proposalId”s differ
* How will you store proposal data: off chain. The full unhashed proposal data must be included as an argument to the execution transaction.
* A member must have already been a member at time of proposal creation in order to vote on a proposal.
* When can a proposal be executed: an approved proposal must be executed from between 7-10 days from moment of original proposal submission. So there is a three day window from when a proposal passes where it can be executed.
* Who can execute a proposal: Any EOA. As an incentive to encourage execution, executors will receive 0.03 ETH in return for executing an approved proposal.
* Early execution: since voters may change their vote at any time while a proposal is open, there is no early execution of approved proposals, even if everyone in the community approves. The week-long proposal voting period must have ended.
* A proposal may include the function "buyNFTForDao" which works with NftMarketplace Interface-like NFT marketplaces. This single function will check the price of a particular NFT on the marketplace, and if it is less than or equal to the specified price, it will purchase the NFT for CollectorDAO. This function may only be called by the DAO contract itself during proposal execution.

### Voting System Spec

* 1 ETH = 1 Vote. Membership in Collector DAO costs 1 ETH minimum. Additional ETH contributed to the DAO treasury results in additional voting power at a rate of 1:1. 
* A member may contribute more ETH at any time to increase their voting power for future proposals.
* Membership and voting power is "snapshotted" at proposal time. A new member that joins after a proposal is active cannot vote on the existing active proposal. A member that increases their voting power will only see their increased voting power reflected in future proposals, but not existing proposals. 
* Single choice voting. Each voter selects only one choice (approve/deny) to assign their entire number of votes to. Voters may vote for any number of open proposals at the same time. A voter may vote for separate proposals at the same time, and will assign their total vote value to each proposal voted for, independent of other proposals voted for. 
* Voters may choose to either approve or deny an open proposal. Those are the only options. 
* 25% quorum refers to number of total DAO members at moment of proposal submission, regardless of ETH contributed per DAO member
* The voting period lasts one week from proposal time
* If >50% of voter value has voted to approve by end of proposal time, the vote is considered passed and may be executed by any EOA
* For quorum amount needed to pass at time of proposal submission. Also freeze voting power to time of proposal submission. For every ETH donation to DAO, keep track of time donated. When it’s time to vote only look at voting power from before or equal to proposal timestamp. 
* Off-chain voting: A member may sign their vote for any active proposal off-chain. Their off-chain vote signature must be verified and submitted on-chain before the proposal active voting window closes. 
* The on-chain submission of off-chain vote signatures may be performed by any address, and may be done in bulk with as many signatures as can fit in the calldata of a transaction. 

## Implementation Notes

The core functionality of CollectorDAO is based on OpenZeppelin Governor.sol. Off-chain vote signing and verifying is based on https://solidity-by-example.org/signature/.

## Testing Notes

I realized my existing Project.sol from Crowdfundr is a perfect candidate to test purchasing an actual NFT with. It is an ERC721 compliant token, that is transferred to the contributor for donations of >= 1 ETH. I deploy this contract as "project" in the Hardhat testbench, and the proposal in the test fixture calls contribute() to this contract with a 1 ETH value. I confirmed that when the proposal executes, the DAO contract receives the Crowdfundr Badge NFT.  

## Unfinished Features

### EIP-712 Implementation

Off-chain vote signing is implemented using EIP-191 Signed Data Standard, using https://solidity-by-example.org/signature/ as a model. There are some EIP-712-like features in the vote hashing, but for full EIP-712 compliance, a re-factor of the vote hashing functions and test suite would be required. Compound's GovernorAlpha.sol function CastVoteBySig is a model implementation of this feature in a similar context. 

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->
> Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?

In the current CollectorDAO contract, for a particular proposal, unique voter address are stored in an array, and the votes are stored in a mapping of address to bool. Votes are counted through the function _voteSucceeded function, which iterates through the voter array to find the correct member weight. Transitive voting can be added relatively easily to this structure. 

At contract level add voterDelegation:

```solidity
mapping(address => address) voterDelegation;
address[] votersWithDelegation;
```

For each address, this could either point to null address for no delegation, or to the address the voter has chosen to delegate to. We use votersWithDelegation to track who has delegated to easily iterate over the voterDelegation map when needed. 

Voter delegation should be persistent. If a voter delegates their power, they trust another address to make decisions for their power without having to be involved in every vote. So this should require code changes in both _voteSucceeded and _quorumReached. As in, a delegated vote will always count for quorum, as long as the delegatee actually votes. Delegation can increase quorum if users do not wish to be present for every vote but still want to be counted. 

As it is persistant and outside individual proposals, logic should be added to both _quorumReached and _voteSucceeded outside of the existing for loops, which are based on "proposal.voters"-- i.e. unique voters that have voted on a particular proposal. We should do a similar iteration over addresses that have delegated votes, to check their voting power, check if and how their delegatee has voted, then add the delegated votes to the total.  

```
for i=0; i<votersWithDelegation.length; i++
	check if delegatee has voted
	check how delegatee has voted
	add delegator's voting weight to total
```

We would also need some checking to make sure that a delegated voter cannot cast a regular vote.

Delegation can be decided by either an on-chain transaction, or an off-chain signed transaction signature that is later submitted on chain, similar to our existing off-chain voting system. 

> What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).

With transitive voting, there is an obvious risk of creating loops, where at some point voters have delegated their voting power to eachother. What happens in such cases? In the simplest case A delegates to B, B delegates to A, we could say that their vote power is effectively nullified since there is no target. But how do we determine programatically that we've reached a loop? We would have to track our previous states and how we got here and notice that we are following the same pointers that brought us to the same nodes. We would have to store this in memory. As we analyze more complex transitive vote delegation scenarios, this becomes a very memory-intensive problem, far outside the scope of anything we would ever want to run on the EVM, even in memory. 

We would need to go through the entire map of delegators and delegatees and determine if each node eventually points to a valid end delegatee node without any further delegation pointers. Without storing previous states in memory, we can assume that for "n" voter nodes, we would want to make sure that, for each voter node, by "n" iterations, we reach an end node without further delegations. This is an O(n^2) complexity level problem, where "n" is the number of voters. This isn't impossible to solve, but it is insane to do on-chain. 

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
