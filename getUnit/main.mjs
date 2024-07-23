import { CborCodecNode } from '@alphabill/alphabill-js-sdk/lib/codec/cbor/CborCodecNode.js';
import { DefaultSigningService } from '@alphabill/alphabill-js-sdk/lib/signing/DefaultSigningService.js';
import { createMoneyClient, http } from '@alphabill/alphabill-js-sdk/lib/StateApiClientFactory.js';
import { Base16Converter } from '@alphabill/alphabill-js-sdk/lib/util/Base16Converter.js';
import config from '../config.js';

const signingService = new DefaultSigningService(Base16Converter.decode(config.privateKey));

const client = createMoneyClient({
  transport: http(config.moneyPartitionUrl, new CborCodecNode()),
});

const unitIds = await client.getUnitsByOwnerId(signingService.publicKey);
if (unitIds.length > 0) {
  console.log(await client.getUnit(unitIds.at(-1), true));
} else {
  console.log('No units available');
}
