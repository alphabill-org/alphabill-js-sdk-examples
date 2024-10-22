import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import {
  ReclaimFeeCreditTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/ReclaimFeeCreditTransactionRecordWithProof.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const targetBillId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.BILL);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD);

if (!feeCreditRecordId) {
  throw new Error('No fee credit available');
}

const bill = await client.getUnit(targetBillId, false, Bill);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
const round = await client.getRoundNumber();

const closeFeeCreditHash = await client.closeFeeCredit(
  {
    bill,
    feeCreditRecord,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
  },
);
const proof = await waitTransactionProof(client, closeFeeCreditHash);

const reclaimFeeCreditHash = await client.reclaimFeeCredit(
  {
    proof,
    bill,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
  },
);
console.log((await client.waitTransactionProof(reclaimFeeCreditHash, ReclaimFeeCreditTransactionRecordWithProof))?.toString());
