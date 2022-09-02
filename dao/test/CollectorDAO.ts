import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { utils } from "../typechain-types/@openzeppelin/contracts";


const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");
const TWO_ETHER: BigNumber = ethers.utils.parseEther("2");

const ONE_DAY: number = 60 * 60 * 24;
const ONE_WEEK: number = 60 * 60 * 24 * 7;


// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number) => {
  await time.increase(seconds);
};

//compare account balance without fussing about gas fees
const closeTo = async (a: BigNumberish, b: BigNumberish, margin: number) => {
  expect(a).to.be.closeTo(b, margin)
};

describe("CollectorDAO", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployICO() {

    // Contracts are deployed using the first signer/account by default
    const [owner, proposer, voter1, voter2, voter3, voter4, voter5] = await ethers.getSigners();

    const DAO = await ethers.getContractFactory("CollectorDAO");
    const dao = await DAO.deploy();
    await dao.deployed();

    //Okay. To really test this thing, I'm going to deploy my CrowdFundr project. 
    //It's just crazy enough to work!
    const Project = await ethers.getContractFactory("Project");
    const project = await Project.deploy("10000000000000000000", "2592000", dao.address);
    await project.deployed();

    await dao.connect(proposer).memberContribute({ value: TWO_ETHER });
    await dao.connect(voter1).memberContribute({ value: ONE_ETHER });
    await dao.connect(voter2).memberContribute({ value: ONE_ETHER });
    await dao.connect(voter3).memberContribute({ value: TWO_ETHER });
    await dao.connect(voter4).memberContribute({ value: TWO_ETHER });
    
    const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
    //const selectorCallData = ethers.utils.id('cancelProject()').substring(0, 10);

    const txPropose = await dao.connect(proposer).propose(
      [project.address],
      //["0x00"],
      ["0x0de0b6b3a7640000"], //1 ETH in HEX
      [selectorCallData],
      'proposal description'
    );
    const proposeReceipt = await txPropose.wait();
    const proposalId = proposeReceipt.events![0].args![0];


    return { dao, proposalId, project, owner, proposer, voter1, voter2, voter3, voter4, voter5 };
  }


  describe("Deployment", function () {
    /* Where we're going, we don't need owners B^)
    it("Deploy DAO should set owner correctly", async function () {
      const { dao, owner, proposer, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      expect(await dao.owner()).to.equal(owner.address);
    });*/

  });

  describe("Membership", function () {
    it("Can contribute 1 ETH and become a member", async function () {
      const { dao, owner, proposer, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      expect(await dao.memberWeight(voter1.address)).to.equal(ONE_ETHER);
      await dao.connect(voter1).memberContribute({ value: ethers.utils.parseEther("0.5") });
      expect(await dao.memberWeight(voter1.address)).to.equal(ethers.utils.parseEther("1.5"));

    });

    //less than 1 eth reverts
    it("less than 1 eth contrib reverts", async function () {
      const { dao, owner, proposer, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);

      expect(await dao.memberWeight(voter5.address)).to.equal(0);

      await expect(dao.connect(voter5).memberContribute({ value: ethers.utils.parseEther("0.5") })).to.be.revertedWith("must contribute at least 1 ETH");
    });    

    //can contribute 1 eth then 0.5 eth and have member weight updated
    it("Can contribute 1 eth then 0.5 eth and have member weight updated", async function () {
      const { dao, owner, proposer, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      expect(await dao.memberWeight(voter1.address)).to.equal(ONE_ETHER);
    });

    //memberWeightAtTime works at arbitrary times
    it("Can accurately track member weight at particular time", async function () {
      const { dao, owner, proposer, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      expect(await dao.memberWeight(proposer.address)).to.equal(TWO_ETHER);

      //2 ether @timestamp 
      const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
      //console.log(timestamp);

      timeTravel(1000);
      await dao.connect(proposer).memberContribute({ value: ONE_ETHER });
      timeTravel(1000);

      const timestamp2 = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
      //console.log(timestamp2);

      timeTravel(1000);
      await dao.connect(proposer).memberContribute({ value: ONE_ETHER });
      timeTravel(1000);

      const timestamp3 = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
      //console.log(timestamp3);

      expect(await dao.getMemberWeightAtTime(proposer.address, timestamp)).to.equal(TWO_ETHER);
      expect(await dao.getMemberWeightAtTime(proposer.address, timestamp2)).to.equal(ethers.utils.parseEther("3"));
      expect(await dao.getMemberWeightAtTime(proposer.address, timestamp3)).to.equal(ethers.utils.parseEther("4"));
    });
  });

  describe("Proposal", function () {
    
    
    it("Anyone can hash a proposal", async function () {
      const { dao, project, owner, proposer, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      //const targets[] = project.address;

      //https://ethereum.stackexchange.com/questions/129760/is-there-a-way-to-retrieve-hexadecimal-methodid-from-function-abi
      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      //console.log(selectorCallData);
      const descriptionHash = ethers.utils.id('proposal description');
      //console.log(descriptionHash);

      const proposalHash = await(dao.hashProposal(
        [project.address],
        [selectorCallData],
        ["0x0de0b6b3a7640000"], //1 ETH in HEX
        descriptionHash
      ));
      //console.log(proposalHash);
    });
    
    it("Proposer can submit a proposal, and emits event as expected", async function () {
      const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);

      const txPropose = await dao.connect(proposer).propose(
        [project.address],
        ["0x0de0b6b3a7640000"],
        [selectorCallData], 
        'a different proposal description'
      );
      
      //console.log(txPropose);

      // This works for querying the event. But it sucks. 
      const proposeReceipt = await txPropose.wait();
      const eventArg0 = proposeReceipt.events![0].args![0];
      //console.log(eventArg0)
      expect(eventArg0).to.equal("16895448891879862884454037903405533702100044953311472141241838279054855724077");

      const eventArg1 = proposeReceipt.events![0].args![1];
      //console.log(eventArg1)
      expect(eventArg1).to.equal(proposer.address);

      const eventArg2 = proposeReceipt.events![0].args![2];
      //console.log(eventArg2)
      //console.log(project.address);
      expect(eventArg2[0]).to.equal(project.address);

      const eventArg3 = proposeReceipt.events![0].args![3];
      //console.log(eventArg3)
      expect(eventArg3[0]).to.equal("0x0de0b6b3a7640000");

      const eventArg4 = proposeReceipt.events![0].args![4];
      //console.log(eventArg4)
      //expect(eventArg4[0]).to.equal(selectorCallData);

      const eventArg5 = proposeReceipt.events![0].args![5];
      //console.log(eventArg5)
      expect(eventArg5[0]).to.equal(selectorCallData);

      const eventArg6 = proposeReceipt.events![0].args![6];
      //console.log(eventArg6)
      //expect(eventArg6[0]).to.equal(selectorCallData); //idk it's a timestamp 
    
      const eventArg7 = proposeReceipt.events![0].args![7];
      //console.log(eventArg7)
      expect(eventArg7).to.equal('a different proposal description');

    });

    it("Duplicate proposal is rejected", async function () {
      const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);

      await expect(dao.connect(proposer).propose(
        [project.address],
        ["0x0de0b6b3a7640000"],
        [selectorCallData], 
        'proposal description'
      )).to.be.revertedWith("Governor: proposal already exists");
    

    });

    //less than 2 eth member cannot submit proposal
    it("less than 2 eth member cannot submit proposal", async function () {
      const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);

      await expect(dao.connect(voter1).propose(
        [project.address],
        ["0x0de0b6b3a7640000"],
        [selectorCallData], 
        'a different proposal description'
      )).to.be.revertedWith("Governor: proposer below 2 ETH threshold required to propose");
    });

    it("Proposal starts in Active state", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      expect(await dao.state(proposalId)).to.equal(0);      //0 = Active

    });    

  });

  describe("Voting", function () {
    /*
    it("Member can cast on-chain vote for a proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const txVote = await dao.connect(voter1).castVote(proposalId, true);
    });*/

    it("Member joining after proposal time cannot vote", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);
      await time.increase(ONE_DAY);
      await dao.connect(voter5).memberContribute({ value: ONE_ETHER });
      expect(await dao.memberWeight(voter5.address)).to.equal(ONE_ETHER);
      await expect(dao.connect(voter5).castVote(proposalId, true)).to.be.revertedWith("voter has no voting power");
    });   

    it("Proposal defeated if quorum not met", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    });    

    it("Can't vote for defeated proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
      await expect(dao.connect(voter2).castVote(proposalId, true)).to.be.revertedWith("Governor: proposal not active");
    });    

    it("Proposal passes if everyone votes yes", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await dao.connect(voter2).castVote(proposalId, true);
      await dao.connect(voter3).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Succeeded
    });    

    it("Can't vote for succeeded proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await dao.connect(voter2).castVote(proposalId, true);
      await dao.connect(voter3).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Succeeded
      await expect(dao.connect(voter2).castVote(proposalId, true)).to.be.revertedWith("Governor: proposal not active");
    });   

    it("Proposal defeated if everyone votes no", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, false);
      await dao.connect(voter1).castVote(proposalId, false);
      await dao.connect(voter2).castVote(proposalId, false);
      await dao.connect(voter3).castVote(proposalId, false);
      await dao.connect(voter4).castVote(proposalId, false);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    }); 

    it("DAO contribution after proposal start date does not change weight for active proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await dao.connect(voter2).castVote(proposalId, true);
      await dao.connect(voter3).castVote(proposalId, true);
      
      //add an /extra/ 10 ETH at DAO level. vote no on existing proposal. should still pass!
      await dao.connect(voter4).memberContribute({ value: ethers.utils.parseEther("10") });
      expect(await dao.memberWeight(voter4.address)).to.equal(ethers.utils.parseEther("12"));

      await dao.connect(voter4).castVote(proposalId, false);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Succeeded
    });  

    //one voter voting five times in a row fails quorum
    it("one voter voting five times fails quorum", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    });        

    it("one voter can change their vote a bunch-- and fail quorum", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, false);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(proposer).castVote(proposalId, false);
      await dao.connect(proposer).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    });    

    //prevents member from voting multiple times
    it("Defeated if one member tries to vote yes a bunch of times", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, false);
      await dao.connect(voter1).castVote(proposalId, false);
      await dao.connect(voter2).castVote(proposalId, false);
      await dao.connect(voter3).castVote(proposalId, false);
      await dao.connect(voter4).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await dao.connect(voter4).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    }); 

    //allows member to change their vote

  });

  describe("Signed Voting", function () {
    it("Sign and decode a vote", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))
      const result = await dao.verify(voter1.address, proposalId, true, voter1.address, sig);

      const ethSignedMessage = await dao.getEthSignedMessageHash(ethers.utils.arrayify(msgHash));
      const result2 = await dao.recoverSigner(ethSignedMessage, sig);

      expect(result).to.equal(true);
      expect(voter1.address).to.equal(result2);
    });

    it("Sign and cast a vote", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))

      await dao.castVoteBySig(voter1.address, proposalId, true, sig);
    });

    it("One on-chain and one off-chain vote can succeed proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))
      await dao.castVoteBySig(voter1.address, proposalId, true, sig);
      await dao.connect(voter2).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Succeeded
    });

    it("One on-chain and one off-chain vote by same address will fail quorum", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))
      await dao.castVoteBySig(voter1.address, proposalId, true, sig);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeated
    });

    it("Multiple address can sign offchain votes, cast by a 3rd party one at a time, and proposal will pass", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))
      await dao.connect(voter5).castVoteBySig(voter1.address, proposalId, true, sig);

      const msgHash2 = await dao.getMessageHash(proposalId, true, voter2.address);
      const sig2 = voter2.signMessage(ethers.utils.arrayify(msgHash2))
      await dao.connect(voter5).castVoteBySig(voter2.address, proposalId, true, sig2);

      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Success
    });

    it("Multiple address can sign offchain votes, cast by a 3rd party in bulk, and proposal will pass", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);

      const msgHash = await dao.getMessageHash(proposalId, true, voter1.address);
      const sig = voter1.signMessage(ethers.utils.arrayify(msgHash))
      //await dao.connect(voter5).castVoteBySig(voter1.address, proposalId, true, sig);

      const msgHash2 = await dao.getMessageHash(proposalId, true, voter2.address);
      const sig2 = voter2.signMessage(ethers.utils.arrayify(msgHash2))
      //await dao.connect(voter5).castVoteBySig(voter2.address, proposalId, true, sig2);

      await dao.connect(voter5).castVotesBySigBulk([voter1.address, voter2.address], [proposalId, proposalId], [true, true], [sig, sig2]);


      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Success
    });

    it("Multiple address can sign offchain votes with different votes, cast by a 3rd party in bulk, and proposal will pass as expected", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);
      const msgHash = await dao.getMessageHash(proposalId, true, voter3.address);
      const sig = voter3.signMessage(ethers.utils.arrayify(msgHash))
      const msgHash2 = await dao.getMessageHash(proposalId, false, voter2.address);
      const sig2 = voter2.signMessage(ethers.utils.arrayify(msgHash2))
      await dao.connect(voter5).castVotesBySigBulk([voter3.address, voter2.address], [proposalId, proposalId], [true, false], [sig, sig2]);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2); //Success
    });

    it("Multiple address can sign offchain votes with different votes, cast by a 3rd party in bulk, and proposal will be defeated as expected", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4, voter5 } = await loadFixture(deployICO);
      const msgHash = await dao.getMessageHash(proposalId, false, voter3.address);
      const sig = voter3.signMessage(ethers.utils.arrayify(msgHash))
      const msgHash2 = await dao.getMessageHash(proposalId, true, voter2.address);
      const sig2 = voter2.signMessage(ethers.utils.arrayify(msgHash2))
      await dao.connect(voter5).castVotesBySigBulk([voter3.address, voter2.address], [proposalId, proposalId], [false, true], [sig, sig2]);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(1); //Defeat
    });

  });

  describe("Execution", function () {
    it("Proposal can be executed if vote passes", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      //const selectorCallData = ethers.utils.id('cancelProject()').substring(0, 10);
      //console.log(selectorCallData);
      const descriptionHash = ethers.utils.id('proposal description');
      //console.log(descriptionHash);

      //console.log("CollectorDAO.ts dao.address: %s", dao.address)
      const proposalHash = await(dao.execute(
        [project.address],
        ["0x0de0b6b3a7640000"], 
        [selectorCallData], 
        descriptionHash
      ));
      //console.log(proposalHash);
      expect(await dao.state(proposalId)).to.equal(3);
    });    

    it("Proposal can be executed by a 3rd party if vote passes, and they receive their ETH reward", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      const descriptionHash = ethers.utils.id('proposal description');

      const balancePre = await ethers.provider.getBalance(voter4.address);
      //console.log(balancePre);

      const proposalHash = await(dao.connect(voter4).execute(
        [project.address],
        ["0x0de0b6b3a7640000"], 
        [selectorCallData], 
        descriptionHash
      ));
      expect(await dao.state(proposalId)).to.equal(3);

      const balancePost = await ethers.provider.getBalance(voter4.address);
      //console.log(balancePost);
      expect(balancePost).to.be.closeTo(balancePre.add(ethers.utils.parseEther("0.03")), ethers.utils.parseEther("0.001"))
    });    

    it("Proposal can be executed if vote passes, confirm DAO recieves NFT", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);
      expect (await project.balanceOf(dao.address)).to.equal(0);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      const descriptionHash = ethers.utils.id('proposal description');
      const proposalHash = await(dao.execute(
        [project.address],
        ["0x0de0b6b3a7640000"], 
        [selectorCallData], 
        descriptionHash
      ));
      expect(await dao.state(proposalId)).to.equal(3);
      expect (await project.balanceOf(dao.address)).to.equal(1);
    });

    it("Can't vote for executed proposal", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      const descriptionHash = ethers.utils.id('proposal description');
      const proposalHash = await(dao.execute(
        [project.address],
        ["0x0de0b6b3a7640000"], 
        [selectorCallData], 
        descriptionHash
      ));
      expect(await dao.state(proposalId)).to.equal(3);
      await expect(dao.connect(voter2).castVote(proposalId, true)).to.be.revertedWith("Governor: proposal not active");
    }); 
    
    it("proposal cannot be re-executed", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      const descriptionHash = ethers.utils.id('proposal description');
      const proposalHash = await(dao.execute(
        [project.address],
        ["0x0de0b6b3a7640000"], //1 ETH in HEX
        [selectorCallData], 
        descriptionHash
      ));
      expect(await dao.state(proposalId)).to.equal(3);
      await expect(dao.execute(
        [project.address],
        ["0x0de0b6b3a7640000"], //1 ETH in HEX
        [selectorCallData],
        descriptionHash
      )).to.be.revertedWith("Governor: proposal not successful");

    });    

    it("Proposal goes into Defeated state if not executed within 3 days of passing", async function () {
      const { dao, proposalId, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);
      await time.increase(ONE_DAY * 3);
      expect(await dao.state(proposalId)).to.equal(1);
    });

    it("Error on proposal execution is bubbled all the way up to executor", async function () {
      const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

      const selectorCallData = ethers.utils.id('contribute()').substring(0, 10);
      const txPropose = await dao.connect(proposer).propose(
        [project.address],
        ["0x00"],
        [selectorCallData], 
        'buy NFT for 0 ETH-- this will fail!'
      );
      const proposeReceipt = await txPropose.wait();
      const proposalId = proposeReceipt.events![0].args![0];

      await dao.connect(proposer).castVote(proposalId, true);
      await dao.connect(voter1).castVote(proposalId, true);
      await time.increase(ONE_WEEK);
      expect(await dao.state(proposalId)).to.equal(2);

      const descriptionHash = ethers.utils.id('buy NFT for 0 ETH-- this will fail!');

      await expect(dao.connect(proposer).execute(
        [project.address],
        ["0x00"],
        [selectorCallData], 
        descriptionHash
      )).to.be.revertedWith("cannot contribute, contribution below minimum of 0.01 ETH");
    });
    describe("NFT Marketplace Execution", function () {
      it("DAO can buy NFT from NFT Marketplace interface", async function () {
        const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);

        //deploy NFT interface contract to test with
        const Market = await ethers.getContractFactory("NftMarketplaceContract");
        const market = await Market.deploy();
        await market.deployed();
        expect(market.address).to.equal("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

        //now build the proposal

        const callData = "0xde50f9ec0000000000000000000000009fE46736679d2D9a65F0992F2272dE9f3c7fa6e00000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000009fE46736679d2D9a65F0992F2272dE9f3c7fa6e00000000000000000000000000000000000000000000000000000000000000000"
        //This represents: (thanks to Remix for generating this)
        /*{
          "address _NftMarketplace": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
          "uint256 _maxPrice": "1000000000000000000",
          "address _nftAddress": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
          "uint256 _tokenId": "0"
        }*/ 

        const txPropose = await dao.connect(proposer).propose(
          [dao.address],
          ["0x0de0b6b3a7640000"], //1 ETH in HEX.
          [callData], 
          'NFTMarketplace'
        );

        const proposeReceipt = await txPropose.wait();
        const proposalId = proposeReceipt.events![0].args![0];

        //Pass the proposal.
        await dao.connect(proposer).castVote(proposalId, true);
        await dao.connect(voter1).castVote(proposalId, true);
        await time.increase(ONE_WEEK);
        expect(await dao.state(proposalId)).to.equal(2);

        //Execute the proposal.
        const descriptionHash = ethers.utils.id('NFTMarketplace');

        await dao.connect(proposer).execute(
          [dao.address],
          ["0x0de0b6b3a7640000"],
          [callData], 
          descriptionHash
        )

        expect(await dao.state(proposalId)).to.equal(3);

      });
      it("EOA cannot use buyNFTForDao function", async function () {
        const { dao, owner, proposer, project, voter1, voter2, voter3, voter4 } = await loadFixture(deployICO);
        await expect(dao.connect(voter4).buyNFTForDao(dao.address, ONE_ETHER, dao.address, 0)).to.be.revertedWith("Only DAO executed proposal can call this function");

      });
    });
  });


});
