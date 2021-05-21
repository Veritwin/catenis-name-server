/**
 * Created by claudio on 2019-09-18
 */

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr.js';
import {promDnsResolveTxt} from './Util.js';

// Config entries
const ctnNodeConfig = config.get('ctnNode');

// Configuration settings
const cfgSettings = {
    dnsRecName: ctnNodeConfig.get('dnsRecName'),
    idPrefix: ctnNodeConfig.get('idPrefix'),
    refreshInterval: ctnNodeConfig.get('refreshInterval')
};


// Definition of function classes
//

// CtnNode function class
export function CtnNode() {
    this.ctnNodeIdInfo = new Map();

    this.promiseInitRetrieval = retrieveCatenisNodes.call(this);

    setInterval(intervalRetrieveCatenisNodes.bind(this), cfgSettings.refreshInterval);
}


// Public CtnNode object methods
//


// Module functions used to simulate private CtnNode object methods
//  NOTE: these functions need to be bound to a CtnNode object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function intervalRetrieveCatenisNodes() {
    retrieveCatenisNodes.call(this)
    .catch(err => {
        CNS.logger.ERROR('Error executing process to retrieve Catenis nodes.', err);
    });
}

async function retrieveCatenisNodes() {
    CNS.logger.TRACE('Retrieving Catenis nodes...');
    let records;

    try {
        records = await promDnsResolveTxt(cfgSettings.dnsRecName + '.' + CNS.app.domainRoot);
    }
    catch (err) {
        CNS.logger.ERROR('Error retrieving Catenis nodes.', err);
        return;
    }

    const newCtnNodeIdInfo = new Map();

    records.forEach((chunks) => {
        const record = chunks.reduce((rec, chunk) => {
            return rec + chunk;
        }, '');

        // Try to parse it
        let ctnNodeInfo;

        try {
            ctnNodeInfo = JSON.parse(record);
        }
        catch (err2) {
        }

        if (isValidCtnNodeInfo(ctnNodeInfo)) {
            newCtnNodeIdInfo.set(makeCtnNodeId(ctnNodeInfo.idx), ctnNodeInfo);
        }
    });

    // Remove credentials of missing Catenis nodes
    for (let ctnNodeId of this.ctnNodeIdInfo.keys()) {
        if (!newCtnNodeIdInfo.has(ctnNodeId)) {
            CNS.credentials.removeCatenisNode(ctnNodeId);
        }
    }

    // Add credentials of new Catenis nodes
    for (let [ctnNodeId, ctnNodeInfo] of newCtnNodeIdInfo) {
        if (!this.ctnNodeIdInfo.has(ctnNodeId)) {
            CNS.credentials.addCatenisNode(ctnNodeId, ctnNodeInfo);
        }
    }

    this.ctnNodeIdInfo = newCtnNodeIdInfo;
}


// CtnNode function class (public) methods
//

CtnNode.initialize = async function () {
    CNS.ctnNode = new CtnNode();

    await CNS.ctnNode.promiseInitRetrieval;
};


// CtnNode function class (public) properties
//

//CtnNode.prop = {};


// Definition of module (private) functions
//

export function makeCtnNodeId(idx) {
    return cfgSettings.idPrefix + idx;
}

export function makeIpfsRootDbNameKey(idx) {
    return makeCtnNodeId(idx) + '.ipfs-root';
}

export function ctnNodeIdxFromId(id) {
    const matchRes = id.match(new RegExp(util.format('^%s(\\d+)$', cfgSettings.idPrefix)));

    if (matchRes) {
        return parseInt(matchRes[1], 10);
    }
}

export function ctnNodeIdFromIpfsRootDbNameKey(dbNameKey) {
    const matchRes = dbNameKey.match(new RegExp(util.format('^(%s\\d+)\\.ipfs-root$', cfgSettings.idPrefix)));

    if (matchRes) {
        return matchRes[1];
    }
}

function isValidCtnNodeInfo(info) {
    return typeof info === 'object' && info !== null && Number.isInteger(info.idx) && info.idx >= 0 && typeof info.pubKey === 'string';
}


// Module code
//
