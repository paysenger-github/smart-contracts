import {expect} from 'chai';
import {BigNumber, Contract, ContractFactory, Signer, utils} from 'ethers';
import {parseEther, parseUnits} from 'ethers/lib/utils';
import {ethers} from 'hardhat';
import {hexConcat} from '@ethersproject/bytes';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {evmRestoreSnap, evmTakeSnap} from './utils/helpers';
import {getCurrentTimestamp} from './utils';

interface UserInfo {
  amountStake: BigNumber;
  missedReward: BigNumber;
  availableReward: BigNumber;
}

describe('Staking', function () {
  describe('Staking', () => {
    let Staking: ContractFactory;
    let staking: Contract;
    let ERC20: ContractFactory;
    let token: Contract;
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

      ERC20 = await ethers.getContractFactory('EgoToken');
      Staking = await ethers.getContractFactory('Staking');
      console.log('asd');

      token = await ERC20.connect(owner).deploy(
        'EgoToken',
        'EGO',
        owner.address, //we do not use gateway axelar here
        owner.address, //we do not use gateway axelar here
        owner.address,
        owner.address,
        [owner.address, owner.address],
        [1, 2]
      );

      staking = await Staking.connect(owner).deploy(
        token.address,
        token.address,
        rewardPerEpoch,
        epochDuration,
        rewardDistributionPeriod,
        lockPeriod
      );

      await token.connect(owner).transfer(staking.address, rewardPerEpoch.mul(5));
      await token.connect(owner).approve(staking.address, await token.connect(owner).balanceOf(owner.address));

      for (let i = 0; i < users.length; i++) {
        await token.connect(owner).transfer(users[i].address, amountOfUser);
        await token.connect(users[i]).approve(staking.address, amountOfUser);
      }
    });

    beforeEach(async () => {
      snapId = await evmTakeSnap();
    });

    afterEach(async () => {
      await evmRestoreSnap(snapId);
    });

    it('1.1) Deploy', async function () {
      await token.deployed();
      await staking.deployed();
      for (let i = 0; i < users.length; i++) {
        const balance = await token.balanceOf(users[i].address);
        const allowance = await token.allowance(users[i].address, staking.address);
        expect(allowance.toString()).to.eq(amountOfUser.toString());
        expect(balance.toString()).to.eq(amountOfUser.toString());
      }
      const balanceOfStaking = await token.balanceOf(staking.address);
      expect(balanceOfStaking.toString()).to.eq(rewardPerEpoch.mul(5).toString());
    });

    it('2) One user stake: Deposit and await until epoch ends', async function () {
      await staking.connect(users[0]).stake(amountOfUser);
      await ethers.provider.send('evm_increaseTime', [epochDuration]);
      await ethers.provider.send('evm_mine', []);
      const userInfo = await staking.getAccount(users[0].address);
      logUser(userInfo);
      expect(userInfo.amountStake.toString()).to.eq(amountOfUser.toString());
      expect((await staking.totalAmountStake()).toString()).to.eq(amountOfUser.toString());
    });

    it('3) Two users stake: first user stake from start, second user start stake after half of epoch', async function () {
      await staking.connect(users[0]).stake(amountOfUser);
      await ethers.provider.send('evm_increaseTime', [epochDuration / 2]);
      await ethers.provider.send('evm_mine', []);
      await staking.connect(users[1]).stake(amountOfUser);
      const userInfo = await staking.getAccount(users[0].address);
      await ethers.provider.send('evm_increaseTime', [epochDuration / 2]);
      await ethers.provider.send('evm_mine', []);

      const user = await staking.getAccount(users[0].address);
      logUser(user);
      expect(userInfo.amountStake.toString()).to.eq(amountOfUser.toString()); //   await staking.connect(owner).setParametres(parseUnits('100', 18), 3600, 3600);
      expect((await staking.totalAmountStake()).toString()).to.eq(amountOfUser.mul(2).toString());
    });

    it('4) User claim after epoch: user stake and wait until epoch ends and claim', async function () {
      await staking.connect(users[0]).stake(amountOfUser);
      await ethers.provider.send('evm_increaseTime', [epochDuration + 2]);
      await ethers.provider.send('evm_mine', []);
      // expect(balanceOfStaking.toString()).to.eq(rewardPerEpoch.toString());
      const userInitBalance = await token.balanceOf(users[0].address);
      const initUserInfo = await staking.getAccount(users[0].address);
      const availableReward = await staking.availableReward(users[0].address);
      logUser(initUserInfo);
      const time = await getCurrentTimestamp();
      console.log('time', time);

      await staking.connect(users[0]).claim();

      const userFinalBalance = await token.balanceOf(users[0].address);
      expect(userFinalBalance.sub(availableReward).toString()).to.eq(userInitBalance.toString());
      const finalUserInfo = await staking.getAccount(users[0].address);

      logUser(finalUserInfo);
      expect(finalUserInfo.amountStake.toString()).to.eq(amountOfUser.toString());
      expect((await staking.totalAmountStake()).toString()).to.eq(amountOfUser.toString());
    });

    it('4) User stake two times: user start stake and add stake after period of time', async function () {
      await staking.connect(owner).stake(amountOfUser.div(2));
      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);

      await staking.connect(users[0]).stake(amountOfUser.div(2));
      const initUserInfo = await staking.getAccount(users[0].address);
      console.log('init');
      logUser(initUserInfo);
      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);
      console.log('available reward1', (await staking.availableReward(users[0].address)).toString());

      await staking.connect(users[0]).stake(amountOfUser.div(2));

      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);
      const finalUserInfo1 = await staking.getAccount(users[0].address);
      console.log('final');
      logUser(finalUserInfo1);
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());
      console.log('available reward owner', (await staking.availableReward(owner.address)).toString());
    });

    it('4) User stake two times: user start stake and add stake after period of time and unstake', async function () {
      await staking.connect(owner).stake(amountOfUser.div(2));
      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);

      await staking.connect(users[0]).stake(amountOfUser.div(2));
      const initUserInfo = await staking.getAccount(users[0].address);

      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);
      console.log('available reward1', (await staking.availableReward(users[0].address)).toString());

      await staking.connect(users[0]).stake(amountOfUser.div(2));

      await ethers.provider.send('evm_increaseTime', [(2 * epochDuration) / 3]);
      await ethers.provider.send('evm_mine', []);

      console.log('init');
      logUser(initUserInfo);
      console.log('init balance', (await token.balanceOf(users[0].address)).toString());
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());

      await staking.connect(users[0]).unstake(amountOfUser);

      await staking.connect(users[0]).claim();
      console.log('final balance', (await token.balanceOf(users[0].address)).toString());

      const finalUserInfo1 = await staking.getAccount(users[0].address);
      console.log('final');
      logUser(finalUserInfo1);
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());
      await token.connect(users[0]).approve(staking.address, amountOfUser);
      await staking.connect(users[0]).stake(amountOfUser.div(2));
      await ethers.provider.send('evm_increaseTime', [epochDuration]);
      await ethers.provider.send('evm_mine', []);
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());
      console.log('available reward owner', (await staking.availableReward(owner.address)).toString());
      await staking.connect(owner).unstake(amountOfUser.div(2).sub(1));

      const finalUserInfo2 = await staking.getAccount(owner.address);
      console.log('owner final');
      logUser(finalUserInfo2);
      console.log('available reward owner', (await staking.availableReward(owner.address)).toString());
    });

    it('4) User stake two times: user start stake and add stake after period of time and unstake', async function () {
      await staking.connect(owner).stake(amountOfUser.div(2));
      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);

      await staking.connect(users[0]).stake(amountOfUser.div(2));
      const initUserInfo = await staking.getAccount(users[0].address);

      await ethers.provider.send('evm_increaseTime', [epochDuration / 3]);
      await ethers.provider.send('evm_mine', []);
      console.log('available reward1', (await staking.availableReward(users[0].address)).toString());

      await staking.connect(users[0]).stake(amountOfUser.div(2));

      await ethers.provider.send('evm_increaseTime', [(2 * epochDuration) / 3]);
      await ethers.provider.send('evm_mine', []);

      console.log('init');
      logUser(initUserInfo);
      console.log('init balance', (await token.balanceOf(users[0].address)).toString());
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());

      await staking.connect(users[0]).unstake(amountOfUser);

      await staking.connect(users[0]).claim();
      console.log('final balance', (await token.balanceOf(users[0].address)).toString());

      const finalUserInfo1 = await staking.getAccount(users[0].address);
      console.log('final');
      logUser(finalUserInfo1);
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());
      await token.connect(users[0]).approve(staking.address, amountOfUser);
      await staking.connect(users[0]).stake(amountOfUser.div(2));
      await ethers.provider.send('evm_increaseTime', [epochDuration]);
      await ethers.provider.send('evm_mine', []);
      console.log('available reward user', (await staking.availableReward(users[0].address)).toString());
      console.log('available reward owner', (await staking.availableReward(owner.address)).toString());
      await staking.connect(owner).unstake(amountOfUser.div(2).sub(1));

      const finalUserInfo2 = await staking.getAccount(owner.address);
      console.log('owner final');
      logUser(finalUserInfo2);
      console.log('available reward owner', (await staking.availableReward(owner.address)).toString());

      console.log('init owner balance', await token.balanceOf(owner.address));
      await ethers.provider.send('evm_increaseTime', [70]);
      await ethers.provider.send('evm_mine', []);
      await staking.connect(owner).claim();
      await staking.connect(owner).claim();
      await staking.connect(owner).claim();
      await staking.connect(owner).claim();
      await staking.connect(owner).claim();
      console.log('final owner balance', await token.balanceOf(owner.address));
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
