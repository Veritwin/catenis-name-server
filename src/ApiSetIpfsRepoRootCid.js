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
import moment from 'moment';
import async from 'async';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {checkRequestParams} from './ApiGetIpfsRepoRootCid';
import { makeIpfsRootDbNameKey, makeCtnNodeId } from './CtnNode';
import {Credentials} from './Credentials';

// Definition of module (private) functions
//

// Method used to process POST '/ctn-node/:nodeIdx/ipfs-root' endpoint of Rest API
//
//  URL parameters:
//    nodeIdx [String] - Catenis node index
//
//  JSON payload: {
//    "cid": [String],  - Catenis node IPFS root repository CID
//    "lastUpdatedDate": [String]  - (optional) ISO-8601 formatted date and time when CID for this Catenis node's IPFS root repository has last been recorded
//  }
//
//  Success data returned: {
//    "status": "success"
//  }
//
export function setIpfsRootRepoCid(req, res, next) {
    try {
        if (!this.canProcess()) {
            return next(new resError.ServiceUnavailableError('Service unavailable'));
        }

        if (req.getContentType() !== 'application/json') {
            return next(new resError.UnsupportedMediaTypeError('Unsupported media type'))
        }

        if (!checkRequestParams(req, 'setIpfsRootRepoCid')) {
            return next(new resError.BadRequestError('Missing or invalid request parameters'));
        }

        if (!(typeof req.body === 'object' && req.body !== null)) {
            return next(new resError.BadRequestError('Missing body parameters'));
        }

        if (typeof req.body.cid !== 'string') {
            CNS.logger.DEBUG('setIpfsRootRepoCid: invalid `cid` body parameter [%s], req.body.cid');
            return next(new resError.BadRequestError('Missing or invalid body parameters'));
        }

        let mtLastUpdatedDate;

        if (req.userInfo.role === Credentials.roles.cnsInstance && !(typeof req.body.lastUpdatedDate === 'string'
            && (mtLastUpdatedDate = moment(req.body.lastUpdatedDate, moment.ISO_8601, true)).isValid())) {
            CNS.logger.DEBUG('setIpfsRootRepoCid: invalid `lastUpdatedDate` body parameter [%s]', req.body.lastUpdatedDate);
            return next(new resError.BadRequestError('Missing or invalid body parameter'));
        }

        // Make sure that user is trying to update its own IPFS root repository CID
        if (req.userInfo.role === Credentials.roles.ctnNode && req.username !== makeCtnNodeId(req.params.nodeIdx)) {
            return next(new resError.UnauthorizedError('User not allowed to update resource'));
        }

        const ipfsRootDbNameKey = makeIpfsRootDbNameKey(req.params.nodeIdx);

        let updateNameEntry = true;

        if (req.userInfo.role === Credentials.roles.cnsInstance) {
            const nameEntry = CNS.nameDB.getNameEntry(ipfsRootDbNameKey);

            if (nameEntry && !mtLastUpdatedDate.isAfter(nameEntry.lastUpdatedDate)) {
                CNS.logger.DEBUG('setIpfsRootRepoCid: received CID is not newer than current CID value for the designated name and shall not be updated', {
                    currentNameEntry: nameEntry,
                    receivedParams: req.body
                });
                updateNameEntry = false;
            }
        }

        if (updateNameEntry) {
            CNS.nameDB.setNameEntry(ipfsRootDbNameKey, req.body.cid, mtLastUpdatedDate ? mtLastUpdatedDate.toDate() : undefined);

            if (req.userInfo.role === Credentials.roles.ctnNode && CNS.cnsInstance.hasRemoteCNSInstances()) {
                const nameEntry = CNS.nameDB.getNameEntry(ipfsRootDbNameKey);

                async.each(CNS.cnsInstance.remoteCnsConnection, ([cnsInstanceId, cnsClient], cb) => {
                    cnsClient.setIpfsRootRepoCid(req.params.nodeIdx, nameEntry.value, nameEntry.lastUpdatedDate, (err) => {
                        if (err) {
                            CNS.logger.ERROR('Error broadcasting newly set Catenis node IPFS root repo CID to remote CNS instance [%s].', cnsInstanceId, err);
                        }
                        cb();
                    });
                }, () => {});
            }
        }

        res.send({
            status: 'success'
        });
        return next();
    }
    catch (err) {
        CNS.logger.ERROR('Error processing POST \'/ctn-node/:nodeIdx/ipfs-root\' API request.', err);
        return next(new resError.InternalServerError('Internal server error'));
    }
}