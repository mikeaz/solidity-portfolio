require('dotenv').config({
  path: `${__dirname}/.env`
})

// console.log(process.env) // remove this after you've confirmed it working

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";

// Go to https://www.alchemyapi.io, sign up, create
// a new App in its dashboard, and replace "KEY" with its key
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Replace this private key with your Goerli account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Beware: NEVER put real Ether into testing accounts
const GOERLI_PRIVATE_KEY = "YOUR GOERLI PRIVATE KEY";
const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  networks: {
    //goerli: {
    //  url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
    //  accounts: [GOERLI_PRIVATE_KEY]
    //},
    hardhat: {
      accounts: {
        count: 40
      },
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [process.env.RINKEBY_PRIVATE_KEY!]
    }
  },
  etherscan: {
    // your api key for etherscan
    apiKey: process.env.ETHERSCAN_API_KEY
  }  
};

export default config;
