// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import path from 'path';
import fs from 'fs';
// Third-party node modules
import config from 'config';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { LEVEL } from 'triple-beam';

// References code in other (Catenis Name Server) modules
import { CNS } from './CtnNameSrv';

// Config entries
const loggerConfig = config.get('logger');

// Configuration settings
const cfgSettings = {
    exitOnError: loggerConfig.get('exitOnError'),
    objInspectionDepth: loggerConfig.get('objInspectionDepth'),
    console: {
        active: loggerConfig.get('console.active'),
        logLevel: loggerConfig.get('console.logLevel')
    },
    file: {
        active: loggerConfig.get('file.active'),
        logLevel: loggerConfig.get('file.logLevel'),
        logDir: loggerConfig.get('file.logDir'),
        logFilename: loggerConfig.get('file.logFilename'),
        maxDays: loggerConfig.get('file.maxDays')
    }
};

const mergeMetaArguments = winston.format((info, opts) => {
    if (info.metaArgs) {
        // Incorporate metadata arguments into the message itself
        const args = info.metaArgs.concat();

        // Check for literal objects and arrays and replace them with their corresponding string
        //  representation so they appear in a new line
        args.forEach((arg, idx) => {
            if (typeof arg === 'object' && arg !== null && arg.constructor && ((arg.constructor.name === 'Object' && Object.keys(arg).length > 0) || (arg.constructor.name === 'Array' && arg.length > 0))) {
                args[idx] = '\n' + util.inspect(arg, {depth: cfgSettings.objInspectionDepth, colors: opts && opts.colors});
            }
        });

        // Adjust default inspect options if required
        let colorsOptReset = false;
        let defaultDepthOpt;

        if (opts && opts.colors && !util.inspect.defaultOptions.colors) {
            util.inspect.defaultOptions.colors = true;
            colorsOptReset = true;
        }

        if (cfgSettings.objInspectionDepth !== util.inspect.defaultOptions.depth) {
            defaultDepthOpt = util.inspect.defaultOptions.depth;
            util.inspect.defaultOptions.depth = cfgSettings.objInspectionDepth;
        }

        // Merge arguments
        info.message = util.format(info.message, ...args);

        // Reset default inspect options if necessary
        if (colorsOptReset) {
            util.inspect.defaultOptions.colors = false;
        }

        if (defaultDepthOpt) {
            util.inspect.defaultOptions.depth = defaultDepthOpt;
        }
    }

    return info;
});


// Definition of function classes
//

// Logger function class
export function Logger() {
    setUpTransports.call(this);

    // Instantiate the logger object itself
    this._logger = winston.createLogger({
        levels: Logger.logSeverity.levels,
        level: 'INFO',
        exitOnError: cfgSettings.exitOnError,
        transports: [
            this.logTransport.console,
            this.logTransport.dailyRotateFile
        ]
    });

    winston.addColors(Logger.logSeverity.colors);

    // Set up logger error handler
    this._logger.on('error', loggerErrorHandler.bind(this))
}


// Public Logger object methods
//

Logger.prototype._log = function (transport, level, message, ...args) {
    const info = {
        level: level,
        message: message
    };

    if (args.length > 0) {
        info.metaArgs = args;
    }

    if (transport) {
        // Make sure to add level symbol entry and to include dummy callback
        info[LEVEL] = level;
        transport._write(info, 'utf8', () => {});
    }
    else {
        this._logger.log(info);
    }
};


// Module functions used to simulate private Logger object methods
//  NOTE: these functions need to be bound to a Logger object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function setUpTransports() {
    const transportOptions = {
        console: {
            level: validLogLevel(cfgSettings.console.logLevel, 'INFO'),
            silent: !cfgSettings.console.active,
            handleExceptions: true,
            exceptionsLevel: 'FATAL',
            humanReadableUnhandledException: true,
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                mergeMetaArguments({colors: true}),
                winston.format.printf(formatLogMessage)
            )
        },
        dailyRotateFile: {
            level: validLogLevel(cfgSettings.file.logLevel, 'DEBUG'),
            silent: !cfgSettings.file.active,
            handleExceptions: true,
            exceptionsLevel: 'FATAL',
            humanReadableUnhandledException: true,
            datePattern: 'YYYY-MM-DD',
            dirname: path.join(global.CNS_ROOT_DIR, cfgSettings.file.logDir),
            filename: cfgSettings.file.logFilename,
            maxFiles: cfgSettings.file.maxDays + 'd',
            auditFile: path.join(global.CNS_ROOT_DIR, cfgSettings.file.logDir, '.log-audit.json'),
            format: winston.format.combine(
                winston.format.timestamp(),
                mergeMetaArguments({colors: false}),
                winston.format.printf(formatLogMessage)
            )
        }
    };

    if (!transportOptions.dailyRotateFile.silent) {
        // Logging to file is active. Make sure that logging directory exists
        try {
            fs.accessSync(transportOptions.dailyRotateFile.dirname);
        }
        catch (err) {
            // Assume that directory does not yet exists and try to create it
            try {
                fs.mkdirSync(transportOptions.dailyRotateFile.dirname, 0o755);
            }
            catch (err2) {
                // Error creating log directory
                throw new Error('Unable to create log directory: ' + err2.toString());
            }
        }
    }

    // Instantiate logging transports
    this.logTransport = {
        console: new winston.transports.Console(transportOptions.console),
        dailyRotateFile: new winston.transports.DailyRotateFile(transportOptions.dailyRotateFile)
    };
}


// Logger function class (public) methods
//

Logger.initialize = function () {
    addLoggingMethods();

    // Instantiate Logger object
    CNS.logger = new Logger();
};


// Logger function class (public) properties
//

Logger.logSeverity = Object.freeze({
    levels: Object.freeze({
        FATAL: 0,
        error: 101,     // Workaround to properly log exceptions (otherwise, winston fails with the following error message: "[winston] Unknown logger level: error")
        ERROR: 100,
        WARN: 200,
        INFO: 300,
        DEBUG: 400,
        TRACE: 500,
        ALL: 9998
    }),
    colors: Object.freeze({
        FATAL: 'magenta',
        error: 'red',
        ERROR: 'red',
        WARN: 'yellow',
        INFO: 'blue',
        DEBUG: 'green',
        TRACE: 'gray',
        ALL: 'gray'
    })
});

Logger.largestLevelLength = computeLargestLevelLength();


// Definition of module (private) functions
//

function computeLargestLevelLength() {
    return Object.keys(Logger.logSeverity.levels).reduce((largestLength, level) => {
        return level.length > largestLength ? level.length : largestLength;
    }, 0);
}

function addLoggingMethods() {
    Object.keys(Logger.logSeverity.levels).forEach((level) => {
        Logger.prototype[level] = function (message, ...args) {
            return this._log(null, level, message, ...args);
        };
    });
}

function validLogLevel(level, defaultLevel) {
    return level in Logger.logSeverity.levels ? level : defaultLevel;
}

function formatLogMessage(info) {
    const paddingLength = Logger.largestLevelLength - info[LEVEL].length;
    const padding = paddingLength > 0 ? Buffer.alloc(paddingLength, ' ').toString() : '';
    const prefix = info.timestamp ? `${info.timestamp} - ` : '';

    return `${prefix}${info.level}:${padding} ${info.message}`;
}

function loggerErrorHandler(error, transport) {
    let errMsg = transport ? util.format('Error sending log message via \'%s\' transport.', transport.name)
            : 'Logger error.';

    // Log error to console
    console.error(util.format('%s - ****** %s', new Date().toISOString(), errMsg), error);
}


// Module code
//
Logger.initialize();