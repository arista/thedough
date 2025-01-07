import {A, M} from "../index.js"

export type ClassificationRule = AccountClassificationRule

export interface AccountClassificationRule {
  type: "Account"
  match: RuleMatch
  account: string
  memo?: string
}

export type RuleMatch = PropertyRuleMatch | Array<PropertyRuleMatch>

export type PropertyRuleMatch = {[property: string]: PropertyRuleMatchValue}

export type PropertyRuleMatchValue =
  | string
  | number
  | PropertyRuleMatchValueDirective
  | Array<PropertyRuleMatchValue>

export interface PropertyRuleMatchValueDirective {
  starts?: string | Array<string>
  ends?: string | Array<string>
  includes?: string | Array<string>
  matches?: RegExp | Array<RegExp>
  lt?: string | number | Array<string | number>
  le?: string | number | Array<string | number>
  gt?: string | number | Array<string | number>
  ge?: string | number | Array<string | number>
}

export function matchesRuleMatch(
  t: M.entities.SourceTransaction,
  match: RuleMatch
): boolean {
  if (Array.isArray(match)) {
    for (const matchElem of match) {
      if (matchesRuleMatch(t, matchElem)) {
        return true
      }
    }
    return false
  } else {
    // If multiple keys are specified, must match all of them
    for (const key of Object.keys(match)) {
      const matchValue: PropertyRuleMatchValue = match[key]
      const value = (t as any)[key]
      if (!matchesRuleMatchValue(value, matchValue)) {
        return false
      }
    }
    return true
  }
}

export function matchesRuleMatchValue(
  val: any,
  matchValue: PropertyRuleMatchValue
): boolean {
  if (Array.isArray(matchValue)) {
    for (const elem of matchValue) {
      if (matchesRuleMatchValue(val, elem)) {
        return true
      }
    }
    return false
  } else {
    if (typeof matchValue === "string") {
      return matchValue === `${val}`
    } else if (typeof matchValue === "number") {
      if (typeof val === "number") {
        return val === matchValue
      } else {
        return parseFloat(`${val}`) === matchValue
      }
    } else if (typeof matchValue === "object") {
      if (
        matchStringDirective(val, matchValue.starts, (v, m) => v.startsWith(m))
      ) {
        return true
      }
      if (matchStringDirective(val, matchValue.ends, (v, m) => v.endsWith(m))) {
        return true
      }
      if (
        matchStringDirective(
          val,
          matchValue.includes,
          (v, m) => v.indexOf(m) >= 0
        )
      ) {
        return true
      }
      if (
        matchRegExpDirective(
          val,
          matchValue.matches,
          (v, m) => v.match(m) != null
        )
      ) {
        return true
      }
      if (matchCompareDirective(val, matchValue.lt, (v, m) => v < m)) {
        return true
      }
      if (matchCompareDirective(val, matchValue.le, (v, m) => v <= m)) {
        return true
      }
      if (matchCompareDirective(val, matchValue.gt, (v, m) => v > m)) {
        return true
      }
      if (matchCompareDirective(val, matchValue.ge, (v, m) => v >= m)) {
        return true
      }
      return false
    } else {
      return false
    }
  }
}

export function matchStringDirective(
  val: any,
  match: null | undefined | string | Array<string>,
  f: (val: string, match: string) => boolean
) {
  if (match == null) {
    return false
  } else if (Array.isArray(match)) {
    for (const elem of match) {
      if (matchStringDirective(val, elem, f)) {
        return true
      }
    }
    return false
  } else {
    return f(`${val}`, match)
  }
}

export function matchRegExpDirective(
  val: any,
  match: null | undefined | RegExp | Array<RegExp>,
  f: (val: string, match: RegExp) => boolean
) {
  if (match == null) {
    return false
  } else if (Array.isArray(match)) {
    for (const elem of match) {
      if (matchRegExpDirective(val, elem, f)) {
        return true
      }
    }
    return false
  } else {
    return f(`${val}`, match)
  }
}

export function matchCompareDirective(
  val: any,
  match: null | undefined | string | number | Array<string | number>,
  f: (val: string | number, match: string | number) => boolean
) {
  if (match == null) {
    return false
  } else if (Array.isArray(match)) {
    for (const elem of match) {
      if (matchCompareDirective(val, elem, f)) {
        return true
      }
    }
    return false
  } else {
    if (typeof match === "string") {
      return f(`${val}`, match)
    } else if (typeof match === "number") {
      if (typeof val === "number") {
        return f(val, match)
      } else {
        return f(parseFloat(val), match)
      }
    }
  }
}

export function applyClassificationRules(
  t: M.entities.SourceTransaction,
  rules: Array<ClassificationRule>
): M.Classification | null {
  for (const rule of rules) {
    const ret = applyClassificationRule(t, rule)
    if (ret != null) {
      return ret
    }
  }
  return null
}

export function applyClassificationRule(
  t: M.entities.SourceTransaction,
  rule: ClassificationRule
): M.Classification | null {
  switch (rule.type) {
    case "Account":
      if (matchesRuleMatch(t, rule.match)) {
        return {
          type: "Account",
          account: rule.account,
          memo: rule.memo,
        }
      } else {
        return null
      }
  }
}

export function validateClassificationRules(
  model: M.Model,
  rules: Array<ClassificationRule>
) {
  for (const rule of rules) {
    validateClassificationRule(model, rule)
  }
}

export function validateClassificationRule(
  model: M.Model,
  rule: ClassificationRule
) {
  switch (rule.type) {
    case "Account":
      if (!A.Accounts.findAccount(model, rule.account)) {
        throw new Error(
          `ClassificationRule specifies account "${rule.account}" which either doesn't exist or is ambiguous`
        )
      }
      break
    default:
      const unexpected: never = rule.type
  }
}
