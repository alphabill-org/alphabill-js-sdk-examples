import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/AlwaysTruePredicate.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
  transactionOrderFactory: transactionOrderFactory,
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === UnitType.TOKEN_PARTITION_FEE_CREDIT_RECORD,
);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), UnitType.TOKEN_PARTITION_NON_FUNGIBLE_TOKEN_TYPE);

const createNonFungibleTokenTypeHash = await client.createNonFungibleTokenType(
  {
    type: { unitId: tokenTypeUnitId },
    symbol: 'E',
    name: 'Token Name',
    icon: { type: 'image/png', data: new Uint8Array() },
    parentTypeId: null,
    subTypeCreationPredicate: new AlwaysTruePredicate(),
    tokenCreationPredicate: new AlwaysTruePredicate(),
    invariantPredicate: new AlwaysTruePredicate(),
    dataUpdatePredicate: new AlwaysTruePredicate(),
    subTypeCreationPredicateSignatures: null,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await waitTransactionProof(client, createNonFungibleTokenTypeHash))?.toString());
