import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Airdrop, ERC20, MacroToken, MerkleTestFunctions } from "../typechain-types"
import { BigNumber, Signer } from "ethers";


const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");

const provider = ethers.provider
let account1: SignerWithAddress
let account2: SignerWithAddress
let claimant1: SignerWithAddress
let claimant2: SignerWithAddress
let claimant3: SignerWithAddress
let claimant4: SignerWithAddress
let rest: SignerWithAddress[]

let macroToken: MacroToken
let airdrop: Airdrop
let merkleRoot: string
let merkle: MerkleTestFunctions

//what are we doing here
let leaf1: string
let leaf2: string
let leaf3: string
let leaf4: string
let m1: string
let m2: string

describe("Airdrop", function () {
  before(async () => {
    ;[account1, account2, claimant1, claimant2, claimant3, claimant4, ...rest] = await ethers.getSigners()

    macroToken = (await (await ethers.getContractFactory("MacroToken")).deploy("Macro Token", "MACRO")) as MacroToken
    await macroToken.deployed()
    
    // Create a merkle tree for testing, computes it root, then set it here
    // using a helper contract with some functions duplicated and publicized to leverage my code to build the merkle tree + root
    merkle = await (await ethers.getContractFactory("MerkleTestFunctions")).deploy();
    await merkle.deployed()

    leaf1 = await merkle.toLeafFormat(claimant1.address, ONE_ETHER);
    leaf2 = await merkle.toLeafFormat(claimant2.address, ethers.utils.parseEther("2"));
    leaf3 = await merkle.toLeafFormat(claimant3.address, ethers.utils.parseEther("3"));
    leaf4 = await merkle.toLeafFormat(claimant4.address, ethers.utils.parseEther("4"));
    m1 = await merkle.hashPair(leaf1, leaf2);
    m2 = await merkle.hashPair(leaf3, leaf4);
    merkleRoot = await merkle.hashPair(m1, m2);
    
  })

  beforeEach(async () => {
    airdrop = await (await ethers.getContractFactory("Airdrop")).deploy(merkleRoot, account1.address, macroToken.address)
    await airdrop.deployed()

    //mint some tokens for the airdrop
    macroToken.mint(airdrop.address, ethers.utils.parseEther("1000"));
  })

  describe("setup and disabling ECDSA", () => {

    it("should deploy correctly", async () => {
      // if the beforeEach succeeded, then this succeeds
      expect(await macroToken.balanceOf(airdrop.address)).to.equal(ethers.utils.parseEther("1000"));
    })

    it("should disable ECDSA verification", async () => {
      // first try with non-owner user
      await expect(airdrop.connect(account2).disableECDSAVerification()).to.be.revertedWith("Ownable: caller is not the owner")

      // now try with owner
      await expect(airdrop.disableECDSAVerification())
        .to.emit(airdrop, "ECDSADisabled")
        .withArgs(account1.address)
    })
  })

  describe("Merkle claiming", () => {
    it ("Invalid Merkle claim reverts -- wrong claim amount", async () => {
        //give it l1: claimaint1.address, 2 tokens (not the amount we have in the official tree)
        //proof: [leaf2, m2]
        await expect(airdrop.connect(claimant1).merkleClaim([leaf2, m2], claimant1.address, ethers.utils.parseEther("2"))).to.be.revertedWith("invalid merkle");
        expect((await airdrop.alreadyClaimed(claimant1.address))).to.equal(false);
        expect((await macroToken.balanceOf(claimant1.address))).to.equal(0);
    })
    it ("Invalid Merkle claim reverts -- wrong claimant address", async () => {
        //give it l1: claimaint1.address, ONE_ETHER
        //proof: [leaf2, m2]
        await expect(airdrop.connect(account2).merkleClaim([leaf2, m2], claimant1.address, ONE_ETHER)).to.be.revertedWith("invalid merkle");
        expect((await airdrop.alreadyClaimed(account2.address))).to.equal(false);
        expect((await macroToken.balanceOf(account2.address))).to.equal(0);
    })
    it ("Can claim by Merkle", async () => {
        //give it l1: claimaint1.address, ONE_ETHER
        //proof: [leaf2, m2]
        await airdrop.connect(claimant1).merkleClaim([leaf2, m2], claimant1.address, ONE_ETHER);
        expect((await airdrop.alreadyClaimed(claimant1.address))).to.equal(true);
        expect((await macroToken.balanceOf(claimant1.address))).to.equal(ONE_ETHER);
    })
    it ("Merkle claim reverts if already claimed", async () => {
        //give it l1: claimaint1.address, ONE_ETHER
        //proof: [leaf2, m2]
        await airdrop.connect(claimant1).merkleClaim([leaf2, m2], claimant1.address, ONE_ETHER);
        expect((await airdrop.alreadyClaimed(claimant1.address))).to.equal(true);
        await expect (airdrop.connect(claimant1).merkleClaim([leaf2, m2], claimant1.address, ONE_ETHER)).to.be.revertedWith("already claimed!");
    })
  })

  describe("Signature claiming", () => {
    it("Invalid signature reverts -- wrong signer", async function () {
        //generate the sig
        //const network = await ethers.getDefaultProvider().getNetwork();
        const domain = {
          name: "Airdrop",
          version: "v1",
          chainId: 31337, // fix this later
          verifyingContract: airdrop.address
        };
        const types = {
          Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ]
        };
        const myData = {
            claimer: account2.address,
            amount: ONE_ETHER
        };
        //--> INVALID because this sig is signed by account2, not account1(legit signer)
        const signature = await account2._signTypedData(domain, types, myData);
        await expect(airdrop.connect(account2).signatureClaim(signature, account2.address, ONE_ETHER)).to.be.revertedWith("invalid signature");
        expect((await airdrop.alreadyClaimed(account2.address))).to.equal(false);
        expect((await macroToken.balanceOf(account2.address))).to.equal(0);
      });
    it("Can claim by signature ", async function () {
        //signer = account1.address
        //generate the sig
        //const network = await ethers.getDefaultProvider().getNetwork();
        const domain = {
          name: "Airdrop",
          version: "v1",
          chainId: 31337, // fix this later
          verifyingContract: airdrop.address
        };
        const types = {
          Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ]
        };
        const myData = {
            claimer: account2.address,
            amount: ONE_ETHER
        };
        const signature = await account1._signTypedData(domain, types, myData);
        await airdrop.connect(account2).signatureClaim(signature, account2.address, ONE_ETHER);
        expect((await airdrop.alreadyClaimed(account2.address))).to.equal(true);
        expect((await macroToken.balanceOf(account2.address))).to.equal(ONE_ETHER);
      });
      it("Cannot claim by merkle after claim by signature ", async function () {
        //signer = account1.address
        //generate the sig
        //const network = await ethers.getDefaultProvider().getNetwork();
        const domain = {
          name: "Airdrop",
          version: "v1",
          chainId: 31337, // fix this later
          verifyingContract: airdrop.address
        };
        const types = {
          Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ]
        };
        const myData = {
            claimer: claimant2.address,
            amount: ONE_ETHER.mul(2)
        };
        const signature = await account1._signTypedData(domain, types, myData);
        await airdrop.connect(claimant2).signatureClaim(signature, claimant2.address, ONE_ETHER.mul(2));
        expect((await airdrop.alreadyClaimed(claimant2.address))).to.equal(true);
        expect((await macroToken.balanceOf(claimant2.address))).to.equal(ONE_ETHER.mul(2));
        await expect(airdrop.connect(claimant2).merkleClaim([leaf1, m2], claimant2.address, ONE_ETHER.mul(2))).to.be.revertedWith("already claimed!");
      });
      it("Second claim with same sig fails ", async function () {
        expect((await airdrop.alreadyClaimed(account2.address))).to.equal(false);
        expect((await macroToken.balanceOf(account2.address))).to.equal(ONE_ETHER);

        //signer = account1.address
        //generate the sig
        //const network = await ethers.getDefaultProvider().getNetwork();
        const domain = {
          name: "Airdrop",
          version: "v1",
          chainId: 31337, // fix this later
          verifyingContract: airdrop.address
        };
        const types = {
          Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ]
        };
        const myData = {
            claimer: account2.address,
            amount: ONE_ETHER
        };
        const signature = await account1._signTypedData(domain, types, myData);
        await airdrop.connect(account2).signatureClaim(signature, account2.address, ONE_ETHER);
        expect((await airdrop.alreadyClaimed(account2.address))).to.equal(true);
        expect((await macroToken.balanceOf(account2.address))).to.equal(ONE_ETHER.mul(2));
        await expect(airdrop.connect(account2).signatureClaim(signature, account2.address, ONE_ETHER)).to.be.revertedWith("already claimed!");
        expect((await macroToken.balanceOf(account2.address))).to.equal(ONE_ETHER.mul(2));
      });
      it("Cannot claim with valid signature if ECDSA disabled ", async function () {
        await expect(airdrop.disableECDSAVerification())
        .to.emit(airdrop, "ECDSADisabled")
        .withArgs(account1.address)
    
        //signer = account1.address
        //generate the sig
        //const network = await ethers.getDefaultProvider().getNetwork();
        const domain = {
          name: "Airdrop",
          version: "v1",
          chainId: 31337, // fix this later
          verifyingContract: airdrop.address
        };
        const types = {
          Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ]
        };
        const myData = {
            claimer: account2.address,
            amount: ONE_ETHER
        };
        const signature = await account1._signTypedData(domain, types, myData);
        await expect(airdrop.connect(account2).signatureClaim(signature, account2.address, ONE_ETHER)).to.be.revertedWith("SIGS_DISABLED");
      });
  })
})