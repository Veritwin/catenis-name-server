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
import resError from 'restify-error';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {dbNameKey} from './ApiGetIpfsRootRepoCid';


// Definition of module (private) functions
//

// Method used to process POST '/ctn-node/:nodeIdx/ipfs-root' endpoint of Rest API
export function setIpfsRootRepoCid(req, res, next) {
    if (!this.apiReady) {
        return next(new resError.ServiceUnavailableError());
    }

    if (req.getContentType() !== 'application/json') {
        return next(new resError.UnsupportedMediaTypeError())
    }

    if (!(typeof req.body === 'object' && typeof req.body.cid === 'string')) {
        return next(new resError.BadRequestError('Missing or invalid cid parameter'));
    }

    // Make sure that use is trying to update its own IPFS root repository CID
    if (req.ctnNodeInfo.idx !== parseInt(req.params.nodeIdx)) {
        return next(new resError.UnauthorizedError('User not allowed to update resource'));
    }

    CNS.nameDB.setNameEntry(dbNameKey(req), req.body.cid);

    res.send({
        status: 'success'
    });
    return next();
}