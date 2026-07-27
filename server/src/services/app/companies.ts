import { loadCompany, loadInstruments } from "../../utils/fetchData";
import { setSymbolCurrencies } from "../../utils/index";
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

// getGICS() below cached sector/industry forever (no expiry), so once a symbol was
// looked up it kept serving whatever Sector/Industry Aktia.Symbols had at that moment
// for the entire life of this long-running process — even after Aktia.Symbols was
// corrected (e.g. the monthly TradingView re-import). Root cause of Sync2's Sector
// Allocation chart showing 0% Information Technology despite holding INTC:XNAS, whose
// live Aktia.Symbols.Sector is "Electronic technology": the cached value was stale.
const GICS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — matches how often Aktia.Symbols realistically changes
const gicsCachedAt: Record<string, number> = {};

function isGicsCacheFresh(symbol: string): boolean {
  const cachedAt = gicsCachedAt[symbol];
  return !!cachedAt && Date.now() - cachedAt < GICS_CACHE_TTL_MS;
}

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
let symbolsExchange: Record<string, string> = {};
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

// Symbols whose authoritative currency has already been resolved from Aktia.Symbols
// (value '' means "looked up, not found" so we don't re-query every calc).
const dbCurrencyResolved: Record<string, boolean> = {};

// Preload authoritative currencies from Aktia.Symbols (by Symbol-Mic) into the
// shared currency map used by isPenceQuoted(). One batched query per set of
// not-yet-resolved symbols. This is what lets the synchronous pence-scaling check
// distinguish GBP (pence-quoted) London lines from USD/EUR/SEK/... London lines.
export const preloadSymbolCurrencies = async (symbols: string[]): Promise<void> => {
  const need = Array.from(
    new Set(
      symbols
        .map((s) => s && s.toUpperCase())
        .filter((s): s is string => !!s && !s.endsWith(":FX") && !dbCurrencyResolved[s]),
    ),
  );
  if (need.length === 0 || !process.env.MONGODB_URI) return;

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const collection = client.db("Aktia").collection("Symbols");
    const docs = await collection
      .find(
        { "Symbol-Mic": { $in: need } },
        { projection: { "Symbol-Mic": 1, Currency: 1 } },
      )
      .toArray();

    const found: Record<string, string> = {};
    for (const d of docs) {
      const mic = (d["Symbol-Mic"] as string)?.toUpperCase();
      if (mic && d.Currency) found[mic] = String(d.Currency).toUpperCase();
    }
    if (Object.keys(found).length > 0) setSymbolCurrencies(found);
    // Mark every requested symbol resolved (incl. not-found) to avoid re-querying.
    for (const s of need) dbCurrencyResolved[s] = true;
  } catch (err) {
    console.log("Error in preloadSymbolCurrencies:", err);
  } finally {
    await client.close();
  }
};

export const getGICS = async (
  symbol: string,
): Promise<{ sector: string; industry: string }> => {
  // Check cache first — only trust it while still fresh (see GICS_CACHE_TTL_MS above).
  if (companies[symbol] && companies[symbol].sector !== undefined && companies[symbol].industry !== undefined
      && isGicsCacheFresh(symbol)) {
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
      gicsCachedAt[symbol] = Date.now();
      return {
        sector: companies[symbol].sector || "",
        industry: companies[symbol].industry || "",
      };
    }
    // If not found in DB, cache an empty result to avoid repeated lookups for this symbol
    companies[symbol] = { ...companies[symbol], symbol, name: companies[symbol]?.name || "", sector: "", industry: "" };
    gicsCachedAt[symbol] = Date.now();
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

const symbolCountryCache: Record<string, string> = {};

export const getSymbolCountry = async (symbol: string): Promise<string> => {
  if (symbol in symbolCountryCache) return symbolCountryCache[symbol];

  if (!process.env.MONGODB_URI) return "";

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const collection = client.db('Aktia').collection('Symbols');

    let doc = await collection.findOne({ 'Symbol-Mic': symbol });
    if (!doc) {
      doc = await collection.findOne({
        $or: [
          { Symbol: symbol },
          { 'Symbol-Mic': new RegExp(`^${symbol}:`) },
        ]
      });
    }

    const country = doc?.['Country or region of registration'] || "";
    symbolCountryCache[symbol] = country;
    return country;
  } catch (err) {
    console.log("Error in getSymbolCountry for symbol:", symbol, err);
    symbolCountryCache[symbol] = "";
    return "";
  } finally {
    await client.close();
  }
};

export const getGICSAr = async (
  symbolsAr: string[],
): Promise<Record<string, { sector: string; industry: string }>> => {
  const reqSymbols = symbolsAr.filter((s) => !companies[s] || !isGicsCacheFresh(s));
  if (reqSymbols.length > 0) {
    try {
      // Call the modified getGICS for each symbol not in cache, or whose cache entry
      // has expired (see GICS_CACHE_TTL_MS) — this will (re)populate the cache
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
