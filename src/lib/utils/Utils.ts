import * as fs from "node:fs"
import {packageDirectorySync} from "pkg-dir"
import * as url from "node:url"
import canonicalize from "canonicalize"

export function notNull<T>(val: T | null | undefined, str?: string): T {
  if (val == null) {
    if (str == null) {
      throw new Error(`Assertion failed: value is null`)
    } else {
      throw new Error(`Assertion failed: value is null: ${str}`)
    }
  }
  return val
}

export function fileExists(path: string): boolean {
  try {
    fs.statSync(path)
    return true
  } catch (e) {
    return false
  }
}

export function getPackageDirectory(): string {
  const __filename = url.fileURLToPath(import.meta.url)
  return notNull(packageDirectorySync({cwd: __filename}))
}

export function readJsonFile<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename).toString())
}

export function toCanonicalJson(obj: Object): string {
  // This is needed, unfortunately, to avoid a TS error with
  // canonicalize.  Hopefully this will eventually be fixed
  // @ts-expect-error
  return canonicalize(obj)
}

export function dateToYYYYMMDD(date: Date): string {
  const yearStr = `${date.getFullYear()}`.padStart(4, "0")
  const monthStr = `${date.getMonth() + 1}`.padStart(2, "0")
  const dateStr = `${date.getDate()}`.padStart(2, "0")
  return `${yearStr}-${monthStr}-${dateStr}`
}

export function toCurrency(value: number, currency: string): string {
  return Intl.NumberFormat("en-us", {style: "currency", currency}).format(
    value / 100.0
  )
}

export function normalizeString(str: string): string {
  return str
    .replaceAll(/^\s+/g, "")
    .replaceAll(/\s+$/g, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll("|", "")
}

export function compareStrings(s1: string, s2: string): number {
  return s1 < s2 ? -1 : s1 > s2 ? 1 : 0
}

export type Comparable =
  | boolean
  | string
  | number
  | null
  | undefined
  | Array<boolean | string | number | null | undefined>

export function compare(v1: Comparable, v2: Comparable): number {
  if (Array.isArray(v1) && Array.isArray(v2)) {
    for (let i = 0; i < v1.length && i < v2.length; i++) {
      const cmp = compare(v1[i], v2[i])
      if (cmp !== 0) {
        return cmp
      }
    }
    return compare(v1.length, v2.length)
  } else if (typeof v1 === "boolean" && typeof v2 === "boolean") {
    return !v1 && v2 ? -1 : v1 && !v2 ? 1 : 0
  } else if (typeof v1 === "string" && typeof v2 === "string") {
    return v1 < v2 ? -1 : v1 > v2 ? 1 : 0
  } else if (typeof v1 === "number" && typeof v2 === "number") {
    return v1 < v2 ? -1 : v1 > v2 ? 1 : 0
  } else if (typeof v1 == null && v2 == null) {
    return 0
  } else {
    return compare(typeof v1, typeof v2)
  }
}

export function sortBy<T, V extends Comparable>(
  arr: Array<T>,
  f: (elem: T) => V,
  ascending: boolean = true
) {
  return arr.sort((e1, e2) => {
    const v1 = f(e1)
    const v2 = f(e2)
    const ret = compare(v1, v2)
    return ascending ? ret : -ret
  })
}
