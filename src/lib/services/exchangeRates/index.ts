export type ExchangeRates = {
    [currency: string]: number;
};

export async function fetchExchangeRates(): Promise<ExchangeRates | undefined> {
    const url = 'https://www.nationalbanken.dk/api/currencyratesxmlhistory?lang=en';

    try {
        // Fetch the XML data from the URL
        const response = await fetch(url);
        const xmlText = await response.text();

        // Parse the XML data
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // Extract the latest exchange rates
        const rates: ExchangeRates = {};
        const cubes = xmlDoc.getElementsByTagName("Cube");
        const latestCube = cubes[cubes.length - 1]; // Get the most recent <Cube> element

        const rateElements = latestCube.getElementsByTagName("Cube");

        for (let i = 0; i < rateElements.length; i++) {
            const currency = rateElements[i].getAttribute("currency");
            const rate = parseFloat(rateElements[i].getAttribute("rate") || '');

            if (currency) {
                rates[currency] = rate;
            }
        }

        // Log the exchange rates
        console.log(rates);

        return rates;
    } catch (error) {
        console.error('Error fetching or parsing the exchange rates:', error);
        return undefined;
    }
}

export default {
    fetchExchangeRates,
};