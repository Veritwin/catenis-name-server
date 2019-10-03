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
    shutdownTimeout: appConfig.get('shutdownTimeout'),
    shutdownWithErrorTimeout: appConfig.get('shutdownWithErrorTimeout')
};


// Definition of function classes
//

// Application function class
export function Application() {
    this.dbRunning = false;
    this.restApiRunning = false;
    this.runningState = Application.runningState.starting;
    this.fatalError = false;

    // Set up handler to gracefully shutdown the application
    process.on('SIGTERM', processShutdown.bind(this));

    process.on('uncaughtException', shutdownWithError.bind(this));

    Object.defineProperties(this,{
        environment: {
            get: function () {
                return cfgSettings.environment;
            },
            enumerable: true
        },
        domainRoot: {
            get: function () {
                return envSubdomainPrefix(this.environment) + cfgSettings.domain;
            },
            enumerable: true
        },
        ready: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.runningState === Application.runningState.ready;
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
    CNS.logger.TRACE('Application started');
    this.runningState = Application.runningState.started;

    // Synchronize this CNS instance with all accessible remote CNS instances
    CNS.cnsInstance.synchronize(() => {
        this.runningState = Application.runningState.ready;
        CNS.logger.INFO('Application ready');
    });
}

function processShutdown() {
    this.runningState = Application.runningState.stopping;

    if (CNS.restApi) {
        // Shutdown Rest API
        CNS.restApi.shutdown();

        // Wait for some time to make sure that all processing is finalized gracefully
        //  before shutting down the name Database
        setTimeout(() => CNS.nameDB.shutdown(), cfgSettings.shutdownTimeout);
    }
    else if (CNS.nameDB) {
        CNS.nameDB.shutdown()
    }
}

function finalizeShutdown() {
    if (!this.fatalError) {
        process.exit(0);
    }
}

function shutdownWithError(err) {
    // A fatal error (uncaught exception) has occurred. Try to shutdown gracefully
    //  forcing application to exit after a while
    this.fatalError = true;

    setTimeout(() => {
        process.exit(-2)
    }, cfgSettings.shutdownWithErrorTimeout);

    processShutdown.call(this);
}


// Application function class (public) methods
//

Application.initialize = function () {
    CNS.app = new Application();
};


// Application function class (public) properties
//

Application.runningState = Object.freeze({
    starting: 'starting',
    started: 'started',
    ready: 'ready',
    stopping: 'stopping'
});


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
