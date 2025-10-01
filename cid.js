const {utils} = require("ethers");

function cidToBytes32(cid) {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

function bytes32ToCid(bytes32) {
    return utils.base58.encode(Buffer.from('1220' + bytes32.slice(2), 'hex'));
}

const { create } = require( 'ipfs-http-client');
const fs = require('fs');

async function uploadToIpfs(file) {
    const ipfs = create({ url: 'https://unauthipfs.subquery.network/ipfs/api/v0' })
    const content = fs.readFileSync(file, { encoding: 'utf8' });
    const { cid } = await ipfs.add(content, { pin: true });
    return cid;
}
