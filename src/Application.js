/**
 * Created by claudio on 2019-09-17
 */

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';

// Config entries
const appConfig = config.get('application');

// Configuration settings
const cfgSettings = {
    environment: appConfig.get('environment'),
    domain: appConfig.get('domain'),
    shutdownTimeout: appConfig.get('shutdownTimeout')
};


// Definition of function classes
//

// Application function class
export function Application() {
    this.dbRunning = false;
    this.restApiRunning = false;
    this.shuttingDown = false;

    // Set up handler to gracefully shutdown the application
    process.on('SIGTERM', processShutdown.bind(this));

    Object.defineProperties(this,{
        environment: {
            get: function () {
                return cfgSettings.environment;
            },
            enumerable: true
        },
        rootSubdomain: {
            get: function () {
                return envSubdomainPrefix(this.environment) + cfgSettings.domain;
            },
            enumerable: true
        }
    });
}


// Public Application object methods
//

Application.prototype.setDbStarted = function () {
    if (!this.dbRunning) {
        this.dbRunning = true;

        if (checkInitComplete.call(this)) {
            startProcessing.call(this);
        }
    }
};

Application.prototype.setRestApiStarted = function () {
    if (!this.restApiRunning) {
        this.restApiRunning = true;

        if (checkInitComplete.call(this)) {
            startProcessing.call(this);
        }
    }
};

Application.prototype.setDbStopped = function () {
    if (this.dbRunning) {
        this.dbRunning = false;

        if (checkShutdownComplete.call(this)) {
            finalizeShutdown.call(this);
        }
    }
};

Application.prototype.setRestApiStopped = function () {
    if (this.restApiRunning) {
        this.restApiRunning = false;

        if (checkShutdownComplete.call(this)) {
            finalizeShutdown.call(this);
        }
    }
};


// Module functions used to simulate private Application object methods
//  NOTE: these functions need to be bound to a Application object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function checkInitComplete() {
    return this.dbRunning && this.restApiRunning;
}

function checkShutdownComplete() {
    return !this.dbRunning && !this.restApiRunning;
}

function startProcessing() {
}

function processShutdown() {
    // Shutdown database
    CNS.nameDB.shutdown();

    // Shutdown Rest API
    CNS.restApi.shutdown();
}

function finalizeShutdown() {
    // Wait for some time to make sure that all processing is finalized gracefully
    setTimeout(() => process.exit(0), cfgSettings.shutdownTimeout);
}


// Application function class (public) methods
//

Application.initialize = function () {
    CNS.app = new Application();
};


// Application function class (public) properties
//

//Application.prop = {};


// Definition of module (private) functions
//

function envSubdomainPrefix(env) {
    let prefix;

    switch (env) {
        case 'development':
            prefix = 'dev.';
            break;

        case 'sandbox':
            prefix = 'sandbox.';
            break;

        default:
            prefix = '';
            break;
    }

    return prefix;
}


// Module code
//
