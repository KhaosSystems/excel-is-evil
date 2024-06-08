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

export interface SolverOptions {
  excludedCategories: string[]
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

export function solve(entries: Entry[], options: SolverOptions = { excludedCategories: [] }): Result {
  let result: Result = { timestamps: [], categories: new Set<string>() }

  entries.forEach(entry => {
    try {
      if (entry.interval == EntryInterval.Never) {
        return
      }

      if (options.excludedCategories.includes(entry.category)) {
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
  // Helper function to generate a label for a given date
  const generateLabel = (year: number, month: number): string => {
    return `${new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' })} ${year}`
  }

  const monthlyResults: MonthlyResult[] = []
  console.log(result.timestamps)
  result.timestamps.forEach((entry, index) => {
    try {
      // Validate the timestamp properties
      if (entry.timestamp && typeof entry.timestamp.year === 'number' && typeof entry.timestamp.month === 'number') {
        const date = new CalendarDate(entry.timestamp.year, entry.timestamp.month, 1);
        const label = generateLabel(entry.timestamp.year, entry.timestamp.month);
  
        let monthlyResult = monthlyResults.find(e => e.date.compare(date) == 0);
        if (!monthlyResult) {
          monthlyResult = { date: date, label: label, categorizedResults: [] };
          monthlyResults.push(monthlyResult);
        }
  
        let categorizedResult = monthlyResult.categorizedResults.find(e => e.category === entry.category);
        if (!categorizedResult) {
          categorizedResult = { category: entry.category, balance: entry.amount };
          monthlyResult.categorizedResults.push(categorizedResult);
        } else {
          categorizedResult.balance += entry.amount;
        }
      } else {
        throw new Error("Invalid timestamp in entry");
      }
    } catch (error) {
      console.log(`Failed accumulating result for entry ${index}. Error: '${error.message}'`);
    }
  });
  
  // Log the final results to debug
  console.log('Final monthly results:', JSON.stringify(monthlyResults, null, 2));

  // Sort months
  monthlyResults.sort((a, b) => a.date.compare(b.date))

  // Insert empty results for missing months
  const filledMonthlyResults: MonthlyResult[] = []

  if (monthlyResults.length > 0) {
    let currentDate = monthlyResults[0].date
    let endDate = monthlyResults[monthlyResults.length - 1].date

    while (currentDate.compare(endDate) <= 0) {
      let currentMonthResult = monthlyResults.find(e => e.date.toString() == currentDate.toString())
      if (currentMonthResult) {
        filledMonthlyResults.push(currentMonthResult)
      } else {
        filledMonthlyResults.push({
          date: new CalendarDate(currentDate.year, currentDate.month, 0),
          label: generateLabel(currentDate.year, currentDate.month),
          categorizedResults: [],
        })
      }
      currentDate = currentDate.add({ months: 1 })
    }
  }

  return filledMonthlyResults
}

export type Statistics = {
  // overview
  total: number
  // average
  dailyAverage: number
  weeklyAverage: number
  monthlyAverage: number
  quarterlyAverage: number
  // duration
  days: number
  months: number
  years: number
}

function getDaysDifference(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay)
}

function getMonthsDifference(startDate: Date, endDate: Date): number {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth()
}

function getYearsDifference(startDate: Date, endDate: Date): number {
  return endDate.getFullYear() - startDate.getFullYear()
}

export function calculateStatistics(result: Result): Statistics {
  const total = result.timestamps.reduce((a, e) => a + e.amount, 0)

  if (result.timestamps.length === 0) {
    return {
      total,
      dailyAverage: 0,
      weeklyAverage: 0,
      monthlyAverage: 0,
      quarterlyAverage: 0,
      days: 0,
      months: 0,
      years: 0,
    }
  }

  // Sort timestamps to find the earliest and latest dates
  const sortedTimestamps = result.timestamps.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const startDate = new Date(sortedTimestamps[0].timestamp)
  const endDate = new Date(sortedTimestamps[sortedTimestamps.length - 1].timestamp)

  const days = getDaysDifference(startDate, endDate) + 1 // +1 to include both start and end date
  const months = getMonthsDifference(startDate, endDate) + 1
  const years = getYearsDifference(startDate, endDate) + 1

  const dailyAverage = days ? total / days : 0
  const weeklyAverage = days ? total / (days / 7) : 0
  const monthlyAverage = months ? total / months : 0
  const quarterlyAverage = months ? total / (months / 3) : 0

  return {
    total,
    dailyAverage,
    weeklyAverage,
    monthlyAverage,
    quarterlyAverage,
    days,
    months,
    years,
  }
}

export default {
  solve,
  accumulateMonthly,
  calculateStatistics,
}
