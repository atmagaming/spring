import chalk from "chalk";

export {};

declare global {
    /** {@link console.log} */
    const log: Log;
}

class Log {
    private readonly prefixMap = new Map<string, string>();
    constructor() {
        this.register("log", chalk.gray("[LOG]"));
        this.register("info", chalk.blue("[INFO]"));
        this.register("warn", chalk.yellow("[WARN]"));
        this.register("error", chalk.red("[ERROR]"));
    }

    log(...args: unknown[]) {
        this.logWith("log", ...args);
    }

    info(...args: unknown[]) {
        this.logWith("info", ...args);
    }
    warn(...args: unknown[]) {
        this.logWith("warn", ...args);
    }
    error(...args: unknown[]) {
        this.logWith("error", ...args);
    }

    from(prefix: string, ...args: unknown[]) {
        this.logWith(prefix, ...args);
    }

    register(prefix: string, display: string) {
        this.prefixMap.set(prefix, display);
    }

    private logWith(prefix: string, ...args: unknown[]) {
        const display = this.prefixMap.get(prefix);
        // eslint-disable-next-line no-console
        console.log(chalk.gray(display), ...args);
    }
}

Reflect.defineProperty(globalThis, "log", {
    value: new Log(),
});
