import {CountryModel} from "../../models/country";
import {Country} from "../../types/country";

interface CountriesKnownProperties {
  name: string;
  region: string;
  subRegion: string;
  a2: string
  currency: string;
}
interface Countries {
  [key: string]: CountriesKnownProperties;
}
let countries: Countries = {}//country=> CountriesKnownProperties
let regionHolder = new Map();
let subregionHolder = new Map();

export const initCountries = async () => {
  const all = await CountryModel.find({}).lean() as Country[];
  countries =  all.reduce((o: Record<string, CountriesKnownProperties>, c:Country)=> ({...o,
     [c.name]: {name:c.name, region:c.region, a2:c.a2, subRegion: c.subRegion,currency:c.currency}})
  , {})
  all.forEach(({region, subRegion, name}) => {
      if (region && subRegion) {
          if (!regionHolder.has(region)) {
              regionHolder.set(region, new Set())
          }
          regionHolder.get(region).add(subRegion);
      }
      if (subRegion && name) {
          if (!subregionHolder.has(subRegion)) {
              subregionHolder.set(subRegion, new Set())
          }
          subregionHolder.get(subRegion).add(name);
      }
  })
    //console.log(regionHolder.forEach((v, k)=> console.log(k, ":",v)));
}

export const getSubRegions = (region:string) =>
    regionHolder.has(region) ? [...regionHolder.get(region)] : []

export const getCountries = (subRegion:string) =>
    subregionHolder.has(subRegion) ? [...subregionHolder.get(subRegion)] : []

export const getCountryField =  (name: string, field:keyof CountriesKnownProperties='a2'):string => {
  return countries[name] ? countries[name][field] as string : '';
};

export const getCountryFields = (
    name: string,
    fields: (keyof CountriesKnownProperties)[]
): { [P in keyof CountriesKnownProperties]?: string } => {
    if (countries[name]) {
        return fields.reduce(
            (o: { [P in keyof CountriesKnownProperties]?: string }, fld: keyof CountriesKnownProperties) => ({
                ...o,
                [fld]: countries[name][fld],
            }),
            {}
        );
    }

    return {};
};

//console.log(getCountryField('Finland'));
//console.log(getCountryField('"United States'));


