/**
 * Created by claudio on 2019-09-18
 */

// Module variables
//

// References to external code
//
// Internal node modules
import dns from 'dns';
// Third-party node modules
import config from 'config';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';

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
    this.ctnNodeIdInfo = undefined;

    retrieveCatenisNodes.call(this);

    setInterval(retrieveCatenisNodes.bind(this), cfgSettings.refreshInterval);
}


// Public CtnNode object methods
//

/**
 * Get Catenis node info by Catenis node ID
 *
 * @param id {String} Catenis node ID in the form 'ctn-node<ctnNodeIdx>'
 * @returns {Object} Catenis node info: {idx:[Integer], pubKey:[String]}
 */
CtnNode.prototype.getNodeInfoById = function (id) {
    return this.ctnNodeIdInfo.get(id);
};


// Module functions used to simulate private CtnNode object methods
//  NOTE: these functions need to be bound to a CtnNode object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function retrieveCatenisNodes() {
    this.ctnNodeIdInfo = new Map();

    dns.resolveTxt(cfgSettings.dnsRecName + '.' + CNS.app.rootSubdomain, (err, records) => {
        if (err) {
            CNS.logger.ERROR('Error retrieving Catenis nodes.', err);
        }
        else {
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
                    this.ctnNodeIdInfo.set(cfgSettings.idPrefix + ctnNodeInfo.idx, ctnNodeInfo);
                }
            });
        }
    });
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

function isValidCtnNodeInfo(info) {
    return typeof info === 'object' && info !== null && Number.isInteger(info.idx) && info.idx >= 0 && typeof info.pubKey === 'string';
}


// Module code
//
