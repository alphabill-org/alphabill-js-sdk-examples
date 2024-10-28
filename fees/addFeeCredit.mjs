import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { FeeCreditUnitType } from '@alphabill/alphabill-js-sdk/lib/fees/FeeCreditRecordUnitType.js';
import { AddFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/AddFeeCreditTransactionRecordWithProof.js';
import { TransferFeeCreditTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/records/TransferFeeCreditTransactionRecordWithProof.js';
import { UnsignedAddFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedAddFeeCreditTransactionOrder.js';
import { UnsignedTransferFeeCreditTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/fees/transactions/UnsignedTransferFeeCreditTransactionOrder.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, createTokenClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { SystemIdentifier } from '@alphabill/alphabill-js-sdk/lib/SystemIdentifier.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { UnitIdWithType } from '@alphabill/alphabill-js-sdk/lib/transaction/UnitIdWithType.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);

const moneyClient = createMoneyClient({
  transport: http(config.moneyPartitionUrl, cborCodec),
});

const tokenClient = createTokenClient({
  transport: http(config.tokenPartitionUrl, cborCodec),
});

const billIds = (await moneyClient.getUnitsByOwnerId(signingService.publicKey)).bills;
if (billIds.length === 0) {
  throw new Error('No bills available');
}

const partitions = [
  {
    client: moneyClient,
    systemIdentifier: SystemIdentifier.MONEY_PARTITION,
  },
  {
    client: tokenClient,
    systemIdentifier: SystemIdentifier.TOKEN_PARTITION,
  },
];

for (const { client, systemIdentifier } of partitions) {
  const bill = await moneyClient.getUnit(billIds[0], false, Bill);
  const round = await moneyClient.getRoundNumber();
  const ownerPredicate = await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey);

  const transferFeeCreditTransactionOrder = await UnsignedTransferFeeCreditTransactionOrder.create(
    {
      amount: 100n,
      targetSystemIdentifier: systemIdentifier,
      latestAdditionTime: round + 60n,
      feeCreditRecord: { ownerPredicate: ownerPredicate },
      bill,
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: null,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  ).then((transactionOrder) => transactionOrder.sign(proofFactory));
  const transferFeeCreditHash = await moneyClient.sendTransaction(transferFeeCreditTransactionOrder);

  const transferFeeCreditProof = await moneyClient.waitTransactionProof(
    transferFeeCreditHash,
    TransferFeeCreditTransactionRecordWithProof,
  );
  const feeCreditRecordId = new UnitIdWithType(
    transferFeeCreditTransactionOrder.payload.attributes.targetUnitId.bytes,
    FeeCreditUnitType.FEE_CREDIT_RECORD,
  );

  const addFeeCreditTransactionOrder = await UnsignedAddFeeCreditTransactionOrder.create(
    {
      targetSystemIdentifier: systemIdentifier,
      ownerPredicate: ownerPredicate,
      proof: transferFeeCreditProof,
      feeCreditRecord: { unitId: feeCreditRecordId },
      networkIdentifier: NetworkIdentifier.LOCAL,
      stateLock: null,
      metadata: {
        timeout: round + 60n,
        maxTransactionFee: 5n,
        feeCreditRecordId: null,
        referenceNumber: new Uint8Array(),
      },
      stateUnlock: new AlwaysTruePredicate(),
    },
    cborCodec,
  ).then((transactionOrder) => transactionOrder.sign(proofFactory));
  const addFeeCreditHash = await client.sendTransaction(addFeeCreditTransactionOrder);

  console.log((await client.waitTransactionProof(addFeeCreditHash, AddFeeCreditTransactionRecordWithProof)).toString());
}
