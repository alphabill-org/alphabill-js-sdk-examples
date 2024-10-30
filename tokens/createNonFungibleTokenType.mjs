import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { CreateNonFungibleTokenTypeTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateNonFungibleTokenTypeTransactionRecordWithProof.js';
import { UnsignedCreateNonFungibleTokenTypeTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/UnsignedCreateNonFungibleTokenTypeTransactionOrder.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.NON_FUNGIBLE_TOKEN_TYPE);

const createNonFungibleTokenTypeTransactionOrder = await UnsignedCreateNonFungibleTokenTypeTransactionOrder.create(
  {
    type: { unitId: tokenTypeUnitId },
    symbol: 'E',
    name: 'Token Name',
    icon: { type: 'image/png', data: new Uint8Array() },
    parentTypeId: null,
    subTypeCreationPredicate: new AlwaysTruePredicate(),
    tokenMintingPredicate: new AlwaysTruePredicate(),
    tokenTypeOwnerPredicate: new AlwaysTruePredicate(),
    dataUpdatePredicate: new AlwaysTruePredicate(),
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
).sign(proofFactory, []);
const createNonFungibleTokenTypeHash = await client.sendTransaction(createNonFungibleTokenTypeTransactionOrder);

console.log(
  (
    await client.waitTransactionProof(
      createNonFungibleTokenTypeHash,
      CreateNonFungibleTokenTypeTransactionRecordWithProof,
    )
  ).toString(),
);
