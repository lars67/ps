import { CommandModel } from "../models/command";
import { Command } from "@/types/command";

import { getMongoose } from "../app";
import {
  collectionNameToComPar,
  getModelNameByCollectionName,
  validateRequired,
} from "../utils";
import customCommands from "./custom";
import testsCommands from "./tests"
import { ErrorType } from "../types/other";
import { errorMsgs } from "../constants";
//standart collection with standart handlers
const collections = ["currencies", "portfolios", "plays", "sectors", "trades"];

export const validationsAddRequired: string[] = ["label", "value"];
export async function list(
  filter: Partial<Command> = {},
): Promise<Command[] | null> {
  const maps = collectionNameToComPar(getMongoose());
  //  console.log('MAPS', maps)

  try {
    const tableCommands = [
      ...[
        ...collections.map((c) => [
          {
            label: `List ${c}`,
            value: JSON.stringify({ command: `${c}.list`, ...maps[c].list }),
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

    ///
    // console.log('tableCommands.length', tableCommands.length)

    const userCommands = await CommandModel.find().lean();

    const commands: { label: string; value: string; commandType: string; extended?:object[] }[] =
      [];

    collections.forEach((col) => {
      const modelName = getModelNameByCollectionName(col);
      if (modelName) {
        const des = require(`./${modelName?.toLowerCase()}`);
        //console.log('>>>', Object.keys(des));
        const { description, list, add, update, remove, ...rest } = des;
        //console.log('description, value', description, Object.keys(rest));
        if (description) {
          Object.keys(description).map((c) => {
            commands.push({
              label: description[c].label,
              value: description[c].value || `{"command": "${col}.${c}"}`,
              commandType: "custom",
              extended: description[c].extended,
            });
          });
        }
      }
    });

    Object.keys(customCommands).map((g) => {
      // @ts-ignore
      const { description, ...rest } = customCommands[g];
       if (description) {
        Object.keys(description).map((c) => {
          commands.push({
            label: description[c].label,
            value: description[c].value || `{"command": "${g}.${c}"}`,
            commandType: "custom",
          });
        });
      }
    });

 /*   Object.keys(testsCommands).map((g) => {
      // @ts-ignore
      const { description, ...rest } = testsCommands[g];
//      console.log(description, rest);
      if (description) {
        Object.keys(description).map((c) => {
          commands.push({
            label: description[c].label,
            value: description[c].value || `{"command": "${g}.${c}"}`,
            commandType: "tests",
          });
        });
      }
    });
*/
  /*  console.log('COMMANDS',
       [ ...userCommands,
        ...commands,
        ...tableCommands,]
    );*/

    return [
      ...userCommands,
      ...commands,
      ...tableCommands,

    ];
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
  userId: string,
): Promise<Command | ErrorType | null> {
  command.ownerId = userId;

  let err_required = validateRequired<Command>(validationsAddRequired, command);
  if (err_required) {
    return errorMsgs.required(err_required);
  }

  if (!command.ownerId) {
    command.ownerId = userId;
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
  return await CommandModel.findByIdAndUpdate(_id, other, {new: true});
}

export async function remove({ _id }: { _id: string }): Promise<Command | null> {
  return await CommandModel.findByIdAndDelete(_id);
}
