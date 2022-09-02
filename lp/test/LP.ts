import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");
const TWO_ETHER: BigNumber = ethers.utils.parseEther("2");
const FIVE_ETHER: BigNumber = ethers.utils.parseEther("5");

describe("SpaceCoinLP", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployICO() {

    // Contracts are deployed using the first signer/account by default
    const [owner, treasury, alice, bob] = await ethers.getSigners();

    const ICO = await ethers.getContractFactory("SpaceCoinICO");
    const ico = await ICO.deploy(treasury.address);
    await ico.deployed();
    const tokenAddress = await ico.tokenAddress();
    const spcToken = await ethers.getContractAt("SpaceCoin", tokenAddress);

    //const { lp, router } = await loadFixture(deployLP);


    return { ico, spcToken, owner, treasury, alice, bob };
  }

  async function deployLP() {
    //const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
    const [owner, treasury, alice, bob] = await ethers.getSigners();

    const ICO = await ethers.getContractFactory("SpaceCoinICO");
    const ico = await ICO.deploy(treasury.address);
    await ico.deployed();
    const tokenAddress = await ico.tokenAddress();
    const spcToken = await ethers.getContractAt("SpaceCoin", tokenAddress);

    const LP = await ethers.getContractFactory("SpaceCoinLP");
    const lp = await LP.deploy(spcToken.address);
    await lp.deployed();

    const Router = await ethers.getContractFactory("SpaceRouter");
    const router = await Router.deploy(spcToken.address, lp.address);
    await router.deployed();

    //Put the stuff to move to phase3 and contrib ETH for SPC right here so we can have them in accounts for easy testing
    await ico.connect(owner).advancePhase();
    await ico.connect(owner).advancePhase();
    //await expect(ico.currentPhase()).to.equal(3);

    await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });

    //await expect (spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

    await ico.connect(bob).invest({ value: ethers.utils.parseEther("10") });
    //await expect(spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("50"));

    return { ico, spcToken, owner, treasury, alice, bob, lp, router };
  }

  describe("ICO Deployment", function () {
    it("Deploy ICO should set owner correctly", async function () {
      const { ico, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.owner()).to.equal(owner.address);
    });

    it("ICO contract spcToken balance should be 150_000 after deployment", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("150000"));
    }); 

    it("Treasury spcToken balance should be 350_000 after deployment", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("350000"));
    });     
  });
  describe("SPC Token", function () {
    it("Owner set correctly in spcToken ERC20 contract", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await spcToken.owner()).to.equal(owner.address);
    });    

    it("Total spcToken supply should be 500_000 after deployment", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await spcToken.totalSupply()).to.equal(ethers.utils.parseEther("500000"));
    }); 


    it("Token deployed with token transfer tax off", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await spcToken.transferTaxOn()).to.equal(false);
    });   

    it("Allows owner to turn on token transfer tax", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);
    });   

    it("Prevents non-owners from toggling token transfer tax", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      await expect(spcToken.connect(alice).enableTransferTax(true)).to.be.revertedWith("only owner can do that");

      expect(await spcToken.transferTaxOn()).to.equal(false);
    });   
    
    //untaxed transfer from treasury to alice
    it("untaxed transfer from treasury to alice", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(treasury).transfer(alice.address, ethers.utils.parseEther("1"))
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999"));
    });     

    it("taxed transfer from alice to bob", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(treasury).transfer(alice.address, ethers.utils.parseEther("1"))
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999"));
      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);
      await spcToken.connect(alice).transfer(bob.address, ethers.utils.parseEther("1"))
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.98"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999.02"));
    });         

    it("untaxed approve transferfrom flow", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(treasury).transfer(alice.address, ethers.utils.parseEther("1"))
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999"));

      await spcToken.connect(alice).approve(bob.address, ethers.utils.parseEther("1"));
      await spcToken.connect(bob).transferFrom(alice.address, bob.address, ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
    });     

    it("taxed approve transferfrom flow", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(treasury).transfer(alice.address, ethers.utils.parseEther("1"))
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999"));

      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);

      await spcToken.connect(alice).approve(bob.address, ethers.utils.parseEther("1"));
      await spcToken.connect(bob).transferFrom(alice.address, bob.address, ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.98"));
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("349999.02"));
    });   

    it("treasury address set correctly on deployment", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      expect (await spcToken.treasury()).to.equal(treasury.address);
    });
  
    /*
    it("owner can update treasury address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(owner).setTreasuryAddress(alice.address);
      expect (await spcToken.treasury()).to.equal(alice.address);
    });*/

    /*
    it("non-owner cannot update treasury address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await expect(spcToken.connect(alice).setTreasuryAddress(alice.address)).to.be.revertedWith("only owner can do that");
    });*/

  });
  describe("ICO", function () {
    it("ICO deployed not paused", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.isPaused()).to.equal(false);
    });  

    it("ICO owner can pause", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      await ico.connect(owner).pause(true);
      expect(await ico.isPaused()).to.equal(true);
    });  

    it("Event emitted on ICO owner pause", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.connect(owner).pause(true)).to.emit(ico, "Pause").withArgs(true);
    });  

    it("ICO non-owner cannot pause", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      await expect(ico.connect(alice).pause(true)).to.be.revertedWith("only owner can do that");
    });  

    it("ICO owner can pause and un-pause", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.isPaused()).to.equal(false);
      await ico.connect(owner).pause(true);
      expect(await ico.isPaused()).to.equal(true);
      await ico.connect(owner).pause(false);
      expect(await ico.isPaused()).to.equal(false);
    });  

    it("Event emitted on ICO owner un-pause", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.isPaused()).to.equal(false);
      await ico.connect(owner).pause(true);
      expect(await ico.isPaused()).to.equal(true);
      expect(await ico.connect(owner).pause(false)).to.emit(ico, "Pause").withArgs(false);
    });      

    describe("Phase 1: Seed", function () {
      it("ICO launches in seed (phase 1)", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
      });  
    
      it("Non-whitelist address cannot invest", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.be.revertedWith("cannot invest in seed phase, address not whitelisted")

      });  

      it("Owner can add address to whitelist", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);
      });  
      
      it("Owner can add multiple address to whitelist", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addManyToWhitelist([alice.address, bob.address]);
        expect (await ico.whitelist(alice.address)).to.equal(true);
        expect (await ico.whitelist(bob.address)).to.equal(true);
      });   
      
      it("Owner can remove address from whitelist after single add", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);
        await ico.connect(owner).removeFromWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(false);
      });  

      it("Owner can remove address to whitelist after multiple add", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addManyToWhitelist([alice.address, bob.address]);
        expect (await ico.whitelist(alice.address)).to.equal(true);
        expect (await ico.whitelist(bob.address)).to.equal(true);
        await ico.connect(owner).removeFromWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(false);
        expect (await ico.whitelist(bob.address)).to.equal(true);
      });             

      it("Whitelist address can invest", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

      });  

      it("Emit event on Whitelist address invest", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        expect (await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.emit(ico, "Investment").withArgs(alice.address, ethers.utils.parseEther("1"), 1);
      });  

      it("Investor cannot claim in phase 1", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await expect(ico.connect(alice).claimToken()).to.be.revertedWith("cannot claim tokens, not yet in open phase");
      });  

      it("Whitelist address cannot invest in phase 1 if paused", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(owner).pause(true);
        expect(await ico.isPaused()).to.equal(true);        

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.be.revertedWith("cannot invest, currently paused");
      });  

      it("One whitelisted account can invest 1500 ETH in one transaction", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1500") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1500"));
      });

      it("One whitelisted account can invest 1500 ETH in two transactions", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1000") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1000"));

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("500") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1500"));
      });

      it("One whitelisted account cannot invest more than 1500 ETH in one transaction", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1501") })).to.be.revertedWithCustomError;
      });

      it("One whitelisted account cannot invest more than 1500 ETH in two transactions", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1000") });

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1000") })).to.be.revertedWithCustomError;
      });

      it("Ten accounts each invest 1500 ETH, reaching maxTotalPrivateContrib", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        const signerAccounts = await ethers.getSigners();

        for(let j=5; j<15; j++) {
          await ico.connect(owner).addToWhitelist(signerAccounts[j].address);
          expect (await ico.whitelist(signerAccounts[j].address)).to.equal(true);
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("1500") });
          expect(await ico.totalClaimableContrib(signerAccounts[j].address)).to.equal(ethers.utils.parseEther("1500"));
        }
        
        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("15000"));
      });  

      it("Cannot exceed maxTotalPrivateContrib for seed phase at exactly max private limit", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        const signerAccounts = await ethers.getSigners();

        for(let j=5; j<15; j++) {
          await ico.connect(owner).addToWhitelist(signerAccounts[j].address);
          expect (await ico.whitelist(signerAccounts[j].address)).to.equal(true);
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("1500") });
          expect(await ico.totalClaimableContrib(signerAccounts[j].address)).to.equal(ethers.utils.parseEther("1500"));
        }
        
        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("15000"));

        await ico.connect(owner).addToWhitelist(signerAccounts[15].address);
        await expect(ico.connect(signerAccounts[15]).invest({ value: ethers.utils.parseEther("1500") })).to.be.revertedWith("investment exceeds max total private investment for this phase");
      });  

      it("Cannot exceed maxTotalPrivateContrib for seed phase at less than max private limit", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        const signerAccounts = await ethers.getSigners();

        for(let j=5; j<14; j++) {
          await ico.connect(owner).addToWhitelist(signerAccounts[j].address);
          expect (await ico.whitelist(signerAccounts[j].address)).to.equal(true);
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("1500") });
          expect(await ico.totalClaimableContrib(signerAccounts[j].address)).to.equal(ethers.utils.parseEther("1500"));
        }
        
        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("13500"));

        await ico.connect(owner).addToWhitelist(signerAccounts[14].address);
        await ico.connect(signerAccounts[14]).invest({ value: ethers.utils.parseEther("1000") });

        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("14500"));

        await ico.connect(owner).addToWhitelist(signerAccounts[15].address);
        await expect(ico.connect(signerAccounts[15]).invest({ value: ethers.utils.parseEther("1000") })).to.be.revertedWith("investment exceeds max total private investment for this phase");
      });
      
      //prevents token redemptions

    });

    describe("Phase 2: General", function () {
      it("Owner can advance to phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
      });  

      it("Event emitted on Owner advance to phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect (await ico.connect(owner).advancePhase()).to.emit(ico, "PhaseAdvance").withArgs(2);
      });  

      it("Investor can contribute in phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));
      });  

      it("Emit event on Investor contribute in phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        expect (await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.emit(ico, "Investment").withArgs(alice.address, ethers.utils.parseEther("1"), 2);
      });  

      it("Address cannot invest in phase 2 if paused", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(owner).pause(true);

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.be.revertedWith("cannot invest, currently paused");
      });


      it("Investor cannot claim in phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await expect(ico.connect(alice).claimToken()).to.be.revertedWith("cannot claim tokens, not yet in open phase");
      });  

      //non-whitelisted investor can invest in phase2
      it("non-whitelisted investor can invest in phase2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).addToWhitelist(bob.address);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));
      });  

      //whitelisted investor can invest in phase2
      it("whitelisted investor can invest in phase2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).addToWhitelist(alice.address);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));
      });  

      it("New Investor can contribute 1000 ETH in phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1000") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1000"));
      });        

      it("New Investor cannot contribute over 1000 ETH in phase 2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1001") })).to.be.revertedWithCustomError;
      });        

      it("New Investor cannot contribute over 1000 ETH in two transactions2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("600") })
        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("600") })).to.be.revertedWithCustomError;
      });        
      
      //1500 eth p1 investor cannot invest in p2

      //1000 eth p1 investor cannot invest in p2

      //500 eth p1 investor can invest 500 eth in p2

      //500 eth p1 investor cannot invest 1000 eth in p2

      //30 investors can each invest 1000 ETH in phase2
      it("30 investors can each invest 1000 ETH in phase2", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        const signerAccounts = await ethers.getSigners();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        for(let j=5; j<35; j++) {
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("1000") });
          expect(await ico.totalClaimableContrib(signerAccounts[j].address)).to.equal(ethers.utils.parseEther("1000"));
        }
        
        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("30000"));
      });  

      //30 investors can each invest 1000 ETH in phase2-- but 31st investor is denied
      it("30 investors can each invest 1000 ETH in phase2-- but 31st investor is denied", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        const signerAccounts = await ethers.getSigners();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        for(let j=5; j<35; j++) {
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("1000") });
          expect(await ico.totalClaimableContrib(signerAccounts[j].address)).to.equal(ethers.utils.parseEther("1000"));
        }
        
        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("30000"));

        await expect(ico.connect(signerAccounts[15]).invest({ value: ethers.utils.parseEther("1000") })).to.be.revertedWith("investment exceeds max total private investment for this phase");
      });  
      //10 investors can each invest 1500 ETH in phase1 and 15 investors can each invest 1000 eth in phase2
    });

    describe("Phase 3: Open", function () {
      it("Owner can advance to phase 3", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);
      });  

      it("Emit event on Owner advance to phase 3", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        expect (await ico.connect(owner).advancePhase()).to.emit(ico, "PhaseAdvance").withArgs(3);
      });  

      it("Owner cannot advance past phase 3", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);
        await expect(ico.connect(owner).advancePhase()).to.be.revertedWith("cannot advance past open phase");
      });  

      it("Investor can invest in phase 3 and receives proper number SPC tokens", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      });  

      it("Emit event on invest in phase 3", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        expect (await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.emit(ico, "Investment").withArgs(alice.address, ethers.utils.parseEther("1"), 3);
      });  



      it("Address cannot invest in phase 3 if paused", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
        
        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);
        await ico.connect(owner).pause(true);

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.be.revertedWith("cannot invest, currently paused");
      });
      
      //investor can buy every single SPC token
      it("investors can buy every single SPC token", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
        const signerAccounts = await ethers.getSigners();

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        for (let j=11; j<16; j++) {
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("6000") });
        }
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("0"));
      });  

      it("investors can buy every single SPC token--but not more", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
        const signerAccounts = await ethers.getSigners();

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        for (let j=11; j<16; j++) {
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("6000") });
        }
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("0"));

        await expect(ico.connect(alice).invest({ value: ethers.utils.parseEther("1") })).to.be.reverted;
      });  

      //investors cannot buy every single SPC token if previous round investors have claims
      it("investors cannot buy every single SPC token if previous round investors have claims", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
        const signerAccounts = await ethers.getSigners();

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        //alice buys 1000 ETH of SPC (claimable) in Phase2:
        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1000") });

        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("1000"));

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        for (let j=11; j<15; j++) {
          await ico.connect(signerAccounts[j]).invest({ value: ethers.utils.parseEther("6000") });
        }

        expect(await ico.totalPrivateContrib()).to.equal(ethers.utils.parseEther("25000"));

        //we have 30k SPC left in ICO contract. 5k of that belongs to alice. make sure we can't steal from alice's claim.
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("30000"));

        await expect(ico.connect(signerAccounts[15]).invest({ value: ethers.utils.parseEther("6000") })).to.be.reverted;
      });  

      //investor can withdraw seed phase investment as SPC
      it("investor can claim seed phase investment as SPC", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(owner).addToWhitelist(alice.address);
        expect (await ico.whitelist(alice.address)).to.equal(true);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        await ico.connect(alice).claimToken();
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("0"));

        expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("149995"));
      });

      it("investor can claim general phase investment as SPC", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        await ico.connect(alice).claimToken();
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("0"));

        expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("149995"));
      });

      it("investor SPC claim should fail if already claimed", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        await ico.connect(alice).claimToken();
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("0"));

        expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
        expect(await spcToken.balanceOf(ico.address)).to.equal(ethers.utils.parseEther("149995"));

        await expect(ico.connect(alice).claimToken()).to.be.reverted;
      });

      it("Emit event on investor claim general phase investment as SPC", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("1"));

        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        expect (await ico.connect(alice).claimToken()).to.emit(ico, "TokensClaimed").withArgs(alice.address, ethers.utils.parseEther("5"));
      });

      it("tokens claim should revert if didn't invest in seed or general", async function () {
        const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);

        await ico.connect(owner).advancePhase();
        await ico.connect(owner).advancePhase();
        expect(await ico.currentPhase()).to.equal(3);

        await ico.connect(alice).invest({ value: ethers.utils.parseEther("1") });
        expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

        expect(await ico.totalClaimableContrib(alice.address)).to.equal(ethers.utils.parseEther("0"));
        await expect(ico.connect(alice).claimToken()).to.be.revertedWith("no SPC tokens to claim from seed or general phase investments");
      });

      //investor can withdraw general phase investment as SPC
    });
  });
  describe("LP Deployment", function () {
    it("Sanity checks for deployLP test fixture", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await ico.currentPhase()).to.equal(3);
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("50"));
    });
    /*
    it("Can deploy LP+token with expected address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await lp.tokenAddress()).to.equal(spcToken.address);
    });*/
    /*
    it("Can deploy Router with expected address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await router.tokenAddress()).to.equal(spcToken.address);
      expect(await router.lpTokenAddress()).to.equal(lp.address);
    });*/
    it("test the end-to-end process of raising funds via the ICO, withdrawing them to the treasury, and then depositing an even worth of ETH and SPC into your liquidity contract.", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await ico.currentPhase()).to.equal(3);
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("50"));

      expect(await ethers.provider.getBalance(treasury.address)).to.equal(ethers.utils.parseEther("10000"));    
      expect(await ethers.provider.getBalance(ico.address)).to.equal(ethers.utils.parseEther("11"));    

      await ico.connect(owner).withdraw(ethers.utils.parseEther("11"));
      
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(ethers.utils.parseEther("10011"));    
      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("350000"));

      //provide an even worth of ETH and SPC into liquidity contract: 10_000 ETH + 50_000 SPC
      await spcToken.connect(treasury).approve(router.address, ethers.utils.parseEther("50000"));
      await router.connect(treasury).addLiquidity(ethers.utils.parseEther("50000"), 0, 0, {value: ethers.utils.parseEther("10000")});

      expect(await spcToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("300000"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("50000"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10000"));    

      expect(await lp.quoteTokenForEth(ONE_ETHER)).to.equal(ethers.utils.parseEther("0.197996079677622384"));
      expect(await lp.idealQuote(ONE_ETHER, true)).to.equal(ethers.utils.parseEther("0.2"));
    });    
  });
  describe("Raw LP Function", function() {
    it("LP can seed the pool with raw mint", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //send 1 ETH
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});

      //send 5 SPC
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);

      await lp.connect(alice).mint(alice.address);

      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
    });
    it("LP seed pool with only SPC fails", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //send 5 SPC
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);

      await expect(lp.connect(alice).mint(alice.address)).to.be.revertedWith("must add SPC + ETH");
    });
    it("LP seed pool with only ETH fails", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //send 1 ETH
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});

      await expect(lp.connect(alice).mint(alice.address)).to.be.revertedWith("must add SPC + ETH");
    });
    it("LP can seed the pool at arbitrary amounts", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ethers.utils.parseEther("100")});
      await spcToken.connect(alice).transfer(lp.address, ethers.utils.parseEther("0.01"));

      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
    });
    it("Second LP can add liquidity to the pool with raw mint", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("10"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("2"));
    });    
    // switch the order of LP adds.. do the numbers still work? 
    it("Second LP can add liquidity to the pool with raw mint (swap amounts added to confirm)", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("10"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ONE_ETHER);

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0.5"));
    });    
    it("second LP gets some LP tokens if ratio is off (more ETH than needed)", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("2"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.4"));
    }); 
    it("second LP gets some LP tokens if ratio is off (more ETH than needed)-- and available pool ratio is unchanged!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);

      const ratio1 = await lp.idealQuote(ONE_ETHER, true);

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("2"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.4"));

      const ratio2 = await lp.idealQuote(ONE_ETHER, true);
      expect (ratio1).to.equal(ratio2);
    }); 
    it("second LP gets some LP tokens if ratio is off (more SPC than needed)", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("0.1")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("1"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.1"));
    }); 
    it("second LP gets some LP tokens if ratio is off (more SPC than needed)-- and available pool ratio is unchanged!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);
      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);

      const ratio1 = await lp.idealQuote(ONE_ETHER, true);

      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("0.1")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("1"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.1"));
      const ratio2 = await lp.idealQuote(ONE_ETHER, true);
      expect (ratio1).to.equal(ratio2);
    }); 
    it("LP can seed the pool with raw mint, then completely remove with raw burn", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);

      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
      expect(await spcToken.balanceOf(alice.address)).to.equal(0);

      await lp.connect(alice).transfer(lp.address, ONE_ETHER);
      await lp.connect(alice).burn(alice.address);

      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(0);
    });
    it("LP can seed the pool with raw mint, then partially remove with raw burn", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);

      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
      expect(await spcToken.balanceOf(alice.address)).to.equal(0);

      await lp.connect(alice).transfer(lp.address, ethers.utils.parseEther("0.5"));
      await lp.connect(alice).burn(alice.address);

      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("2.5"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("2.5"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("0.5"));
    });
    it("LP can seed the pool with raw mint, then remove with raw burn.. after 2nd LP has added a different amount", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);

      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
      expect(await spcToken.balanceOf(alice.address)).to.equal(0);

      //Now Bob adds liquidity
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("10"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("2"));

      await lp.connect(alice).transfer(lp.address, ONE_ETHER);
      await lp.connect(alice).burn(alice.address);

      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("10"));
    });
    it("Both LPs can add to pool then remove completely with raw burn", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await spcToken.connect(alice).transfer(lp.address, FIVE_ETHER);
      await lp.connect(alice).mint(alice.address);

      expect(await lp.balanceOf(alice.address)).to.equal(ONE_ETHER);
      expect(await spcToken.balanceOf(alice.address)).to.equal(0);

      //Now Bob adds liquidity
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("2")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("10"));
      await lp.connect(bob).mint(bob.address);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("2"));

      //alice removes liquidity
      await lp.connect(alice).transfer(lp.address, ONE_ETHER);
      await lp.connect(alice).burn(alice.address);

      expect(await spcToken.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("10"));

      //bob removes liquidity
      await lp.connect(bob).transfer(lp.address, ethers.utils.parseEther("2"));
      await lp.connect(bob).burn(bob.address);

      expect(await spcToken.balanceOf(lp.address)).to.equal(0);
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("0"));

      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("50"));
    });
  });
  describe("Liquidity Through Router", function () {
    it("LP can seed empty pool through router add liquidity", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("50"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));
    });
    it("LP can seed empty pool through router, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await expect (router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")})).to.emit(lp, "Mint").withArgs(bob.address, ethers.utils.parseEther("10"), ethers.utils.parseEther("50"));
    });
    it("Secondary LP can seed pool through router, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("5"));
      await expect (router.connect(alice).addLiquidity(ethers.utils.parseEther("5"), 0, 0, {value: ethers.utils.parseEther("1")})).to.emit(lp, "Mint").withArgs(alice.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("5"));
    });
    it("LP can burn LP tokens through router, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      await lp.connect(bob).approve(router.address, ONE_ETHER);
      await expect (router.connect(bob).removeLiquidity(ONE_ETHER)).to.emit(lp, "Burn").withArgs(bob.address, ethers.utils.parseEther("10"), ethers.utils.parseEther("50"));
    });

    it("LP can seed empty pool and fully remove LP tokens", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("50"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));

      await lp.connect(bob).approve(router.address, ONE_ETHER);
      await router.connect(bob).removeLiquidity(ONE_ETHER);

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("50"));
    });
    it("LP can seed empty pool and partially remove LP tokens", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("50"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));

      await lp.connect(bob).approve(router.address, ethers.utils.parseEther("0.5"));
      await router.connect(bob).removeLiquidity(ethers.utils.parseEther("0.5"));

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0.5"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("25"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("25"));
    });
    it("LP seed pool-- test ideal quote functions", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      
      //ideal quote: TRUE = eth for given spc, FALSE = spc for given eth
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));
    });
    it("LP seed pool-- test price quote functions", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      
      //One SPC = a little less than 0.2 ether
      expect (await lp.quoteTokenForEth(ONE_ETHER)).to.equal("194155716807217102");

      //One Eth = a little less than 5 ether
      expect (await lp.quoteEthForToken(ONE_ETHER)).to.equal("4504094631483166516");
    });
    it("Multiple LPs can add liquidity to pool -- ideal quote should remain constant, price impact should improve", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));
      //expect (await lp.quoteTokenForEth(ONE_ETHER)).to.equal("194155716807217102");
      expect (await lp.quoteEthForToken(ONE_ETHER)).to.equal("4504094631483166516");

      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("5"));
      await router.connect(alice).addLiquidity(ethers.utils.parseEther("5"), 0, 0, {value: ethers.utils.parseEther("1")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));

      const totalsupply = await lp.totalSupply();
      //console.log(totalsupply);
      const ethTotal = await lp.ethTotal();
      //console.log(ethTotal);
      const spcTotal = await lp.spcTotal();
      //console.log(spcTotal);
      
      //should be about ~10% better quote since have 10% more liquidity in pool :) (well not quite, but it's a better quote)
      expect (await lp.quoteTokenForEth(ONE_ETHER)).to.equal("194499017681728881");
      expect (await lp.quoteEthForToken(ONE_ETHER)).to.equal("4541284403669724771"); 

      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("55"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));

      expect(await lp.balanceOf(bob.address)).to.equal(ONE_ETHER);
      expect(await lp.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0.1"));
    });
    //multiple LP's can add and remove from Pool
    it("LP can seed empty pool through router and add + remove liquidity-- with transfer tax on", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //turn tax on 
      await spcToken.connect(owner).enableTransferTax(true);
      expect (await spcToken.transferTaxOn()).to.equal(true);

      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"), ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
      //it actually works with 0% slippage 

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("49"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("49"));
      expect(await lp.ethTotal()).to.equal(ethers.utils.parseEther("10"));

      //now let's withdraw our LP token
      await lp.connect(bob).approve(router.address, ONE_ETHER);
      await router.connect(bob).removeLiquidity(ONE_ETHER);
      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await spcToken.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("48.02"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("0"));
      expect(await lp.ethTotal()).to.equal(ethers.utils.parseEther("0"));
    });
    it("Secondary LP can add liquidity with transfer tax on", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //turn tax on 
      await spcToken.connect(owner).enableTransferTax(true);
      expect (await spcToken.transferTaxOn()).to.equal(true);

      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"), ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
      //it actually works with 0% slippage 

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("49"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("49"));
      expect(await lp.ethTotal()).to.equal(ethers.utils.parseEther("10"));

      //this is the amount ETH we need to perfectly pair with 5 SPC
      const ratio = await lp.idealQuote(ONE_ETHER, true);
      //console.log(ratio);

      //Now alice adds-- this should be weird since ratio is not quite as expected with transfer tax on! 
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("10"));
      //Add at 0% slippage will fail since some SPC will be lost in transfer! 
      await expect(router.connect(alice).addLiquidity(ONE_ETHER, ONE_ETHER, ratio, {value: ratio})).to.be.revertedWith("SpaceRouter: INSUFFICIENT_ETH_AMOUNT");
      //should go through with 2% slippage
      await router.connect(alice).addLiquidity(ONE_ETHER, (ONE_ETHER).mul(98).div(100), ratio.mul(98).div(100), {value: ratio});


      //Must be 100% correct
  //    expect(await ethers.provider.getBalance(lp.address)).to.equal(await lp.ethTotal());
      expect((await lp.ethTotal()).sub(await ethers.provider.getBalance(lp.address))).to.equal("0");
      expect((await lp.spcTotal()).sub(await spcToken.balanceOf(lp.address))).to.equal("0");

      //okay so now that this is slightly wonky--- what if both LP's try to withdraw 100%. will it break????
      const aliceLPtokens = await lp.balanceOf(alice.address);
      await lp.connect(alice).approve(router.address, ONE_ETHER);
      await router.connect(alice).removeLiquidity(aliceLPtokens);

      const bobLPtokens = await lp.balanceOf(bob.address);
      await lp.connect(bob).approve(router.address, bobLPtokens);
      await router.connect(bob).removeLiquidity(bobLPtokens);

    });
    it("Multiple LPs can add liquidity to pool -- confirm second LP can add less than the first and get LP tokens", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));

      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("5"));
      await router.connect(alice).addLiquidity(ethers.utils.parseEther("5"), 0, 0, {value: ethers.utils.parseEther("1")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));

      const totalsupply = await lp.totalSupply();
      //console.log(totalsupply);
      const ethTotal = await lp.ethTotal();
      //console.log(ethTotal);
      const spcTotal = await lp.spcTotal();
      //console.log(spcTotal);
      
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("55"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));

      expect(await lp.balanceOf(bob.address)).to.equal(ONE_ETHER);
      expect(await lp.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0.1"));
    });
    it("Multiple LPs can add liquidity to pool -- confirm second LP can add FAR less than the first and get LP tokens", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});
      
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));

      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("0.0005"));
      await router.connect(alice).addLiquidity(ethers.utils.parseEther("0.0005"), 0, 0, {value: ethers.utils.parseEther("0.0001")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));
      expect (await lp.idealQuote(ethers.utils.parseEther("1"), false)).to.equal(ethers.utils.parseEther("5"));

      const totalsupply = await lp.totalSupply();
      //console.log(totalsupply);
      const ethTotal = await lp.ethTotal();
      //console.log(ethTotal);
      const spcTotal = await lp.spcTotal();
      //console.log(spcTotal);
      
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("50.0005"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10.0001"));

      expect(await lp.balanceOf(bob.address)).to.equal(ONE_ETHER);
      expect(await lp.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0.00001"));
    });
    it("Two LP's can add and remove liquidity with transfer tax on", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //turn tax on 
      await spcToken.connect(owner).enableTransferTax(true);
      expect (await spcToken.transferTaxOn()).to.equal(true);

      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"), ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
      //it actually works with 0% slippage 

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("49"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("49"));
      expect(await lp.ethTotal()).to.equal(ethers.utils.parseEther("10"));

      //this is the amount ETH we need to perfectly pair with 5 SPC
      const ratio = await lp.idealQuote(ONE_ETHER, true);
      //console.log(ratio);

      //Now alice adds-- this should be weird since ratio is not quite as expected with transfer tax on! 
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("10"));
      //Add at 0% slippage will fail since some SPC will be lost in transfer! 
      await expect(router.connect(alice).addLiquidity(ONE_ETHER, ONE_ETHER, ratio, {value: ratio})).to.be.revertedWith("SpaceRouter: INSUFFICIENT_ETH_AMOUNT");
      //should go through with 2% slippage
      await router.connect(alice).addLiquidity(ONE_ETHER, (ONE_ETHER).mul(98).div(100), ratio.mul(98).div(100), {value: ratio});


      //Must be 100% correct
  //    expect(await ethers.provider.getBalance(lp.address)).to.equal(await lp.ethTotal());
      expect((await lp.ethTotal()).sub(await ethers.provider.getBalance(lp.address))).to.equal("0");
      expect((await lp.spcTotal()).sub(await spcToken.balanceOf(lp.address))).to.equal("0");

      //okay so now that this is slightly wonky--- what if both LP's try to withdraw 100%. will it break????
      const aliceLPtokens = await lp.balanceOf(alice.address);
      await lp.connect(alice).approve(router.address, ONE_ETHER);
      await router.connect(alice).removeLiquidity(aliceLPtokens);

      const bobLPtokens = await lp.balanceOf(bob.address);
      await lp.connect(bob).approve(router.address, bobLPtokens);
      await router.connect(bob).removeLiquidity(bobLPtokens);

      expect(await ethers.provider.getBalance(lp.address)).to.equal(0);
      expect(await spcToken.balanceOf(lp.address)).to.equal(0);
    });
    it("Second LP add liquidity with bad ratio (too much ETH) with transfer tax on", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      //turn tax on 
      await spcToken.connect(owner).enableTransferTax(true);
      expect (await spcToken.transferTaxOn()).to.equal(true);

      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"), ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
      //it actually works with 0% slippage-- is this a bug? mikeaz TODO

      expect(await lp.balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1"));
      expect(await spcToken.balanceOf(lp.address)).to.equal(ethers.utils.parseEther("49"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("49"));
      expect(await lp.ethTotal()).to.equal(ethers.utils.parseEther("10"));

      //this is the amount ETH we need to perfectly pair with 5 SPC
      const ratio = await lp.idealQuote(ONE_ETHER, true);
      //console.log(ratio);

      //Now alice adds at funny and allows 100% slippage
      //ideal ratio = 4.9 SPC to 1 ETH
      //alice adds: 1 SPC + 1 ETH (way too much ETH!)
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("10"));
      await router.connect(alice).addLiquidity(ONE_ETHER, 0, 0, {value: ONE_ETHER});

      //so with NO transfer tax, expect to add 1 SPC and "ratio" ETH
      //WITH transfer tax, expect.. 0.98 SPC and ratio*0.98 ETH? 
      const transferTax = ONE_ETHER.mul(2).div(100);
      const spcSent = ONE_ETHER.sub(transferTax);
      expect(await ethers.provider.getBalance(router.address)).to.equal(ethers.utils.parseEther("0"));
      expect(await lp.spcTotal()).to.equal(ethers.utils.parseEther("49").add(spcSent));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10").add((ratio).mul(98).div(100).add(1)));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10.2"));
      expect(await lp.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("0.02"));
    });
  });
  describe("Liquidity and Swaps Through Router", function () {
    it("LP seeds. Alice makes a few swaps moving the price one direction", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log(quote1);
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);
      const quote2 = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log(quote2);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote2);
      const quote3 = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log(quote3);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote3);
      //check the spot price
      expect (quote2).to.be.lessThan(quote1);
      expect (quote3).to.be.lessThan(quote2);
    });
    it("LP seeds. Alice swaps, moving SPC price down. second LP tx w/ 0% slippage fails", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.192271456533191821"));

      //alice tries to add liquidity (1SPC:0.2ETH) at old price of 0.2ETH and 0% slippage
      //this should revert!!
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("1"));
      await expect(router.connect(alice).addLiquidity(ethers.utils.parseEther("1"), ONE_ETHER, ethers.utils.parseEther("0.2"), 
      {value: ethers.utils.parseEther("0.2")})).to.be.revertedWith("SpaceRouter: INSUFFICIENT_ETH_AMOUNT");
    });
    it("LP seeds. Alice swaps, moving SPC price down. Second LP provider tx w/ 5% slippage succeeds", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);

      const lpEthBalance = await ethers.provider.getBalance(lp.address);
      const lpSpcBalance = await spcToken.balanceOf(lp.address);

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.192271456533191821"));

      //alice tries to add liquidity (1SPC:0.2ETH) at old price of 0.2ETH and 5% slippage
      //this should succeed! But not take all of Alice's submitted liquidity
      //what will happen??
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("1"));
      await router.connect(alice).addLiquidity(ethers.utils.parseEther("1"), ethers.utils.parseEther("0.95"), ethers.utils.parseEther("0.19"), 
      {value: ethers.utils.parseEther("0.2")});
      //Since SPC price has gone DOWN, we expect to use ALL SPC and some ETH.. in ratio of ideal quote

      expect(await ethers.provider.getBalance(lp.address)).to.equal(await lp.ethTotal());
      expect(await spcToken.balanceOf(lp.address)).to.equal(await lp.spcTotal());
    });
    it("LP seeds. Alice swaps, moving SPC price up. second LP tx w/ 0% slippage fails", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("50"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("50"), 0, 0, {value: ethers.utils.parseEther("10")});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.2"));

      const quote1 = await lp.quoteEthForToken(ONE_ETHER);
    //await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      await router.connect(alice).swapExactEthForToken(quote1, {value: ONE_ETHER});

      expect (await lp.idealQuote(ethers.utils.parseEther("1"), true)).to.equal(ethers.utils.parseEther("0.24178"));

      //alice tries to add liquidity (1SPC:0.2ETH) at old price of 0.2ETH and 0% slippage
      //this should revert!!
      await spcToken.connect(alice).approve(router.address, ethers.utils.parseEther("1"));
      await expect(router.connect(alice).addLiquidity(ethers.utils.parseEther("1"), ONE_ETHER, ethers.utils.parseEther("0.2"), 
      {value: ethers.utils.parseEther("0.2")})).to.be.revertedWith("SpaceRouter: INSUFFICIENT_SPC_AMOUNT");
    });
    it("Bob LP seeds. Alice swaps SPC to ETH and back. New balances in LP should reflect fee paid by swap!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("10"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("10"), 0, 0, {value: ethers.utils.parseEther("2")});

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      //quote1 = amount of ETH received for ONE SPC
     // console.log(quote1);
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);

      //check LP's balances after transfer :>
      const lpEth1 = await ethers.provider.getBalance(lp.address);
      //console.log("LP ETH: %s", lpEth1);
      const lpSpc1 = await spcToken.balanceOf(lp.address);
      //console.log("LP SPC: %s", lpSpc1);

      const amtToSwapBack = quote1.mul(100).div(99);
      const quote2 = await lp.quoteEthForToken(amtToSwapBack);
      await router.connect(alice).swapExactEthForToken(quote2, {value: amtToSwapBack});

      const lpEth2 = await ethers.provider.getBalance(lp.address);
      //console.log("LP ETH: %s", lpEth2);
  const      lpSpc2 = await spcToken.balanceOf(lp.address);
      //console.log("LP SPC: %s", lpSpc2);

      expect(lpEth2).to.be.greaterThan(ethers.utils.parseEther("2"));
      expect(lpSpc2).to.be.greaterThan(ethers.utils.parseEther("10"));

    });
    it("Bob LP seeds. Alice swaps SPC to ETH and back. If alice swaps SPC to ETH again, the rate should be /sliiightly/ better due to greater liquidity in pool from fees", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("10"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("10"), 0, 0, {value: ethers.utils.parseEther("2")});

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      //quote1 = amount of ETH received for ONE SPC
      //console.log(quote1);
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);

      //check LP's balances after transfer :>
      const lpEth1 = await ethers.provider.getBalance(lp.address);
      //console.log("LP ETH: %s", lpEth1);
      const lpSpc1 = await spcToken.balanceOf(lp.address);
      //console.log("LP SPC: %s", lpSpc1);

      const amtToSwapBack = quote1.mul(100).div(99);
      const quote2 = await lp.quoteEthForToken(amtToSwapBack);
      await router.connect(alice).swapExactEthForToken(quote2, {value: amtToSwapBack});

      const lpEth2 = await ethers.provider.getBalance(lp.address);
      //console.log("LP ETH: %s", lpEth2);
  const      lpSpc2 = await spcToken.balanceOf(lp.address);
      //console.log("LP SPC: %s", lpSpc2);

      expect(lpEth2).to.be.greaterThan(ethers.utils.parseEther("2"));
      expect(lpSpc2).to.be.greaterThan(ethers.utils.parseEther("10"));

      const quote3 = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log(quote3);
      expect(quote3).to.be.greaterThan(quote1);

    });
    it("Bob LP seeds. Alice swaps SPC to ETH, then back. LP Bob removes. New balances from Bob should reflect fees paid by swaps!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("10"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("10"), 0, 0, {value: ethers.utils.parseEther("2")});

      const quote1 = await lp.quoteTokenForEth(ONE_ETHER);
      //quote1 = amount of ETH received for ONE SPC
      //console.log(quote1);
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote1);

      //quote2 = amount of SPC received for... quote1 of ETH
      const amtToSwapBack = quote1.mul(100).div(99);
      const quote2 = await lp.quoteEthForToken(amtToSwapBack);
      //console.log(quote2);
      await router.connect(alice).swapExactEthForToken(quote2, {value: amtToSwapBack});

      //check bob's balances before burning
      const bobEth1 = await ethers.provider.getBalance(bob.address);
      //console.log("bobEth1: %s", bobEth1);
      const bobSpc1 = await spcToken.balanceOf(bob.address);
      //console.log("bobSpc1: %s", bobSpc1);

      //bob burns
      await lp.connect(bob).approve(router.address, ONE_ETHER);
      const burnTx = await router.connect(bob).removeLiquidity(ONE_ETHER);
      const receipt = await burnTx.wait();
      ////console.log(burnTx);
      const gasUsed = receipt.gasUsed;
      //console.log("gasUsed: %s", gasUsed);

      //check bob's balances after burning
      const bobEth2 = await ethers.provider.getBalance(bob.address);
      //console.log("bobEth2: %s", bobEth2);
      const bobSpc2 = await spcToken.balanceOf(bob.address);
      //console.log("bobSpc2: %s", bobSpc2);

      //console.log("bobEthDiff: %s", bobEth2.sub(bobEth1));
      //console.log("bobSpcDiff: %s", bobSpc2.sub(bobSpc1));

      expect(bobSpc2.sub(bobSpc1)).to.be.greaterThan(ethers.utils.parseEther("10"));
      expect(bobEth2.sub(bobEth1)).to.be.greaterThan(ethers.utils.parseEther("2"));
    });
    it("Bob LP seeds. Alice swaps ETH to SPC, then back. LP Bob removes. New balances from Bob should reflect fees paid by swaps!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);
      
      await spcToken.connect(bob).approve(router.address, ethers.utils.parseEther("10"));
      await router.connect(bob).addLiquidity(ethers.utils.parseEther("10"), 0, 0, {value: ethers.utils.parseEther("2")});

      const quote1 = await lp.quoteEthForToken(ONE_ETHER);
      //quote1 = amount of SPC received for ONE ETH
      //console.log(quote1);
      await router.connect(alice).swapExactEthForToken(quote1, {value: ONE_ETHER});

      
      //quote2 = amount of ETH received for... quote1 of SPC
      const amtToSwapBack = quote1.mul(100).div(99);

      const quote2 = await lp.quoteTokenForEth(amtToSwapBack);
      //console.log(quote2);
      await spcToken.connect(alice).approve(router.address, amtToSwapBack);
      await router.connect(alice).swapExactTokenForEth(amtToSwapBack, quote2);
      
      //check bob's balances before burning
      const bobEth1 = await ethers.provider.getBalance(bob.address);
      //console.log("bobEth1: %s", bobEth1);
      const bobSpc1 = await spcToken.balanceOf(bob.address);
      //console.log("bobSpc1: %s", bobSpc1);

      //bob burns
      await lp.connect(bob).approve(router.address, ONE_ETHER);
      const burnTx = await router.connect(bob).removeLiquidity(ONE_ETHER);
      const receipt = await burnTx.wait();
      ////console.log(burnTx);
      const gasUsed = receipt.gasUsed;
      //console.log("gasUsed: %s", gasUsed);

      //check bob's balances after burning
      const bobEth2 = await ethers.provider.getBalance(bob.address);
      //console.log("bobEth2: %s", bobEth2);
      const bobSpc2 = await spcToken.balanceOf(bob.address);
      //console.log("bobSpc2: %s", bobSpc2);

      //console.log("bobEthDiff: %s", bobEth2.sub(bobEth1));
      //console.log("bobSpcDiff: %s", bobSpc2.sub(bobSpc1));

      expect(bobSpc2.sub(bobSpc1)).to.be.greaterThan(ethers.utils.parseEther("10"));
      expect(bobEth2.sub(bobEth1)).to.be.greaterThan(ethers.utils.parseEther("2"));
    });
  });
  describe("LP Swap Functionality", function () {
    it("Raw swap SPC for ETH", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      const quote = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log(quote);

      //Alice sends 1 SPC to swap out for ETH
      await spcToken.connect(alice).transfer(lp.address, ONE_ETHER);
      await lp.connect(alice).swapTokenForEth(alice.address);

      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("51"));
      //TODO: write expect statem
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10").sub(quote));
    });
    it("Raw swap ETH for SPC -- confirm Quote function working", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //CHECK QUOTE
      const quote = await lp.quoteEthForToken(ONE_ETHER);
      //console.log("Quote: %s", quote);

      //Alice sends 1 ETH to swap out for SPC
      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      await lp.connect(alice).swapEthForToken(alice.address);

      //check pool balances
      //console.log(await lp.ethTotal());
      //console.log(await lp.spcTotal());

      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("50").sub(quote));
      //TODO: write expect statem
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));
    });
    it("Swap SPC for ETH through router", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //CHECK QUOTE
      const quote = await lp.quoteTokenForEth(FIVE_ETHER);
      //console.log("Quote: %s", quote);

      //ideal quote for funsies
      const idealQuote = await lp.idealQuote(FIVE_ETHER, true);
      //console.log("Ideal quote: %s", idealQuote);

      //Alice sends 5 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      //tell the router to swap
      await router.connect(alice).swapExactTokenForEth(FIVE_ETHER, quote);

      //check pool balances
      //console.log(await lp.ethTotal());
      //console.log(await lp.spcTotal());
      //TODO: write expect statem

      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("55"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10").sub(quote));
    });
    it("Swap SPC for ETH through router, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      const quote = await lp.quoteTokenForEth(FIVE_ETHER);

      //give the router approval
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      //tell the router to swap
      await expect (router.connect(alice).swapExactTokenForEth(FIVE_ETHER, quote)).to.emit(lp, "SwapSPC").withArgs(alice.address, FIVE_ETHER, quote);
    });
    it("Swap SPC for ETH through router, no slippage beyond expected", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //CHECK QUOTE
      const quote = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log("Quote: %s", quote);

      //Alice sends 1 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      //tell the router to swap
      await router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote);

      //check pool balances
      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("51"));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10").sub(quote));

      //This should fail if we try to swap again with same quote since balances have changed!
      const newQuote = await lp.quoteTokenForEth(ONE_ETHER);
      //console.log("newQuote: %s", newQuote);
      expect (newQuote).to.be.lessThan(quote);

      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await expect(router.connect(alice).swapExactTokenForEth(ONE_ETHER, quote)).to.be.revertedWith("SpaceRouter: INSUFFICIENT_OUTPUT_AMOUNT");
    });
    it("Swap SPC for ETH through router-- with transfer tax on!", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //turn tax on 
      await spcToken.connect(owner).enableTransferTax(true);
      expect (await spcToken.transferTaxOn()).to.equal(true);

      //CHECK QUOTE
      const quote = await lp.quoteTokenForEth(FIVE_ETHER);
      //console.log("Quote: %s", quote);

      //ideal quote for funsies
      const idealQuote = await lp.idealQuote(FIVE_ETHER, true);
      //console.log("Ideal quote: %s", idealQuote);

      //Alice sends 5 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, FIVE_ETHER);
      //tell the router to swap
      await expect(router.connect(alice).swapExactTokenForEth(FIVE_ETHER, quote)).to.be.revertedWith("SpaceRouter: INSUFFICIENT_OUTPUT_AMOUNT");

      const quote98 = quote.mul(98).div(100);

      await router.connect(alice).swapExactTokenForEth(FIVE_ETHER, quote98);

      //check pool balances
      //console.log(await lp.ethTotal());
      //console.log(await lp.spcTotal());

      //4.9/5 SPC make it to the pool
      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("54.9"));
      //this isn't actually the same number because the input is already taxed and is on a curve..
//      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("10").sub(quote98));
      expect ((ethers.utils.parseEther("10").sub(quote98)).sub(await ethers.provider.getBalance(lp.address))).to.be.lessThan(ethers.utils.parseEther("0.0016"));
    });
    it("Swap ETH for SPC through router", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //CHECK QUOTE
      const quote = await lp.quoteEthForToken(ONE_ETHER);
      //console.log("Quote: %s", quote);

      //Alice sends 1 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      //tell the router to swap
      await router.connect(alice).swapExactEthForToken(quote, {value: ONE_ETHER});

      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("50").sub(quote));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));
    });
    it("Swap ETH for SPC through router, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      const quote = await lp.quoteEthForToken(ONE_ETHER);

      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await expect (router.connect(alice).swapExactEthForToken(quote, {value: ONE_ETHER})).to.emit(lp, "SwapETH").withArgs(alice.address, ONE_ETHER, quote);
    });
    it("Swap ETH for SPC through router with transfer tax on", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //set transfer tax 
      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);

      //CHECK QUOTE
      const quote = await lp.quoteEthForToken(ONE_ETHER);
      //console.log("Quote: %s", quote);
      //mikeaz: quote is not aware of spc transfer tax. is this okay?? 

      const aliceSpc1 = await spcToken.balanceOf(alice.address);

      //Alice sends 1 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      //tell the router to swap
      await router.connect(alice).swapExactEthForToken(quote.mul(98).div(100).sub(1), {value: ONE_ETHER});

      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("50").sub(quote));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));

      const aliceSpc2 = await spcToken.balanceOf(alice.address);
      expect(aliceSpc2.sub(aliceSpc1)).to.equal(quote.mul(98).div(100).add(1));
    });
    it("Swap ETH for SPC through router with transfer tax on, amount SPC return value matches actual account balance change", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //set transfer tax 
      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);

      await alice.sendTransaction({to: lp.address, value: ONE_ETHER});
      const returnValue = await lp.connect(alice).callStatic.swapEthForToken(alice.address);

      const aliceSpc1 = await spcToken.balanceOf(alice.address);
      await lp.connect(alice).swapEthForToken(alice.address);
      const aliceSpc2 = await spcToken.balanceOf(alice.address);

      expect (aliceSpc2.sub(aliceSpc1)).to.equal(returnValue);
    });
    it("Swap ETH for SPC through router with transfer tax on, emits event", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //set transfer tax 
      await spcToken.connect(owner).enableTransferTax(true);
      expect(await spcToken.transferTaxOn()).to.equal(true);

      const quote = await lp.quoteEthForToken(ONE_ETHER);
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await expect(router.connect(alice).swapExactEthForToken(quote.mul(98).div(100).sub(1), {value: ONE_ETHER})).to.emit(lp, "SwapETH").withArgs(alice.address, ONE_ETHER, quote.mul(98).div(100).add(1));

    });
    it("Swap ETH for SPC through router, no slippage beyond expected", async function () {
      const { ico, spcToken, owner, treasury, alice, bob, lp, router } = await loadFixture(deployLP);

      //Bob seeds LP with 10 ETH and 50 SPC
      await bob.sendTransaction({to: lp.address, value: ethers.utils.parseEther("10")});
      await spcToken.connect(bob).transfer(lp.address, ethers.utils.parseEther("50"));
      await lp.connect(bob).mint(bob.address);

      //CHECK QUOTE
      const quote = await lp.quoteEthForToken(ONE_ETHER);
      //console.log("Quote: %s", quote);

      //Alice sends 1 SPC to swap out for ETH
      //give the router approval
      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      //tell the router to swap
      await router.connect(alice).swapExactEthForToken(quote, {value: ONE_ETHER});

      //check pool balances
      expect (await lp.spcTotal()).to.equal(ethers.utils.parseEther("50").sub(quote));
      expect(await ethers.provider.getBalance(lp.address)).to.equal(ethers.utils.parseEther("11"));

      //This should fail if we try to swap again with same quote since balances have changed!
      const newQuote = await lp.quoteEthForToken(ONE_ETHER);
      //console.log("newQuote: %s", newQuote);
      expect (newQuote).to.be.lessThan(quote);

      await spcToken.connect(alice).approve(router.address, ONE_ETHER);
      await expect(router.connect(alice).swapExactEthForToken(quote, {value: ONE_ETHER})).to.be.revertedWith("SpaceRouter: INSUFFICIENT_OUTPUT_AMOUNT");
    });
  });
});
