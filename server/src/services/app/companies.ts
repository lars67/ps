import { loadCompany, loadInstruments } from "../../utils/fetchData";

interface CompanyCnownProperties {
  name: string;
  symbol: string;
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
      const car = (await loadInstruments(reqSymbols.join(","))) as {
        symbol: string;
        region: string;
      }[];
      car.map((c) => {
        const country = c.region === 'US' ?'United States': c.region;
        symbolsCountry[c.symbol] = country
      });
    } catch (err) {
      console.log("Error getCompany", err);
      return {};
    }
  }
  return symbolsAr.reduce((o, s) => ({ ...o, [s]: symbolsCountry[s] }), {});
};
