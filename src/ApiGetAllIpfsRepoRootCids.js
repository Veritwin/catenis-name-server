/**
 * Created by claudio on 2019-09-25
 */

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import resError from 'restify-errors';
import moment from 'moment';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {
    ctnNodeIdFromIpfsRootDbNameKey,
    ctnNodeIdxFromId
} from './CtnNode';

// Definition of module (private) functions
//

// Method used to process GET '/ctn-node/ipfs-root?updatedSince=<date>' endpoint of Rest API
//
//  Query string (optional) parameters:
//    updatedSince [String]  - ISO-8601 formatted date and time used to filter Catenis IPFS repository root CIDs to be returned.
//                              Only CIDs that have been last updated on this date or later should be returned
//
//  Success data returned: {
//    "status": "success",
//    "data": {  - (optional)
//      "<Catenis_node_index>": {
//        "cid": [String] - CID of IPFS repository root for that Catenis node
//        "lastUpdatedDate": [String] - ISO-8601 formatted date and time when CID has been last updated
//      },
//      ...
//    }
//  }
//
export function getAllIpfsRootRepoCids(req, res, next) {
    try {
        if (!this.canProcess()) {
            return next(new resError.ServiceUnavailableError('Service unavailable'));
        }

        if (!checkRequestParams(req)) {
            return next(new resError.BadRequestError('Invalid request parameters'));
        }

        const data = {};
        const nameEntries =  CNS.nameDB.getAllNameEntries(req.params.updatedSince);

        Object.keys(nameEntries).forEach((name) => {
            const ctnNodeId = ctnNodeIdFromIpfsRootDbNameKey(name);

            if (ctnNodeId) {
                data[ctnNodeIdxFromId(ctnNodeId)] = {
                    cid: nameEntries[name].value,
                    lastUpdatedDate: nameEntries[name].lastUpdatedDate.toISOString()
                }
            }
        });

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
        CNS.logger.ERROR('Error processing GET \'/ctn-node/ipfs-root\' API request.', err);
        return next(new resError.InternalServerError('Internal server error'));
    }
}

function checkRequestParams(req) {
    let valid = true;

    if (req.params.updatedSince) {
        const mtDate = moment(req.params.updatedSince, moment.ISO_8601, true);

        if (mtDate.isValid()) {
            req.params.updatedSince = mtDate.toDate();
        }
        else {
            CNS.logger.DEBUG('getAllIpfsRootRepoCids: invalid `updatedSince` query parameter [%s]', req.params.updatedSince);
            valid = false;
        }
    }

    return valid;
}
