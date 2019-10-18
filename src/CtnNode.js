/**
 * Created by claudio on 2019-09-18
 */

// Module variables
//

// References to external code
//
// Internal node modules
import dns from 'dns';
import util from 'util';
// Third-party node modules
import config from 'config';
import Future from 'fibers/future';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {syncDnsResolveTxt} from './Util';

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

    retrieveCatenisNodes.call(this);

    setInterval(intervalRetrieveCatenisNodes.bind(this), cfgSettings.refreshInterval);
}


// Public CtnNode object methods
//

/*CtnNode.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CtnNode object methods
//  NOTE: these functions need to be bound to a CtnNode object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function intervalRetrieveCatenisNodes() {
    Future.task(retrieveCatenisNodes.bind(this)).detach();
}

function retrieveCatenisNodes() {
    CNS.logger.TRACE('Retrieving Catenis nodes...');
    let records;

    try {
        records = syncDnsResolveTxt(cfgSettings.dnsRecName + '.' + CNS.app.domainRoot);
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

CtnNode.initialize = function () {
    CNS.ctnNode = new CtnNode();
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
