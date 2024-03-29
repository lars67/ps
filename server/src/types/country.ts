import { ObjectId } from "mongodb";

export type Country = {
    countryId: string;
    a3: string;
    name: string;
    a2: string;
    tld: string;
    currency: string;
    callCode: string;
    region: string;
    subRegion: string
};

export type CountryWithID = Country & { _id: string | ObjectId };

