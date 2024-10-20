import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { SystemIdentifier } from '@alphabill/alphabill-js-sdk/lib/SystemIdentifier.js';
import { FeeCreditRecordUnitIdFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/FeeCreditRecordUnitIdFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/PayToPublicKeyHashPredicate.js';
import { TransactionOrderFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/TransactionOrderFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { UnitType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';
import { waitTransactionProof } from '../waitTransactionProof.mjs';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const transactionOrderFactory = new TransactionOrderFactory(cborCodec, signingService);
const feeCreditRecordUnitIdFactory = new FeeCreditRecordUnitIdFactory();

const moneyClient = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
  transactionOrderFactory: transactionOrderFactory,
  feeCreditRecordUnitIdFactory: feeCreditRecordUnitIdFactory,
});

const tokenClient = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
  transactionOrderFactory,
});

const unitIds = (await moneyClient.getUnitsByOwnerId(signingService.publicKey)).filter(
  (id) => id.type.toBase16() === UnitType.MONEY_PARTITION_BILL_DATA,
);
if (unitIds.length === 0) {
  throw new Error('No bills available');
}

const partitions = [
  {
    client: moneyClient,
    systemIdentifier: SystemIdentifier.MONEY_PARTITION,
    unitType: UnitType.MONEY_PARTITION_FEE_CREDIT_RECORD,
  },
  {
    client: tokenClient,
    systemIdentifier: SystemIdentifier.TOKEN_PARTITION,
    unitType: UnitType.TOKEN_PARTITION_FEE_CREDIT_RECORD,
  },
];

for (const { client, systemIdentifier, unitType } of partitions) {
  const bill = await moneyClient.getUnit(unitIds[0], false);
  const round = await moneyClient.getRoundNumber();
  const ownerPredicate = await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey);

  let transferToFeeCreditHash = await moneyClient.transferToFeeCredit(
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

  let proof = await waitTransactionProof(moneyClient, transferToFeeCreditHash);
  const feeCreditRecordUnitId = proof.transactionRecord.transactionOrder.payload.attributes.targetUnitId;
  const feeCreditRecordId = new UnitIdWithType(feeCreditRecordUnitId.bytes, unitType);

  const addFeeCreditHash = await client.addFeeCredit(
    {
      ownerPredicate: ownerPredicate,
      proof,
      feeCreditRecord: { unitId: feeCreditRecordId },
    },
    {
      maxTransactionFee: 5n,
      timeout: round + 60n,
    },
  );
  console.log((await waitTransactionProof(client, addFeeCreditHash)).toString());
}
