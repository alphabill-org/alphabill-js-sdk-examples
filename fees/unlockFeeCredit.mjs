import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { UnlockFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/UnlockFeeCreditTransactionRecordWithProof.js';
import { UnsignedUnlockFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedUnlockFeeCreditTransactionOrder.js';
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
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);
console.log(feeCreditRecord.toString());

console.log('Unlocking fee credit...');
const unlockFeeCreditTransactionOrder = await UnsignedUnlockFeeCreditTransactionOrder.create(
  {
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
).sign(proofFactory);

const unlockFeeCreditHash = await client.sendTransaction(unlockFeeCreditTransactionOrder);

console.log(
  (await client.waitTransactionProof(unlockFeeCreditHash, UnlockFeeCreditTransactionRecordWithProof)).toString(),
);
