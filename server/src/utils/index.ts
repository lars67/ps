import mongoose, {
  Document,
  Model,
  Schema,
  model,
  models,
  connect,
} from "mongoose";
import { dbConnection } from "@/db";
import {Trade} from "@/types/trade";
import {validationsAddRequired} from "@/services/portfolio";
const fs = require('fs');
const path = require( "path");

export function createDefaultObject<T>(type: new () => T): T {
  return new type();
}

export function getTypeJSON<T>(type: new () => T, values: Partial<T>): string {
  return JSON.stringify(type);
}

// Define a function to create a model instance based on the collection name
export const getModelNameByCollectionName = (
  collectionName: string,
): string | null => {
  let name = null;
  for (const Model of Object.values(mongoose.models)) {
    name = Model.modelName;
    if (Model.collection.name === collectionName) {
      name = Model.modelName;
      break;
    }
  }
  return name;
};



type mapsCollectionName = {
  [key: string]: { list: object; add: object; update: object; remove: object };
};

export const collectionNameToComPar = (mongoose: typeof import("mongoose")) => {
  const maps: mapsCollectionName = {};
  for (const Model of Object.values(mongoose.models)) {
    // console.log(Model.collection.name)
    const mpath = path.join(__dirname, `../services/${Model.modelName.toLowerCase()}`)
    if (fs.existsSync(`${mpath}.js`)) {
      const service = require(mpath)
      //console.log( Model.modelName, service?.validationsAddRequired );

      const list = {filter: {}};
      const add = Object.keys(Model.schema.paths)
          .filter((k) => k !== "__v" && k !== "_id")
          .reduce((o, fld, i) => {
            const sym = service?.validationsAddRequired && service?.validationsAddRequired.includes(fld) ? '?' : ''
            // @ts-ignore
            return {...o, [fld]: Model.schema.paths[fld].defaultValue || sym};

          }, {});
    //  console.log('add>', add,service?.validationsAddRequired );
      const update = Object.keys(Model.schema.paths)
          .filter((k) => k !== "__v" && k !== "_id")
          .reduce(
              (o, fld, i) => {
                // @ts-ignore
                return {...o, [fld]: Model.schema.paths[fld].defaultValue || ""};
              },
              {_id: "?"},
          );

      const remove = {_id: "?"};

      //console.log(list, add, update, remove)
      maps[Model.collection.name] = {list, add, update, remove};
    }
  }
  return maps;
};

const jsonRegex = /\{(?:[^{}]|{[^{}]*})*\}/g;
export const getCommands = (text: string) => {
  const jsonMatches = text.match(jsonRegex);
  const jsonArray: any[] = [];

  jsonMatches?.forEach((jsonString) => {
    try {
      const jsonObject = JSON.parse(jsonString);
      console.log(jsonObject);
      if (jsonObject.command) {
        jsonArray.push(jsonObject);
      }
    } catch (error) {
      return [];
    }
  });
  console.log("jsonArray", jsonArray);
  return jsonArray;
};

export const isISODate = (str: string): boolean => {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  return isoDatePattern.test(str);
};


export const validateRequired = <T>(fields:string[], obj:T) =>
   fields.reduce((err, fld) => {
    if (!obj[fld as keyof T]) {
      err += `${fld}, `;
    }
    return err;
  }, "");

