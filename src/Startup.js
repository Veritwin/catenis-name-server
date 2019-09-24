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

// References code in other (Catenis Name Server) modules
import {CNS} from './CtnNameSrv';
import {Application} from './Application';
import {NameDB} from './NameDB';
import {CtnNode} from './CtnNode';
import {RestApi} from './RestAPI';

// Module code
//

Application.initialize();
NameDB.initialize();
CtnNode.initialize();
RestApi.initialize();