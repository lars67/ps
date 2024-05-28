import { loadCompany, loadInstruments } from "../../utils/fetchData";

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
export const getSymbolsCountries = async (
  symbolsAr: string[],
): Promise<Record<string, string>> => {
  const reqSymbols = symbolsAr.filter((s) => !symbolsCountry[s]);
  if (reqSymbols.length > 0) {
    try {
      let car = (await loadInstruments(reqSymbols.join(","))) as {
        symbol: string;
        region: string;
      }[];
      if (!Array.isArray(car)) car =[car];
      car.map((c) => {
        const country = c.region === "US" ? "United States" : c.region;
        symbolsCountry[c.symbol] = country;
      });
    } catch (err) {
      console.log("Error getCompany", err);
      return {};
    }
  }
  return symbolsAr.reduce((o, s) => ({ ...o, [s]: symbolsCountry[s] }), {});
};

export const getGICS = async (
  symbol: string,
): Promise<{ sector: string; industry: string }> => {
  if (companies[symbol]) {
    return {
      sector: companies[symbol].sector || "",
      industry: companies[symbol].industry || "",
    };
  }

  try {
    const c = await loadCompany(symbol);
    companies[symbol] = c;
    return {
      sector: companies[symbol].sector || "",
      industry: companies[symbol].industry || "",
    };
  } catch (err) {
    console.log("Error getCompany", symbol, err);
    return { sector: "", industry: "" };
  }
};
export const getGICSAr = async (
  symbolsAr: string[],
): Promise<Record<string, { sector: string; industry: string }>> => {
  const reqSymbols = symbolsAr.filter((s) => !companies[s]);
  if (reqSymbols.length > 0) {
    try {
      for (let symbol of reqSymbols) {
        const c = await loadCompany(symbol);
        companies[symbol] = c;
      }
    } catch (err) {
      console.log("Error getCompany", err);
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
