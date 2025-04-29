import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { PartitionTypeIdentifier } from '@alphabill/alphabill-js-sdk/lib/PartitionTypeIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { NonFungibleTokenData } from '@alphabill/alphabill-js-sdk/lib/tokens/NonFungibleTokenData.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { CreateNonFungibleToken } from '@alphabill/alphabill-js-sdk/lib/tokens/transactions/CreateNonFungibleToken.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/tokens/UnitIdWithType.js';
import { ClientMetadata } from '@alphabill/alphabill-js-sdk/lib/transaction/ClientMetadata.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { AlwaysTrueProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/AlwaysTrueProofFactory.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { TransactionStatus } from '@alphabill/alphabill-js-sdk/lib/transaction/record/TransactionStatus.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService);
const alwaysTrueProofFactory = new AlwaysTrueProofFactory();

const client = createTokenClient({
  transport: http(config.tokenPartitionUrl),
});

const feeCreditRecordId = (await client.getUnitsByOwnerId(signingService.publicKey)).feeCreditRecords.at(0);
const round = (await client.getRoundInfo()).roundNumber;

// token type needs to be created before
const tokenTypeUnitId = new UnitIdWithType(new Uint8Array([1, 2, 3]), TokenPartitionUnitType.NON_FUNGIBLE_TOKEN_TYPE);

console.log(`Creating non-fungible token of type ${tokenTypeUnitId}`);
const createNonFungibleTokenTransactionOrder = await CreateNonFungibleToken.create({
  ownerPredicate: await PayToPublicKeyHashPredicate.create(signingService.publicKey),
  typeId: tokenTypeUnitId,
  name: 'My token',
  uri: 'http://guardtime.com',
  data: await NonFungibleTokenData.create(['user variables as primitives', 10000, [true, new Uint8Array()]]),
  dataUpdatePredicate: new AlwaysTruePredicate(),
  nonce: 0n,
  version: 1n,
  networkIdentifier: NetworkIdentifier.LOCAL,
  partitionIdentifier: PartitionTypeIdentifier.TOKEN,
  stateLock: null,
  metadata: new ClientMetadata(round + 60n, 5n, feeCreditRecordId, new Uint8Array()),
  stateUnlock: new AlwaysTruePredicate(),
}).sign(alwaysTrueProofFactory, proofFactory);
const createNonFungibleTokenHash = await client.sendTransaction(createNonFungibleTokenTransactionOrder);
const createNonFungibleTokenProof = await client.waitTransactionProof(
  createNonFungibleTokenHash,
  CreateNonFungibleToken,
);
console.log(
  `Create non-fungible token response - ${TransactionStatus[createNonFungibleTokenProof.transactionRecord.serverMetadata.successIndicator]}`,
);
