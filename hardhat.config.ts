import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-deploy-tenderly';
import {node_url, accounts, addForkConfiguration} from './utils/network';
import './tasks/index';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
  },
  namedAccounts: {
    admin: 0,
    distributionCreator: 1,
    validator: 2,
    user: 3,
    EgoTokenDeployer: 4,
    ReqCreatorDeployer: 5,
    bridgeMaster: 6,
  },
  networks: addForkConfiguration({
    hardhat: {
      live: true,
      chainId: 56,
      initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
    },
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
    },
    staging: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
    },
    production: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    arbitrum_one: {
      url: node_url('arbitrum_one'),
      accounts: accounts('arbitrum_one'),
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
    },
    goerli: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
    },
    mumbai: {
      url: node_url('mumbai'),
      accounts: accounts('mumbai'),
    },
    bsc_testnet: {
      url: node_url('bsc_testnet'),
      accounts: accounts('bsc_testnet'),
    },
    bsc_mainnet: {
      url: node_url('bsc_mainnet'),
      accounts: accounts('bsc_mainnet'),
    },
    polygon: {
      url: node_url('polygon'),
      accounts: accounts('polygon'),
    },
    moonbase: {
      url: node_url('moonbase'),
      accounts: accounts('moonbase'),
    },
    moonbeam: {
      url: node_url('moonbeam'),
      accounts: accounts('moonbeam'),
    },
    avalanche: {
      url: node_url('avalanche'),
      accounts: accounts('avalanche'),
    },
    aurora_testnet: {
      url: node_url('aurora_testnet'),
      accounts: accounts('aurora_testnet'),
    },
    aurora_mainnet: {
      url: node_url('aurora_mainnet'),
      accounts: accounts('aurora_mainnet'),
    },
  }),
  paths: {
    sources: 'src',
    tests: './test',
  },
  gasReporter: {
    currency: 'USD',
    token: 'BNB',
    gasPrice: 6,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 1000000,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.MAINNET_API_KEY !== undefined ? process.env.MAINNET_API_KEY : '',
      bsc: process.env.BSC_API_KEY !== undefined ? process.env.BSC_API_KEY : '',
      bscTestnet: process.env.BSC_API_KEY !== undefined ? process.env.BSC_API_KEY : '',
      polygonMumbai: process.env.MUMBAI_API_KEY !== undefined ? process.env.MUMBAI_API_KEY : '',
      polygon: process.env.MUMBAI_API_KEY !== undefined ? process.env.MUMBAI_API_KEY : '',
      moonbaseAlpha: process.env.MOONBASE_API_KEY !== undefined ? process.env.MOONBASE_API_KEY : '',
      auroraTestnet: process.env.AURORA_TESTNET_API_KEY !== undefined ? process.env.AURORA_TESTNET_API_KEY : '',
      moonbeam: process.env.MOONBEAM_API_KEY !== undefined ? process.env.MOONBEAM_API_KEY : '',
      arbitrumOne: process.env.ARBITRUM_API_KEY !== undefined ? process.env.ARBITRUM_API_KEY : '',
      avalanche: process.env.AVALANCHE_API_KEY !== undefined ? process.env.AVALANCHE_API_KEY : '',
    },
  },
  external: process.env.HARDHAT_FORK
    ? {
        deployments: {
          // process.env.HARDHAT_FORK will specify the network that the fork is made from.
          // these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
          hardhat: ['deployments/' + process.env.HARDHAT_FORK],
          localhost: ['deployments/' + process.env.HARDHAT_FORK],
        },
      }
    : undefined,
  tenderly: {
    project: 'template-ethereum-contracts',
    username: process.env.TENDERLY_USERNAME as string,
  },
};

export default config;
