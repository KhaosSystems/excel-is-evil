<script>
  import { onMount } from "svelte";
  import { Bar } from "svelte-chartjs";

  import {
    Chart,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
  } from "chart.js";

  Chart.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
  );

  let offset = 4;

  let data = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Expenses",
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: "rgba(255, 177, 101,0.4)",
        borderWidth: 2,
        borderColor: "rgba(255, 177, 101, 1)",
      },
    ],
  };

  import { read, utils, writeFileXLSX } from "xlsx";

  /* the component state is an array of presidents */
  let pres = [];

  /* get state data and export to XLSX */
  function exportFile() {
    const ws = utils.json_to_sheet(pres);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Data");
    writeFileXLSX(wb, "SheetJSSvelteAoO.xlsx");
  }

  /* handle file upload and read XLSX */
  function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      pres = utils.sheet_to_json(ws).slice(offset);
      console.log(pres);

      // Loop over the array and sum the prices for each month
      monthlySums = {};
      pres.forEach((item) => {
        try {
          const date = item["__EMPTY_1"];
          const price = item["__EMPTY_6"];
          const jsDate = excelDateToJSDate(date);
          const yearMonth =
            jsDate.getFullYear() + "-" + (jsDate.getMonth() + 1);

          if (!monthlySums[yearMonth]) {
            monthlySums[yearMonth] = 0;
          }

          monthlySums[yearMonth] += price;
        } catch (innerError) {
          console.error("Error processing item:", item, innerError);
        }
      });

      console.log(monthlySums);

      const keys = Object.keys(monthlySums);
      const values = keys.map((key) => monthlySums[key]);
      console.log(keys);
      console.log(values);
      data = {
        labels: keys,
        datasets: [
          {
            label: "Expenses",
            data: values,
            backgroundColor: "rgba(255, 177, 101,0.4)",
            borderWidth: 2,
            borderColor: "rgba(255, 177, 101, 1)",
          },
        ],
      };
    };

    reader.readAsArrayBuffer(file);
  }

  // Helper function to convert Excel date to JavaScript date
  function excelDateToJSDate(excelDate) {
    // Excel's date system starts on January 1, 1900, which is day 1
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  }

  // Initialize an empty object to store the sums for each month
  let monthlySums = {};
</script>

<div style="width: 100vw; height: 400px;">
  <Bar {data} options={{ responsive: true }} />
  {monthlySums}
</div>
<input type="number" bind:value={offset} />
<input type="file" accept=".xlsx" on:change={handleFileUpload} />
<main>
  <table>
    <thead>
      <th>Serienr</th>
      <th>Konto</th>
      <th>Dato</th>
      <th>Bilag</th>
      <th>Type</th>
      <th>Moms</th>
      <th>Tekst</th>
      <th>Beløb</th>
      <th>Saldo</th>
      <th>Valuta</th>
    </thead>
    <tbody>
      {#each pres as row}
        <tr>
          <!-- WARN: JANK ALERT -->
          {#each Object.keys(row) as header}
            <td>{row[header]}</td>
          {/each}
        </tr>
      {/each}
    </tbody>

    <!--<tfoot
      ><td colSpan={2}>
        <button on:click={exportFile}>Export XLSX</button>
      </td></tfoot
    >-->
  </table>
</main>

<style>
  table,
  td,
  th {
    border: 1px solid #ddd;
    text-align: left;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th {
    padding: 15px;
  }
  td {
    padding: 8px 15px;
  }
</style>
