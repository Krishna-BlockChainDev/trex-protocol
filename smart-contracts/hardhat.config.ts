import 'dotenv/config';
import '@xyrusworx/hardhat-solidity-json';
import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import '@nomiclabs/hardhat-solhint';
import '@primitivefi/hardhat-dodoc';
import '@nomiclabs/hardhat-etherscan';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545';
const ETHERSCAN_API_KEY_SEPOLIA = process.env.ETHERSCAN_API_KEY_SEPOLIA ?? '';
const ETHERSCAN_API_KEY_BSC = process.env.ETHERSCAN_API_KEY_BSC ?? '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: true,
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      chainId: 97,
      accounts: DEPLOYER_PRIVATE_KEY ? [`0x${DEPLOYER_PRIVATE_KEY}`] : [],
    },
  },
  dodoc: {
    runOnCompile: false,
    debugMode: true,
    outputDir: './docgen',
    freshOutput: true,
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY_SEPOLIA,
      bscTestnet: ETHERSCAN_API_KEY_BSC,
    },
  },
};

export default config;
