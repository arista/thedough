import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"

const extensions = [".js"]
const plugins = [
  json(),
  commonjs(),
  resolve(),

  // This is needed because react code for some reason contains a
  // couple references to process.env, so this effectively gets rid of
  // those references.
  replace({
    preventAssignment: false,
    "process.env.NODE_ENV": `"development"`
  })
  // Include this to minify
//  terser(),
]

export default [
  {
    treeshake: {
      // This assumes that importing modules has no side effects, so
      // it can safely pick only the module elements being used
      // instead of the whole module (which enables the whole "import
      // {A,M}" scheme)
      preset: "smallest",
    },
    input: "build/dist/src/webapp/index.js",
    output: {
      file: "build/webapp/js/webapp.js",
      format: "iife",
      name: "webappBundle",
    },
    plugins,
  },
]
