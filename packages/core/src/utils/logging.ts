export {};

declare global {
    /** {@link console.log} */
    function log(...args: unknown[]): void;
}

Reflect.defineProperty(globalThis, "log", {
    value(...args: unknown[]) {
        // eslint-disable-next-line no-console
        console.log(...args);
    },
    writable: false,
    enumerable: false,
    configurable: false,
});
