import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';

import config from '../config.js';

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
});
const round = await client.getRoundNumber();
console.log(Base16Converter.encode(await client.getBlock(round)));
