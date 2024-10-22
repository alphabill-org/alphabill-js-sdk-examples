import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import { SwapBillsWithDustCollectorTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/money/transactions/SwapBillsWithDustCollectorTransactionRecordWithProof.js';
import { TransferBillToDustCollectorTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/money/transactions/TransferBillToDustCollectorTransactionRecordWithProof.js';
import { UnsignedSwapBillsWithDustCollectorTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/money/transactions/UnsignedSwapBillsWithDustCollectorTransactionOrder.js';
import { UnsignedTransferBillToDustCollectorTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/money/transactions/UnsignedTransferBillToDustCollectorTransactionOrder.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const round = await client.getRoundNumber();
const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([MoneyPartitionUnitType.FEE_CREDIT_RECORD])),
);
const billUnitIds = (await client.getUnitsByOwnerId(signingService.publicKey)).filter(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([MoneyPartitionUnitType.BILL])),
);
const bill = await client.getUnit(billUnitIds[0], false, Bill);
const targetBill = await client.getUnit(billUnitIds[1], false, Bill);
if (!bill || !targetBill) {
  throw new Error('No bills available');
}

console.log('Transferring bill to dust collector...');
const transferBillToDustCollectorTransactionOrder = await (
  await UnsignedTransferBillToDustCollectorTransactionOrder.create(
    {
      bill: bill,
      targetBill: targetBill,
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: feeCreditRecordId,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  )
).sign(proofFactory, proofFactory);
const transferBillToDustCollectorHash = await client.sendTransaction(transferBillToDustCollectorTransactionOrder);
const transferBillToDustCollectorProof = await client.waitTransactionProof(
  transferBillToDustCollectorHash,
  TransferBillToDustCollectorTransactionRecordWithProof,
);

console.log('Swapping bill with dust collector...');
const swapBillWithDustCollectorTransactionOrder = await (
  await UnsignedSwapBillsWithDustCollectorTransactionOrder.create(
    {
      bill: targetBill,
      proofs: [transferBillToDustCollectorProof],
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: feeCreditRecordId,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  )
).sign(proofFactory, proofFactory);
const swapBillsWithDustCollectorHash = await client.sendTransaction(swapBillWithDustCollectorTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(
      swapBillsWithDustCollectorHash,
      SwapBillsWithDustCollectorTransactionRecordWithProof,
    )
  )?.toString(),
);
