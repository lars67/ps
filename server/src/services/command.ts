import { CommandModel } from "../models/command";
import { Command } from "@/types/command";

import { getMongoose } from "../app";
import {
  collectionNameToComPar,
  getModelNameByCollectionName,
  validateRequired,
} from "../utils";
import customCommands from "./custom";
import { ErrorType } from "../types/other";
import { errorMsgs } from "../constants";
import { UserData } from "@/services/websocket";
import { FilterQuery } from "mongoose";

type CommandItem = {
  label: string;
  value: string;
  commandType: string;
  extended?: object[];
  access?: string;
};
//standart collection with standart handlers
const memberCollections = ["portfolios", "trades"];

const collections = ["currencies", "sectors", "users", ...memberCollections];

export const validationsAddRequired: string[] = ["label", "value"];

const checkAccessByRole = (role:string) => (c:Command) => {
  if (c.access === 'public' || role ==='admin') return true;
  if (c.access === 'member' && role === 'member') return true
  return false
}
let allCustomCommands: CommandItem[] = [];
let customCommandsInitialized = false;
let guestAllowedCommands: string[] = [];
let  memberAllowedCommands: string[] = [];
export async function list(
  filter: Partial<Command> = {},
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  { userId, role, login }: UserData,
): Promise<Command[] | null> {
  const maps = collectionNameToComPar(getMongoose());
//  console.log("commands list", userId, role, name,maps);
  const isGuest = role === "guest";
  try {
    const tableCommands = isGuest
      ? []
      : [
          ...[
            ...(role === 'member' ? memberCollections : collections).map((c) => [
              {
                label: `List ${c}`,
                value: JSON.stringify({
                  command: `${c}.list`,
                  ...maps[c].list,
                }),
                commandType: "collection",
              },
              {
                label: `Add ${c}`,
                value: JSON.stringify({ command: `${c}.add`, ...maps[c].add }),
                commandType: "collection",
              },
              {
                label: `Update ${c}`,
                value: JSON.stringify({
                  command: `${c}.update`,
                  ...maps[c].update,
                }),
                commandType: "collection",
              },
              {
                label: `Remove ${c}`,
                value: JSON.stringify({
                  command: `${c}.remove`,
                  ...maps[c].remove,
                }),
                commandType: "collection",
              },
            ]),
          ],
        ].flat();

    const filterConditions: Record<string, FilterQuery<Command>> = {
      admin: {},
      guest: {
        access: {
          $eq: "public",
        },
      },
      member: {
        $or: [
          {
            ownerId: {
              $eq: userId,
            },
          },
          {
            access: {
              $eq: "public",
            },
          },
        ],
      },
    };
    const filter = filterConditions[role] as FilterQuery<Command>;
    const userCommands = await CommandModel.find(filter).lean();

    if (!customCommandsInitialized) {
      collections.forEach((col) => {
        const modelName = getModelNameByCollectionName(col);
        console.log('>>>',col, modelName);
        if (modelName) {
          const des = require(`./${modelName?.toLowerCase()}`);
          //console.log('>>>', Object.keys(des));
          const { description, list, add, update, remove, ...rest } = des;
          //console.log('description, value', description, Object.keys(rest));
          if (description) {
            Object.keys(description).map((c) => {
              allCustomCommands.push({
                label: description[c].label,
                value: description[c].value || `{"command": "${col}.${c}"}`,
                commandType: "custom",
                extended: description[c].extended,
                access: description[c].access,
              });
            });
          }
        }
      });

      Object.keys(customCommands).map((g) => {
        // @ts-ignore
        const { description, ...rest } = customCommands[g];
        console.log('>>>',g, description);
        if (description) {
          Object.keys(description).map((c) => {
            allCustomCommands.push({
              label: description[c].label,
              value: description[c].value || `{"command": "${g}.${c}"}`,
              commandType: "custom",
              access: description[c].access,
            });
          });
        }
      });
    }
    customCommandsInitialized = true;

    if (isGuest) {
      return [...allCustomCommands.filter((c) => c.access === "public")];
    } else {
      return [...userCommands, ...allCustomCommands.filter(checkAccessByRole(role)), ...tableCommands];
    }
  } catch (err) {
    console.log("ERR", err);
  }
  return [];
}

export async function add(
  command: Command,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  { userId, role, login }: UserData,
): Promise<Command | ErrorType | null> {
  command.ownerId = userId;

  let err_required = validateRequired<Command>(validationsAddRequired, command);
  if (err_required) {
    return errorMsgs.required(err_required);
  }

  if (!command.ownerId) {
    command.ownerId = userId;
  }
  const findExistingName = await CommandModel.findOne({
    label: command.label,
    ownerId: userId,
  });
  if (findExistingName) {
    return errorMsgs.error("Command with this name alreay exists");
  }
  if (typeof command.value === "string") {
    command.value = JSON.parse(command.value);
  }
  const newCommand = new CommandModel(command);
  const added = await newCommand.save();
  return added;
}

export async function update(
  command: Partial<Command>,
): Promise<Command | ErrorType | null> {
  const { _id, ...other } = command;
  if (!_id) {
    return errorMsgs.required1("_id");
  }
  if (typeof other.value === "string") {
    other.value = JSON.parse(other.value);
  }
  return await CommandModel.findByIdAndUpdate(_id, other, { new: true });
}

export async function remove({
  _id,
}: {
  _id: string;
}): Promise<Command | null> {
  return await CommandModel.findByIdAndDelete(_id);
}

export const getGuestAccessAlowedCommands = () => {
  if (guestAllowedCommands.length === 0) {
    guestAllowedCommands.push('commands.list');
    collections.forEach((col) => {
      const modelName = getModelNameByCollectionName(col);
      if (modelName) {
        const { description } = require(`./${modelName?.toLowerCase()}`);
        if (description) {
          Object.keys(description).map((c) => {
            description[c].access === 'public' && guestAllowedCommands.push(`${col}.${c}`);
          });
        }
      }
    });
  }
  return guestAllowedCommands;
};

export const getMemberAccessAlowedCommands = () => {
  if (memberAllowedCommands.length === 0) {
    memberAllowedCommands.push('commands.list');
    memberAllowedCommands.push(...['portfolios.list', 'portfolios.add', 'portfolios.update', 'portfolios.remove',
       'portfolios.positions', 'portfolios.attribution', 'portfolios.history',
       'portfolios.detailList',
       'trades.add', 'trades.update', 'trades.remove']);
    collections.forEach((col) => {
      const modelName = getModelNameByCollectionName(col);
      if (modelName) {
        const { description } = require(`./${modelName?.toLowerCase()}`);
        if (description) {
          Object.keys(description).map((c) => {
            if (description[c].access === 'member' ||  description[c].access === 'public')
              memberAllowedCommands.push(`${col}.${c}`.toLowerCase());
          });
        }
      }
    });
    console.log('memberAllowedCommands >>>', memberAllowedCommands)

  }
  return memberAllowedCommands;
};
