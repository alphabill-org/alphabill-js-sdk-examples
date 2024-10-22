import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import {
  TransferBillToDustCollectorTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/money/transactions/TransferBillToDustCollectorTransactionRecordWithProof.js';
import {
  SwapBillsWithDustCollectorTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/money/transactions/SwapBillsWithDustCollectorTransactionRecordWithProof.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD);
const targetBillId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.BILL);
const billId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.BILL && id !== targetBillId);

if (!targetBillId || !billId) {
  throw new Error('No bills available');
}

const targetBill = await client.getUnit(targetBillId, false, Bill);
const bill = await client.getUnit(billId, false, Bill);
const round = await client.getRoundNumber();

const transferBillToDustCollectorHash = await client.transferBillToDustCollector(
  {
    bill,
    targetBill,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
const transactionProof = await client.waitTransactionProof(transferBillToDustCollectorHash, TransferBillToDustCollectorTransactionRecordWithProof);

const swapBillsWithDustCollectorHash = await client.swapBillsWithDustCollector(
  {
    bill: targetBill,
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    proofs: [transactionProof],
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 100n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(swapBillsWithDustCollectorHash, SwapBillsWithDustCollectorTransactionRecordWithProof))?.toString());
