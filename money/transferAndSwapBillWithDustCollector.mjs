import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/PayToPublicKeyHashPredicate.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
  transactionOrderFactory: transactionOrderFactory,
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === UnitType.MONEY_PARTITION_FEE_CREDIT_RECORD);
const targetBillId = units.findLast((id) => id.type.toBase16() === UnitType.MONEY_PARTITION_BILL_DATA);
const billId = units.findLast((id) => id.type.toBase16() === UnitType.MONEY_PARTITION_BILL_DATA && id !== targetBillId);

if (!targetBillId || !billId) {
  throw new Error('No bills available');
}

/**
 * @type {Bill|null}
 */
const targetBill = await client.getUnit(targetBillId, false);
/**
 * @type {Bill|null}
 */
const bill = await client.getUnit(billId, false);
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
const transactionProof = await waitTransactionProof(client, transferBillToDustCollectorHash);

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
console.log((await waitTransactionProof(client, swapBillsWithDustCollectorHash))?.toString());
