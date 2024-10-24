import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { FeeCreditRecord } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecord.js';
import { DeleteFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/DeleteFeeCreditTransactionRecordWithProof.js';
import { UnsignedDeleteFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedDeleteFeeCreditTransactionOrder.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});
const round = await client.getRoundNumber();
const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === Base16Converter.encode(new Uint8Array([TokenPartitionUnitType.FEE_CREDIT_RECORD])),
);
const feeCreditRecord = await client.getUnit(feeCreditRecordId, false, FeeCreditRecord);

console.log('Deleting fee credit...');
const deleteFeeCreditTransactionOrder = await (
  await UnsignedDeleteFeeCreditTransactionOrder.create(
    {
      feeCredit: { unitId: feeCreditRecordId, counter: feeCreditRecord.counter },
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

const deleteFeeCreditHash = await client.sendTransaction(deleteFeeCreditTransactionOrder);

console.log(
  (await client.waitTransactionProof(deleteFeeCreditHash, DeleteFeeCreditTransactionRecordWithProof))?.toString(),
);
