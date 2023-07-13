import {expect} from './chai-setup';
import {BigNumber} from 'ethers';
import BalanceTree from './utils/Merkle-vesting/balance-tree';
import {ethers} from 'hardhat';
import {parseBalanceMap} from './utils/Merkle-vesting/parse-balance-map';
// import {ERC20Sample, Vesting} from '../typechain';
import {getCurrentTime} from './utils/helpers';
import {getCurrentTimestamp} from './utils';
import {parseEther} from 'ethers/lib/utils';
import {Vesting} from '../typechain';
const overrides = {
  gasLimit: 9999999,
};

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('Merklevesting', () => {
  let minter: any, owner: any, users: any;
  let erc20Sample: any;
  let vesting: any;

  beforeEach('deploy erc20Sample', async () => {
    [minter, owner, ...users] = await ethers.getSigners();
    const erc20SampleFactory = await ethers.getContractFactory('ERC20Sample');
    const vestingFactory = await ethers.getContractFactory('Vesting');
    erc20Sample = await erc20SampleFactory.deploy();

    let merkleRoot: any,
      vestingPercentage: BigNumber,
      totalAmountOfVesting: BigNumber,
      vestingStartTime: number,
      vestingEndTime: number;

    const currentTime = await getCurrentTimestamp();
    vestingPercentage = BigNumber.from(30);
    totalAmountOfVesting = BigNumber.from(201);
    vestingStartTime = currentTime + 10000;
    vestingEndTime = vestingStartTime + 30000;
    vesting = await vestingFactory.deploy(
      erc20Sample.address,
      ZERO_BYTES32,
      vestingPercentage,
      totalAmountOfVesting,
      vestingStartTime,
      vestingEndTime
    );
  });

  describe('#erc20Sample', () => {
    it('returns the erc20Sample address', async () => {
      expect(await vesting.token()).to.eq(erc20Sample.address);
    });
  });

  describe('#merkleRoot', () => {
    it('returns the zero merkle root', async () => {
      expect(await vesting.merkleRoot()).to.eq(ZERO_BYTES32);
    });
  });

  describe('#claim', () => {
    it('fails for empty proof', async () => {
      await ethers.provider.send('evm_setNextBlockTimestamp', [(await vesting.vestingStartTime()).toNumber()]);
      await ethers.provider.send('evm_mine', []);

      await expect(vesting.claim(10, [])).to.be.revertedWith('MerkleDistributor: Invalid proof.');
    });

    describe('two account tree', () => {
      let vesting: any;
      let tree: BalanceTree;
      let firstUserAvailableAmount: BigNumber,
        secondUserAvailableAmount: BigNumber,
        vestingPercentage: BigNumber,
        totalAmountOfVesting: number,
        vestingStartTime: number,
        vestingEndTime: number;

      beforeEach('deploy', async () => {
        const vestingFactory = await ethers.getContractFactory('Vesting');
        const currentTime = await getCurrentTimestamp();
        vestingPercentage = BigNumber.from(30);
        totalAmountOfVesting = 201;
        vestingStartTime = currentTime + 10000;
        vestingEndTime = vestingStartTime + 30000;
        firstUserAvailableAmount = parseEther('10');
        secondUserAvailableAmount = BigNumber.from(101);

        vesting = await vestingFactory.deploy(
          erc20Sample.address,
          ZERO_BYTES32,
          vestingPercentage,
          totalAmountOfVesting,
          vestingStartTime,
          vestingEndTime
        );
        await erc20Sample.setBalance(vesting.address, parseEther('1000'));

        tree = new BalanceTree([
          {account: '0x6aea0b8F18b355676D56EE878d0aFA74f759f221', amount: parseEther('10')},
          {account: '0x23933736D49A5b415Be1C49E45f23062028b1a3E', amount: parseEther('10')},
          {account: '0xEafeD2a025ff825D1B3461914F0151ce7F480E17', amount: parseEther('10')},
          {account: users[0].address, amount: parseEther('10')},
          {account: users[1].address, amount: parseEther('100')},
          {account: users[2].address, amount: parseEther('12')},
          {account: users[3].address, amount: parseEther('14')},
        ]);

        console.log('root', tree.getHexRoot());
        console.log('proof and', tree.getProof(0, '0x6aea0b8F18b355676D56EE878d0aFA74f759f221', parseEther('10')));
        console.log('proof evg', tree.getProof(0, '0x23933736D49A5b415Be1C49E45f23062028b1a3E', parseEther('10')));

        vesting = await vestingFactory.deploy(
          erc20Sample.address,
          tree.getHexRoot(),
          vestingPercentage,
          totalAmountOfVesting,
          vestingStartTime,
          vestingEndTime
        );

        await erc20Sample.setBalance(vesting.address, parseEther('1000'));
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingStartTime]);
        await ethers.provider.send('evm_mine', []);
      });

      it('successful claim', async () => {
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);

        await expect(vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides))
          .to.emit(vesting, 'Claimed')
          .withArgs(users[0].address, firstUserAvailableAmount.mul(30).div(100));

        const isStartAmountClaimed = await vesting.isStartAmountClaimed(users[0].address);

        expect(isStartAmountClaimed).to.eq(true);

        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingStartTime + 1200]);
        await ethers.provider.send('evm_mine', []);

        const initBalance = await erc20Sample.balanceOf(users[0].address);
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);
        const finalBalance = await erc20Sample.balanceOf(users[0].address);
        const calculatedAmountClaimed = firstUserAvailableAmount
          .mul(70)
          .div(100)
          .div(BigNumber.from((vestingEndTime - vestingStartTime) / 1200));
        expect(finalBalance.sub(initBalance)).to.be.eq(calculatedAmountClaimed);
        console.log('initBalance', initBalance.toString());
        console.log('finalBalance', finalBalance.toString());
      });

      it('successful first claim after vesting ends', async () => {
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);

        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingEndTime]);
        await ethers.provider.send('evm_mine', []);
        const initBalance = await erc20Sample.balanceOf(users[0].address);
        await expect(vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides))
          .to.emit(vesting, 'Claimed')
          .withArgs(users[0].address, firstUserAvailableAmount);

        const isStartAmountClaimed = await vesting.isStartAmountClaimed(users[0].address);

        expect(isStartAmountClaimed).to.eq(true);

        const finalBalance = await erc20Sample.balanceOf(users[0].address);
        expect(finalBalance.sub(initBalance)).to.be.eq(firstUserAvailableAmount);
        console.log('initBalance', initBalance.toString());
        console.log('finalBalance', finalBalance.toString());
      });

      it('Claim part of tokens in the middle of vesting and after vesting', async () => {
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingStartTime + 1]);
        await ethers.provider.send('evm_mine', []);
        const amountAvailableToClaim1 = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amount available to cliam', amountAvailableToClaim1.toString());
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);
        await ethers.provider.send('evm_setNextBlockTimestamp', [
          vestingStartTime + (vestingEndTime - vestingStartTime) / 3,
        ]);
        await ethers.provider.send('evm_mine', []);

        const amountAvailableToClaim = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amount available to cliam', amountAvailableToClaim.toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);

        console.log('amountCLimed1', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingEndTime + 10000]);
        await ethers.provider.send('evm_mine', []);

        const amountAvailableToClaim2 = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amonut available to cliam', amountAvailableToClaim2.toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);
        console.log('amountCLimed2', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());
        console.log('user balance', (await erc20Sample.balanceOf(users[0].address)).toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);
        console.log('amountCLimed3', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());
        expect(await erc20Sample.balanceOf(users[0].address)).to.eq(firstUserAvailableAmount);
      });

      it('Claim three times before vesting end time', async () => {
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingStartTime + 1]);
        await ethers.provider.send('evm_mine', []);
        const amountAvailableToClaim1 = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amount available to cliam', amountAvailableToClaim1.toString());
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);
        await ethers.provider.send('evm_setNextBlockTimestamp', [
          vestingStartTime + (vestingEndTime - vestingStartTime) / 3,
        ]);
        await ethers.provider.send('evm_mine', []);

        const amountAvailableToClaim = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amount available to cliam', amountAvailableToClaim.toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);

        console.log('amountCLimed1', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());

        const amountAvailableToClaim2 = await vesting.getAmountAvailableToClaim(
          users[0].address,
          firstUserAvailableAmount
        );

        console.log('amonut available to cliam', amountAvailableToClaim2.toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);
        console.log('amountCLimed2', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());
        console.log('user balance', (await erc20Sample.balanceOf(users[0].address)).toString());
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);
        console.log('amountCLimed3', (await vesting.userAddressToAmountClaimed(users[0].address)).toString());
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingEndTime + 10000]);
        await ethers.provider.send('evm_mine', []);
        await vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides);

        expect(await erc20Sample.balanceOf(users[0].address)).to.eq(firstUserAvailableAmount);
      });

      it('must have enough to transfer', async () => {
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);
        await erc20Sample.setBalance(vesting.address, 99);
        await ethers.provider.send('evm_setNextBlockTimestamp', [vestingEndTime]);
        await ethers.provider.send('evm_mine', []);
        await expect(vesting.connect(users[0]).claim(firstUserAvailableAmount, proof0, overrides)).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance'
        );
      });

      it('cannot claim more than proof', async () => {
        const proof0 = tree.getProof(0, users[0].address, firstUserAvailableAmount);
        await expect(vesting.connect(users[0]).claim(101, proof0, overrides)).to.be.revertedWith(
          'MerkleDistributor: Invalid proof.'
        );
      });
    });
  });
});
