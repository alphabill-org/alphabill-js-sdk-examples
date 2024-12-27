import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { TokenIcon } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenIcon.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { CreateFungibleTokenType } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateFungibleTokenType.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/tokens/UnitIdWithType.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const round = await client.getRoundNumber();
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.FUNGIBLE_TOKEN_TYPE);

const createFungibleTokenTypeTransactionOrder = await CreateFungibleTokenType.create({
  type: { unitId: tokenTypeUnitId },
  symbol: 'E',
  name: 'Big money come',
  icon: new TokenIcon('image/png', new Uint8Array()),
  parentTypeId: null,
  decimalPlaces: 8,
  subTypeCreationPredicate: new AlwaysTruePredicate(),
  tokenMintingPredicate: new AlwaysTruePredicate(),
  tokenTypeOwnerPredicate: new AlwaysTruePredicate(),
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(proofFactory, []);
const createFungibleTokenTypeHash = await client.sendTransaction(createFungibleTokenTypeTransactionOrder);

console.log((await client.waitTransactionProof(createFungibleTokenTypeHash, CreateFungibleTokenType)).toString());
