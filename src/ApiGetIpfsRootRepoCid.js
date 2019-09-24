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


// Definition of module (private) functions
//

// Method used to process POST '/ctn-node/:nodeIdx/ipfs-root' endpoint of Rest API
export function getIpfsRootRepoCid(req, res, next) {
    if (!this.apiReady) {
        return next(new resError.ServiceUnavailableError());
    }

    const data = {};
    const nameEntry =  CNS.nameDB.getNameEntry(dbNameKey(req));

    if (nameEntry) {
        data.cid = nameEntry.value;
        data.lastUpdatedDate = nameEntry.lastUpdatedDate.toISOString();
    }

    res.send({
        status: 'success',
        data: data
    });
    return next();
}

export function dbNameKey(req) {
    return req.username + '.ipfs-root';
}