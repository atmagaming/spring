declare global {
    /** Throws if condition is falsy. Will not do anything in PROD builds */
    function assert<T>(condition: T, reason?: string): asserts condition;
}

if (import.meta.env.PROD)
    Reflect.defineProperty(globalThis, "assert", {
        value() {
            return;
        },
        writable: false,
        enumerable: false,
        configurable: false,
    });
else
    Reflect.defineProperty(globalThis, "assert", {
        value<T>(condition: T, reason = "Assertion failed"): asserts condition {
            if (!condition) throw new Error(reason);
        },
        writable: false,
        enumerable: false,
        configurable: false,
    });
