/**
 * Created by claudio on 2019-09-27
 */

// Module variables
//

// References to external code

// Internal node modules
import dns from 'dns';
// Third-party node modules
import Future from 'fibers/future';

// References code in other (Catenis Name Server) modules

// Definition of module (private) functions
//

export function strictParseInt(val) {
    return Number.isInteger(val) ? val : (typeof val === 'string' && /^\d+$/.test(val) ? parseInt(val, 10) : NaN);
}

export const syncDnsResolveTxt = (() => {
    const futFunc = Future.wrap(dns.resolveTxt);

    return function syncDnsResolveTxt() {
        return futFunc.apply(this, arguments).wait();
    }
})();

