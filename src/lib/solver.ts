import { type today, type getLocalTimeZone, type startOfYear, type endOfYear, CalendarDate, startOfMonth } from '@internationalized/date'
import { Calendar, type Month } from 'bits-ui'
import type { Bold } from 'lucide-svelte'

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
  category: Category
  timeRange: EntryTimeRange
}

export interface CategoryColor {
  backgroundColor: string
  borderColor: string
}

export const colors: CategoryColor[] = [
  { backgroundColor: 'rgba(255, 177, 101, 0.4)', borderColor: 'rgba(255, 177, 101, 1)' },
  { backgroundColor: 'rgba(101, 255, 137, 0.4)', borderColor: 'rgba(101, 255, 137, 1)' },
  { backgroundColor: 'rgba(101, 157, 255, 0.4)', borderColor: 'rgba(101, 157, 255, 1)' },
  { backgroundColor: 'rgba(255, 101, 101, 0.4)', borderColor: 'rgba(255, 101, 101, 1)' },
  { backgroundColor: 'rgba(255, 251, 101, 0.4)', borderColor: 'rgba(255, 251, 101, 1)' },
  { backgroundColor: 'rgba(137, 101, 255, 0.4)', borderColor: 'rgba(137, 101, 255, 1)' },
  { backgroundColor: 'rgba(101, 255, 241, 0.4)', borderColor: 'rgba(101, 255, 241, 1)' },
  { backgroundColor: 'rgba(177, 101, 255, 0.4)', borderColor: 'rgba(177, 101, 255, 1)' },
  { backgroundColor: 'rgba(255, 101, 221, 0.4)', borderColor: 'rgba(255, 101, 221, 1)' },
  { backgroundColor: 'rgba(101, 255, 101, 0.4)', borderColor: 'rgba(101, 255, 101, 1)' },
]

export class Category {
  // General Ledger Accounts (GLs) account number
  account: number
  name: string
  hidden: boolean = false
  imported: boolean = true
  color: CategoryColor = colors[Math.floor(Math.random() * colors.length)]

  constructor(name: string, account: number = -1, imported: boolean = false) {
    this.account = account
    this.name = name
    this.imported = imported
  }
}

export interface SolverOptions {
  excludedCategories: Category[]
}

export interface TimestampEntry {
  timestamp: CalendarDate
  // In EUR
  amount: number
  category: Category
}

export interface Result {
  timestamps: TimestampEntry[]
  categories: Set<Category>
}

export function solve(entries: Entry[], options: SolverOptions = { excludedCategories: [] }): Result {
  let result: Result = { timestamps: [], categories: new Set<Category>() }

  entries.forEach(entry => {
    try {
      if (entry.interval == EntryInterval.Never) {
        return
      }

      if (options.excludedCategories.find(c => c.name == entry.category.name)) {
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
      console.warn(`Failed to process entry. '${error}'`)
    }
  })

  return result
}

export type CategorizedResult = {
  category: Category
  balance: number
}

export type MonthlyResult = {
  date: CalendarDate
  categorizedResults: CategorizedResult[]
}

export function accumulateMonthly(result: Result): MonthlyResult[] {
  // init results array
  let monthlyResults: MonthlyResult[] = []

  // Get more info about the results.
  const statistics = calculateStatistics(result);
  if (!statistics.startDate || !statistics.endDate) {
    console.error(`Failed accumulating result. 'startDate' or 'endDate' date was invalid. startDate: '${statistics.startDate}', endDate: '${statistics.endDate}'`);
    return monthlyResults
  }

  // make sure that endDate is after startDate
  if (statistics.startDate.compare(statistics.endDate) >= 0) {
    console.error(`'startDate' was after 'endDate' aborting... startDate: '${statistics.startDate}', endDate: '${statistics.endDate}'`);
    return monthlyResults
  }

  // Accumulate sums for each months, from statistics.startDate to statistics.endDate
  let currentDate = startOfMonth(statistics.startDate)
  while (currentDate.compare(statistics.endDate) <= 0) {
    try {
      // add current month to results
      monthlyResults.push({
        date: currentDate,
        categorizedResults: []
      })

      // get ref to this month for easy access.
      let thisMonthsResults = monthlyResults[monthlyResults.length - 1]

      // add timestamps
      result.timestamps.forEach((entry) => {
        try {
          // return early if this timestamp is not in the current month
          if (entry.timestamp.compare(currentDate) < 0 || entry.timestamp.compare(currentDate.add({ months: 1 })) >= 0) {
            return;
          }

          // find the correct category, add to sum, create if not exists
          let categorizedResult = thisMonthsResults.categorizedResults.find(e => e.category === entry.category);
          if (!categorizedResult) {
            categorizedResult = { category: entry.category, balance: entry.amount };
            thisMonthsResults.categorizedResults.push(categorizedResult);
          } else {
            categorizedResult.balance += entry.amount;
          }
        } catch (error) {
          throw new Error(`Something went wrong accumulating entry. '${error}'`);
        }
      })
    } catch (error) {
      console.error(`Something went wrong. '${error}'`);
    }

    console.warn(monthlyResults)

    // Move to the next month
    currentDate = currentDate.add({ months: 1 });
  }


  // Sort months, not sure if this is required..
  monthlyResults.sort((a, b) => a.date.compare(b.date))

  // return successfully
  return monthlyResults
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
  startDate?: CalendarDate | null
  endDate?: CalendarDate | null
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

export interface CalculateStatisticsOptions {
  ignoreImported: boolean
} 

export function calculateStatistics(result: Result, options: CalculateStatisticsOptions = { ignoreImported: false }): Statistics {
  // filter results according to options
  const filteredTimestamps = options.ignoreImported ? result.timestamps.filter(val => !val.category.imported) : result.timestamps;

  // calculate total
  const total = filteredTimestamps.reduce((a, e) => a + e.amount, 0)

  if (filteredTimestamps.length === 0) {
    return {
      total,
      dailyAverage: 0,
      weeklyAverage: 0,
      monthlyAverage: 0,
      quarterlyAverage: 0,
      startDate: null,
      endDate: null,
      days: 0,
      months: 0,
      years: 0,
    }
  }

  // Sort timestamps to find the earliest and latest dates
  const sortedTimestamps = filteredTimestamps.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
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
    // Convert the zero-based month index from the JavaScript Date object to a one-based index suitable for the CalendarDate constructor.
    startDate: new CalendarDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
    endDate: new CalendarDate(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate()),
    days,
    months,
    years,
  }
}

export default {
  solve,
  accumulateMonthly,
  calculateStatistics,
  colors
}
