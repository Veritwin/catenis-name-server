/**
 * Created by claudio on 2019-09-25
 */

// Module variables
//

// References to external code
//
// Internal node modules
import dns from 'dns';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
import async from 'async';
import moment from 'moment';
import Future from 'fibers/future';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr';
import {CnsClient} from './CnsClient';
import {
    ctnNodeIdFromIpfsRootDbNameKey,
    ctnNodeIdxFromId,
    makeIpfsRootDbNameKey
} from './CtnNode';
import {syncDnsResolveTxt} from './Util';
import {cfgSettings as restApiCfgSettings} from './RestAPI';

// Config entries
const cnsInstanceConfig = config.get('cnsInstance');

// Configuration settings
const cfgSettings = {
    dnsRecName: cnsInstanceConfig.get('dnsRecName'),
    idPrefix: cnsInstanceConfig.get('idPrefix'),
    self: {
        privKey: cnsInstanceConfig.get('self.privKey'),
        pubKey: cnsInstanceConfig.get('self.pubKey')
    },
    defaults: {
        port: cnsInstanceConfig.get('defaults.port'),
        secure: cnsInstanceConfig.get('defaults.secure')
    },
    refreshInterval: cnsInstanceConfig.get('refreshInterval')
};


// Definition of function classes
//

// CnsInstance function class
export function CnsInstance() {
    this.cnsInstanceIdInfo = new Map();
    this.remoteCnsInstanceIds = new Set();
    this.remoteCnsConnection = new Map();
    this.selfId = undefined;

    retrieveCNSInstances.call(this);

    setInterval(intervalRetrieveCNSInstances.bind(this), cfgSettings.refreshInterval);

    Object.defineProperties(this, {
        self: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return {
                    id: this.selfId,
                    privKey: cfgSettings.self.privKey
                }
            },
            enumerable: true
        }
    });
}


// Public CnsInstance object methods
//

CnsInstance.prototype.hasRemoteCNSInstances = function () {
    return this.remoteCnsInstanceIds.size > 0;
};

CnsInstance.prototype.synchronize = function (callback) {
    CNS.logger.TRACE('Synchronizing with other CNS instances');
    if (this.hasRemoteCNSInstances()) {
        async.series([
            // Retrieve all Catenis node IPFS repo root CIDs from remote CNS instances
            (cb) => {
                async.each(this.remoteCnsConnection, ([cnsInstanceId, cnsClient], cb2) => {
                    cnsClient.getAllIpfsRepoRootCids((err, result) => {
                        if (err) {
                            CNS.logger.ERROR('Error retrieving all Catenis node IPFS repo root CIDs from remote CNS instance [%s].', cnsInstanceId, err);
                        }
                        else if (result.data) {
                            Object.keys(result.data).forEach((key) => {
                                const nodeEntry = result.data[key];
                                nodeEntry.mtLastUpdatedDate = moment(nodeEntry.lastUpdatedDate);
                                const nodeIdx = parseInt(key);
                                const ipfsRootDbNameKey = makeIpfsRootDbNameKey(nodeIdx);
                                const nameEntry = CNS.nameDB.getNameEntry(ipfsRootDbNameKey);

                                if (nameEntry && !nodeEntry.mtLastUpdatedDate.isAfter(nameEntry.lastUpdatedDate)) {
                                    CNS.logger.DEBUG('CnsInstance.synchronize: received CID is not newer than current CID value for the designated name and shall not be updated', {
                                        currentNameEntry: nameEntry,
                                        nodeIdx: nodeIdx,
                                        nodeEntry: nodeEntry
                                    });
                                }
                                else {
                                    CNS.nameDB.setNameEntry(ipfsRootDbNameKey, nodeEntry.cid, nodeEntry.mtLastUpdatedDate.toDate());
                                }
                            });
                        }

                        cb2();
                    });
                }, () => {
                    cb();
                });
            },
            // Send all locally recorded Catenis node IPFS repo root CIDs to remote CNS instances
            (cb) => {
                const ctnNodeEntries = {};
                const nameEntries =  CNS.nameDB.getAllNameEntries();

                const names = Object.keys(nameEntries);

                if (names.length > 0) {
                    names.forEach((name) => {
                        const ctnNodeId = ctnNodeIdFromIpfsRootDbNameKey(name);

                        if (ctnNodeId) {
                            ctnNodeEntries[ctnNodeIdxFromId(ctnNodeId)] = {
                                cid: nameEntries[name].value,
                                lastUpdatedDate: nameEntries[name].lastUpdatedDate.toISOString()
                            }
                        }
                    });

                    async.each(this.remoteCnsConnection, ([cnsInstanceId, cnsClient], cb2) => {
                        cnsClient.setMultiIpfsRepoRootCid(ctnNodeEntries, (err) => {
                            if (err) {
                                CNS.logger.ERROR('Error sending all locally recorded Catenis node IPFS repo root CIDs to remote CNS instance [%s].', cnsInstanceId, err);
                            }
                            cb2();
                        });
                    }, () => {
                        cb();
                    });
                }
                else {
                    // No name entries; just return
                    cb();
                }
            }
        ],
        () => {
            async.setImmediate(() => callback());
        });
    }
};


// Module functions used to simulate private CnsInstance object methods
//  NOTE: these functions need to be bound to a CnsInstance object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function intervalRetrieveCNSInstances() {
    Future.task(retrieveCNSInstances.bind(this)).detach();
}

function retrieveCNSInstances() {
    CNS.logger.TRACE('Retrieving Catenis Name Server instances...');

    let records;

    try {
        records = syncDnsResolveTxt(cfgSettings.dnsRecName + '.' + CNS.app.domainRoot);
    }
    catch (err) {
        CNS.logger.ERROR('Error retrieving Catenis Name Server instances.', err);
        return;
    }

    const newCnsInstanceIdInfo = new Map();
    const newRemoteCnsInstanceIds = new Set();
    let foundSelfId;

    records.forEach((chunks) => {
        const record = chunks.reduce((rec, chunk) => {
            return rec + chunk;
        }, '');

        // Try to parse it
        let cnsInstanceInfo;

        try {
            cnsInstanceInfo = JSON.parse(record);
        }
        catch (err2) {
        }

        if (isValidCnsInstanceInfo(cnsInstanceInfo)) {
            const cnsInstanceId = makeCnsInstanceId(cnsInstanceInfo.idx);

            if (cnsInstanceInfo.pubKey !== cfgSettings.self.pubKey) {
                newRemoteCnsInstanceIds.add(cnsInstanceId);
            }
            else {
                foundSelfId = cnsInstanceId;
            }

            newCnsInstanceIdInfo.set(cnsInstanceId, _und.defaults(cnsInstanceInfo, cfgSettings.defaults));
        }
    });

    // Make sure that info for this Catenis Name Server instance is consistent
    if (foundSelfId) {
        const inconsistency = checkSelfInfo(newCnsInstanceIdInfo.get(foundSelfId));

        if (inconsistency) {
            // Inconsistency found. Log error
            CNS.logger.ERROR('Retrieved info for this Catenis Name Server instance is not consistent.', inconsistency);

            if (!this.selfId) {
                // Info for this Catenis Name Server instance had not been retrieve yet.
                //  Throw exception to abort processing
                CNS.logger.DEBUG('Info for this Catenis Name Server instance had not been retrieved yet.');
                throw new Error('Inconsistent info for this Catenis Name Server instance. Aborting processing');
            }
        }
        else {
            this.selfId = foundSelfId;
        }
    }

    // Remove credentials of missing CNS instances
    for (let cnsInstanceId of this.cnsInstanceIdInfo.keys()) {
        if (!newCnsInstanceIdInfo.has(cnsInstanceId)) {
            CNS.credentials.removeCNSInstance(cnsInstanceId);
        }
    }

    // Add credentials of new CNS instances
    for (let [cnsInstanceId, cnsInstanceInfo] of newCnsInstanceIdInfo) {
        if (!this.cnsInstanceIdInfo.has(cnsInstanceId)) {
            CNS.credentials.addCNSInstance(cnsInstanceId, cnsInstanceInfo);
        }
    }

    // Remove connection of missing remote CNS instances
    for (let cnsInstanceId of this.remoteCnsInstanceIds) {
        if (!newRemoteCnsInstanceIds.has(cnsInstanceId)) {
            this.remoteCnsConnection.delete(cnsInstanceId);
        }
    }

    // Add connection of new remote CNS instances
    for (let cnsInstanceId of newRemoteCnsInstanceIds) {
        if (!this.remoteCnsInstanceIds.has(cnsInstanceId)) {
            this.remoteCnsConnection.set(cnsInstanceId, new CnsClient(newCnsInstanceIdInfo.get(cnsInstanceId)));
        }
    }

    this.cnsInstanceIdInfo = newCnsInstanceIdInfo;
    this.remoteCnsInstanceIds = newRemoteCnsInstanceIds;
}


// CnsInstance function class (public) methods
//

CnsInstance.initialize = function () {
    CNS.cnsInstance = new CnsInstance();
};


// CnsInstance function class (public) properties
//

//CnsInstance.prop = {};


// Definition of module (private) functions
//

export function makeCnsInstanceId(idx) {
    return cfgSettings.idPrefix + idx;
}

function isValidCnsInstanceInfo(info) {
    return typeof info === 'object' && info !== null && Number.isInteger(info.idx) && info.idx >= 1
        && typeof info.pubKey === 'string'
        && (info.port === undefined || typeof info.port === 'number')
        && (info.secure === undefined || typeof info.secure === 'boolean');
}

function checkSelfInfo(info) {
    let isConsistent = true;
    const inconsistency = {};

    if (info.idx !== global.CNS_INSTANCE_IDX) {
        isConsistent = false;
        inconsistency.idx = {
            expected: global.CNS_INSTANCE_IDX,
            current: info.idx
        }
    }

    if (info.port !== restApiCfgSettings.port) {
        isConsistent = false;
        inconsistency.port = {
            expected: restApiCfgSettings.port,
            current: info.port
        }
    }

    return !isConsistent ? inconsistency : undefined;
}


// Module code
//
