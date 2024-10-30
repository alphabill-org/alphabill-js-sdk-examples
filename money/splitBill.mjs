import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { Bill } from '@alphabill/alphabill-js-sdk/lib/money/Bill.js';
import { SplitBillTransactionRecordWithProof } from '@alphabill/alphabill-js-sdk/lib/money/transactions/SplitBillTransactionRecordWithProof.js';
import { UnsignedSplitBillTransactionOrder } from '@alphabill/alphabill-js-sdk/lib/money/transactions/UnsignedSplitBillTransactionOrder.js';
import { NetworkIdentifier } from '@alphabill/alphabill-js-sdk/lib/NetworkIdentifier.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { AlwaysTruePredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/AlwaysTruePredicate.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { PayToPublicKeyHashProofFactory } from '@alphabill/alphabill-js-sdk/lib/transaction/proofs/PayToPublicKeyHashProofFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));
const proofFactory = new PayToPublicKeyHashProofFactory(signingService, cborCodec);
const ownerPredicate = await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey);

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.feeCreditRecords.at(0);
const billId = units.bills.at(0);
const round = await client.getRoundNumber();
const bill = await client.getUnit(billId, false, Bill);
console.log(bill.toString());

const splitBillTransactionOrder = await UnsignedSplitBillTransactionOrder.create(
  {
    splits: [
      { value: 2n, ownerPredicate: ownerPredicate },
      { value: 1n, ownerPredicate: ownerPredicate },
    ],
    bill: bill,
    networkIdentifier: NetworkIdentifier.LOCAL,
    stateLock: null,
    metadata: {
      timeout: round + 60n,
      maxTransactionFee: 5n,
      feeCreditRecordId: feeCreditRecordId,
      referenceNumber: new Uint8Array(),
    },
    stateUnlock: new AlwaysTruePredicate(),
  },
  cborCodec,
).sign(proofFactory, proofFactory);
const splitBillHash = await client.sendTransaction(splitBillTransactionOrder);

console.log((await client.waitTransactionProof(splitBillHash, SplitBillTransactionRecordWithProof))?.toString());
