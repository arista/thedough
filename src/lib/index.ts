// Re-exports all the exports from all modules, for convenient
// importing by other modules.  Modules can make use of this with a
// single import line:
//
//   import {A, M} from ".../index.js"
//
// The "A" namespace represents "All" exports - for example,
// "A.Uploader" brings in all exports from the "Uploader" modules, so
// you can reference things like "A.Uploader.Props".
//
// The "M" namespace represents the "Main" exports of each module,
// which is particularly useful when the module's name is the same as
// that export.  For example, "M.Uploader" would be equivalent to
// "A.Uploader.Uploader", but is less awkward.

export * as A from "./indexAll.js"
export * as M from "./indexMains.js"
