import {task} from 'hardhat/config';

task('getInfoERC721', 'To mint tokens to target')
  .addParam('tokenId', "The account's address")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    console.log('Account:', accounts[3].address);

    const erc721 = await hre.ethers.getContract('ERC721ReqCreator');
    console.log('ERC721 address:', erc721.address);

    const name = await erc721.name();
    const symbol = await erc721.symbol();
    const tokenURI = await erc721.connect(accounts[3]).tokenURI(taskArgs.tokenId);
    const ownerOf = await erc721.connect(accounts[3]).ownerOf(taskArgs.tokenId);
    const balanceOf = await erc721.connect(accounts[3]).balanceOf(accounts[0].address);
    const isApprovedForAll = await erc721.isApprovedForAll(accounts[2].address, accounts[0].address);
    const getApproved = await erc721.getApproved(taskArgs.tokenId);
    const royaltyInfo = await erc721.royaltyInfo(taskArgs.tokenId, 10000);

    console.log('----------------Start_-----------------');
    console.log('Name', name);
    console.log('---------------------------------------');
    console.log('Symbol', symbol);
    console.log('---------------------------------------');
    console.log('baseTokenURI', tokenURI);
    console.log('---------------------------------------');
    console.log('ownerOf', ownerOf);
    console.log('---------------------------------------');
    console.log('balanceOf', balanceOf);
    console.log('---------------------------------------');
    console.log('isApprovedForAll', isApprovedForAll);
    console.log('---------------------------------------');
    console.log('getApproved', getApproved);
    console.log('---------------------------------------');
    console.log('royaltyInfo', royaltyInfo);
    console.log('----------------End--------------------');
  });