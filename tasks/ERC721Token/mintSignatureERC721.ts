import '@nomiclabs/hardhat-ethers';
import {Transaction} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import Web3 from 'web3';

task('mintSignatureERC721', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();

  console.log('Account:', accounts[0].address);
  console.log('Account balance:', await accounts[0].getBalance());

  const erc721 = await hre.ethers.getContract('ERC721ReqCreator');
  console.log('ERC721 address:', erc721.address);
  const user = new hre.ethers.Wallet(process.env.ADMIN_PRIVATE_KEY !== undefined ? process.env.ADMIN_PRIVATE_KEY : '');

  //frontend
  const types = ['address', 'string', 'uint96', 'address', 'uint256', 'uint256', 'address', 'address'];
  const values = [
    user.address, //wallet
    'some uri', //uri
    100, //feeNumerator
    user.address, //royaltyReceiver
    11113, //random number
    80001, //chainId
    user.address, //from
    erc721.address, //to
  ];

  const hash = hre.ethers.utils.solidityKeccak256(types, values);
  console.log('hash', hash);

  //put private key here
  const signer = new hre.ethers.Wallet(
    process.env.BACKEND_VALIDATOR_KEY !== undefined ? process.env.BACKEND_VALIDATOR_KEY : ''
  );
  console.log('signer', signer.address);

  const signedData = await signer.signMessage(hre.ethers.utils.arrayify(hash));

  const provider = 'https://matic-testnet-archive-rpc.bwarelabs.com';
  const web3Provider = new Web3.providers.HttpProvider(provider);
  const web3 = new Web3(web3Provider);
  const web3Signer = web3.eth.accounts.privateKeyToAccount(
    process.env.BACKEND_VALIDATOR_KEY !== undefined ? process.env.BACKEND_VALIDATOR_KEY : ''
  );
  const data1 = web3.utils.encodePacked(
    {value: user.address, type: 'address'},
    {value: 'some uri', type: 'string'},
    {value: '100', type: 'uint96'},
    {value: user.address, type: 'address'},
    {value: '11113', type: 'uint256'},
    {value: '80001', type: 'uint256'},
    {value: user.address, type: 'address'},
    {value: erc721.address, type: 'address'}
  );
  const msgHash2 = web3.utils.keccak256(data1 || '');

  const sig2 = web3Signer.sign(msgHash2);
  console.log('sig2', sig2);
  const v = sig2.v;
  const r = sig2.r;
  const s = sig2.s;

  // front get request with vrs from backend here
  const iface = new hre.ethers.utils.Interface([
    'function safeMintSignature(address _requestor,string uri,uint96 _feeNumerator,address _creator,uint256 _salt,uint8 v,bytes32 r,bytes32 s)',
  ]);

  const data2 = iface.encodeFunctionData('safeMintSignature', [
    accounts[0].address,
    'some uri',
    100,
    accounts[0].address,
    11113,
    v,
    r,
    s,
  ]);

  const transactionParameters = {
    gasPrice: await hre.ethers.provider.getGasPrice(),
    gasLimit: '0x1FBD00',
    to: erc721.address, // Required except during contract publications.
    from: user.address, // must match user's active address.
    value: '0x00', // Only required to send ether to the recipient from the initiating external account.
    data: data2, // Optional, but used for defining smart contract creation and interaction.
    chainId: 80001, // Used to prevent transaction reuse across blockchains. Auto-filled by MetaMask.
    nonce: await hre.ethers.provider.getTransactionCount(user.address),
  };

  const signedTx = await user.signTransaction(transactionParameters);

  console.log('nonce', await hre.ethers.provider.getTransactionCount('0x6191942911ebb7FfAa5dD6108284cab57eb52546'));
  console.log('gas price', (await hre.ethers.provider.getGasPrice()).toString());
  const pending = await web3.eth.getPendingTransactions();
  console.log(pending);
});
