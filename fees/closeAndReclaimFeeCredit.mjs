import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { CloseFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/CloseFeeCreditTransactionRecordWithProof.js';
import { ReclaimFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/ReclaimFeeCreditTransactionRecordWithProof.js';
import { UnsignedCloseFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedCloseFeeCreditTransactionOrder.js';
import { UnsignedReclaimFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedReclaimFeeCreditTransactionOrder.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
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

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const targetBillId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([MoneyPartitionUnitType.BILL])),
);
const feeCreditRecordId = units.findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([MoneyPartitionUnitType.FEE_CREDIT_RECORD])),
);
if (!feeCreditRecordId) {
  throw new Error('No fee credit available');
}

const bill = await client.getUnit(targetBillId, false, Bill);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
const round = await client.getRoundNumber();

const closeFeeCreditTransactionOrder = await (
  await UnsignedCloseFeeCreditTransactionOrder.create(
    {
      bill: bill,
      feeCreditRecord: feeCreditRecord,
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: null,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  )
).sign(proofFactory);
const closeFeeCreditHash = await client.sendTransaction(closeFeeCreditTransactionOrder);
const closeFeeCreditProof = await client.waitTransactionProof(
  closeFeeCreditHash,
  CloseFeeCreditTransactionRecordWithProof,
);

const reclaimFeeCreditTransactionOrder = await (
  await UnsignedReclaimFeeCreditTransactionOrder.create(
    {
      proof: closeFeeCreditProof,
      bill: bill,
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: null,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  )
).sign(proofFactory);
const reclaimFeeCreditHash = await client.sendTransaction(reclaimFeeCreditTransactionOrder);

console.log(
  (await client.waitTransactionProof(reclaimFeeCreditHash, ReclaimFeeCreditTransactionRecordWithProof))?.toString(),
);
