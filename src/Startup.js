/**
 * Created by claudio on 2019-09-17
 */

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import fs from 'fs';
import path from 'path';
// Third-party node modules
import config from 'config';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSvr';
import {Application} from './Application';
import {NameDB} from './NameDB';
import {Credentials} from './Credentials';
import {CnsInstance} from './CnsInstance';
import {CtnNode} from './CtnNode';
import {RestApi} from './RestAPI';

// Config entries
const startupConfig = config.get('startup');

// Configuration settings
const cfgSettings = {
    pidFilenameFormat: startupConfig.get('pidFilenameFormat')
};


// Definition of module (private) functions
//

function saveProcessId() {
    fs.writeFile(path.join(global.CNS_ROOT_DIR, util.format(cfgSettings.pidFilenameFormat, global.CNS_INSTANCE_IDX)), process.pid.toString(), (err) => {
        if (err) {
            // Error recording process ID
            CNS.logger.ERROR('Error recording process ID.', err);
        }
    });
}


// Module code
//

(async function mainTask() {
    CNS.logger.TRACE('Starting application');
    // Record ID of current process
    saveProcessId();

    Application.initialize();
    NameDB.initialize();
    Credentials.initialize();
    await CnsInstance.initialize();
    await CtnNode.initialize();
    RestApi.initialize();
})();
