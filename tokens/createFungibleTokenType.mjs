import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { TokenIcon } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenIcon.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import {
  CreateFungibleTokenTypeTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateFungibleTokenTypeTransactionRecordWithProof.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === TokenPartitionUnitType.FEE_CREDIT_RECORD,
);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.FUNGIBLE_TOKEN_TYPE);

const createFungibleTokenTypeHash = await client.createFungibleTokenType(
  {
    type: { unitId: tokenTypeUnitId },
    symbol: 'E',
    name: 'Big money come',
    icon: new TokenIcon('image/png', new Uint8Array()),
    parentTypeId: null,
    decimalPlaces: 8,
    subTypeCreationPredicate: new AlwaysTruePredicate(),
    tokenMintingPredicate: new AlwaysTruePredicate(),
    tokenTypeOwnerPredicate: new AlwaysTruePredicate(),
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(createFungibleTokenTypeHash, CreateFungibleTokenTypeTransactionRecordWithProof))?.toString());
