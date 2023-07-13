import {expect} from './chai-setup';
import {BigNumber} from 'ethers';
import BalanceTree from './utils/Merkle-vesting/balance-tree';
import {ethers} from 'hardhat';
import {parseBalanceMap} from './utils/Merkle-vesting/parse-balance-map';
// import {ERC20Sample, Vesting} from '../typechain';
import {getCurrentTime} from './utils/helpers';
import {getCurrentTimestamp} from './utils';
import {parseEther} from 'ethers/lib/utils';
const overrides = {
  gasLimit: 9999999,
};

describe('ERC721Conduit tests', () => {
  let minter: any, owner: any, users: any;
  let erc20Sample: any;
  let vesting: any;
  let feePercent: number, conduit: any, reqResToken: any, feeNumerator: number, erc20Amount: BigNumber;
  beforeEach('deploy erc20Sample', async () => {
    [minter, owner, ...users] = await ethers.getSigners();
    const erc20SampleFactory = await ethers.getContractFactory('ERC20Sample');
    const reqResFactory = await ethers.getContractFactory('ERC721ReqCreator');
    const conduitFactory = await ethers.getContractFactory('ConduitERC721');
    feePercent = 1000;
    feeNumerator = 500;
    reqResToken = await reqResFactory.deploy(users[0].address, users[1].address, ['polygon'], owner.address);
    await reqResToken.connect(owner).safeMint(users[2].address, 'zero', feeNumerator, users[3].address);
    await reqResToken.connect(owner).safeMint(users[2].address, 'zero', feeNumerator, users[3].address);

    erc20Sample = await erc20SampleFactory.deploy();
    erc20Amount = parseEther('100');

    await erc20Sample.setBalance(users[0].address, erc20Amount);
    await erc20Sample.setBalance(users[1].address, erc20Amount);

    conduit = await conduitFactory.connect(owner).deploy(feePercent);
    await conduit.connect(owner).updateAcceptedTokenList(erc20Sample.address, 1);
    console.log(conduit.address);
  });

  describe('#makeOffer', () => {
    it('Successful offer', async () => {
      const currentTime = await getCurrentTimestamp();
      const deadline = currentTime + 10000;
      const tokenId = 0;
      await erc20Sample.connect(users[0]).approve(conduit.address, erc20Amount);
      await expect(
        conduit.connect(users[0]).makeOffer(reqResToken.address, tokenId, erc20Sample.address, erc20Amount, deadline)
      )
        .to.emit(conduit, 'OfferMade')
        .withArgs(reqResToken.address, tokenId, erc20Sample.address, erc20Amount, deadline);
      console.log(await conduit.offers(users[0].address, 0));
    });

    it('Successful offer execution', async () => {
      const currentTime = await getCurrentTimestamp();
      const deadline = currentTime + 10000;
      const tokenId = 0;
      await erc20Sample.connect(users[0]).approve(conduit.address, erc20Amount);
      await conduit
        .connect(users[0])
        .makeOffer(reqResToken.address, tokenId, erc20Sample.address, erc20Amount, deadline);
      await reqResToken.connect(users[2]).approve(conduit.address, 0);
      await expect(conduit.connect(owner).executeOffer(users[0].address, users[2].address, 0))
        .to.emit(conduit, 'OfferExecuted')
        .withArgs(users[0].address, 0);
      await expect(conduit.connect(owner).executeOffer(users[0].address, users[2].address, 0)).to.be.revertedWith(
        'Offer already executed'
      );
      const balanceOfUser0 = await erc20Sample.balanceOf(users[0].address);
      const balanceOfUser2 = await erc20Sample.balanceOf(users[2].address);
      const balanceOfUser3 = await erc20Sample.balanceOf(users[3].address);
      const balanceOfConduit = await erc20Sample.balanceOf(conduit.address);

      expect(balanceOfUser0.toString()).to.eq('0');
      expect(balanceOfUser2.toString()).to.eq('94000000000000000000');
      expect(balanceOfUser3.toString()).to.eq('5000000000000000000');
      expect(balanceOfConduit.toString()).to.eq('1000000000000000000');
      const offer = await conduit.offers(users[0].address, 0);

      expect(offer.executed).to.eq(true);
    });

    it('Offer execution reverted', async () => {
      const currentTime = await getCurrentTimestamp();
      const deadline = currentTime + 10000;
      const tokenId = 0;
      await erc20Sample.connect(users[0]).approve(conduit.address, erc20Amount);
      await conduit
        .connect(users[0])
        .makeOffer(reqResToken.address, tokenId, erc20Sample.address, erc20Amount, deadline);
      await reqResToken.connect(users[2]).approve(conduit.address, 0);
      await ethers.provider.send('evm_setNextBlockTimestamp', [currentTime + 10001]);
      await ethers.provider.send('evm_mine', []);
      await expect(conduit.connect(owner).executeOffer(users[0].address, users[2].address, 0)).to.be.revertedWith(
        'Offer expired'
      );
    });
  });
});
