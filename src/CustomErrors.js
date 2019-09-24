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


// Definition of classes
//

// DbNotReadyError class
export class DbNotReadyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DbNotReadyError';
    }
}
