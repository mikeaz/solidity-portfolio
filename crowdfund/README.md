# Crowdfund Project

## Technical Spec
<!-- Here you should list the technical requirements of the project. These should include the points given in the project spec, but will go beyond what is given in the spec because that was written by a non-technical client who leaves it up to you to fill in the spec's details -->

From Macro-delivered spec:
- The smart contract is reusable; multiple projects can be registered and accept ETH concurrently.
  - Specifically, you should use the factory contract pattern.
- The goal is a preset amount of ETH.
  - This cannot be changed after a project gets created.
- Regarding contributing:
  - The contribute amount must be at least 0.01 ETH.
  - There is no upper limit.
  - Anyone can contribute to the project, including the creator.
  - One address can contribute as many times as they like.
  - No one can withdraw their funds until the project either fails or gets cancelled.
- Regarding contributer badges:
  - An address receives a badge if their total contribution is at least 1 ETH.
  - One address can receive multiple badges, but should only receive 1 badge per 1 ETH.
  - Each project should use its own NFT contract.
- If the project is not fully funded within 30 days:
  - The project goal is considered to have failed.
  - No one can contribute anymore.
  - Supporters get their money back.
  - Contributor badges are left alone. They should still be tradable.
- Once a project becomes fully funded:
  - No one else can contribute (however, the last contribution can go over the goal).
  - The creator can withdraw any amount of contributed funds.
- The creator can choose to cancel their project before the 30 days are over, which has the same effect as a project failing.

From mikeaz:
- Project contract should have four states: funding open, canceled, failed, and success
- State starts in funding open on deployment
- When time exceeds funding length, state goes to canceled
- Owner can cancel at any time while funding is open
- Contributors can only contribute while fund is open
- Contributors can withdraw funds only in canceled or failed state
- Successful state is reached when a contribution pushes the total contributions past the funding goal 
- Owner can only withdraw funds in success state
- Events should be emitted on contribution, cancellation, contributor withdrawal, and owner withdrawal
- In success state, owner should be allowed to partially withdraw from the contract (for some reason)

## Design Exercise Answer
<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->
> Smart contracts have a hard limit of 24kb. Crowdfundr hands out an NFT to everyone who contributes. However, consider how Kickstarter has multiple contribution tiers. How would you design your contract to support this, without creating three separate NFT contracts?

Yes. In the NFT world, it is common for NFT's in a set to have particular traits, some that are more rare than others. Many production NFTs these days are using the URI attribute of ERC721 linked to IPFS to store off-chain data like traits and NFT images. My intuition is that such a method is likely overkill for this particular project. The benefits are mutability, and ability to store a vast array of data at low cost since it's off-chain. Another benefit is that it integrates rich data into marketplaces, which can increase resale interest, and improve the user experience for collecting and reselling the tokens. But, it has a higher design cost to implement, we don't need the mutability, and mainly we really only need one attribute to track multiple contribution tiers. (Note to look more into mutability re: ipfs. It seems there's some nuance there to be researched).

My intuition is to store the additional tier data in a struct associated with each individual tokenID, thinking back on how CryptoZombies stored level data in a struct. But CryptoZombies wasn't an ERC721. A quick search for "erc721 struct" turns up this stackexchange question:

https://stackoverflow.com/questions/66856296/how-to-add-custom-attributes-on-chain-in-erc721-token

Which answer includes this code snippet:

    struct Character {
        uint256 strength;
        uint256 dexterity;
        uint256 constitution;
        uint256 intelligence;
        uint256 wisdom;
        uint256 charisma;
        uint256 experience;
        string name;
    }

    Character[] public characters;

    mapping(uint256 => uint256) tokenIdToCharacterIndex;

At a bare minimum, we could get away with just one map that corresponds to tier level for each NFT tokenId minted. On minting in contribute function, we could set this to the desired tier level based on value of the contribution.

mapping(uint256 => uint256) tokenIdToTier;

In function contribute, once we have tokenId we're about to mint:

    if value >= 1 ETH
      tokenIdToTier[tokenId] = 1
    if value >= 3 ETH
      tokenIdToTier[tokenId] = 2
    if value >= 5 ETH
      tokenIdToTier[tokenId] = 3

At this point, I would also want to track the exact amount contributed per each NFT. Could be through a second map:

    mapping(uint256 => uint256) tokenIdToAmountContributed

  In contribute before minting:

    tokenIdToAmountContributed = value

Once we start adding more items to track per NFT beyond that, it becomes worth making it a struct. 

Note this changes some behavior of our current contract, in that instead of minting multiple NFT's for big contributions, we would just mint a single NFT per contribution that can reflect the additional value. That also opens the spec to what we would do for contributors with multiple smaller donations. We could make NFT minting a "pull" rather than "push", where the contract keeps track of contribution totals per address (it already does this), and the contributor can mint an nft reflecting the total value of all their contributions whenever they choose. Of course minting the NFT with a certain value would reset the value for minting again unless the user contributes more. 

## Unfinished Features
- Hardhat tests have near 100% coverage, but don't cover cases where project is interacted with from another contract instead of an EOA
- C-E-I practices are followed to prevent re-entry attacks, but I didn't build an attack contract and corresponding hardhat tests to try and re-enter it. i would want to try harder to hack it myself if i were to deploy to mainnet 

All features from the spec have been implemented, however here are some possible ways this contract could be expanded with more development time:
- instead of giving multiple nfts for >1 eth donations we could give a single nft that has different tiers, or has special attributes based on amount donated
- since nfts are fun collectibles, maybe some element of randomness where certain nfts minted end up with some special rarity that makes them valuable. as an incentive to donate. 
- currently the min contribution amount and the nft threshold are hard-coded as constants, as per the spec, but these could be configurable, at fund deployment 
- could build a front end


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
