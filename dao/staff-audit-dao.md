https://github.com/0xMacro/student.mikeaz/tree/32b79a348293fa791e590eb4bbd907ad4ca86472/dao

Audited By: Jamie

# General Comments

- Good job on how you designed `buyNFTForDao()`. You opted to include the `INftMarketplace` address as one of the function parameters. This allows for a more resilient DAO purchase scheme, since it allows the DAO to not be locked into purchasing from the same marketplace. As you know, the target prices and the target NFTs are public all throughout the proposal process, so front-running is very much a concern. We don't want our DAO to be purchasing NFTs at inflated prices.
- If our goal is to engineer smart contracts that are durable and last a lifetime, I would nudge you to think more about how the DAO or the environment can change in the future. For instance:
  - How will the DAO handle future Ethereum forks? See `[TM-1]`.
  - If the DAO becomes wildly successful in the future, will it still function? Some 0(N) logic could be a bottleneck.
  - Will the execution reward of `0.03 ether` be too much or too little in the future. Obviously not part of the spec, but it could be a good idea to have this amount configurable by the DAO (now that you implemented arbitrary functions!).
- Your `splitSignature()` function is a carbon copy of [code somewhere else](https://github.com/Cainuriel/Solidity-practices/blob/4fec0cfdbe6834d20c4da420a972c2c72fd2dbc4/Signature.sol#L82-L107). Please make sure you note that in the readme or comments next time.
- Please include the `package.json` and `package-lock.json` files in your repo next time to allow anyone to easily setup, compile, and run your tests.
- I appreciate your thoughtful design exercise answers!

# Design Exercise

> Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?

Great answer Mike! You are correct in that this delegation enhancement plays very nicely with your current DAO design. Introducing delegation means breaking the 1ETH-membership-only-1-vote requirement of the base spec of this project.

> What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).

You are correct. Inevitably, transitive vote delegation introduces O(N) operations, which can lead to gas limit issues. As you noted, the delegation graph can have infinitely many chains that would need to be looked up.

# Issues

## **[M-1]** Signature votes are replayable

In line 142 of `CollectorDAO.sol` we have:

```solidity
bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 _proposalId,bool _support, address _voter)");

```

This ballot typehash allows for members to update the vote status for a Proposal, but does not protect against a malicious relayers replaying signatures for previous votes. For instance, if the honest member casts a "FOR" vote by signature, and then updates it by casting a "AGAINST" vote by signature, then the relayer can set the honest member's vote status to either "FOR" or "AGAINST".

Consider adding an additional field to your `BALLOT_TYPEHASH`, `uint32 nonce`, and keeping track of each user's nonce in a `mapping(address -> uint32)`. In `castVoteBySig()` you then will need to check that the nonce hasn't already been used, and if it hasn't been used, mark it as used.

## **[L-1]** DAO will stop functioning if it gets large enough

In line 113 of `CollectorDAO.sol` we have the following:

```solidity
for (uint i=0; i<proposal.voters.length; i++) {
  if (proposal.voters[i] == _voter) {
    //already voted, don't add to voter list
    alreadyVoted = true;
    break;
  }
}
```

Which can loop through all voters that have voted for a proposal. In the same function right before this statement in line 57 we have:

```solidity
for (uint i=0; i<memberWeightHistory[_member].length; i++) {
  if (memberWeightHistory[_member][i].timestamp <= _timestamp) {
    weightAtTime += memberWeightHistory[_member][i].amount;
  }
}
```

The above is another 0(N) loop that iterates through all checkpoints of a given address to determine voting weight at a given timestamp. The number of iterations can, again, grow unbounded, and thus could revert with an "out of gas" error. This is problematic since both examples are used in `_vote()`. While this situation is only likely to occur if the `_member` address has a large amount of contributions, or `_timestamp` is a small value in the case of old proposals, the possibility of this is enough to influence voting behavior of an account with many contributions.

Consider:
Avoid iterating arrays, the size of which the contract has no control over. At the cost of added complexity, Open Zeppelin used a binary search scheme to alleviate this in [ERC20Votes.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC20Votes.sol#L97).

You could also accumulate the voting power of a user in per-address `uint256` value, whose lookup would be O(1)

## **[Technical Mistake]** Incorrect implementation of EIP712

EIP-712 is not implemented correctly. In line 149 of `CollectorDAO.sol` we have this:

```solidity
bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("CollectorDAO")), 1, "address(this)"));

```

There are two issues here, both of which do not protect the contract from replay attacks:

1. The `chainid` is hardcoded as 1, which renders `castVoteBySig()` unusable if any other Ethereum chain were to be used, such as a testnet or a future fork.
2. The `address verifyingContract` is hardcoded. Someone can clone this contract, deploy it on mainnet, solicit signature votes on the clone, and then apply it on the original DAO.

Here is what [EIP-712](https://eips.ethereum.org/EIPS/eip-712) says:

> `uint256 chainId` the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.

> `address verifyingContract` the address of the contract that will verify the signature. The user-agent may do contract specific phishing prevention.

Consider:
Using `block.chainid` available to newer versions of solidity (which you are using), and passing in the address of the contract.

```solidity
bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("CollectorDAO")), block.chainid, address(this)));
```

---

## **[Q-1]** Remove split signature feature to simply contract and save gas

In `CollectorDAO.sol` the `verify` function can be simplified by moving the `splitSignature()` function off-chain. This is a common procedure in cryptography, so we do not need to include a potentially error-prone implementation into the contract.

Consider allowing the EOA to do work instead of the contract, but having `castVoteBySig` take in the v,r,s parameters.

# Nitpicks

## **[N-1]** Reduce code returning booleans

In line 278 of `CollectorDAO`:

```solidity
if (approveTotal > denyTotal) {
  return true;
} else {
  return false;
}
```

Can simply be called like:

```solidity
return (approveTotal > denyTotal);
```

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 3     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 4

Good job!
