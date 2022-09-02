import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// This was in crowdfundr.. do we need an equivalent for ico? 
//import { Project, ProjectFactory } from "../typechain-types";


describe("SpaceCoinICO", function () {
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

    return { ico, spcToken, owner, treasury, alice, bob };
  }

  describe("Deployment", function () {
    it("Deploy ICO should set owner correctly", async function () {
      const { ico, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.owner()).to.equal(owner.address);
    });

    /*
    it("Deploy ICO should set treasury correctly", async function () {
      const { ico, owner, treasury, alice, bob } = await loadFixture(deployICO);

      expect(await ico.treasury()).to.equal(treasury.address);
    });
    */

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
  
    it("owner can update treasury address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await spcToken.connect(owner).setTreasuryAddress(alice.address);
      expect (await spcToken.treasury()).to.equal(alice.address);
    });

    it("non-owner cannot update treasury address", async function () {
      const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(deployICO);
      await expect(spcToken.connect(alice).setTreasuryAddress(alice.address)).to.be.revertedWith("only owner can do that");
    });

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
});
