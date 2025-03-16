import { emoji } from "@grammyjs/emoji";
import chalk from "chalk";
import type { ChatBot } from "chat-bot";
import { createSpinner } from "nanospinner";
import { inspect } from "util";
import { italic } from "./html-formatting";

class Logger {
    private readonly prefixMap = new Map<string, string>();
    private readonly activeSpinners = [] as ReturnType<typeof createSpinner>[];

    chat?: ChatBot;

    constructor() {
        this.register("debug", chalk.gray("[DEBUG]"));
        this.register("info", chalk.blue("[INFO]"));
        this.register("warn", chalk.yellow("[WARN]"));
        this.register("error", chalk.red("[ERROR]"));
    }

    debug(...args: unknown[]) {
        this.logWith("debug", ...args);
    }

    info(...args: unknown[]) {
        this.logWith("info", ...args);
        void this.chat?.sendText(italic(args.map(String).join(" ")), "HTML");
    }
    warn(...args: unknown[]) {
        this.logWith("warn", ...args);
        void this.chat?.sendText(italic(`${emoji("warning")} ${args.map(String).join(" ")}`), "HTML");
    }
    error(...args: unknown[]) {
        this.logWith("error", ...args);
        void this.chat?.sendText(italic(`${emoji("red_exclamation_mark")} ${args.map(String).join(" ")}`), "HTML");
    }

    from(prefix: string, ...args: unknown[]) {
        this.logWith(prefix, ...args);
    }

    register(prefix: string, display: string) {
        this.prefixMap.set(prefix, display);
    }

    inspect(value: unknown) {
        // eslint-disable-next-line no-console
        console.log(inspect(value, { showHidden: false, depth: null, colors: true }));
    }

    process(message: string) {
        const spinner = createSpinner(message);
        this.activeSpinners.push(spinner);

        return {
            success: (message?: string) => {
                this.flushSpinners();
                spinner.success(message);
                this.activeSpinners.remove(spinner);
            },
            update: (message: string) => {
                this.flushSpinners();
                spinner.update(message);
            },
        };
    }

    private logWith(prefix: string, ...args: unknown[]) {
        const display = this.prefixMap.get(prefix);
        this.flushSpinners();
        // eslint-disable-next-line no-console
        console.log(chalk.gray(display), ...args);
    }

    private flushSpinners() {
        for (const s of this.activeSpinners) s.clear();
    }
}

export const log = new Logger();
