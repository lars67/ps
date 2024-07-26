import mongoose, {
  Document,
  Model,
  Schema,
  model,
  models,
  connect, FilterQuery,
} from "mongoose";

import {errorMsgs} from "../constants";
import {ErrorType} from "../types/other";
import {Currency} from "../types/currency";
import {CurrencyModel} from "../models/currency";
import {Portfolio} from "../types/portfolio";
import {UserData} from "../services/websocket";
const { ObjectId } = require('mongodb');


const fs = require("fs");
const path = require("path");

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
    const mpath = path.join(
      __dirname,
      `../services/${Model.modelName.toLowerCase()}`,
    );
    if (fs.existsSync(`${mpath}.js`)) {
      const service = require(mpath);
      //console.log( Model.modelName, service?.validationsAddRequired );

      const list = { filter: {} };
      const add = Object.keys(Model.schema.paths)
        .filter((k) => k !== "__v" && k !== "_id")
        .reduce((o, fld, i) => {
          const sym =
            service?.validationsAddRequired &&
            service?.validationsAddRequired.includes(fld)
              ? "?"
              : "";
          // @ts-ignore
          return { ...o, [fld]: Model.schema.paths[fld].defaultValue || sym };
        }, {});
      //  console.log('add>', add,service?.validationsAddRequired );
      const update = Object.keys(Model.schema.paths)
        .filter((k) => k !== "__v" && k !== "_id")
        .reduce(
          (o, fld, i) => {
            // @ts-ignore
            return { ...o, [fld]: Model.schema.paths[fld].defaultValue || "" };
          },
          { _id: "?" },
        );

      const remove = { _id: "?" };

      //console.log(list, add, update, remove)
      maps[Model.collection.name] = { list, add, update, remove };
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
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;
  return isoDatePattern.test(str);
};

export const validateRequired = <T>(fields: string[], obj: T) =>
  fields.reduce((err, fld) => {
    if (!obj[fld as keyof T]) {
      err += `${fld}, `;
    }
    return err;
  }, "");

export const findOne = async <T>(model:Model<T>, filter: FilterQuery<T>) =>
  (await model.findOne(filter)) as T


export const checkCurrency = async (currency: string) => {
    const c = await findOne<Currency>(CurrencyModel,{symbol:currency}) as Currency;
  console.log(currency, 'CCCCCCCCCCCCCCCCCCCCCC',c);
  return c ? null : errorMsgs.unknown('currency', currency)
}

export const findMinByField = <T>(arr: T[], field: keyof T) =>
  arr.reduce(
    (min, current) => (current[field] < min[field] ? current : min),
    arr[0],
  );
/*
function getMinimalFieldValue(objects, field) {
  // Extract an array of field values from objects
  const fieldValues = objects.map(obj => obj[field]);
  // Find the minimum value using Math.min and spread the fieldValues array as arguments
  const minValue = Math.min(...fieldValues);

  return minValue;
}*/
export const findMaxByField = <T>(arr: T[], field: keyof T) =>
  arr.reduce(
    (max, current) => (current[field] > max[field] ? current : max),
    arr[0],
  );

export const isValidDateFormat = (inputString: string) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(inputString);
};

export const isValidObjectId = (str:string) => {
  return ObjectId.isValid(str);
}
export const getModelInstanceByIDorName = async <T >(_id: string, model:Model<T>) => {
  let  instance = null;
  let error = null;
  console.log('start getModelInstanceByIDorName', _id, );
  try {
    console.log('getModelInstanceByIDorName', _id, );
    if (isValidObjectId(_id)) {
      instance = (await model.findById(_id)) ;
    }
    if (!instance) {
      instance = (await model.findOne({$or:[{accountId:_id},{name: _id}]}));
      console.log('instance', Boolean(instance));
      if (!!instance) {
        _id = (instance as (T & {_id: typeof ObjectId}))._id.toString();
        console.log('_id', _id);
      }
    }
    if (!instance) {
      error = {error: "Can't find record with this _id or name"}
    }
  } catch(err) {
    error = {error: "Error during find by _id or name!"}
  }
console.log('getModelInstanceByIDorName', _id, instance);
  return {_id, error, instance: instance as T}
}



export const getRealId = async <T>(_id: string, model: Model<T>, nameField: string[] = ['accountId','name']) => {
  let error = null;
  try {
    if (isValidObjectId(_id)) {
      const instance = (await model.findById(_id)) as T;
      if (instance) {
        return _id.toString();
      }
    }
    const far = nameField.map(fld=> ({[fld]: _id})) as  FilterQuery<T>;
    console.log('FAR', far)
    const filter = {$or: far} as  FilterQuery<T>
    const instance = (await model.findOne(filter) )as T;
    if (instance) {
      return (instance as T & {_id: string})._id;
    }
    return { error: "Can't find record with this _id or name or accountId" };
  } catch (err) {
    return { error: "Error during find by _id or name" };
  }
};

export const checkUnique= async <T>( model: Model<T>,value: string, field: string= 'name')=> {
  const filter = {[field]:value} as  FilterQuery<T>
  const instance = (await model.findOne(filter)) as T;
  if (instance) {
     return errorMsgs.unique(value, field)
  }
  return null;
}

interface ToNumParams {
  n: number;
  precision?: number
}

export const toNum = ({n, precision}: ToNumParams) => precision ? Number(n.toFixed(precision)) : n;

export const extractUniqueFields = <T>(data: T[], field: keyof T) => {
  const uniqueSymbols = new Set();

  data.forEach((item) => {
    if (item[field]) {
      uniqueSymbols.add(item[field]);
    }
  });

  return Array.from(uniqueSymbols) as string[];
};

export const extractUniqueValues = (data: string[]) => {
  const uniqueSymbols = new Set();

  data.forEach((item) => {
      uniqueSymbols.add(item);
  });

  return Array.from(uniqueSymbols) as string[];
};
export const divideArray = <T>(
  arr: T[],
  func: (t: T) => boolean,
): [T[], T[]] => {
  const subarray1: T[] = [];
  const subarray2: T[] = [];

  for (const obj of arr) {
    if (func(obj)) {
      subarray1.push(obj);
    } else {
      subarray2.push(obj);
    }
  }
  return [subarray1, subarray2];
};

export function isErrorType(variable: any): variable is ErrorType {
  return (typeof variable === 'object') && (typeof variable.error === 'string');
}


export function isCurrency(symbol:string) {
  return symbol.indexOf(':FX') > 0
}


export function removeDuplicatesByProperty<T, K extends keyof T>(array: T[], property: K): T[] {
  const uniqueValues = new Set<T[K]>();
  return array.filter((item) => {
    if (uniqueValues.has(item[property])) {
      return false;
    } else {
      uniqueValues.add(item[property]);
      return true;
    }
  });
}
