import '@nomiclabs/hardhat-ethers';
import {BigNumber, utils} from 'ethers';
import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import * as path from 'path';
import * as fs from 'fs';
import {parse} from 'csv-parse';

type ClaimData = {
  Txhash: string;
  Blockno: string;
  UnixTimestamp: string;
  DateTime: string;
  From: string;
  To: string;
  ContractAddress: string;
  'Value_IN(DEV)': string;
  'Value_OUT(DEV)': string;
  'CurrentValue @ $0/DEV': string;
  'TxnFee(DEV)': string;
  'TxnFee(USD)': string;
  'Historical $Price/DEV': string;
  Status: string;
  ErrCode: string;
  Method: string;
  nextString: string;
};

const providerURL = 'https://rpc.api.moonbase.moonbeam.network';

task('migrateERC20', 'To mint tokens to target').setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = path.resolve(__dirname, '../../temp/myjsonfile.json');
  const moonbaseProvider = new hre.ethers.providers.StaticJsonRpcProvider(providerURL, {
    chainId: 1287,
    name: 'moonbase-alphanet',
  });
  const fileContent = fs.readFileSync(csvFilePath, {encoding: 'utf-8'});
  const parseJson = JSON.parse(fileContent);
  const data: ClaimData[] = parseJson;

  const accounts = await hre.ethers.getSigners();
  const erc20Token = await hre.ethers.getContract('EgoToken');

  for (let i = 0; i < data.length; i++) {
    if (data[i].Method == 'Claim' && data[i].ErrCode == '') {
      const tx = await moonbaseProvider.getTransactionReceipt(data[i].Txhash);
      for (let j = 0; j < tx.logs.length; j++) {
        if (tx.logs[j].topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          const amountOfTokens = BigNumber.from(tx.logs[j].data);

          const userAddress = hre.ethers.utils.defaultAbiCoder.decode(['address'], tx.logs[j].topics[2]);
          const transferTx = await erc20Token.connect(accounts[6]).transfer(userAddress[0], amountOfTokens);
          await transferTx.wait();
          console.log('transaction hash', transferTx.hash);
        }
      }
      console.log(i);
    }
  }
});
