<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import * as Select from '$lib/components/ui/select'
  import * as AlertDialog from '$lib/components/ui/alert-dialog'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import * as Alert from '$lib/components/ui/alert'
  import { onMount } from 'svelte'
  import { Bar } from 'svelte-chartjs'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, type ChartData } from 'chart.js'
  import { RangeCalendar } from '$lib/components/ui/range-calendar'
  import { today, getLocalTimeZone, startOfYear, endOfYear, CalendarDate } from '@internationalized/date'
  import { CalendarRange, TriangleAlert, Upload, Download, X } from 'lucide-svelte'
  import solver, { EntryInterval, EntryType, type Entry, type Result as SolverResult, type EntryTimeRange, type Currency } from '$lib/solver'
  import { get, writable, type Writable } from 'svelte/store'
  import { flatten, unflatten } from 'flat'
  import { read, utils, writeFileXLSX } from 'xlsx'

  Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

  let currencies: Currency[] = [
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

  let offset = 3

  let data: ChartData<"bar", (number | [number, number])[], unknown> = writable({ datasets: [] })

  /* the component state is an array of presidents */
  let rows = []
  let headers = []

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

  function importEntriesFile(event) {
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = e => {
      const arrayBuffer = e.target.result
      const wb = read(arrayBuffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      let rows = utils.sheet_to_json(ws)

      let newEntries = rows.map(entry => {
        let unflattenedEntry: Entry = unflatten(entry)
        // Restore prototype for start and end dates
        unflattenedEntry.timeRange.start = new CalendarDate(
          unflattenedEntry.timeRange.start.year,
          unflattenedEntry.timeRange.start.month,
          unflattenedEntry.timeRange.start.day,
        )
        unflattenedEntry.timeRange.end = new CalendarDate(
          unflattenedEntry.timeRange.end.year,
          unflattenedEntry.timeRange.end.month,
          unflattenedEntry.timeRange.end.day,
        )
        return unflattenedEntry
      })

      entries.set(newEntries)
    }

    reader.readAsArrayBuffer(file)
  }

  /* handle file upload and read XLSX */
  function handleFileUpload(event) {
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = e => {
      const arrayBuffer = e.target.result
      const wb = read(arrayBuffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = utils.sheet_to_json(ws).slice(offset)
      headers = rows[0]
      rows = rows.slice(1)

      // Loop over the array and sum the prices for each month
      monthlySums = {}
      rows.forEach(item => {
        try {
          const date = item['__EMPTY_1']
          const price = item['__EMPTY_6']
          const jsDate = excelDateToJSDate(date)
          const yearMonth = jsDate.getFullYear() + '-' + (jsDate.getMonth() + 1)

          if (!monthlySums[yearMonth]) {
            monthlySums[yearMonth] = 0
          }

          monthlySums[yearMonth] += price
        } catch (innerError) {
          console.error('Error processing item:', item, innerError)
        }
      })

      const keys = Object.keys(monthlySums)
      const values = keys.map(key => monthlySums[key])
      data.datasets.push({
        label: 'Actual Expenses',
        data: values,
        backgroundColor: 'rgba(255, 80, 80, 0.4)',
        borderWidth: 2,
        borderColor: 'rgba(255, 80, 80, 1)',
      })
    }

    reader.readAsArrayBuffer(file)
  }

  // Helper function to convert Excel date to JavaScript date
  function excelDateToJSDate(excelDate) {
    // Excel's date system starts on January 1, 1900, which is day 1
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)
  }

  // Initialize an empty object to store the sums for each month
  let monthlySums = {}

  const MakeRow = (
    type: EntryType = EntryType.Expense,
    description: string = 'description',
    amount: number = 0,
    category: string = 'miscellaneous',
    interval: EntryInterval = EntryInterval.Monthly,
    currency: Currency = { code: 'EUR', rate: 1 },
  ) => {
    return {
      type: type,
      description: description,
      amount: amount,
      currency: currency,
      interval: interval,
      category: category,
      timeRange: { start: startOfYear(today(getLocalTimeZone())), end: endOfYear(today(getLocalTimeZone())) },
    }
  }

  let entries: Writable<Entry[]> = writable([])

  onMount(async () => {
    // load from local storage
    let rows = JSON.parse(localStorage.entries)
    let newEntries = await rows.map(entry => {
      let unflattenedEntry: Entry = unflatten(entry)
      // Restore prototype for start and end dates
      unflattenedEntry.timeRange.start = new CalendarDate(unflattenedEntry.timeRange.start.year, unflattenedEntry.timeRange.start.month, unflattenedEntry.timeRange.start.day)
      unflattenedEntry.timeRange.end = new CalendarDate( unflattenedEntry.timeRange.end.year, unflattenedEntry.timeRange.end.month, unflattenedEntry.timeRange.end.day)
      return unflattenedEntry
    })

    // entries
    entries.subscribe(e => { localStorage.entries = JSON.stringify(e) })
    entries.subscribe(e => { rebuild() })
    entries.set(newEntries)
  })

  let categoryToggles = []
  function rebuild() {
    let result = solver.solve(get(entries))
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
          backgroundColor: colors[datasets.length % colors.length].backgroundColor,
          borderWidth: 2,
          borderColor: colors[datasets.length % colors.length].borderColor,
          stack: 'Sum',
        })
      }
    })

    data.datasets = datasets
  }

  $: categoryToggles, rebuild()
</script>

<div class="flex flex-col min-h-screen">
  <div class="p-8 bg-neutral-950">
    <div class="flex justify-center w-full h-96 mb-6">
      <Bar {data} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 0 } }} />
    </div>
  </div>

  <div class="flex flex-col flex-grow p-8 gap-2 bg-neutral-900">
    <div class="flex flex-row gap-6">
      <div class="flex flex-row gap-1">
        <!-- import -->
        <Button on:click={exportFile} variant="outline" class="p-2"><Download size="18" /></Button>
        <!-- export -->
        <Input type="file" accept=".xlsx" id="import-entries" class="hidden" on:change={importEntriesFile} />
        <Button
          on:click={() => {
            document.getElementById('import-entries').click()
          }}
          id="import-entries"
          variant="outline"
          class="p-2"><Upload size="18" /></Button
        >
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
      <Table.Caption>
        <Button on:click={() => entries.update(e => [...e, MakeRow()])} variant="outline">Add Row</Button>
      </Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-28">Type</Table.Head>
          <Table.Head>Description</Table.Head>
          <Table.Head class="w-32">Catagory</Table.Head>
          <Table.Head class="w-40">Amount</Table.Head>
          <Table.Head class="w-32">Interval</Table.Head>
          <Table.Head class="w-40">Calendar Range</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each $entries as entry}
          <Table.Row>
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
              <Input type="text" placeholder="Hookers and cocaine..." bind:value={entry.description} />
            </Table.Cell>
            <Table.Cell>
              <Select.Root selected={{ value: entry.category, label: entry.category }} onSelectedChange={v => { entry.category = v.value }}>
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
              <Input type="number" placeholder="1234.56" value={entry.amount}
                class="w-20 rounded-r-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                on:input={e => {
                  e.target.value = Number(e.target.value)
                  entry.amount = Number(e.target.value)
                }}
              />
              <!-- Currency -->
              <Select.Root selected={{ value: entry.currency, label: entry.currency.code }} onSelectedChange={v => { entry.currency = v.value }}>
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
                onSelectedChange={v => { entry.interval = v.value }}>
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

    <Tabs.Root value="budgeteditor" class="w-full">
      <Tabs.List>
        <Tabs.Trigger value="budgeteditor">Budget Editor</Tabs.Trigger>
        <Tabs.Trigger value="production">Production</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="budgeteditor"></Tabs.Content>
      <Tabs.Content value="production">
        <div class="flex gap-4">
          Offset
          <Input type="number" bind:value={offset} />
          <Input type="file" accept=".xlsx" on:change={handleFileUpload} />
        </div>

        {#if rows.length || headers.length}
          <Table.Root>
            <Table.Caption>
              <Button>Add Row</Button>
            </Table.Caption>
            <Table.Header>
              <Table.Row>
                {#each Object.keys(headers) as key}
                  <Table.Head class="w-40">{key}</Table.Head>
                {/each}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each rows as row}
                <Table.Row>
                  {#each Object.keys(row) as key}
                    <Table.Cell>{row[key]}</Table.Cell>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </Tabs.Content>
    </Tabs.Root>

    <Alert.Root class="text-orange-400">
      <Alert.Description>
        <TriangleAlert class="h-4 w-4 inline mr-1" />
        Missing features: deleting rows, loading e-conomics, working category colors (also on select)
      </Alert.Description>
    </Alert.Root>
  </div>
</div>
