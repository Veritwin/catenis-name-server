/**
 * Created by claudio on 2019-09-17
 */


// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
import fs from 'fs';
// Third-party node modules
import config from 'config';
import Loki from 'lokijs';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {
    DbNotReadyError
} from './CustomErrors';

// Config entries
const nameDbConfig = config.get('nameDB');

// Configuration settings
const cfgSettings = {
    dbDir: nameDbConfig.get('dbDir'),
    dbFilename: nameDbConfig.get('dbFilename'),
    autoSaveInterval: nameDbConfig.get('autoSaveInterval')
};


// Definition of function classes
//

// NameDB function class
export function NameDB(dbPath) {
    this.dbPath = dbPath;
    this.dbReady = false;

    checkDirExists.call(this);

    // Instantiate loki DB
    this.db = new Loki(this.dbPath, {
        autoload: true,
        autoloadCallback : dbLoaded.bind(this),
        autosave: true,
        autosaveInterval: cfgSettings.autoSaveInterval
    });
}


// Public NameDB object methods
//

NameDB.prototype.shutdown = function () {
    if (this.dbReady) {
        this.db.saveDatabase((err) => {
            if (err) {
                CNS.logger.ERROR('Error persisting database for shutdown', err);
            }

            CNS.app.setDbStopped();
        });

        this.dbReady = false;
    }
    else {
        CNS.app.setDbStopped();
    }
};

NameDB.prototype.getNameEntry = function (name) {
    if (!this.dbReady) {
        throw new DbNotReadyError('NameDB not currently available');
    }

    const docName = this.collName.by('name', name);

    if (docName) {
        return {
            value: docName.value,
            lastUpdatedDate: new Date(docName.lastUpdatedDate)
        };
    }
};

NameDB.prototype.setNameEntry = function (name, value, lastUpdatedDate) {
    if (!this.dbReady) {
        throw new DbNotReadyError('NameDB not currently available');
    }

    let docName = this.collName.by('name', name);

    if (!docName) {
        this.collName.insert({
            name: name,
            value: value,
            lastUpdatedDate: (lastUpdatedDate instanceof Date) ? lastUpdatedDate : new Date()
        });
    }
    else {
        docName.value = value;
        docName.lastUpdatedDate = (lastUpdatedDate instanceof Date) ? lastUpdatedDate : new Date();

        this.collName.update(docName);
    }
};

NameDB.prototype.getAllNameEntries = function (updatedSince) {
    if (!this.dbReady) {
        throw new DbNotReadyError('NameDB not currently available');
    }

    const selector = {};

    if (updatedSince instanceof Date) {
        selector.lastUpdatedDate = {
            $gte: updatedSince
        }
    }

    return this.collName.find(selector).reduce((names, doc) => {
        names[doc.name] = {
            value: doc.value,
            lastUpdatedDate: new Date(doc.lastUpdatedDate)
        };

        return names;
    }, {});
};


// Module functions used to simulate private NameDB object methods
//  NOTE: these functions need to be bound to a NameDB object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function checkDirExists() {
    // Make sure that DB directory exists
    try {
        fs.accessSync(path.dirname(this.dbPath));
    }
    catch (err) {
        // Assume that directory does not yet exists and try to create it
        try {
            fs.mkdirSync(path.dirname(this.dbPath), 0o755);
        }
        catch (err2) {
            // Error creating DB directory
            throw new Error('Unable to create DB directory: ' + err2.toString());
        }
    }
}

function dbLoaded() {
    // Check if it needs to create the collections
    this.collName = this.db.getCollection('Name');

    if (!this.collName) {
        this.collName = this.db.addCollection('Name', {
            unique: ['name'],
            indices: ['name', 'lastUpdatedDate']
        });
    }

    this.dbReady = true;

    // Indicate that DB is started
    CNS.app.setDbStarted();
}

// NameDB function class (public) methods
//

NameDB.initialize = function () {
    CNS.nameDB = new NameDB(path.join(global.CNS_ROOT_DIR, cfgSettings.dbDir, cfgSettings.dbFilename));
};


// NameDB function class (public) properties
//

//NameDB.prop = {};


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//
