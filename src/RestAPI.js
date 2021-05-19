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
import config from 'config';
import restify from 'restify';
import resError from 'restify-errors';
import httpSignature from 'http-signature';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr.js';
import {getIpfsRepoRootCid} from './ApiGetIpfsRepoRootCid.js';
import {setIpfsRepoRootCid} from './ApiSetIpfsRepoRootCid.js';
import {getAllIpfsRepoRootCids} from './ApiGetAllIpfsRepoRootCids.js';
import {setMultiIpfsRepoRootCid} from './ApiSetMultiIpfsRepoRootCid.js';

// Config entries
const restApiConfig = config.get('restApi');

// Configuration settings
export const cfgSettings = {
    port: restApiConfig.get('port'),
    host: restApiConfig.get('host')
};


// Definition of function classes
//

// RestApi function class
export function RestApi(port, host) {
    this.apiReady = false;

    const opts = {};

    this.apiServer = new restify.createServer(opts);

    this.apiServer.use(restify.plugins.acceptParser(['application/json']));
    this.apiServer.use(restify.plugins.authorizationParser());
    this.apiServer.use(authenticateRequest);
    this.apiServer.use(restify.plugins.bodyParser({
        rejectUnknown: true
    }));
    this.apiServer.use(restify.plugins.queryParser({mapParams: true}));

    this.apiServer.on('restifyError', errorHandler);

    // Define API methods
    this.apiServer.get('/ctn-node/:nodeIdx/ipfs-root', getIpfsRepoRootCid.bind(this));
    this.apiServer.post('/ctn-node/:nodeIdx/ipfs-root', setIpfsRepoRootCid.bind(this));
    this.apiServer.get('/ctn-node/ipfs-root', getAllIpfsRepoRootCids.bind(this));
    this.apiServer.post('/ctn-node/ipfs-root', setMultiIpfsRepoRootCid.bind(this));

    this.apiServer.listen(port, host, () => {
        CNS.logger.INFO('Catenis Name Server started at', this.apiServer.address());
        this.apiReady = true;
        CNS.app.setRestApiStarted();
    });
}


// Public RestApi object methods
//

RestApi.prototype.canProcess = function () {
    return this.apiReady && CNS.app.ready;
};

RestApi.prototype.shutdown = function () {
    if (this.apiReady) {
        this.apiServer.close((err) => {
            if (err) {
                CNS.logger.ERROR('Error closing REST API connection', err);
            }

            CNS.app.setRestApiStopped();
        });

        this.apiReady = false;
    }
    else {
        CNS.app.setRestApiStopped();
    }
};


// Module functions used to simulate private RestApi object methods
//  NOTE: these functions need to be bound to a RestApi object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// RestApi function class (public) methods
//

RestApi.initialize = function () {
    CNS.restApi = new RestApi(cfgSettings.port, cfgSettings.host);
};


// RestApi function class (public) properties
//

//RestApi.prop = {};


// Definition of module (private) functions
//

function authenticateRequest(req, res, next) {
    if (req.username === 'anonymous') {
        return next(new resError.UnauthorizedError('Authentication required'));
    }

    if (!req.authorization.signature) {
        return next(new resError.UnauthorizedError('Unsupported authentication method'));
    }

    // Try to lookup user
    const userInfo = CNS.credentials.getUserInfoById(req.username);

    if (!userInfo) {
        CNS.logger.ERROR('Error authenticating request: username not found [%s]', req.username);
        return next(new resError.UnauthorizedError('Invalid user credentials'));
    }

    if (!httpSignature.verifySignature(req.authorization.signature, userInfo.pubKey)) {
        CNS.logger.ERROR('Error authenticating request: failed to verify signature for user %s', req.username);
        return next(new resError.UnauthorizedError('Invalid user credentials'));
    }

    req.userInfo = userInfo;

    return next();
}

function errorHandler(req, res, err, cb) {
    err.toString = function () {
        return err.message ? err.message : err.code;
    };

    err.toJSON = function () {
        return {
            status: 'error',
            message: err.message ? err.message : err.code
        }
    };

    cb();
}


// Module code
//
