import { CommandModel } from "../models/command";
import {Command, CommandWithID} from "@/types/command";

import {getMongoose} from "../app";
import {collectionNameToComPar, getObjectByCollectionName} from "../utils";
import customCommands from "./custom";
import {CurrencyModel} from "@/models/currency";
//standart collection with standart handlers
const collections  =['plays','currencies','sectors']



export async function list(
  filter: Partial<Command> = {},
): Promise<Command[] | null> {
  const maps = collectionNameToComPar(getMongoose());
//  console.log('MAPS', maps)

  try {
    const tableCommands = [...[...collections.map( c=> [
      {label: `List ${c}`, value: JSON.stringify({command : `${c}.list`, ...maps[c].list}),commandType:'collection'},
      {label: `Add ${c}`, value: JSON.stringify({command : `${c}.add`, ...maps[c].add}),commandType:'collection'},
      {label: `Update ${c}`, value: JSON.stringify({command : `${c}.update`, ...maps[c].update}),commandType:'collection'},
      {label: `Remove ${c}`, value: JSON.stringify({command : `${c}.remove`, ...maps[c].remove}),commandType:'collection'},
    ])]].flat()
    console.log('tableCommands.length', tableCommands.length)
   // const commands = await CommandModel.find({}).lean();
    //console.log ('=========>',Object.keys(customCommands), Object.keys(customCommands.symbols))
    const userCommands = await CommandModel.find().lean();

    const commands: {label: string, value:string, commandType:string}[] = [];
    Object.keys(customCommands).map(g=> {
       // @ts-ignore
      const {description,  ...rest} = customCommands[g];
      //console.log('description, value', description);
       Object.keys(rest).map(c=> {
          commands.push({
             label: description[c].label, value: description[c].value || `{"command": "${g}.${c}"}`, commandType:'custom'}
         )
       })
    })
//console.log('custom commands', commands);

    return [...userCommands,...commands, ...tableCommands];
  } catch (err) {
    console.log('ERR',err)
  }
  return [];
}

export async function add(command: Command, sendResponse:  (data:object)=>void, msgId:string, userModif: string, userId:string): Promise<Command | null> {
  command.ownerId = userId
  if (typeof command.value === 'string' ) {
    command.value=JSON.parse(command.value)
  }
  const newCommand = new CommandModel(command);
  const added = await newCommand.save();
  return added;
}

export async function update(
  command: Partial<CommandWithID>,
): Promise<Command | null> {
  const { _id, ...other } = command;
  if (typeof other.value === 'string' ) {
    command.value=JSON.parse(other.value)
  }
  return await CommandModel.findByIdAndUpdate(_id, other);
}

export async function remove({id}:{id: string}): Promise<Command | null> {
  return await CommandModel.findByIdAndDelete(id);
}

