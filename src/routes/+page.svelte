<script lang="ts">
  import { onMount } from 'svelte'
  import { Bar } from 'svelte-chartjs'
  import { Button } from '$lib/components/ui/button'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import * as Select from '$lib/components/ui/select'
  import * as ToggleGroup from '$lib/components/ui/toggle-group'
  import { Input } from '$lib/components/ui/input'
  import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
  import { RangeCalendar } from '$lib/components/ui/range-calendar'
  import { today, getLocalTimeZone, startOfYear, endOfYear } from '@internationalized/date'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { CalendarRange, TriangleAlert } from 'lucide-svelte'
  import solver, { EntryInterval, EntryType, type Entry, type Result as SolverResult } from '$lib/solver'
  import { writable } from 'svelte/store'
  import * as Alert from '$lib/components/ui/alert'

  Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

  let offset = 3

  let data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Expected Expenses',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: 'rgba(255, 177, 101, 0.4)',
        borderWidth: 2,
        borderColor: 'rgba(255, 177, 101, 1)',
      },
    ],
  }

  import { read, utils, writeFileXLSX } from 'xlsx'

  /* the component state is an array of presidents */
  let rows = []
  let headers = []

  /* get state data and export to XLSX */
  function exportFile() {
    const ws = utils.json_to_sheet(pres)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Data')
    writeFileXLSX(wb, 'SheetJSSvelteAoO.xlsx')
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
      console.log(headers)
      console.log(rows)

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

      console.log(monthlySums)

      const keys = Object.keys(monthlySums)
      const values = keys.map(key => monthlySums[key])
      console.log(keys)
      console.log(values)
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
  ) => {
    return {
      type: type,
      description: description,
      amount: amount,
      interval: interval,
      category: category,
      timeRange: { start: startOfYear(today(getLocalTimeZone())), end: endOfYear(today(getLocalTimeZone())) },
    }
  }

  let entries: Entry[] = [
    MakeRow(EntryType.Expense, 'Office Rent', 3000, 'Facilities', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Utilities (Electricity, Water, Internet)', 500, 'Facilities', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Adobe Substance 3D License', 50, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Autodesk Maya License', 200, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Unity Pro Subscription', 150, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Unreal Engine Subscription', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'GitHub Enterprise', 250, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'JIRA Subscription', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Slack Premium', 200, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Google Workspace', 300, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'AWS Cloud Storage', 500, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Microsoft Azure Services', 400, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Employee Salaries', 50000, 'Payroll', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Freelance Developer Fees', 2000, 'Payroll', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Health Insurance', 3000, 'Benefits', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Office Supplies', 200, 'Office', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Google Ads', 2000, 'Marketing', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Facebook Ads', 1500, 'Marketing', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Travel Expenses for Conferences', 1000, 'Travel', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'GDC Conference Sponsorship', 5000, 'Marketing', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Website Hosting', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'SSL Certificates', 200, 'Software', EntryInterval.Yearly),
    MakeRow(EntryType.Expense, 'Customer Support Platform (Zendesk)', 150, 'Services', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Dedicated Server Hosting', 300, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Online Course Subscriptions (Coursera, Udemy)', 100, 'Training', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Game Development Kits (Xbox, PlayStation)', 500, 'Hardware', EntryInterval.Yearly),
    MakeRow(EntryType.Expense, '3D Printer Maintenance', 100, 'Hardware', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Sound Studio Rental', 500, 'Hardware', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Office Furniture', 1500, 'Office', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Animation Workshop', 1000, 'Training', EntryInterval.Quarterly),
    MakeRow(EntryType.Expense, 'QA Testing Services', 1500, 'Services', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Freelance Artist Fees', 2000, 'Services', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Legal Fees', 500, 'Legal', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Accounting Software (QuickBooks)', 50, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'ESRB Game Rating Fees', 500, 'Regulatory', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Adobe Creative Cloud Subscription', 60, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Game Audio Middleware (Wwise, FMOD)', 200, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'VR Development Kit', 1000, 'Hardware', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Bug Tracking Software (Bugzilla)', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Animation Software (Toon Boom, Spine)', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Game Localization Services', 1000, 'Services', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Motion Capture Suit Rental', 1500, 'Hardware', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Graphic Design Services', 1000, 'Services', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Server Maintenance', 200, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Mobile Device Testing Services', 300, 'Hardware', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Backup Solutions (Carbonite, Backblaze)', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'General Liability Insurance', 500, 'Benefits', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Postage and Shipping', 50, 'Office', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Print Marketing Materials', 200, 'Marketing', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Bank Transaction Fees', 50, 'Financial', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Trademark Registration Fees', 300, 'Regulatory', EntryInterval.Once),
    MakeRow(EntryType.Expense, 'Employee Recruitment Ads', 500, 'HR', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Subscription to Industry Reports', 100, 'Software', EntryInterval.Monthly),
    MakeRow(EntryType.Expense, 'Data Analytics Tools (Mixpanel, Google Analytics)', 200, 'Software', EntryInterval.Monthly),
  ]

  onMount(() => {
    /*const entriesJson = localStorage.getItem('entries')
    if (entriesJson) {
      console.log(entriesJson)
      entries = JSON.parse(entriesJson)
      console.log(entries)
      rebuild()
    }*/
  })

  function daysInMonth(month, year) {
    return new Date(year, month, 0).getDate()
  }

  let changes: number = 0
  $: entries, (changes += 1)
  $: entries, rebuild()

  function deepEqual(x, y) {
    return JSON.stringify(x) == JSON.stringify(y)
  }

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

  function rebuild() {
    console.log('rebuilding')

    let result = solver.solve(entries)
    let monthlyResults = solver.accumulateMonthly(result)
    //console.log(Array.from(result.categories))

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

    console.log(data)
  }

  let categoryToggles = []

  $: entries, rebuild()
  $: categoryToggles, rebuild()
</script>

<div class="flex flex-col p-8 gap-2">
  <div class="flex justify-center w-full h-96 mb-6">
    <Bar {data} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 0 } }} />
  </div>

  <Alert.Root class="text-orange-400">
    <Alert.Description>
      <TriangleAlert class="h-4 w-4 inline mr-1" />
      The currency fields are currently not implemented. Saving is also missing, and category toggles.
    </Alert.Description>
  </Alert.Root>

  <div class="flex flex-row flex-wrap gap-2 justify-center">
    {#each categoryToggles as categoryToggle}
      <Button
        style={`opacity: ${categoryToggle.enabled ? '1.0' : '0.3'};background-color: ${categoryToggle.color.backgroundColor}; color: ${categoryToggle.color.borderColor}; border-color: ${categoryToggle.color.borderColor}`}
        class="border-2 font-semibold"
        on:click={() => {
          categoryToggle.enabled = !categoryToggle.enabled
        }}
        value={categoryToggle.category}>{categoryToggle.category}</Button
      >
    {/each}
  </div>

  <Table.Root>
    <Table.Caption>
      <Button on:click={() => (entries = [...entries, MakeRow()])} variant="outline">Add Row</Button>
    </Table.Caption>
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-40">Type</Table.Head>
        <Table.Head>Description</Table.Head>
        <Table.Head class="w-48">Catagory</Table.Head>
        <Table.Head class="w-40">Amount</Table.Head>
        <Table.Head class="w-40">Interval</Table.Head>
        <Table.Head class="w-40">Calendar Range</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each entries as entry}
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
            <Select.Root
              selected={{ value: entry.category, label: entry.category }}
              onSelectedChange={v => {
                entry.category = v.value
                console.log(v)
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
              class="w-24 rounded-r-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="1234.56"
              value={entry.amount}
              on:input={e => {
                e.target.value = Number(e.target.value)
                entry.amount = Number(e.target.value)
              }}
            />
            <Select.Root>
              <Select.Trigger class="rounded-l-none border-l-0">
                <Select.Value placeholder="DKK" class="capitalize" />
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Item value="usd" class="capitalize">USD</Select.Item>
                  <Select.Item value="eur" class="capitalize">EUR</Select.Item>
                  <Select.Item value="dkk" class="capitalize">DKK</Select.Item>
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
                console.log(v)
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
            <Button on:click={() => (entries = [...entries, makeDefaultRow()])}>Add Row</Button>
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
</div>
