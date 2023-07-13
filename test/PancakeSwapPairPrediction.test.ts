import {expect} from 'chai';
import {BigNumber, Contract, ContractFactory, Signer, utils} from 'ethers';
import {parseEther, parseUnits} from 'ethers/lib/utils';
import {hexConcat} from '@ethersproject/bytes';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {evmRestoreSnap, evmTakeSnap} from './utils/helpers';
import {getCurrentTimestamp} from './utils';
import {ethers, network} from 'hardhat';

interface UserInfo {
  amountStake: BigNumber;
  missedReward: BigNumber;
  availableReward: BigNumber;
}

describe('PairPrediction', function () {
  describe('PairPrediction', () => {
    let Staking: ContractFactory;
    let staking: Contract;
    let ERC20: ContractFactory;
    let token: Contract;
    let egoTokenTest: Contract;
    let egoToken: Contract;
    let usdt: Contract;
    let pancakeSwapFactory: Contract;
    let owner: SignerWithAddress;
    let users: SignerWithAddress[];

    const rewardPerEpoch = parseEther('10000');
    const epochDuration = 3600 * 24 * 10;
    const rewardDistributionPeriod = 60;
    const amountOfUser = parseEther('100');
    const lockPeriod = epochDuration;
    let snapId: any;

    before(async () => {
      [owner, ...users] = await ethers.getSigners();
      egoToken = await ethers.getContractAt('EgoToken', '0x44a21B3577924DCD2e9C81A3347D204C36a55466');
      egoTokenTest = await ethers.getContractAt('EgoToken', '0xD4bB89eE124B85155E68bf8130e8955e811c62aF');
      usdt = await ethers.getContractAt('EgoToken', '0x55d398326f99059fF775485246999027B3197955');
      pancakeSwapFactory = await ethers.getContractAt(
        'IPancakeV3Factory',
        '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'
      );
    });

    beforeEach(async () => {
      snapId = await evmTakeSnap();
    });

    afterEach(async () => {
      await evmRestoreSnap(snapId);
    });

    it('1.1) Deploy', async function () {
      await network.provider.request({
        method: 'hardhat_reset',
        params: [
          {
            forking: {
              jsonRpcUrl: 'https://bsc-dataseed.binance.org',
              blockNumber: 29720201,
            },
          },
        ],
      });

      const check = await pancakeSwapFactory.owner();
      console.log('checlk', check);

      const pair = await pancakeSwapFactory.createPool(egoToken.address, usdt.address, 2500);
      console.log(pair);
      console.log('createdPool address', (await pair.wait()).events[0].args.pool);
    });
  });
});

function logUser(user: UserInfo) {
  let k: keyof UserInfo;
  for (k in user) {
    if (k.length != 1) {
      console.log(k, user[k].toString());
    }
  }
}
