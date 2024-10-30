import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { SetFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/SetFeeCreditTransactionRecordWithProof.js';
import { UnsignedSetFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedSetFeeCreditTransactionOrder.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { SystemIdentifier } from '@alphabill/alphabill-js-sdk/lib/SystemIdentifier.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
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

console.log('Setting fee credit...');
const setFeeCreditTransactionOrder = await UnsignedSetFeeCreditTransactionOrder.create(
  {
    targetSystemIdentifier: SystemIdentifier.TOKEN_PARTITION,
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    amount: 100n,
    feeCreditRecord: { unitId: null, counter: null },
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

const setFeeCreditHash = await client.sendTransaction(setFeeCreditTransactionOrder);

console.log((await client.waitTransactionProof(setFeeCreditHash, SetFeeCreditTransactionRecordWithProof))?.toString());
