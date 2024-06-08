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
  import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, type ChartData } from 'chart.js'
  import { RangeCalendar } from '$lib/components/ui/range-calendar'
  import { today, getLocalTimeZone, startOfYear, endOfYear, CalendarDate } from '@internationalized/date'
  import { CalendarRange, TriangleAlert, Upload, Download, X, Plus, Settings, FileBarChart2 } from 'lucide-svelte'
  import solver, { EntryInterval, EntryType, type Entry, type Result as SolverResult, type SolverOptions, type EntryTimeRange, type Currency, type Statistics } from '$lib/solver'
  import { get, writable, type Writable } from 'svelte/store'
  import { flatten, unflatten } from 'flat'
  import { Label } from '$lib/components/ui/label'
  import { read, utils, writeFileXLSX } from 'xlsx'
  import { Cell } from '$lib/components/ui/calendar'
  import Calendar from '$lib/components/ui/calendar/calendar.svelte'

  Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

  const currencies: Currency[] = [
    { code: 'EUR', rate: 1 },
    { code: 'DKK', rate: 7.46 },
    { code: 'USD', rate: 1.09 },
  ]

  const colors = [
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

  let settings = writable({
    defaultCurrency: currencies[0],
    graphCurrency: currencies[0],

    // Settings for importing general ledger from your accounting software using an excel file.
    generalLedgerImportCurrency: currencies[0],
    generalLedgerImportOffset: 0,
    generalLedgerImportDateRowIndex: 0,
    generalLedgerImportPriceRowIndex: 0,
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

  function importFile(filePath) {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Convert sheet data to JSON
    const jsonData = xlsx.utils.sheet_to_json(sheet)

    // Unflatten the JSON data if necessary
    const unflattenedData = jsonData.map(entry => unflatten(entry))

    return unflattenedData
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
  let importedWorksheet = null
  /* handle file upload and read XLSX */
  function handleFileUpload(event: EventTarget) {
    importSettingsOpen = true

    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = e => {
      const arrayBuffer = e.target.result
      const wb = read(arrayBuffer)
      importedWorksheet = wb.Sheets[wb.SheetNames[0]]

      processImportedEntriesSheet()
    }
    reader.readAsArrayBuffer(file)
  }

  function processImportedEntriesSheet() {
    if (importedWorksheet) {
      rows = utils.sheet_to_json(importedWorksheet).slice($settings.generalLedgerImportOffset)

      importedResult = { timestamps: [], categories: new Set<string>() }
      rows.slice(1).forEach(row => {
        try {
          const date = row[Object.keys(row)[$settings.generalLedgerImportDateRowIndex]]
          const price = row[Object.keys(row)[$settings.generalLedgerImportPriceRowIndex]]
          const jsDate = excelDateToJSDate(date)

          importedResult.timestamps.push({
            // Convert the zero-based month index from the JavaScript Date object to a one-based index suitable for the CalendarDate constructor.
            timestamp: new CalendarDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate()),
            amount: price / $settings.generalLedgerImportCurrency.rate, // In EUR
            category: '_imported_',
          })
        } catch (error) {
          console.log(`Failed to process row. '${error}'`)
        }
      })

      console.log(rows)
      console.log(importedResult)

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
   var utc_days  = Math.floor(serial - 25569);
   var utc_value = utc_days * 86400;                                        
   var date_info = new Date(utc_value * 1000);

   var fractional_day = serial - Math.floor(serial) + 0.0000001;

   var total_seconds = Math.floor(86400 * fractional_day);

   var seconds = total_seconds % 60;

   total_seconds -= seconds;

   var hours = Math.floor(total_seconds / (60 * 60));
   var minutes = Math.floor(total_seconds / 60) % 60;

   return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

  const MakeRow = (type: EntryType = EntryType.Expense, description: string = 'description', amount: number = 0, category: string = 'miscellaneous', interval: EntryInterval = EntryInterval.Monthly) => {
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
    entries.subscribe(e => { localStorage.entries = JSON.stringify(e) })
    entries.subscribe(e => { rebuild() })
    entries.set(newEntries)

    // settings local storage
    const storedSettings = localStorage.settings ? JSON.parse(localStorage.settings) : $settings
    settings.subscribe(s => { localStorage.settings = JSON.stringify(s) })
    settings.subscribe(s => processImportedEntriesSheet())
    settings.subscribe(s => rebuild())
    settings.set(storedSettings)
  })

  let categoryToggles = []
  function rebuild() {
    let result = solver.solve(get(entries), {
      excludedCategories: categoryToggles.reduce((categories, toggle) => (toggle.enabled ? categories : [...categories, toggle.category]), []),
    })

    // calculate statistics
    statistics.set(solver.calculateStatistics(result))

    // merge with results
    if (importedResult) {
      result.timestamps = [...result.timestamps, ...importedResult.timestamps]
      result.categories.add('_imported_')
    }
    let monthlyResults = solver.accumulateMonthly(result)

    data.labels = monthlyResults.map(item => item.label)

    // find all the categories
    let categories: Set<string> = new Set()
    monthlyResults.forEach(monthlyResult => {
      monthlyResult.categorizedResults.forEach(categorizedResult => {
        categories.add(categorizedResult.category)
      })
    })

    // build category toggles
    categories.forEach(category => {
      let toggle = categoryToggles.find(e => e.category == category)
      if (!toggle) {
        categoryToggles.push({
          category,
          enabled: true,
          color: colors[categoryToggles.length % colors.length],
        })
      }
      categoryToggles = categoryToggles // force reactivity
    })

    let datasets = []
    categories.forEach(categoryName => {
      let monthlyBalance: number[] = []
      monthlyResults.forEach(monthlyResult => {
        // if the current month has any expenses in this category,
        // add the balance to the monthlyBalance array, otherwise, just add a zero.
        let categorizedResult = monthlyResult.categorizedResults.find(e => e.category == categoryName)
        monthlyBalance.push(categorizedResult ? categorizedResult.balance : 0)
      })

      // add the dataset if toggle is enabled
      if (categoryToggles.find(e => e.category == categoryName).enabled) {
        datasets.push({
          label: categoryName,
          data: monthlyBalance,
          backgroundColor: categoryName == '_imported_' ? 'rgba(255, 101, 101, 0.4)' : colors[datasets.length % colors.length].backgroundColor,
          borderWidth: 2,
          borderColor: categoryName == '_imported_' ? 'rgba(255, 101, 101, 1.0)' : colors[datasets.length % colors.length].borderColor,
          stack: categoryName == '_imported_' ? 'Actual' : 'Expected',
        })
      }
    })

    data.datasets = datasets
  }

  $: categoryToggles, rebuild()
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
      <Select.Root selected={{ value: $settings.generalLedgerImportCurrency, label: $settings.generalLedgerImportCurrency.code }}
      onSelectedChange={v => {
        settings.update(s => {
          s.generalLedgerImportCurrency = v.value
          return s
        })
      }}>
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

      <!-- range -->
      <Label>Import Offset</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportOffset} />

      <!-- range -->
      <Label>Date Row Index</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportDateRowIndex} />

      <!-- range -->
      <Label>Price Row Index</Label>
      <Input type="number" bind:value={$settings.generalLedgerImportPriceRowIndex} />

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
                  <Table.Cell class={`${index == $settings.generalLedgerImportDateRowIndex ? 'text-blue-500' : index == $settings.generalLedgerImportPriceRowIndex ? 'text-green-500' : ''}`}>{row[key]}</Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </div>

    <Dialog.Footer>
      <Dialog.Close class={`${buttonVariants({ variant: 'default', size: 'default' })}`}>Close</Dialog.Close>
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
                label: item => `${item.dataset.label}: ${parseFloat(item.formattedValue.replace(".", "")).toFixed(2) * $settings.graphCurrency.rate} ${$settings.graphCurrency.code}`,
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
            </div>

            <Dialog.Footer>
              <Dialog.Close class={`${buttonVariants({ variant: 'default', size: 'default' })}`}>Close</Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
      <div class="flex flex-grow"></div>
      <div class="flex flex-row flex-wrap gap-2 justify-right my-auto">
        {#each categoryToggles as categoryToggle}
          <Button
            style={`opacity: ${categoryToggle.enabled ? '1.0' : '0.3'};background-color: ${categoryToggle.color.backgroundColor}; color: ${categoryToggle.color.borderColor}; border-color: ${categoryToggle.color.borderColor}`}
            class="border-2 font-semibold  h-fit p-1.5 py-1"
            on:click={() => {
              categoryToggle.enabled = !categoryToggle.enabled
            }}
            value={categoryToggle.category}>{categoryToggle.category}</Button
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
                selected={{ value: entry.category, label: entry.category }}
                onSelectedChange={v => {
                  entry.category = v.value
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a category" class="capitalize" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    <Select.Item value="miscellaneous" class="capitalize">miscellaneous</Select.Item>
                    <Select.Item value="payroll" class="capitalize">payroll</Select.Item>
                    <Select.Item value="utilities" class="capitalize">utilities</Select.Item>
                    <Select.Item value="insurance" class="capitalize">insurance</Select.Item>
                    <Select.Item value="taining" class="capitalize">taining</Select.Item>
                    <Select.Item value="travel" class="capitalize">travel</Select.Item>
                    <Select.Item value="website" class="capitalize">website</Select.Item>
                    <Select.Item value="software" class="capitalize">software</Select.Item>
                    <Select.Item value="hardware" class="capitalize">hardware</Select.Item>
                    <Select.Item value="office" class="capitalize">office</Select.Item>
                    <Select.Item value="server" class="capitalize">server</Select.Item>
                    <Select.Item value="rent" class="capitalize">rent</Select.Item>
                    <Select.Item value="catering" class="capitalize">catering</Select.Item>
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
        Missing features: import account when looking at general ledger, timeline, graph currency, cash flow, dark/light mode, day/month intervals on bar chart
      </Alert.Description>
    </Alert.Root>
  </div>
</div>
