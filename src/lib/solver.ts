import { type today, type getLocalTimeZone, type startOfYear, type endOfYear, CalendarDate } from '@internationalized/date'

export enum EntryType {
  Expense = 'expense',
  Income = 'income',
}

export enum EntryInterval {
  Never = 'never',
  Once = 'once',
  Daily = 'daily',
  Weekly = 'weekly',
  Biweekly = 'biweekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Semiannually = 'semiannually',
  Yearly = 'yearly',
}

export interface EntryTimeRange {
  start: CalendarDate
  end: CalendarDate
}

export interface Currency {
  // ISO_4217
  code: string
  // Assuming euro as base currency.
  rate: number
}

export interface Entry {
  type: EntryType
  description: string
  amount: number
  currency: Currency
  interval: EntryInterval
  category: string
  timeRange: EntryTimeRange
}

export interface TimestampEntry {
  timestamp: CalendarDate
  // In EUR
  amount: number
  category: string
}

export interface Result {
  timestamps: TimestampEntry[]
  categories: Set<string>
}

export function solve(entries: Entry[]): Result {
  let result: Result = { timestamps: [], categories: new Set<string>() }

  entries.forEach(entry => {
    try {
      if (entry.interval == EntryInterval.Never) {
        return
      }

      let current = entry.timeRange.start
      let forceEnd = false
      while (!forceEnd && current <= entry.timeRange.end) {
        result.timestamps.push({ timestamp: current, amount: entry.amount / entry.currency.rate, category: entry.category })
        result.categories.add(entry.category)

        switch (entry.interval) {
          case EntryInterval.Once:
            forceEnd = true
            break
          case EntryInterval.Daily:
            current = current.add({ days: 1 })
            break
          case EntryInterval.Weekly:
            current = current.add({ days: 7 })
            break
          case EntryInterval.Biweekly:
            current = current.add({ days: 14 })
            break
          case EntryInterval.Monthly:
            current = current.add({ months: 1 })
            break
          case EntryInterval.Quarterly:
            current = current.add({ months: 3 })
            break
          case EntryInterval.Semiannually:
            current = current.add({ months: 6 })
            break
          case EntryInterval.Yearly:
            current = current.add({ years: 1 })
            break
          default:
            forceEnd = true
            break
        }
      }
    } catch (error) {
      console.log(`Failed to process entry. '${error}'`)
    }
  })

  return result
}

export type CategorizedResult = {
  category: string
  balance: number
}

export type MonthlyResult = {
  date: CalendarDate
  label: string
  categorizedResults: CategorizedResult[]
}

export function accumulateMonthly(result: Result): MonthlyResult[] {
  const monthlyResults: MonthlyResult[] = []

  result.timestamps.forEach(entry => {
    try {
      const month = entry.timestamp.month
      const year = entry.timestamp.year
      const date = new CalendarDate(year, month, 0)
      const label = `${new Date(0, month, 0).toLocaleString('default', { month: 'short' })} ${year}`

      let monthlyResult = monthlyResults.find(e => e.date.toString() == date.toString())
      if (!monthlyResult) {
        let newLength = monthlyResults.push({ date: date, label: label, categorizedResults: [] })
        monthlyResult = monthlyResults[newLength - 1]
      }

      let categorizedResult = monthlyResult.categorizedResults.find(e => e.category == entry.category)
      if (!categorizedResult) {
        let newLength = monthlyResult.categorizedResults.push({ category: entry.category, balance: entry.amount })
        categorizedResult = monthlyResult.categorizedResults[newLength - 1]
      } else {
        categorizedResult.balance += entry.amount
      }
    } catch (error) {
      console.log(`Failed accumulating result for entry. '${error}'`)
    }
  })

  return monthlyResults
}

export default {
  solve,
  accumulateMonthly,
}
