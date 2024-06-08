<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import * as Select from '$lib/components/ui/select'
  import * as AlertDialog from '$lib/components/ui/alert-dialog'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import * as Alert from '$lib/components/ui/alert'
  import * as Dialog from '$lib/components/ui/dialog'
  import { onMount } from 'svelte'
  import { Bar } from 'svelte-chartjs'
  import { Button, buttonVariants } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, type ChartData, type ChartDataset, type DefaultDataPoint } from 'chart.js'
  import { RangeCalendar } from '$lib/components/ui/range-calendar'
  import { today, getLocalTimeZone, startOfYear, endOfYear, CalendarDate } from '@internationalized/date'
  import { CalendarRange, TriangleAlert, Upload, Download, X, Plus, Settings, FileBarChart2 } from 'lucide-svelte'
  import solver, { EntryInterval, EntryType, type Entry, type Result as SolverResult, Category, type SolverOptions, type EntryTimeRange, type Currency, type Statistics } from '$lib/solver'
  import { get, writable, type Writable } from 'svelte/store'
  import { flatten, unflatten } from 'flat'
  import { Label } from '$lib/components/ui/label'
  import { read, utils, writeFileXLSX, type WorkBook, type WorkSheet } from 'xlsx'
  import { Cell } from '$lib/components/ui/calendar'
  import Calendar from '$lib/components/ui/calendar/calendar.svelte'

  Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

  const currencies: Currency[] = [
    { code: 'EUR', rate: 1 },
    { code: 'DKK', rate: 7.46 },
    { code: 'USD', rate: 1.09 },
  ]

  interface Settings {
    defaultCurrency: Currency
    graphCurrency: Currency

    categories: Category[]

    // Settings for importing general ledger from your accounting software using an excel file.
    generalLedgerImportCurrency: Currency
    generalLedgerImportOffset: number
    generalLedgerImportDateRowIndex: number
    generalLedgerImportPriceRowIndex: number
    generalLedgerImportAccountRowIndex: number
  }

  class CategoryPreset {
    name: string
    categories: Category[]

    constructor(name: string, categories: Category[]) {
      this.name = name
      this.categories = categories
    }
  }

  let categoryPresets: CategoryPreset[] = [
    new CategoryPreset('Game Development', [new Category('Salaries', 1), new Category('Software', 2), new Category('Hardware', 3), new Category('Travel & Events', 4), new Category('Administration', 5)]),
    new CategoryPreset('e-conomic', [
      new Category('Lønninger', 2210),
      new Category('B-honorar', 2213),
      new Category('Restaurationsbesøg', 2750),
      new Category('Rejseudgifter', 2770),
      new Category('Husleje', 3410),
      new Category('El, vand og gas', 3420),
      new Category('Edb-udgifter / software', 3604),
      new Category('Rep./vedligeholdelse af inventar', 3610),
      new Category('Mindre anskaffelser', 3617),
      new Category('Revisor', 3640),
      new Category('Advokat', 3645),
      new Category('Forsikringer', 3650),
    ]),
  ]

  let settings: Writable<Settings> = writable({
    defaultCurrency: currencies[0],
    graphCurrency: currencies[0],

    // Based on khaos systems chart of accounts
    categories: categoryPresets[0].categories,

    // Settings for importing general ledger from your accounting software using an excel file.
    generalLedgerImportCurrency: currencies[0],
    generalLedgerImportOffset: 0,
    generalLedgerImportDateRowIndex: 0,
    generalLedgerImportPriceRowIndex: 0,
    generalLedgerImportAccountRowIndex: 0,
  })

  let data: ChartData<'bar', (number | [number, number])[], unknown> = writable({ datasets: [] })

  /* the component state is an array of presidents */
  let rows = []

  /* get state data and export to XLSX */
  function exportFile() {
    const flat = get(entries).map(entry => flatten(entry))
    const ws = utils.json_to_sheet(flat)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Data')
    writeFileXLSX(wb, 'Export.xlsx')
  }

  function importEntriesFile(event: EventTarget) {
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = e => {
      const arrayBuffer = e.target.result
      const wb = read(arrayBuffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      let rows = utils.sheet_to_json(ws)

      utils.decode_range
      let newEntries = rows.map(entry => {
        let unflattenedEntry: Entry = unflatten(entry)
        // Restore prototype for start and end dates
        unflattenedEntry.timeRange.start = new CalendarDate(unflattenedEntry.timeRange.start.year, unflattenedEntry.timeRange.start.month, unflattenedEntry.timeRange.start.day)
        unflattenedEntry.timeRange.end = new CalendarDate(unflattenedEntry.timeRange.end.year, unflattenedEntry.timeRange.end.month, unflattenedEntry.timeRange.end.day)
        return unflattenedEntry
      })

      entries.set(newEntries)
    }

    reader.readAsArrayBuffer(file)
  }

  let importSettingsOpen: boolean = false
  let importedResult: SolverResult
  let importedCategories: Category[] = []
  let importedWorksheet: WorkSheet | null = null
  /* handle file upload and read XLSX */
  function handleFileUpload(event: EventTarget) {
    importSettingsOpen = true

    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = e => {
      const arrayBuffer = e.target.result
      const wb = read(arrayBuffer)
      importedWorksheet = wb.Sheets[wb.SheetNames[0]]

      resizeImportedSheet()
    }
    reader.readAsArrayBuffer(file)
  }

  function resizeImportedSheet() {
    rows = utils.sheet_to_json(importedWorksheet).slice($settings.generalLedgerImportOffset)
  }

  function processImportedEntriesSheet() {
    if (importedWorksheet) {

      importedResult = { timestamps: [], categories: new Set<Category>() }
      rows.slice(1).forEach(row => {
        try {
          const date = row[Object.keys(row)[$settings.generalLedgerImportDateRowIndex]]
          const price = row[Object.keys(row)[$settings.generalLedgerImportPriceRowIndex]]
          const account = row[Object.keys(row)[$settings.generalLedgerImportAccountRowIndex]]
          const jsDate = excelDateToJSDate(date)

          let category = importedCategories.find(c => c.account == account)
          // if we fail to find a category that matches in the user settings and 'importedCategories', we create one
          // and store it in the 'importedCategories' array. this will be destroyed on reload (not stored in local storage)
          if (!category) {
            category = new Category(`${account}`, account, true)
            importedCategories.push(category)
          }
          
          importedResult.categories.add(category)

          importedResult.timestamps.push({
            // Convert the zero-based month index from the JavaScript Date object to a one-based index suitable for the CalendarDate constructor.
            timestamp: new CalendarDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate()),
            amount: price / $settings.generalLedgerImportCurrency.rate, // In EUR
            category: category,
          })
        } catch (error) {
          console.log(`Failed to process row. '${error}'`)
        }
      })

      rebuild()
    }
  }

  /*function excelDateToJSDate(excelDate) {
    // Excel's date system starts on January 1, 1900, which is day 1
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)
  }*/
  // Helper function to convert Excel date to JavaScript date
  function excelDateToJSDate(serial) {
    var utc_days = Math.floor(serial - 25569)
    var utc_value = utc_days * 86400
    var date_info = new Date(utc_value * 1000)

    var fractional_day = serial - Math.floor(serial) + 0.0000001

    var total_seconds = Math.floor(86400 * fractional_day)

    var seconds = total_seconds % 60

    total_seconds -= seconds

    var hours = Math.floor(total_seconds / (60 * 60))
    var minutes = Math.floor(total_seconds / 60) % 60

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds)
  }

  const MakeRow = (type: EntryType = EntryType.Expense, description: string = 'description', amount: number = 0, category: Category = $settings.categories[0], interval: EntryInterval = EntryInterval.Monthly) => {
    return {
      type: type,
      description: description,
      amount: amount,
      currency: get(settings).defaultCurrency,
      interval: interval,
      category: category,
      timeRange: { start: startOfYear(today(getLocalTimeZone())), end: endOfYear(today(getLocalTimeZone())) },
    }
  }

  let entries: Writable<Entry[]> = writable([])
  let statistics: Writable<Statistics> = writable({})

  onMount(async () => {
    // load from local storage
    let rows = localStorage.entries ? JSON.parse(localStorage.entries) : []
    let newEntries = await rows.map(entry => {
      let unflattenedEntry: Entry = unflatten(entry)
      // Restore prototype for start and end dates
      unflattenedEntry.timeRange.start = new CalendarDate(unflattenedEntry.timeRange.start.year, unflattenedEntry.timeRange.start.month, unflattenedEntry.timeRange.start.day)
      unflattenedEntry.timeRange.end = new CalendarDate(unflattenedEntry.timeRange.end.year, unflattenedEntry.timeRange.end.month, unflattenedEntry.timeRange.end.day)
      return unflattenedEntry
    })

    // entries
    entries.subscribe(e => {
      localStorage.entries = JSON.stringify(e)
    })
    entries.subscribe(e => {
      rebuild()
    })
    entries.set(newEntries)

    // settings local storage
    const storedSettings = localStorage.settings ? JSON.parse(localStorage.settings) : $settings
    settings.subscribe(s => {
      localStorage.settings = JSON.stringify(s)
    })
    settings.subscribe(s => importSettingsOpen && resizeImportedSheet())
    settings.subscribe(s => rebuild())
    settings.set(storedSettings)
  })

  function rebuild() {
    const allCategories = [...$settings.categories, ...importedCategories]

    let result = solver.solve(get(entries), {
      excludedCategories: allCategories.reduce((acc: Category[], cur) => cur.hidden ? [...acc, cur] : acc, [])
    })

    // add imported (prefixed with imported)
    if (importedResult) {
      result.timestamps = [...result.timestamps, ...importedResult.timestamps]
    }

    // accumulate monthly
    let monthlyResults = solver.accumulateMonthly(result)
    let newLabels = monthlyResults.map(item => item.date.toString())

    console.log(monthlyResults)
    // calculate statistics
    statistics.set(solver.calculateStatistics(result, { ignoreImported: true }))

    // create datasets for all the user categories
    let newDatasets: ChartDataset<'bar', DefaultDataPoint<'bar'>>[] = []
    allCategories.forEach(category => {
      // make an array with the category balance foreach month
      let monthlyBalance: number[] = []
      monthlyResults.forEach(monthlyResult => {
        let categorizedResult = monthlyResult.categorizedResults.find(e => e.category.name == category.name && e.category.account == category.account)
        monthlyBalance.push(categorizedResult ? categorizedResult.balance : 0)
      })

      // add the dataset if toggle is enabled
      category.name = category.name.replace('EXPECTED-', '')
      newDatasets.push({
        label: category.name,
        data: monthlyBalance,
        backgroundColor: category.color.backgroundColor,
        borderWidth: 2,
        borderColor: category.color.borderColor,
        stack: category.imported ? "A" : "B",
      })
    })

    data.labels = newLabels
    data.datasets = newDatasets
  }
</script>

<!-- import from accounting software settings -->
<Dialog.Root bind:open={importSettingsOpen}>
  <Dialog.Content class="bg-neutral-900 !max-w-screen-xl">
    <Dialog.Header>
      <Dialog.Title>Import Settings</Dialog.Title>
    </Dialog.Header>
    <div class="grid w-full items-center gap-1.5">
      <!-- currency -->
      <Label>Currency</Label>
      <Select.Root
        selected={{ value: $settings.generalLedgerImportCurrency, label: $settings.generalLedgerImportCurrency.code }}
        onSelectedChange={v => {
          settings.update(s => {
            s.generalLedgerImportCurrency = v.value
            return s
          })
        }}
      >
        <Select.Trigger id="default-currency">
          <Select.Value placeholder="DKK" class="capitalize" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each currencies as currency}
              <Select.Item value={currency} class="uppercase">{currency.code}</Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
        <Select.Input name="favoriteFruit" />
      </Select.Root>

      <!-- Import -->
      <Label>Import Offset</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportOffset} />

      <!-- Date -->
      <Label>Date Row Index</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportDateRowIndex} />

      <!-- Price -->
      <Label>Price Row Index</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportPriceRowIndex} />

      <!-- accout -->
      <Label>Account Row Index</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportAccountRowIndex} />

      <!-- data -->
      {#if rows.length}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              {#each Object.keys(rows[0]) as key}
                <Table.Head class="w-40">{rows[0][key]}</Table.Head>
              {/each}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each rows.slice(1, 10) as row}
              <Table.Row>
                {#each Object.keys(row) as key, index}
                  <Table.Cell class={`${index == $settings.generalLedgerImportDateRowIndex ? 'text-blue-500' : index == $settings.generalLedgerImportPriceRowIndex ? 'text-green-500' : index == $settings.generalLedgerImportAccountRowIndex ? 'text-purple-500' : ''}`}>{row[key]}</Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </div>

    <Dialog.Footer>
      <Dialog.Close class={`${buttonVariants({ variant: 'default', size: 'default' })}`} on:click={processImportedEntriesSheet}>Import</Dialog.Close>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<div class="flex flex-col min-h-screen">
  <div class="flex flex-row p-8 bg-neutral-950 gap-8">
    <div class="flex-grow justify-center h-96">
      <Bar
        {data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          scales: {
            y: {
              ticks: {
                callback: (value, index, ticks) => `${parseInt(value) * $settings.graphCurrency.rate} ${$settings.graphCurrency.code}`,
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: item => `${item.dataset.label}: ${parseFloat(item.formattedValue.replace('.', '')).toFixed(2) * $settings.graphCurrency.rate} ${$settings.graphCurrency.code}`,
              },
            },
          },
        }}
      />
    </div>
    <div class="flex-0 w-64 border-l">
      <div class="flex flex-col gap-2 px-6 py-2">
        <div>
          <div class="opacity-50">Statistics</div>
          <div class="opacity-75 font-semibold">Total: {($statistics.total * $settings.graphCurrency.rate).toFixed(2)} {$settings.graphCurrency.code}</div>
        </div>

        <div>
          <div class="opacity-50">Statistics / Averages</div>
          <div class="opacity-75 font-semibold">Daily: {($statistics.dailyAverage * $settings.graphCurrency.rate).toFixed(2)} {$settings.graphCurrency.code}</div>
          <div class="opacity-75 font-semibold">Weekly: {($statistics.weeklyAverage * $settings.graphCurrency.rate).toFixed(2)} {$settings.graphCurrency.code}</div>
          <div class="opacity-75 font-semibold">Monthly: {($statistics.monthlyAverage * $settings.graphCurrency.rate).toFixed(2)} {$settings.graphCurrency.code}</div>
          <div class="opacity-75 font-semibold">Quarterly: {($statistics.quarterlyAverage * $settings.graphCurrency.rate).toFixed(2)} {$settings.graphCurrency.code}</div>
        </div>

        <div>
          <div class="opacity-50">Statistics / Duration</div>
          <div class="opacity-75 font-semibold">Start Date: {$statistics.startDate?.toString()}</div>
          <div class="opacity-75 font-semibold">End Date: {$statistics.endDate?.toString()}</div>
          <div class="opacity-75 font-semibold">Days: {$statistics.days}</div>
          <div class="opacity-75 font-semibold">Months: {$statistics.months}</div>
          <div class="opacity-75 font-semibold">Years: {$statistics.years}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col flex-grow p-8 gap-2 bg-neutral-900">
    <div class="flex flex-row gap-6">
      <div class="flex flex-row gap-1">
        <!-- add -->
        <Button on:click={() => entries.update(e => [MakeRow(), ...e])} class="p-2" variant="outline"><Plus size="20" /></Button>

        <!-- Clear -->
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" class="p-2"><X size="20" /></Button>
          </AlertDialog.Trigger>
          <AlertDialog.Content class="bg-neutral-800">
            <AlertDialog.Header>
              <AlertDialog.Title class="flex-1 text-center">Are you sure you want to DELETE ALL ENTRIES?</AlertDialog.Title>
            </AlertDialog.Header>
            <AlertDialog.Footer class="flex flex-row">
              <AlertDialog.Cancel class="flex-grow border-0 text-white bg-blue-500 hover:bg-blue-400">No</AlertDialog.Cancel>
              <AlertDialog.Action
                class="flex-grow border-0 text-white bg-red-500 hover:bg-red-400"
                on:click={() => {
                  entries.set([])
                }}>Yes</AlertDialog.Action
              >
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>

        <!-- import -->
        <Input type="file" accept=".xlsx" id="import-entries" class="hidden" on:change={importEntriesFile} />
        <Button
          on:click={() => {
            document.getElementById('import-entries').click()
          }}
          id="import-entries"
          variant="outline"
          class="p-2"><Upload size="18" /></Button
        >

        <!-- export -->
        <Button on:click={exportFile} variant="outline" class="p-2"><Download size="18" /></Button>

        <!-- import comparison data -->
        <Input type="file" accept=".xlsx" id="import-comparison-data" class="hidden" on:change={handleFileUpload} />
        <Button
          on:click={() => {
            document.getElementById('import-comparison-data').click()
          }}
          id="import-entries"
          variant="outline"
          class="p-2"><FileBarChart2 size="18" /></Button
        >

        <!-- settings -->
        <Dialog.Root>
          <Dialog.Trigger class={`${buttonVariants({ variant: 'outline' })} !p-2`}><Settings size="18" /></Dialog.Trigger>
          <Dialog.Content class="sm:max-w-[425px] bg-neutral-900">
            <Dialog.Header>
              <Dialog.Title>Settings</Dialog.Title>
            </Dialog.Header>
            <div class="grid w-full max-w-sm items-center gap-1.5">
              <Label for="default-currency">Default Currency</Label>
              <Select.Root
                selected={{ value: $settings.defaultCurrency, label: $settings.defaultCurrency.code }}
                onSelectedChange={v => {
                  settings.update(s => {
                    s.defaultCurrency = v.value
                    return s
                  })
                }}
              >
                <Select.Trigger id="default-currency">
                  <Select.Value placeholder="DKK" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each currencies as currency}
                      <Select.Item value={currency} class="uppercase">{currency.code}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>
              <!---->
              <Label for="graph-currency">Graph Currency</Label>
              <Select.Root
                selected={{ value: $settings.graphCurrency, label: $settings.graphCurrency.code }}
                onSelectedChange={v => {
                  settings.update(s => {
                    s.graphCurrency = v.value
                    return s
                  })
                }}
              >
                <Select.Trigger id="graph-currency">
                  <Select.Value placeholder="DKK" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each currencies as currency}
                      <Select.Item value={currency} class="uppercase">{currency.code}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>

              <!-- chart of account presets-->
              <Label for="graph-currency">CoA Presets</Label>
              <Select.Root
                onSelectedChange={v => {
                  settings.update(s => {
                    s.categories = v?.value.categories
                    return s
                  })
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a preset" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each categoryPresets as categoryPreset}
                      <Select.Item value={categoryPreset} class="uppercase">{categoryPreset.name}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>

              <!-- accounts -->
              <div class="max-h-96 overflow-scroll">
                <Table.Root>
                  <Table.Caption>
                    <Button
                      on:click={() =>
                        settings.update(s => {
                          s.categories.push(new Category('New Category'))
                          return s
                        })}
                      class="p-2"
                      variant="outline"><Plus size="20" /></Button
                    >
                  </Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head class="w-0"></Table.Head>
                      <Table.Head class="w-28">Account</Table.Head>
                      <Table.Head class="w-40">Name</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each $settings.categories as category, index}
                      <Table.Row>
                        <Table.Cell>
                          <Button
                            variant="ghost"
                            class="p-2 hover:bg-red-500"
                            on:click={() => {
                              $settings.update(s => {
                                s.categories.splice(index, 1)
                                return s
                              })
                            }}><X size="20" /></Button
                          >
                        </Table.Cell>
                        <Table.Cell>
                          <Input type="text" placeholder="Description..." bind:value={category.account} />
                        </Table.Cell>
                        <Table.Cell>
                          <Input type="text" placeholder="Description..." bind:value={category.name} />
                        </Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              </div>
            </div>

            <Dialog.Footer>
              <Dialog.Close class={`${buttonVariants({ variant: 'default', size: 'default' })}`}>Close</Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
      <div class="flex flex-grow"></div>
      <div class="flex flex-row flex-wrap gap-2 justify-right my-auto">
        {#each $settings.categories as category}
          <Button
            style={`opacity: ${category.hidden ? '0.3' : '1.0'};background-color: ${category.color.backgroundColor}; color: ${category.color.borderColor}; border-color: ${category.color.borderColor}`}
            class="border-2 font-semibold  h-fit p-1.5 py-1"
            on:click={() => {
              category.hidden = !category.hidden
            }}
            value={category.name}>{category.name}</Button
          >
        {/each}
      </div>
    </div>

    <Table.Root>
      <Table.Caption></Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-0"></Table.Head>
          <Table.Head class="w-28">Type</Table.Head>
          <Table.Head>Description</Table.Head>
          <Table.Head class="w-32">Catagory</Table.Head>
          <Table.Head class="w-40">Amount</Table.Head>
          <Table.Head class="w-32">Interval</Table.Head>
          <Table.Head class="w-40">Calendar Range</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each $entries as entry, index}
          <Table.Row>
            <Table.Cell>
              <Button
                variant="ghost"
                class="p-2 hover:bg-red-500"
                on:click={() => {
                  entries.update(e => {
                    e.splice(index, 1)
                    return e
                  })
                }}><X size="20" /></Button
              >
            </Table.Cell>
            <Table.Cell>
              <Select.Root selected={{ value: entry.type, label: entry.type }}>
                <Select.Trigger>
                  <Select.Value placeholder="Select a type" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each Object.values(EntryType) as value}
                      <Select.Item {value} class="capitalize">{value}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input />
              </Select.Root>
            </Table.Cell>
            <Table.Cell>
              <Input type="text" placeholder="Description..." bind:value={entry.description} />
            </Table.Cell>
            <Table.Cell>
              <Select.Root
                selected={{ value: entry.category, label: entry.category.name }}
                onSelectedChange={v => {
                  entry.category = v.value
                  return v
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a category" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each $settings.categories as category}
                      <Select.Item value={category} class="capitalize">{category.name}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>
            </Table.Cell>
            <Table.Cell class="flex flex-row">
              <Input
                type="number"
                placeholder="1234.56"
                value={entry.amount}
                class="w-20 rounded-r-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                on:input={e => {
                  e.target.value = Number(e.target.value)
                  entry.amount = Number(e.target.value)
                }}
              />
              <!-- Currency -->
              <Select.Root
                selected={{ value: entry.currency, label: entry.currency.code }}
                onSelectedChange={v => {
                  entry.currency = v.value
                }}
              >
                <Select.Trigger class="rounded-l-none border-l-0">
                  <Select.Value placeholder="DKK" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each currencies as currency}
                      <Select.Item value={currency} class="uppercase">{currency.code}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>
            </Table.Cell>
            <Table.Cell>
              <Select.Root
                selected={{ value: entry.interval, label: entry.interval }}
                onSelectedChange={v => {
                  entry.interval = v.value
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select an interval" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each Object.values(EntryInterval) as value}
                      <Select.Item {value} class="capitalize">{value}</Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
                <Select.Input name="favoriteFruit" />
              </Select.Root>
            </Table.Cell>
            <Table.Cell>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild let:builder>
                  <Button builders={[builder]} variant="outline">
                    <CalendarRange size="20" class="mr-2" />
                    {entry.timeRange.start} / {entry.timeRange.end}
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <RangeCalendar bind:value={entry.timeRange} class="rounded-md border shadow" />
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>

    <Alert.Root class="text-orange-400">
      <Alert.Description>
        <TriangleAlert class="h-4 w-4 inline mr-1" />
        Missing features: import accounts when looking at general ledger (konto plan i settings? categories with name and account id(optional)), timeline, graph currency, cash flow, dark/light mode, day/month intervals on bar chart
      </Alert.Description>
    </Alert.Root>
  </div>
</div>
