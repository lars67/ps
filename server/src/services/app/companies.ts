import { loadCompany, loadInstruments } from "../../utils/fetchData";
import { MongoClient } from 'mongodb';

interface CompanyCnownProperties {
  name: string;
  symbol: string;
  sector?: string;
  industry?: string;
}
type ObjectWithKnownCompanyProps = CompanyCnownProperties &
  Record<string, unknown>;

const companies: Record<string, ObjectWithKnownCompanyProps> = {};
export const getCompanyField = async (
  symbol: string,
  field: string = "companyName",
): Promise<string> => {
  if (!companies[symbol]) {
    try {
      const c = await loadCompany(symbol);
      companies[symbol] = c;
    } catch (err) {
      console.log("Error getCompany", err);
      return "";
    }
  }
  return companies[symbol][field] as string;
};

let symbolsCountry: Record<string, string> = {};
let symbolsCurrencies: Record<string, string> = {};
export const getSymbolsCountries = async (
  symbolsAr: string[],
): Promise<Record<string, string>> => {
  const reqSymbols = symbolsAr.filter((s) => !symbolsCountry[s]);
  if (reqSymbols.length > 0) {
    try {
      let car = (await loadInstruments(reqSymbols.join(","))) as {
        symbol: string;
        region: string;
        currency: string;
      }[];
      if (!Array.isArray(car)) car =[car];
      car.map((c) => {
        const country = c.region === "US" ? "United States" : c.region;
        symbolsCountry[c.symbol] = country;
        symbolsCurrencies[c.symbol] =c.currency;
      });
    } catch (err) {
      console.log("Error getCompany", err);
      return {};
    }
  }
  return symbolsAr.reduce((o, s) => ({ ...o, [s]: symbolsCountry[s] }), {});
};

export const getSymbolCurrency = async (
    symbol: string,
): Promise<string> => {
  if (!symbolsCurrencies[symbol]) {
    try {
      let currency = (await loadInstruments(symbol) )as {
        currency: string;
      }
       symbolsCurrencies[symbol] =currency.currency;

    } catch (err) {
      return '';
    }
  }
  return symbolsCurrencies[symbol]
};

export const getGICS = async (
  symbol: string,
): Promise<{ sector: string; industry: string }> => {
  // Check cache first
  if (companies[symbol] && companies[symbol].sector !== undefined && companies[symbol].industry !== undefined) {
    return {
      sector: companies[symbol].sector || "",
      industry: companies[symbol].industry || "",
    };
  }

  // If not in cache, fetch from MongoDB
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI environment variable not set for getGICS');
    return { sector: "", industry: "" };
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('Aktia'); // Explicitly specify the Aktia database
    const collection = db.collection('Symbols');

    let doc = await collection.findOne({ 'Symbol-Mic': symbol });

    if (!doc) {
      doc = await collection.findOne({
        $or: [
          { Symbol: symbol },
          { 'Symbol-Mic': new RegExp(`^${symbol}:`) },
          { 'Symbol-Ric': new RegExp(`^${symbol}\\.`) }
        ]
      });
    }

    if (doc) {
      // Update cache
      companies[symbol] = {
        ...companies[symbol], // Preserve other potential fields if any
        symbol: doc.Symbol || symbol,
        name: doc.Description || companies[symbol]?.name || "", // Use Description as name
        sector: doc.Sector || "",
        industry: doc.Industry || "",
      };
      return {
        sector: companies[symbol].sector || "",
        industry: companies[symbol].industry || "",
      };
    }
    // If not found in DB, cache an empty result to avoid repeated lookups for this symbol
    companies[symbol] = { ...companies[symbol], symbol, name: companies[symbol]?.name || "", sector: "", industry: "" };
    return {
      sector: "",
      industry: "",
    };
  } catch (err) {
    console.log("Error in getGICS fetching from MongoDB for symbol:", symbol, err);
    // Cache an empty result on error as well
    companies[symbol] = { ...companies[symbol], symbol, name: companies[symbol]?.name || "", sector: "", industry: "" };
    return { sector: "", industry: "" };
  } finally {
    await client.close();
  }
};
export const getGICSAr = async (
  symbolsAr: string[],
): Promise<Record<string, { sector: string; industry: string }>> => {
  const reqSymbols = symbolsAr.filter((s) => !companies[s]);
  if (reqSymbols.length > 0) {
    try {
      // Call the modified getGICS for each symbol not in cache
      // This will populate the cache
      for (let symbol of reqSymbols) {
        await getGICS(symbol);
      }
    } catch (err) {
      console.log("Error getGICSAr", err);
      return {};
    }
  }
  return symbolsAr.reduce(
    (o, symbol) => ({
      ...o,
      [symbol]: {
        sector: companies[symbol].sector,
        industry: companies[symbol].industry,
      },
    }),
    {},
  );
};
