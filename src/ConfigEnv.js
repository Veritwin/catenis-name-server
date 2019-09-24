/**
 * Created by claudio on 2019-09-15
 */

// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
// Third-party node modules


// Module code
//

// Set application root directory
global.CNS_ROOT_DIR = path.join(__dirname, '..');

// Set config directory
if (!process.env.NODE_CONFIG_DIR) {
    process.env.NODE_CONFIG_DIR = path.join(global.CNS_ROOT_DIR, 'config');
}
