import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { LockFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/LockFeeCreditTransactionRecordWithProof.js';
import { UnsignedLockFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedLockFeeCreditTransactionOrder.js';
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
const round = await client.getRoundNumber();
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([MoneyPartitionUnitType.FEE_CREDIT_RECORD])),
);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
console.log('Fee credit lock status: ' + feeCreditRecord?.locked);

console.log('Locking fee credit...');
const lockFeeCreditTransactionOrder = await (
  await UnsignedLockFeeCreditTransactionOrder.create(
    {
      status: 5n,
      feeCredit: feeCreditRecord,
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

const lockFeeCreditHash = await client.sendTransaction(lockFeeCreditTransactionOrder);
console.log(
  (await client.waitTransactionProof(lockFeeCreditHash, LockFeeCreditTransactionRecordWithProof))?.toString(),
);
