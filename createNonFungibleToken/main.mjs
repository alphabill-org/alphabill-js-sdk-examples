import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/AlwaysTruePredicate.js';
import { NonFungibleTokenData } from '@alphabill/alphabill-js-sdk/lib/transaction/NonFungibleTokenData.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/PayToPublicKeyHashPredicate.js';
import { TokenUnitIdFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TokenUnitIdFactory.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);
const tokenUnitIdFactory = new TokenUnitIdFactory(cborCodec);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
  transactionOrderFactory: transactionOrderFactory,
  tokenUnitIdFactory: tokenUnitIdFactory,
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).findLast(
  (id) => id.type.toBase16() === UnitType.TOKEN_PARTITION_FEE_CREDIT_RECORD,
);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), UnitType.TOKEN_PARTITION_NON_FUNGIBLE_TOKEN_TYPE);

const createNonFungibleTokenHash = await client.createNonFungibleToken(
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
    tokenCreationPredicateSignatures: [null],
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await waitTransactionProof(client, createNonFungibleTokenHash))?.toString());
