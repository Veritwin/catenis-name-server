/**
 * Created by claudio on 2019-09-26
 */

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import restifyClients from 'restify-clients';
import httpSignature from 'http-signature';
import Future from 'fibers/future';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr';

// Config entries
const cnsClientConfig = config.get('cnsClient');

// Configuration settings
const cfgSettings = {
    connectTimeout: cnsClientConfig.get('connectTimeout'),
    requestTimeout: cnsClientConfig.get('requestTimeout'),
    hostFormat: cnsClientConfig.get('hostFormat'),
    headersToSign: cnsClientConfig.get('headersToSign')
};


// Definition of function classes
//

// CnsClient function class
export function CnsClient(cnsInstanceInfo) {
    this.cnsInstanceInfo = cnsInstanceInfo;
    this.client = new restifyClients.createJSONClient({
        connectTimeout: cfgSettings.connectTimeout,
        requestTimeout: cfgSettings.requestTimeout,
        retry: false,
        signRequest: httpSignRequest,
        url: assembleUrl(cnsInstanceInfo)
    });
    this.syncMethod = {
        get: (() => {
            const futFunc = Future.wrap(this.client.get, true).bind(this.client);

            return function syncGet() {
                return futFunc.apply(this, arguments).wait();
            }
        })(),
        post: (() => {
            const futFunc = Future.wrap(this.client.post, true).bind(this.client);

            return function syncPost() {
                return futFunc.apply(this, arguments).wait();
            }
        })()
    }
}


// Public CnsClient object methods
//

CnsClient.prototype.getIpfsRootRepoCid = function (ctnNodeIdx, callback) {
    const endpointUrl = util.format('/ctn-node/%s/ipfs-root', ctnNodeIdx);

    if (typeof callback === 'function') {
        this.client.get(endpointUrl, (err, req, res, retData) => {
            callback(err, retData);
        });
    }
    else {
        const res = this.syncMethod.get(endpointUrl);

        return res[2];
    }
};

CnsClient.prototype.getAllIpfsRootRepoCids = function (updatedSince, callback) {
    let endpointUrl = '/ctn-node/ipfs-root';

    if (typeof updatedSince === 'function') {
        callback = updatedSince;
    }
    else if (updatedSince instanceof Date) {
        endpointUrl += '?updatedSince=' + updatedSince.toISOString();
    }

    if (typeof callback === 'function') {
        this.client.get(endpointUrl, (err, req, res, retData) => {
            callback(err, retData);
        });
    }
    else {
        const res = this.syncMethod.get();

        return res[2];
    }
};

CnsClient.prototype.setIpfsRootRepoCid = function (ctnNodeIdx, cid, lastUpdatedDate, callback) {
    if (typeof lastUpdatedDate === 'function') {
        callback = lastUpdatedDate;
        lastUpdatedDate = undefined;
    }

    const data = {
        cid: cid
    };

    if (lastUpdatedDate) {
        data.lastUpdatedDate = lastUpdatedDate;
    }

    const endpointUrl = util.format('/ctn-node/%s/ipfs-root', ctnNodeIdx);

    if (typeof callback === 'function') {
        this.client.post(endpointUrl, data, (err, req, res, retData) => {
            callback(err);
        });
    }
    else {
        const res = this.syncMethod.post(endpointUrl, data);
    }
};

// Arguments:
//  ctnNodeEntries: {
//    <ctnNodeIdx>: {
//      cid: [String],
//      lastUpdatedDate: [Date]
//    },
//    ...
//  }
CnsClient.prototype.setMultiIpfsRootRepoCid = function (ctnNodeEntries, callback) {
    const endpointUrl = '/ctn-node/ipfs-root';

    if (typeof callback === 'function') {
        this.client.post(endpointUrl, ctnNodeEntries, (err, req, res, retData) => {
            callback(err);
        });
    }
    else {
        const res = this.syncMethod.post(endpointUrl, ctnNodeEntries);
    }
};


// Module functions used to simulate private CnsClient object methods
//  NOTE: these functions need to be bound to a CnsClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CnsClient function class (public) methods
//

/*CnsClient.class_func = function () {
};*/


// CnsClient function class (public) properties
//

//CnsClient.prop = {};


// Definition of module (private) functions
//

function assembleUrl(cnsInstanceInfo) {
    return 'http' + (cnsInstanceInfo.secure ? 's' : '') + '://' + util.format(cfgSettings.hostFormat, cnsInstanceInfo.idx, CNS.app.domainRoot) + ':' + cnsInstanceInfo.port;
}

function httpSignRequest(req) {
    httpSignature.sign(req, {
        keyId: CNS.cnsInstance.self.id,
        key: CNS.cnsInstance.self.privKey,
        headers: cfgSettings.headersToSign
    });
}


// Module code
//
