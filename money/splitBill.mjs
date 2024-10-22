import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { PayToPublicKeyHashPredicate } from '@alphabill/alphabill-js-sdk/lib/transaction/predicates/PayToPublicKeyHashPredicate.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';
import { MoneyPartitionUnitType } from '@alphabill/alphabill-js-sdk/lib/money/MoneyPartitionUnitType.js';
import {
  SplitBillTransactionRecordWithProof
} from '@alphabill/alphabill-js-sdk/lib/money/transactions/SplitBillTransactionRecordWithProof.js';

const cborCodec = new CborCodecNode();
const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
});

const units = await client.getUnitsByOwnerId(signingService.publicKey);
const feeCreditRecordId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.FEE_CREDIT_RECORD);
const unitId = units.findLast((id) => id.type.toBase16() === MoneyPartitionUnitType.BILL);
const round = await client.getRoundNumber();

/**
 * @type {Bill|null}
 */
const bill = await client.getUnit(unitId, false);

const splitBillHash = await client.splitBill(
  {
    splits: [
      { value: 2n, ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey) },
      { value: 1n, ownerPredicate: await PayToPublicKeyHashPredicate.create(cborCodec, signingService.publicKey) },
    ],
    bill,
  },
  {
    maxTransactionFee: 5n,
    timeout: round + 60n,
    feeCreditRecordId,
  },
);
console.log((await client.waitTransactionProof(splitBillHash, SplitBillTransactionRecordWithProof))?.toString());
