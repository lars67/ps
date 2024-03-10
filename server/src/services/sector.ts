import { Sector, SectorWithID } from "../types/sector";
import { SectorModel } from "../models/sector";
import {FilterQuery} from "mongoose";
import logger from "../utils/logger";

export async function list(
  filter: FilterQuery<Sector> = {},
): Promise<Sector[] | null> {
  try {
    const sectors = await SectorModel.find(filter?.filter).lean();
    return sectors;
  } catch (err) {}
  return [];
}

export async function add(sector: Sector): Promise<Sector | null> {
  const newSector = new SectorModel(sector);
  const added = await newSector.save();
  return added;
}

export async function update(
  sector: Partial<SectorWithID>,
): Promise<Sector | null> {
  const { _id, ...other } = sector;
  return await SectorModel.findByIdAndUpdate(_id, other);
}



export async function remove({_id}:{_id: string}): Promise<Sector | {error:string} | null> {

  if (_id) {
    try {
      return await SectorModel.findByIdAndDelete(_id);
    } catch(err) {
      logger.error(`ERROR: sector.remove for${_id}` )
      return {error: `ERROR: sector.remove for${_id}`}
    }
  } else {
      logger.error(`ERROR: sector.remove no ${_id}` )
      return {error: `ERROR: sector.removeno ${_id}`}
  }
}


