import { ObjectId } from "mongodb";

export type Sector = {
  industry_sector_id: string;
  symbol: string;
  name: string;
};

export type SectorWithID = Sector & { _id: string | ObjectId };
