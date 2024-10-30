import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { NonFungibleTokenData } from '@alphabill/alphabill-js-sdk/lib/tokens/NonFungibleTokenData.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { CreateNonFungibleTokenTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateNonFungibleTokenTransactionRecordWithProof.js';
import { UnsignedCreateNonFungibleTokenTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedCreateNonFungibleTokenTransactionOrder.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { AlwaysTrueProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/AlwaysTrueProofFactory.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);
const alwaysTrueProofFactory = new AlwaysTrueProofFactory(cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.NON_FUNGIBLE_TOKEN_TYPE);

const createNonFungibleTokenTransactionOrder = await UnsignedCreateNonFungibleTokenTransactionOrder.create(
  {
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    type: { unitId: tokenTypeUnitId },
    name: 'My token',
    uri: 'http://guardtime.com',
    data: await NonFungibleTokenData.create(cborCodec, [
      'user variables as primitives',
      10000,
      [true, new Uint8Array()],
    ]),
    dataUpdatePredicate: new AlwaysTruePredicate(),
    nonce: 0n,
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
).sign(alwaysTrueProofFactory, proofFactory);
const createNonFungibleTokenHash = await client.sendTransaction(createNonFungibleTokenTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(createNonFungibleTokenHash, CreateNonFungibleTokenTransactionRecordWithProof)
  )?.toString(),
);
