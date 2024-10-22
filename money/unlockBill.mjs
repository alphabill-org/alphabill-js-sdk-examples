import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import { UnlockBillTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/money/transactions/UnlockBillTransactionRecordWithProof.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const billId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.BILL);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD);
const round = await client.getRoundNumber();
const bill = await client.getUnit(billId, false, Bill);

const unlockBillHash = await client.unlockBill(
  {
    unit: bill,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(unlockBillHash, UnlockBillTransactionRecordWithProof))?.toString());
