/**
 * Created by claudio on 2019-09-27
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
import { makeIpfsRootDbNameKey, makeCtnNodeId } from './CtnNode';
import {Credentials} from './Credentials';
import {strictParseInt} from './Util';


// Definition of module (private) functions
//

// Method used to process POST '/ctn-node/ipfs-root' endpoint of Rest API
//
//  JSON payload: {
//    "<Catenis_node_index>": {
//      "cid": [String],  - Catenis node IPFS repository root CID
//      "lastUpdatedDate": [String]  - (optional) ISO-8601 formatted date and time when CID for this Catenis node's IPFS repository root has last been recorded
//    },
//    ...
//  }
//
//  Success data returned: {
//    "status": "success"
//  }
//
export function setMultiIpfsRootRepoCid(req, res, next) {
    try {
        if (!this.canProcess()) {
            return next(new resError.ServiceUnavailableError('Service unavailable'));
        }

        // Make sure that only CNS instances can call this method
        if (req.userInfo.role !== Credentials.roles.cnsInstance) {
            return next(new resError.UnauthorizedError('User not allowed to access resource'));
        }

        if (req.getContentType() !== 'application/json') {
            return next(new resError.UnsupportedMediaTypeError('Unsupported media type'))
        }

        if (!(typeof req.body === 'object' && req.body !== null)) {
            return next(new resError.BadRequestError('Missing body parameters'));
        }

        if (!validateBodyParams(req.body)) {
            return next(new resError.BadRequestError('Missing or invalid body parameters'));
        }

        Object.keys(req.body).forEach((key) => {
            const nodeEntry = req.body[key];
            const nodeIdx = parseInt(key);
            const ipfsRootDbNameKey = makeIpfsRootDbNameKey(nodeIdx);
            const nameEntry = CNS.nameDB.getNameEntry(ipfsRootDbNameKey);

            if (nameEntry && !nodeEntry.mtLastUpdatedDate.isAfter(nameEntry.lastUpdatedDate)) {
                CNS.logger.DEBUG('setMultiIpfsRootRepoCid: received CID is not newer than current CID value for the designated name and shall not be updated', {
                    currentNameEntry: nameEntry,
                    nodeIdx: nodeIdx,
                    nodeEntry: nodeEntry
                });
            }
            else {
                CNS.nameDB.setNameEntry(ipfsRootDbNameKey, nodeEntry.cid, nodeEntry.mtLastUpdatedDate.toDate());
            }
        });

        res.send({
            status: 'success'
        });
        return next();
    }
    catch (err) {
        CNS.logger.ERROR('Error processing POST \'/ctn-node/ipfs-root\' API request.', err);
        return next(new resError.InternalServerError('Internal server error'));
    }
}

function validateBodyParams(body) {
    const nodeIdxs = Object.keys(body);

    return nodeIdxs.length > 0 && nodeIdxs.every((nodeIdx) => {
        let success = false;
        const idx = strictParseInt(nodeIdx);

        if (!Number.isNaN(idx) && idx >= 0) {
            const entry = body[nodeIdx];
            let mtLastUpdatedDate;

            if (typeof entry === 'object' && entry !== null && typeof entry.cid === 'string'
                    && typeof entry.lastUpdatedDate === 'string'
                    && (mtLastUpdatedDate = moment(entry.lastUpdatedDate, moment.ISO_8601, true)).isValid()) {
                entry.mtLastUpdatedDate = mtLastUpdatedDate;
                success = true;
            }
            else {
                CNS.logger.DEBUG('setMultiIpfsRootRepoCid: invalid `Catenis node entry #%s` of body parameter [%s]', nodeIdx, entry);
            }
        }
        else {
            CNS.logger.DEBUG('setMultiIpfsRootRepoCid: invalid `Catenis node index` key of body parameter [%s]', nodeIdx);
        }

        return success;
    });
}