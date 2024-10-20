import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import config from '../config.js';

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
});
console.log(await client.getRoundNumber());
