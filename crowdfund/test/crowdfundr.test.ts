// ----------------------------------------------------------------------------
// REQUIRED: Instructions
// ----------------------------------------------------------------------------
/*
  For this first project, we've provided a significant amount of scaffolding
  in your test suite. We've done this to:

    1. Set expectations, by example, of where the bar for testing is.
    3. Reduce the amount of time consumed this week by "getting started friction".

  Please note that:

    - We will not be so generous on future projects!
    - The tests provided are about ~90% complete.
    - IMPORTANT:
      - We've intentionally left out some tests that would reveal potential
        vulnerabilities you'll need to identify, solve for, AND TEST FOR!

      - Failing to address these vulnerabilities will leave your contracts
        exposed to hacks, and will certainly result in extra points being
        added to your micro-audit report! (Extra points are _bad_.)

  Your job (in this file):

    - DO NOT delete or change the test names for the tests provided
    - DO complete the testing logic inside each tests' callback function
    - DO add additional tests to test how you're securing your smart contracts
         against potential vulnerabilties you identify as you work through the
         project.

    - You will also find several places where "FILL_ME_IN" has been left for
      you. In those places, delete the "FILL_ME_IN" text, and replace with
      whatever is appropriate.
*/
// ----------------------------------------------------------------------------

import { expect } from "chai";
import { ethers, } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Project, ProjectFactory } from "../typechain-types";


// ----------------------------------------------------------------------------
// OPTIONAL: Constants and Helper Functions
// ----------------------------------------------------------------------------
// We've put these here for your convenience, and to make you aware these built-in
// Hardhat functions exist. Feel free to use them if they are helpful!
const SECONDS_IN_DAY: number = 60 * 60 * 24;
const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");

// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number) => {
  await time.increase(seconds);
};

// Or, set the time to be a specific amount (in seconds past epoch time)
const timeTravelTo = async (seconds: number) => {
  await time.increaseTo(seconds);
};

// Compare two BigNumbers that are close to one another.
//
// This is useful for when you want to compare the balance of an address after
// it executes a transaction, and you don't want to worry about accounting for
// balances changes due to paying for gas a.k.a. transaction fees.
const closeTo = async (a: BigNumberish, b: BigNumberish, margin: number) => {
  expect(a).to.be.closeTo(b, margin)
};
// ----------------------------------------------------------------------------

describe("Crowdfundr", () => {
  // See the Hardhat docs on fixture for why we're using them:
  // https://hardhat.org/hardhat-network-helpers/docs/reference#fixtures
  // In particular, they allow you to run your tests in parallel using
  // `npx hardhat test --parallel` without the error-prone side-effects
  // that come from using mocha's `beforeEach`
  async function setupFixture() {
    const [deployer, alice, bob]: SignerWithAddress[] = await ethers.getSigners();

    // NOTE: You may need to pass arguments to the `deploy` function if your
    //       ProjectFactory contract's constructor has input parameters
    const ProjectFactory = await ethers.getContractFactory("ProjectFactory");
    const projectFactory: ProjectFactory =
      (await ProjectFactory.deploy(/* FILL_ME_IN: */)) as ProjectFactory;
    await projectFactory.deployed();

    // TODO: Your ProjectFactory contract will need a `create` method, to
    //       create new Projects
    // funding goal: 10 ETH = 10000000000000000000
    // fund time length = 30 days = 2592000 seconds
    const txReceiptUnresolved = await projectFactory.create("10000000000000000000", "2592000");
    const txReceipt = await txReceiptUnresolved.wait();

    const projectAddress = txReceipt.events![0].args![0];
    const project: Project = (await ethers.getContractAt("Project", projectAddress)) as Project;

    //alice deploys a project, which we can interact with as aliceProject
    const aliceReceiptUnresolved = await projectFactory.connect(alice).create("10000000000000000000", "2592000");
    const aliceReceipt = await aliceReceiptUnresolved.wait();
    const aliceProjectAddress = aliceReceipt.events![0].args![0];
    const aliceProject: Project = (await ethers.getContractAt("Project", aliceProjectAddress)) as Project;  

    return { projectFactory, deployer, alice, bob, project, projectAddress, aliceProject, aliceProjectAddress }
  };

  describe("ProjectFactory: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up writing Solidity code to protect against a
            vulnerability that is not tested for below, you should add
            at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
  });

  
  describe("ProjectFactory", () => {
    it("Deploys a contract", async () => {
      const { projectFactory, deployer, alice, bob } = await loadFixture(setupFixture);
      
      const factoryAddr = projectFactory.address;
      //console.log("factory addr: %s", projectFactory.address);
      expect(projectFactory.address).to.exist;
    });

    it("Can register a single project", async () => {
      const { projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);

      //looking at setupFixture.. what do we get for projectAddress? 
      //console.log("project addr: %s", projectAddress);

      const projAddr = await projectFactory.connect(deployer).contracts("0");
      //console.log("projAddr (from func): %s", projAddr);

      expect(projectAddress).to.exist;
      expect(projectAddress).to.equal(projAddr);
    });

    it("Can register multiple projects", async () => {
      const { projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);

      //alice calls create
      await projectFactory.connect(alice).create("10000000000000000000", "2592000");
      const aliceProjAddr = await projectFactory.connect(alice).contracts("1");
      //console.log("alice addr: %s", aliceProjAddr);

      //bob calls create
      await projectFactory.connect(bob).create("10000000000000000000", "2592000");
      const bobProjAddr = await projectFactory.connect(bob).contracts("2");
      //console.log("bob addr: %s", bobProjAddr);

      expect(aliceProjAddr).to.exist;
      expect(bobProjAddr).to.exist;
    });

    it("Registers projects with the correct owner", async () => {
      const { project, projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);
      expect (await project.owner()).to.equal(deployer.address);

    });

    it("Registers projects with a preset funding goal (in units of wei)", async () => {
      const { projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);
      await projectFactory.connect(alice).create("10000000000000000000", "2592000");
      const aliceProjAddr = await projectFactory.connect(alice).contracts("1");
      const aliceProj: Project = (await ethers.getContractAt("Project", aliceProjAddr)) as Project;

      const aliceProjGoal = await aliceProj.connect(alice).fundingGoal();
      //console.log("alice funding goal: %s", aliceProjGoal);

      expect(aliceProjGoal).to.equal("10000000000000000000");
    });

    it('Emits a "ProjectCreated" event after registering a project', async () => {
      const { projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);
      const aliceCreateTx = await projectFactory.connect(alice).create("10000000000000000000", "2592000");
      const aliceReceipt = await aliceCreateTx.wait();

      // https://ethereum.stackexchange.com/questions/93757/listening-to-events-using-ethers-js-on-a-hardhat-test-network
      const myEvent = aliceReceipt.events?.filter((x) => {return x.event == "ProjectCreated"});
      //console.log("myEvent: %s", myEvent);

      expect(myEvent).to.exist;
      //can we take a look at what all is in the event list? 
      //console.log("00%s",aliceReceipt.events![0].args![0]); //0xeEBe00Ac0756308ac4AaBfD76c05c4F3088B8883
      //console.log("01%s",aliceReceipt.events![0].args![1]); //undefined

      //console.log("10%s",aliceReceipt.events![1].args![0]);
      //console.log("11%s",aliceReceipt.events![1].args![1]);
      //these fail because there is no second event in alice's receipt.. just making sure :)
    });

    it('Emits a "ProjectCreated" event after registering a project (method2)', async () => {
      const { projectFactory, deployer, alice, bob, projectAddress } = await loadFixture(setupFixture);
      const aliceCreateTx = await projectFactory.connect(alice).create("10000000000000000000", "2592000");
      const aliceReceipt = await aliceCreateTx.wait();

      //https://github.com/fvictorio/hardhat-examples/blob/master/reading-events/test/test.js
      // this is way better..
      await expect(projectFactory.connect(alice).create("10000000000000000000", "2592000")).to.emit(projectFactory, "ProjectCreated");
    });

    it("Allows multiple contracts to accept ETH simultaneously", async () => {
      const { project, deployer, alice, bob, projectFactory, aliceProject, aliceProjectAddress } = await loadFixture(setupFixture);

      /*mikeaz: REFACTOR
      //alice deploys a project, which we can interact with as aliceProject
      const aliceReceiptUnresolved = await projectFactory.connect(alice).create("10000000000000000000", "2592000");
      const aliceReceipt = await aliceReceiptUnresolved.wait();
      const aliceProjectAddress = aliceReceipt.events![0].args![0];
      const aliceProject: Project = (await ethers.getContractAt("Project", aliceProjectAddress)) as Project;  
      */
      
      //bob deploys a project, which we can interact with as bobProject
      const bobReceiptUnresolved = await projectFactory.connect(bob).create("10000000000000000000", "2592000");
      const bobReceipt = await bobReceiptUnresolved.wait();
      const bobProjectAddress = bobReceipt.events![0].args![0];
      const bobProject: Project = (await ethers.getContractAt("Project", bobProjectAddress)) as Project;  
              
      //alice contributes to alice's project
      await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
      expect(await aliceProject.connect(alice).fundingBalance()).to.equal("1000000000000000000");
      expect(await bobProject.connect(alice).fundingBalance()).to.equal("0");

      //alice contributes to bob's project
      await bobProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
      expect(await aliceProject.connect(alice).fundingBalance()).to.equal("1000000000000000000");
      expect(await bobProject.connect(alice).fundingBalance()).to.equal("1000000000000000000");  
    });
  });

  describe("Project: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up protecting against a vulnerability that is not
            tested for below, you should add at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
      //mikeaz added test
      it("Non-owner should not be able to withdraw as owner after fund success", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
        expect(await aliceProject.isFundingOpen()).to.equal(false);

        await expect(aliceProject.connect(bob).withdrawOwner(ethers.utils.parseEther("1"))).to.be.revertedWith("cannot withdraw since you are not the owner");
      });
  });

  
  describe("Project", () => {
    describe("Contributions", () => {
      describe("Contributors", () => {
        it("Allows the creator to contribute", async () => {
          const { project, deployer } = await loadFixture(setupFixture);
          await project.connect(deployer).contribute({ value: ethers.utils.parseEther("1") });
          expect(await project.connect(deployer).fundingBalance()).to.equal("1000000000000000000");
          expect(await project.connect(deployer).amountContributed(deployer.address)).to.equal("1000000000000000000");
        });

        it("Allows any EOA to contribute", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await project.connect(deployer).contribute({ value: ethers.utils.parseEther("1") });
          await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("1") });
          expect(await project.connect(deployer).fundingBalance()).to.equal("3000000000000000000");
          expect(await project.connect(alice).fundingBalance()).to.equal("3000000000000000000");
        });

        it("Allows an EOA to make many separate contributions", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("1") });
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("2") });
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("3") });
          expect(await project.connect(bob).fundingBalance()).to.equal("6000000000000000000");
          expect(await project.connect(bob).amountContributed(bob.address)).to.equal("6000000000000000000");
        });

        it('Emits a "ContributionMade" event after a contribution is made', async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          expect(await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") })).to.emit(project, "ContributionMade").withArgs(alice.address, ethers.utils.parseEther("1"));
        });
      });

      describe("Minimum ETH Per Contribution", () => {
        it("Reverts contributions below 0.01 ETH", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await expect(project.connect(bob).contribute({ value: ethers.utils.parseEther("0.001") })).to.be.reverted;
        
        });

        it("Accepts contributions of exactly 0.01 ETH", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await expect(project.connect(alice).contribute({ value: ethers.utils.parseEther("0.01") })).to.emit(project, "ContributionMade").withArgs(alice.address, ethers.utils.parseEther("0.01"));
        });
      });

      describe("Final Contributions", () => {
        it("Allows the final contribution to exceed the project funding goal", async () => {
          // Note: After this contribution, the project is fully funded and should not
          //       accept any additional contributions. (See next test.)
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({ value: ethers.utils.parseEther("5") });
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("6") });
          expect(await project.fundingBalance()).to.equal( ethers.utils.parseEther("11"));

        });

        it("Prevents additional contributions after a project is fully funded", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({ value: ethers.utils.parseEther("5") });
          await project.connect(bob).contribute({ value: ethers.utils.parseEther("6") });
          expect(await project.fundingBalance()).to.equal( ethers.utils.parseEther("11"));
          await expect(project.connect(bob).contribute({ value: ethers.utils.parseEther("1") })).to.be.reverted;
          expect(await project.fundingBalance()).to.equal( ethers.utils.parseEther("11"));
        });

        it("Prevents additional contributions after 30 days have passed since Project instance deployment", async () => {
          const { project, deployer, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await time.increase(2592001);
          await expect(project.connect(bob).contribute({ value: ethers.utils.parseEther("1") })).to.be.reverted;
        });
      });
    });

    describe("Withdrawals", () => {
      describe("Project Status: Active", () => {
        it("Prevents the creator from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);

          //bob adds 1 eth
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("1") });

          //project should be open
          expect(await aliceProject.isFundingOpen()).to.equal(true);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));

          //alice's attempt to withdraw as owner should fail
          await expect(aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"))).to.be.reverted;
        });
        
        //mikeaz added test
        it("Prevents the creator from withdrawing any funds (as a contributor)", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);

          //bob adds 1 eth
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("1") });
  
          //project should be open
          expect(await aliceProject.isFundingOpen()).to.equal(true);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
  
          //alice's attempt to withdraw as owner should fail
          await expect(aliceProject.connect(alice).withdrawContributor()).to.be.reverted;
        });

        it("Prevents contributors from withdrawing any funds", async () => {
           const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);

          //bob adds 1 eth
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("1") });
  
          //project should be open
          expect(await aliceProject.isFundingOpen()).to.equal(true);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
  
          //bob's attempt to withdraw as contributor should fail
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.reverted;
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);

          //alice adds 1 eth
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
  
          //project should be open
          expect(await aliceProject.isFundingOpen()).to.equal(true);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
  
          //bob's attempt to withdraw as contributor should fail
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.reverted;        });
      });

      describe("Project Status: Success", () => {
        it("Allows the creator to withdraw some of the contribution balance", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("10"));

          await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"));

          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("9"));
        });

        it("Allows the creator to withdraw the entire contribution balance", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("10"));

          await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("10"));

          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("0"));        });

        it("Allows the creator to make multiple withdrawals", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("10"));
          await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"));
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("9"));
          await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"));
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("8"));
          await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("8"));
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("0"));
        });

        it("Prevents the creator from withdrawing more than the contribution balance", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          await expect(aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("11"))).to.be.reverted;
        });
        it('Emits a "OwnerWithdrawalMade" event after a withdrawal is made by the creator', async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("10"));
          expect(await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"))).to.emit;
          expect(await aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"))).to.emit(aliceProject, "OwnerWithdrawalMade").withArgs(ethers.utils.parseEther("1"));
        });

        it("Prevents contributors from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          await expect(aliceProject.connect(alice).withdrawContributor()).to.be.reverted;

        });

        //mikeaz added test
        it("Prevents non-creator contributors from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.reverted;

        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.reverted;        
        });
      });

      describe("Project Status: Failure", () => {
        it("Prevents the creator from withdrawing any funds (if not a contributor)", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await time.increase(2592001);
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          await expect(aliceProject.connect(alice).withdrawOwner(ethers.utils.parseEther("1"))).to.be.reverted;
        });

        it("Prevents contributors from withdrawing any funds (though they can still refund)", async () => {
          //mikeaz: vaguely worded please amend
          //"Prevents contributors from withdrawing full fundingBalance if project fails"
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("1") });

          await time.increase(2592001);
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("2"));
          expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("1"));

          await aliceProject.connect(alice).withdrawContributor();
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
          //actually fundingBalance never changes once funding fails.. let's change this and update. DONE
          expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("0"));
          await expect(aliceProject.connect(alice).withdrawContributor()).to.be.revertedWith("no balance for contributor to withdraw");        

        });

        it("All contributors can withdraw in full after fail (and not more)", async () => {
          //mikeaz: vaguely worded please amend
          //"Prevents contributors from withdrawing full fundingBalance if project fails"
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("1") });

          await time.increase(2592001);
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("2"));
          expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("1"));

          await aliceProject.connect(alice).withdrawContributor();
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
          //actually fundingBalance never changes once funding fails.. let's change this and update. DONE
          expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("0"));
          await expect(aliceProject.connect(alice).withdrawContributor()).to.be.revertedWith("no balance for contributor to withdraw");
          
          await aliceProject.connect(bob).withdrawContributor();
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("0"));
          //actually fundingBalance never changes once funding fails.. let's change this and update. DONE
          expect(await aliceProject.amountContributed(bob.address)).to.equal(ethers.utils.parseEther("0"));
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.revertedWith("no balance for contributor to withdraw");
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
          await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
          await time.increase(2592001);
          expect(await aliceProject.isFundingOpen()).to.equal(false);
          expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
          expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("1"));
          expect(await aliceProject.amountContributed(bob.address)).to.equal(ethers.utils.parseEther("0"));
          await expect(aliceProject.connect(bob).withdrawContributor()).to.be.revertedWith("no balance for contributor to withdraw");     
           });
      });
    });

    describe("Refunds", () => {
      it("Allows contributors to be refunded when a project fails", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        await time.increase(2592001);
        expect(await aliceProject.isFundingOpen()).to.equal(false);
        expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
        expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("1"));
        await aliceProject.connect(alice).withdrawContributor();
        expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("0"));
        expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("0"));
      });

      it("Prevents contributors from being refunded if a project has not failed", async () => {
        //"... because it's still open"
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await aliceProject.isFundingOpen()).to.equal(true);
        expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
        await expect(aliceProject.connect(alice).withdrawContributor()).to.be.revertedWith("cannot withdraw, funding still open");     
      });

      //mikeaz added test
      it("Prevents contributors from being refunded if a project has not failed because it succeeded", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await aliceProject.isFundingOpen()).to.equal(true);
        expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));

        await aliceProject.connect(bob).contribute({ value: ethers.utils.parseEther("10") });
        expect(await aliceProject.isFundingOpen()).to.equal(false);

        await expect(aliceProject.connect(alice).withdrawContributor()).to.be.revertedWith("cannot withdraw, funding succeeded");    
      });

      it('Emits a "ContributorWithdrawalMade" event after a a contributor receives a refund', async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        await time.increase(2592001);
        expect(await aliceProject.isFundingOpen()).to.equal(false);
        expect(await aliceProject.fundingBalance()).to.equal( ethers.utils.parseEther("1"));
        expect(await aliceProject.amountContributed(alice.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await aliceProject.connect(alice).withdrawContributor()).to.emit(aliceProject, "ContributorWithdrawalMade").withArgs(ethers.utils.parseEther("1"));     
      });
    });

    describe("Cancelations (creator-triggered project failures)", () => {
      it("Allows the creator to cancel the project if < 30 days since deployment has passed ", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        expect(await project.isFundingOpen()).to.equal(true);
        await project.connect(deployer).cancelProject();
        expect(await project.isFundingOpen()).to.equal(false);
      });

      it("Prevents the creator from canceling the project if at least 30 days have passed", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        expect(await project.isFundingOpen()).to.equal(true);
        await time.increase(2592001);
        expect(await project.isFundingOpen()).to.equal(false);
        await expect(project.connect(deployer).cancelProject()).to.be.revertedWith("funding closed, cannot cancel");
      });

      //mikeaz added test
      it("Prevents the creator from canceling the project if funding successful", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        expect(await project.isFundingOpen()).to.equal(true);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
        expect(await project.isFundingOpen()).to.equal(false);
        await expect(project.connect(deployer).cancelProject()).to.be.revertedWith("funding closed, cannot cancel");
      });

      //mikeaz added test
      it("Prevents non-creator from canceling the project", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject } = await loadFixture(setupFixture);
        expect(await project.isFundingOpen()).to.equal(true);
        await expect(project.connect(alice).cancelProject()).to.be.revertedWith("you are not the owner, cannot cancel");
        expect(await project.isFundingOpen()).to.equal(true);
      });

      it('Emits a "Cancellation" event after a project is cancelled by the creator', async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        expect(await project.connect(deployer).cancelProject()).to.emit(project, "Cancellation");      
      });
    });

    describe("NFT Contributor Badges", () => {
      it("Awards a contributor with a badge when they make a single contribution of at least 1 ETH", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        await project.connect(bob).contribute({ value: ethers.utils.parseEther("1.1") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);
        expect(await project.connect(bob).balanceOf(bob.address)).to.equal(1);
      });

      it("Awards a contributor with a badge when they make multiple contributions to a single project that sum to at least 1 ETH", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.5") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.5") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);
        await project.connect(bob).contribute({ value: ethers.utils.parseEther("0.5") });
        await project.connect(bob).contribute({ value: ethers.utils.parseEther("0.6") });
        expect(await project.connect(bob).balanceOf(bob.address)).to.equal(1);
      });

      it("Does not award a contributor with a badge if their total contribution to a single project sums to < 1 ETH", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(0);     
        expect(await project.connect(alice).amountContributed(alice.address)).to.equal(ethers.utils.parseEther("0.9"));   
        expect(await project.fundingBalance()).to.equal(ethers.utils.parseEther("0.9"));

      });

      it("Awards a contributor with a second badge when their total contribution to a single project sums to at least 2 ETH", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(0);   
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.3") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);   
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(2);   
      });

      it("Does not award a contributor with a second badge if their total contribution to a single project is > 1 ETH but < 2 ETH", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.5") });
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.5") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);   
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("0.5") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);   
      });

      it("Awards contributors with different NFTs for contributions to different projects", async () => {
        const { project, deployer, alice, bob, projectFactory, aliceProject, aliceProjectAddress } = await loadFixture(setupFixture);
        
        //bob deploys a project, which we can interact with as bobProject
        const bobReceiptUnresolved = await projectFactory.connect(bob).create("10000000000000000000", "2592000");
        const bobReceipt = await bobReceiptUnresolved.wait();
        const bobProjectAddress = bobReceipt.events![0].args![0];
        const bobProject: Project = (await ethers.getContractAt("Project", bobProjectAddress)) as Project;  
                
        //alice contributes to alice's project and gets an alice nft (but not a bob nft)
        await aliceProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await aliceProject.connect(alice).balanceOf(alice.address)).to.equal(1);   
        expect(await bobProject.connect(alice).balanceOf(alice.address)).to.equal(0);   

        //alice contributes to bob's project and gets a bob nft (but not an alice nft)
        await bobProject.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await bobProject.connect(alice).balanceOf(alice.address)).to.equal(1);   
        expect(await aliceProject.connect(alice).balanceOf(alice.address)).to.equal(1);  
      });

      it("Allows contributor badge holders to trade the NFT to another address", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);   
        await project.connect(alice).transferFrom(alice.address, bob.address, 1);
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(0);   
        expect(await project.connect(alice).balanceOf(bob.address)).to.equal(1);   
      });

      it("Allows contributor badge holders to trade the NFT to another address even after its related project fails", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);  

        expect(await project.isFundingOpen()).to.equal(true);
        await time.increase(2592001);
        expect(await project.isFundingOpen()).to.equal(false);

        await project.connect(alice).transferFrom(alice.address, bob.address, 1);
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(0);   
        expect(await project.connect(alice).balanceOf(bob.address)).to.equal(1);        
      });

      //mikeaz add test: can't transfer an NFT you don't own! TODO FILL_ME_IN
      it("Can't transfer an NFT you don't own", async () => {
        const { project, deployer, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({ value: ethers.utils.parseEther("1") });
        expect(await project.connect(alice).balanceOf(alice.address)).to.equal(1);   
        await expect(project.connect(bob).transferFrom(alice.address, bob.address, 1)).to.be.reverted;
      });
    });
  });
});
