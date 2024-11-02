const ethers = require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('hardhat-artifactor');
require('hardhat-tracer');
require('hardhat-docgen');

const config = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: 'USD',
    L1: "polygon",
    L1Etherscan: "SU6QUX66NX4DQWYHDF57VGR4W18RM9EXSH",    // Etherscan api key
    coinmarketcap: "54841dfe-418a-48c5-99ec-82110a274cf8",  // Coinmarketcap api key
    //L2: "optimism",
    currencyDisplayPrecision: 6,
    L2Etherscan: "B16MEM4Z8WPJV1PKE71UWANYZXR7WW9SBU",
    outputFile: "gas-report.txt",
    rst: true,
  },
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
  },
  mocha: {
    timeout: 40000
  }
}

module.exports = config;
