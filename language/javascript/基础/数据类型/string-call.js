const type = (obj) => {
    console.log(Object.prototype.toString.call(obj).slice(8, -1).toLowerCase())
}

type(undefined);           // "Undefined"
type(null);                // "Null"
type(true);                // "Boolean"
type(42);                  // "Number"
type(42n);                 // "BigInt"
type("s");                 // "String"
type(Symbol());            // "Symbol"
type({});                  // "Object"
type([]);                  // "Array"
type(/a/);                 // "RegExp"
type(new Date());          // "Date"
type(()=>{});              // "Function"
type(Promise.resolve());   // "Promise"
type(new Map());           // "Map"
type(new Set());           // "Set"
type(new WeakMap());       // "WeakMap"
type(new WeakSet());       // "WeakSet"
type(global);            // "HTMLDocument"（宿主环境扩展）
