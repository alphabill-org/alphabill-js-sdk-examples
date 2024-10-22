import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import {
  LockFeeCreditTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/LockFeeCreditTransactionRecordWithProof.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const round = await client.getRoundNumber();
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD,
);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
console.log('Fee credit lock status: ' + feeCreditRecord?.locked);

console.log('Locking fee credit...');
const hash = await client.lockFeeCredit(
  {
    status: 5n,
    unit: feeCreditRecord,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
  },
);
console.log((await client.waitTransactionProof(hash, LockFeeCreditTransactionRecordWithProof))?.toString());
