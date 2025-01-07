export function midnightOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function plus(
  d: Date,
  plus: {
    years?: number
    months?: number
    days?: number
  }
): Date {
  const {years, months, days} = plus
  return new Date(
    d.getFullYear() + (years == null ? 0 : years),
    d.getMonth() + (months == null ? 0 : months),
    d.getDate() + (days == null ? 0 : days)
  )
}

export function min(d1: Date, d2: Date): Date {
  return d1 < d2 ? d1 : d2
}

export function max(d1: Date, d2: Date): Date {
  return d1 > d2 ? d1 : d2
}

export function toYYYY_MM_DD(d: Date): string {
  return `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
}

export function toYYYYMMDD(d: Date): string {
  return `${d.getFullYear().toString().padStart(4, "0")}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`
}

export function currentYearStr(): string {
  return `${new Date().getFullYear()}`
}
