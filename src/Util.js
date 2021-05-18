/**
 * Created by claudio on 2019-09-27
 */

// Module variables
//

// References to external code

// Internal node modules
import dns from 'dns';
// Third-party node modules

// References code in other (Catenis Name Server) modules

// Definition of module (private) functions
//

export function strictParseInt(val) {
    return Number.isInteger(val) ? val : (typeof val === 'string' && /^\d+$/.test(val) ? parseInt(val, 10) : NaN);
}

export function callbackToPromise(func, context) {
    return function (...args) {
        let callback;
        const result = new Promise((resolve, reject) => {
            callback = (err, ...res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(res.length === 1 ? res[0] : res);
                }
            }
        });

        args.push(callback);
        func.apply(context, args);

        return result;
    };
}

export const promDnsResolveTxt = callbackToPromise(dns.resolveTxt);
