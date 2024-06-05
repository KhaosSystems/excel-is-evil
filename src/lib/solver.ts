import type { today, getLocalTimeZone, startOfYear, endOfYear, CalendarDate } from '@internationalized/date'

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

export interface Entry {
  type: EntryType
  description: string
  amount: number
  interval: EntryInterval
  timeRange: EntryTimeRange
}

export interface TimestampEntry {
  timestamp: CalendarDate
  amount: number
}

export interface Result {
  timestamps: TimestampEntry[]
}

export function solve(entries: Entry[]): Result {
  let result: Result = { timestamps: [] }

  entries.forEach(entry => {
    try {
      if (entry.interval == EntryInterval.Never) {
        return
      }

      let current = entry.timeRange.start
      let forceEnd = false
      while (!forceEnd && current <= entry.timeRange.end) {
        result.timestamps.push({ timestamp: current, amount: entry.amount })

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

export type MonthlyResult = {
  [month: string]: number
}

export function accumulateMonthly(result: Result): MonthlyResult {
  const monthlyResult: MonthlyResult = {}

  result.timestamps.forEach(entry => {
    const month = entry.timestamp.month
    const year = entry.timestamp.year
    const key = `${new Date(2000, month, 0).toLocaleString('default', { month: 'short' })} ${year}`

    if (!monthlyResult[key]) {
      monthlyResult[key] = 0
    }

    monthlyResult[key] += entry.amount
  })

  return monthlyResult
}

export default {
  solve,
  accumulateMonthly,
}
