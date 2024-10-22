import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import {
  CreateNonFungibleTokenTypeTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateNonFungibleTokenTypeTransactionRecordWithProof.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === TokenPartitionUnitType.FEE_CREDIT_RECORD,
);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.NON_FUNGIBLE_TOKEN_TYPE);

const createNonFungibleTokenTypeHash = await client.createNonFungibleTokenType(
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
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(createNonFungibleTokenTypeHash, CreateNonFungibleTokenTypeTransactionRecordWithProof))?.toString());
