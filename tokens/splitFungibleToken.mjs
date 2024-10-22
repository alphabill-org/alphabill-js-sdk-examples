import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { FungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/FungibleToken.js';
import {
  SplitFungibleTokenTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/SplitFungibleTokenTransactionRecordWithProof.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl, new CborCodecNode()),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === TokenPartitionUnitType.FEE_CREDIT_RECORD);
const unitId = units.findLast((id) => id.type.toBase16() === TokenPartitionUnitType.FUNGIBLE_TOKEN);
const round = await client.getRoundNumber();
const token = await client.getUnit(unitId, false, FungibleToken);

const splitFungibleTokenHash = await client.splitFungibleToken(
  {
    token,
    ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey),
    amount: 3n,
    nonce: null,
    type: { unitId: token.tokenType },
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(splitFungibleTokenHash, SplitFungibleTokenTransactionRecordWithProof))?.toString());
