/**
 * Created by claudio on 2019-09-18
 */

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import resError from 'restify-errors';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr';
import {makeIpfsRootDbNameKey} from './CtnNode';
import {strictParseInt} from './Util';


// Definition of module (private) functions
//

// Method used to process GET '/ctn-node/:nodeIdx/ipfs-root' endpoint of Rest API
//
//  URL parameters:
//    nodeIdx [String] - Catenis node index
//
//  Success data returned: {
//    "status": "success",
//    "data": {  - (optional)
//      "cid": [String] - CID of IPFS repository root for that Catenis node
//      "lastUpdatedDate": [String] - ISO-8601 formatted date and time when CID has been last updated
//    }
//  }
//
export function getIpfsRepoRootCid(req, res, next) {
    try {
        if (!this.canProcess()) {
            return next(new resError.ServiceUnavailableError('Service unavailable'));
        }

        if (!checkRequestParams(req)) {
            return next(new resError.BadRequestError('Missing or invalid request parameters'));
        }

        const ipfsRootDbNameKey = makeIpfsRootDbNameKey(req.params.nodeIdx);

        const data = {};
        const nameEntry =  CNS.nameDB.getNameEntry(ipfsRootDbNameKey);

        if (nameEntry) {
            data.cid = nameEntry.value;
            data.lastUpdatedDate = nameEntry.lastUpdatedDate.toISOString();
        }

        const successResult = {
            status: 'success'
        };

        if (Object.keys(data).length > 0) {
            successResult.data = data;
        }

        res.send(successResult);
        return next();
    }
    catch (err) {
        CNS.logger.ERROR('Error processing GET \'/ctn-node/:nodeIdx/ipfs-root\' API request.', err);
        return next(new resError.InternalServerError('Internal server error'));
    }
}

export function checkRequestParams(req, methodName = 'getIpfsRepoRootCid') {
    let valid = true;
    const idx = strictParseInt(req.params.nodeIdx);

    if (!Number.isNaN(idx) && idx >= 0) {
        req.params.nodeIdx = idx;
    }
    else {
        CNS.logger.DEBUG('%s: invalid `nodeIdx` request parameter [%s]', methodName, req.params.nodeIdx);
        valid = false;
    }

    return valid;
}
