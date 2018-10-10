export function gcd(a: number, b: number): number {
    if (typeof a !== "number" || typeof b !== "number") throw new Error("Invalid argument");
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    if (a === 0 || b === 0) return NaN;
    const r = a % b;
    return r === 0 ? b : gcd(b, r);
}

export function error() {
    throw new Error("<<error at m.ts:11>>");
}

declare const exports, require, module, __filename, __dirname;
export function evaluationContext() {
    return { exports, require, module, __filename, __dirname };
}