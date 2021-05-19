/**
 * Created by claudio on 2019-09-15
 */

// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
import util from 'util';
import url from 'url';
// Third-party node modules

// References code in other (Catenis Name Server) modules
import {strictParseInt} from './Util.js';
import {fixIt as fixMoment} from './FixMoment.js';


// Definition of module (private) functions
//

function checkCNSInstanceIdx(val) {
    const idx = strictParseInt(val);

    return !Number.isNaN(idx) && idx > 0 ? idx : undefined;
}


// Module code
//

// Fix moment class so the proper string is returned when inspecting moment objects on Node.js >= 12.0.0
fixMoment();

// Set Catenis Name Server index for this instance
if (!process.env.CNS_INSTANCE_IDX) {
    console.warn('WARN: no index for this Catenis Name Server instance [CNS_INSTANCE_IDX] has been specified. Setting it to its default value: 1');
    global.CNS_INSTANCE_IDX = 1;
}
else {
    const idx = checkCNSInstanceIdx(process.env.CNS_INSTANCE_IDX);

    if (!idx) {
        // Index for this Catenis Name Server instance is invalid. Throw exception
        throw new Error(util.format('Specified index for this Catenis Name Server instance is not valid [CNS_INSTANCE_IDX: %s]', process.env.CNS_INSTANCE_IDX));
    }

    global.CNS_INSTANCE_IDX = idx;
}

// Set application root directory
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
global.CNS_ROOT_DIR = path.join(__dirname, '..');

// Set config directory
if (!process.env.NODE_CONFIG_DIR) {
    process.env.NODE_CONFIG_DIR = path.join(global.CNS_ROOT_DIR, 'config');
}

// Set application instance
if (!process.env.NODE_APP_INSTANCE) {
    process.env.NODE_APP_INSTANCE = 'cns' + global.CNS_INSTANCE_IDX;
    console.warn('WARN: no application instance [NODE_APP_INSTANCE] has been specified. Setting it according to defined Catenis Name Server index:', process.env.NODE_APP_INSTANCE);
}