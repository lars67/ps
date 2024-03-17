import { Play, PlayWithID } from "../types/play";
import { PlayModel } from "../models/play";
import { FilterQuery } from "mongoose";
import {runWatcher} from "../utils/dbWatcher";

//setTimeout(()=>
//runWatcher('plays'), 3000);

export async function list(
  filter: FilterQuery<Play> = {},
): Promise<Play[] | null> {
  try {
    console.log("filter", filter);
    const plays = await PlayModel.find(filter?.filter).lean();
    return plays;
  } catch (err) {}
  return [];
}

export async function add(play: Play): Promise<Play | null> {
  const newPlay = new PlayModel(play);
  const added = await newPlay.save();
  return added;
}

export async function update(play: Partial<PlayWithID>): Promise<Play | null> {
  const { _id, ...other } = play;
  return await PlayModel.findByIdAndUpdate(_id, other);
}

export async function remove({ _id }: { _id: string }): Promise<Play | null> {
  return await PlayModel.findByIdAndDelete(_id);
}
