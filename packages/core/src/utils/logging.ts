import chalk from "chalk";

export {};

declare global {
    /** {@link console.log} */
    const log: {
        (...args: unknown[]): void;
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    };
}

function logWith(prefix: string, ...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.log(prefix, ...args);
}

Reflect.defineProperty(globalThis, "log", {
    value: logWith.bind(null, chalk.gray("[LOG]")),
    writable: false,
    enumerable: false,
    configurable: false,
});

Reflect.defineProperty(log, "info", {
    value: logWith.bind(null, chalk.blue("[INFO]")),
    writable: false,
    enumerable: false,
    configurable: false,
});

Reflect.defineProperty(log, "warn", {
    value: logWith.bind(null, chalk.yellow("[WARN]")),
    writable: false,
    enumerable: false,
    configurable: false,
});

Reflect.defineProperty(log, "error", {
    value: logWith.bind(null, chalk.red("[ERROR]")),
    writable: false,
    enumerable: false,
    configurable: false,
});
