import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { AddFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/AddFeeCreditTransactionRecordWithProof.js';
import { TransferFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/TransferFeeCreditTransactionRecordWithProof.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { SystemIdentifier } from '@alphabill/alphabill-js-sdk/lib/SystemIdentifier.js';
import { TokenPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/tokens/TokenPartitionUnitType.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const moneyClient = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const tokenClient = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const unitIds = (await moneyClient.getUnitsByOwnerId(signingService.publicKey)).filter(
  (id) => id.type.toBase16() === MoneyPartitionUnitType.BILL,
);
if (unitIds.length === 0) {
  throw new Error('No bills available');
}

const partitions = [
  {
    client: moneyClient,
    systemIdentifier: SystemIdentifier.MONEY_PARTITION,
    unitType: MoneyPartitionUnitType.FEE_CREDIT_RECORD,
  },
  {
    client: tokenClient,
    systemIdentifier: SystemIdentifier.TOKEN_PARTITION,
    unitType: TokenPartitionUnitType.FEE_CREDIT_RECORD,
  },
];

for (const { client, systemIdentifier, unitType } of partitions) {
  const bill = await moneyClient.getUnit(unitIds[0], false);
  const round = await moneyClient.getRoundNumber();
  const ownerPredicate = await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey);

  let transferToFeeCreditHash = await moneyClient.transferFeeCredit(
    {
      bill,
      amount: 100n,
      systemIdentifier,
      feeCreditRecordParams: {
        ownerPredicate: ownerPredicate,
        unitType: unitType,
      },
      latestAdditionTime: round + 60n,
    },
    {
      maxTransactionFee: 5n,
      timeout: round + 60n,
    },
  );

  const transferFeeCreditProof = await moneyClient.waitTransactionProof(
    transferToFeeCreditHash,
    TransferFeeCreditTransactionRecordWithProof,
  );
  const feeCreditRecordId = transferFeeCreditProof.transactionRecord.transactionOrder.payload.unitId;

  const addFeeCreditHash = await client.addFeeCredit({
    ownerPredicate: ownerPredicate,
    proof: transferFeeCreditProof,
    feeCreditRecord: { unitId: feeCreditRecordId },
    maxTransactionFee: 5n,
    timeout: round + 60n,
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    stateUnlock: new AlwaysTruePredicate(),
  });
  console.log((await client.waitTransactionProof(addFeeCreditHash, AddFeeCreditTransactionRecordWithProof)).toString());
}
