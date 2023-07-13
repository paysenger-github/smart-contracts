import * as fs from 'fs';
import * as path from 'path';
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

(() => {
  const csvFilePath = path.resolve(__dirname, 'usersClaimed.csv');

  const headers = [
    'Txhash',
    'Blockno',
    'UnixTimestamp',
    'DateTime',
    'From',
    'To',
    'ContractAddress',
    'Value_IN(DEV)',
    'Value_OUT(DEV)',
    'CurrentValue @ $0/DEV',
    'TxnFee(DEV)',
    'TxnFee(USD)',
    'Historical $Price/DEV',
    'Status',
    'ErrCode',
    'Method',
    'nextString',
  ];

  const fileContent = fs.readFileSync(csvFilePath, {encoding: 'utf-8'});
  console.log(fileContent);

  parse(
    fileContent,
    {
      delimiter: ',',
      columns: headers,
    },
    (error, result: ClaimData[]) => {
      if (error) {
        console.error(error);
      }
      const json = JSON.stringify(result);
      fs.writeFile('myjsonfile.json', json, function (err) {
        if (err) throw err;
        console.log('complete');
      });
      console.log('Result', result);
    }
  );
})();
