import { loadCompany } from "../../utils/fetchData";

interface CompanyCnownProperties {
  name: string;
  symbol: string;
}
type ObjectWithKnownCompanyProps = CompanyCnownProperties &
  Record<string, unknown>;

const companies: Record<string, ObjectWithKnownCompanyProps> = {};
export const getCompanyField = async (symbol: string, field:string='companyName'):Promise<string> => {
  if (!companies[symbol]) {
    try {
      const c = await loadCompany(symbol);
      companies[symbol] = c;
    } catch (err) {
      console.log("Error getCompany", err);
      return ''
    }
  }
  return companies[symbol][field] as string;
};
