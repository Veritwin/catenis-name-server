/**
 * Created by claudio on 2019-09-17
 */

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import Future from 'fibers/future';

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {Application} from './Application';
import {NameDB} from './NameDB';
import {Credentials} from './Credentials';
import {CnsInstance} from './CnsInstance';
import {CtnNode} from './CtnNode';
import {RestApi} from './RestAPI';

// Module code
//

Future.task(function mainTask() {
    CNS.logger.TRACE('Starting application');
    Application.initialize();
    NameDB.initialize();
    Credentials.initialize();
    CnsInstance.initialize();
    CtnNode.initialize();
    RestApi.initialize();
}).detach();
