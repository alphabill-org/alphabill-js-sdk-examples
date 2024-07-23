import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/PayToPublicKeyHashPredicate.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, new CborCodecNode()),
  transactionOrderFactory,
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === UnitType.TOKEN_PARTITION_FEE_CREDIT_RECORD);
const unitId = units.findLast((id) => id.type.toBase16() === UnitType.TOKEN_PARTITION_NON_FUNGIBLE_TOKEN);
const round = await client.getRoundNumber();

/**
 * @type {NonFungibleToken|null}
 */
const token = await client.getUnit(unitId, false);
if (token === null) {
  throw new Error('Token does not exist');
}

const transferNonFungibleTokenHash = await client.transferNonFungibleToken(
  {
    token,
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    nonce: null,
    type: { unitId: token.tokenType },
    invariantPredicateSignatures: [null],
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await waitTransactionProof(client, transferNonFungibleTokenHash))?.toString());
