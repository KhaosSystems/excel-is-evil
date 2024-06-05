<script lang="ts">
  import { onMount } from 'svelte'
  import { Bar } from 'svelte-chartjs'
  import { Button } from '$lib/components/ui/button'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Table from '$lib/components/ui/table'
  import * as Select from '$lib/components/ui/select'
  import { Input } from '$lib/components/ui/input'
  import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

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
      {
        label: 'Actual Expenses',
        data: [],
        backgroundColor: 'rgba(255, 80, 80, 0.4)',
        borderWidth: 2,
        borderColor: 'rgba(255, 80, 80, 1)',
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
      data.datasets[1].data = values
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

  const makeDefaultRow = () => {
    return { type: 'expense', description: 'description', amount: 0, interval: 'monthly' }
  }

  let entries = [
    { type: 'expense', description: 'Lunch', amount: 90, interval: 'daily' },
    { type: 'expense', description: 'Adobe Substance 3D', amount: 342, interval: 'monthly' },
    { type: 'expense', description: 'ZBrush', amount: 3040, interval: 'yearly' },
  ]

  function daysInMonth(month, year) {
    return new Date(year, month, 0).getDate()
  }

  let changes: number = 0
  $: entries, (changes += 1)
  $: entries, rebuild()

  function deepEqual(x, y) {
    return JSON.stringify(x) == JSON.stringify(y)
  }

  function rebuild() {
    console.log('rebuilding')

    let newMonthlySums = {}

    // Initialize monthlySums with 0 for all months
    for (let i = 1; i <= 12; i++) {
      newMonthlySums[i] = 0
    }

    // Loop through entries and accumulate amounts based on interval
    entries.forEach(entry => {
      if (entry.interval === 'monthly') {
        for (let i = 1; i <= 12; i++) {
          newMonthlySums[i] += entry.amount
        }
      } else if (entry.interval === 'yearly') {
        newMonthlySums[1] += entry.amount
      } else if (entry.interval === 'daily') {
        for (let i = 1; i <= 12; i++) {
          newMonthlySums[i] += entry.amount * daysInMonth(i, 2024)
        }
      }
    })

    // only update if diffrent
    if (!deepEqual(monthlySums, newMonthlySums)) {
      // new data
      monthlySums = newMonthlySums
      const keys = Object.keys(monthlySums)
      const values = keys.map(key => monthlySums[key])
      data.labels = keys
      data.datasets[0].data = values
    }
  }
</script>

<div class="p-8">
  <div class="flex justify-center w-full h-96">
    <Bar {data} options={{ responsive: true }} />
  </div>

  <Tabs.Root value="budgeteditor" class="w-full">
    <Tabs.List class="w-full">
      <Tabs.Trigger value="budgeteditor">Budget Editor</Tabs.Trigger>
      <Tabs.Trigger value="production">Production</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="budgeteditor">
      <Table.Root>
        <Table.Caption>
          <Button on:click={() => (entries = [...entries, makeDefaultRow()])}>Add Row</Button>
        </Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-40">Type</Table.Head>
            <Table.Head>Description</Table.Head>
            <Table.Head class="w-40">Amount</Table.Head>
            <Table.Head class="w-40">Interval</Table.Head>
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
                      <Select.Item value="expense" class="capitalize">expense</Select.Item>
                      <Select.Item value="income" class="capitalize">income</Select.Item>
                    </Select.Group>
                  </Select.Content>
                  <Select.Input />
                </Select.Root>
              </Table.Cell>
              <Table.Cell>
                <Input type="text" placeholder="Hookers and cocaine..." bind:value={entry.description} />
              </Table.Cell>
              <Table.Cell>
                <Input
                  type="number"
                  placeholder="1234.56"
                  value={entry.amount}
                  on:input={e => {
                    e.target.value = Number(e.target.value)
                    entry.amount = Number(e.target.value)
                  }}
                />
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
                    <Select.Group
                      ><Select.Item value="daily" class="capitalize">daily</Select.Item>
                      <Select.Item value="weekly" class="capitalize">weekly</Select.Item>
                      <Select.Item value="biweekly" class="capitalize">biweekly</Select.Item>
                      <Select.Item value="monthly" class="capitalize">monthly</Select.Item>
                      <Select.Item value="quarterly" class="capitalize">quarterly</Select.Item>
                      <Select.Item value="semiannually" class="capitalize">semiannually</Select.Item>
                      <Select.Item value="yearly" class="capitalize">yearly</Select.Item>
                    </Select.Group>
                  </Select.Content>
                  <Select.Input name="favoriteFruit" />
                </Select.Root>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Tabs.Content>
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

{changes}
