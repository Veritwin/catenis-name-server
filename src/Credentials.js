/**
 * Created by claudio on 2019-09-24
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


// Definition of function classes
//

// Credentials function class
export function Credentials() {
    this.userIdInfo = new Map();
}


// Public Credentials object methods
//

/**
 * Get user info by user ID
 *
 * @param userId {String} User ID
 * @returns {Object} User info: {pubKey:[String], role:[String]}
 */
Credentials.prototype.getUserInfoById = function (userId) {
    return this.userIdInfo.get(userId);
};

Credentials.prototype.addCatenisNode = function (ctnNodeId, ctnNodeInfo) {
    addUser.call(this, ctnNodeId, ctnNodeInfo.pubKey);
};

Credentials.prototype.removeCatenisNode = function (ctnNodeId) {
    removeUser.call(this, ctnNodeId);
};

Credentials.prototype.addCNSInstance = function (cnsInstanceId, cnsInstanceInfo) {
    addUser.call(this, cnsInstanceId, cnsInstanceInfo.pubKey, Credentials.roles.cnsInstance);
};

Credentials.prototype.removeCNSInstance = function (cnsInstanceId) {
    removeUser.call(this, cnsInstanceId);
};


// Module functions used to simulate private Credentials object methods
//  NOTE: these functions need to be bound to a Credentials object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function addUser(userId, pubKey, role = Credentials.roles.ctnNode) {
    this.userIdInfo.set(userId, {
        pubKey: pubKey,
        role: role
    });
}

function removeUser(userId) {
    this.userIdInfo.delete(userId);
}


// Credentials function class (public) methods
//

Credentials.initialize = function () {
    CNS.credentials = new Credentials();
};


// Credentials function class (public) properties
//

Credentials.roles = Object.freeze({
    ctnNode: 'ctnNode',
    cnsInstance: 'cnsInstance'
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//
