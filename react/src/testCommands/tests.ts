import { CommandDescription } from "./index";
import {getValueByPath} from "../utils/command";

type TestFunction = (
  par: Record<string, any>,
  variables: Record<string, any>,
  variablesCallback: (v: Record<string, any>) => void,
) => any;

export async function delay({ delay }: { delay: number }): Promise<string> {
  return new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(`delay ${delay}`);
    }, delay);
  });
}

type Condition =
  | { $eq: any }
  | { $gt: number }
  | { $absent: boolean }
  | { $has: boolean }
  | { $isArray : boolean }
  | { $isObject: boolean}
type FieldCondition = Record<string, Condition>;


/*function getValueByPath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc ? acc[key] : undefined, obj);
}*/

export function check({path, conditions}:{path: string, conditions: FieldCondition},
                      variables: Record<string, any>,
                      variablesCallback: (v: object) => void,
                      ): boolean {

     const v = path &&  getValueByPath(variables, path);
     return Object.keys(conditions).every((field:string) =>
      checkDo(v, field, conditions[field]))
}

export function checkDo(
  object: any,
  field: string,
  condition: Condition,

): boolean {
  if ("$eq" in condition) {
      const t = typeof object[field]
      if (t === 'string' )
           return object[field] === condition.$eq.toString();
      else if (t === 'number' )
        return object[field] === Number(condition.$eq);
      else
        return object[field] === condition.$eq;
  } else if ("$gt" in condition) {
    return object[field] > (condition as { $gt: number }).$gt;
  } else if ("$lt" in condition) {
    return object[field] < (condition as { $lt: number }).$lt;
  } else if ("$isArray" in condition) {
    const o = field === '*' ? object : object[field];
    return Array.isArray(o) === (condition as { $isArray: boolean }).$isArray;
  } else if ("$isObject" in condition) {
    const o = field === '*' ? object : object[field];
      return (o !== null && typeof o === 'object' && o.constructor === Object) === (condition as{ $isObject: boolean }).$isObject;
  } else if ("$absent" in condition) {
    return object[field] === undefined || object[field] === null;
  } else if ("$has" in condition) {
    return (
      object.hasOwnProperty(field) === (condition as { $has: boolean }).$has
    );
  } else if ("$isString" in condition) {
    return typeof object === 'string'
  } else if ("$exists" in condition) {
     return Boolean(object)

}
  return false; // Default to false if condition is not recognized
}

console.log(checkDo({ a: "a", b: 1 }, "a", { $eq: "a" }));
console.log(checkDo({ a: "a", b: 1 }, "a", { $eq: "aaaa" }));
//console.log(cond({ a: "a", b: 1 }, { a: { $eq: "a" }, b: { $eq: 1 } }));


export function setVar(
  { v }: { v: object },
  variables: Record<string, any>,
  variablesCallback: (v: object) => void,
) {
   variablesCallback(v);
   //return v;
}

export function getVar(
  { path }: { path: string },
  variables: Record<string, any>,
) {
  return getValueByPath(variables,path) || null;
}

export function breakTests() {
  return 'break'
}
export function getVarNames(
  { name }: { name: string },
  variables: Record<string, any>,
) {
  return Object.keys(variables);
}

export function setMode(
    _mode: object ,
    variables: Record<string, any>,
    variablesCallback: (v: object) => void,
) {
  variablesCallback({_mode});
  return {_mode}
}

export const description: CommandDescription = {
  delay: {
    label: "Delay",
    value: JSON.stringify({ command: "tests.delay", delay: "1000" }),
  },
  check: {
    label: "Check condition",
    value: JSON.stringify({
      command: "tests.check",
      path: "?",
      conditions: {},
    }),
  },
  setVar: {
    label: "Set variable",
    value: JSON.stringify({ command: "tests.setVar", v: "?" }),
  },
  getVar: {
    label: "Get variable",
    value: JSON.stringify({ command: "tests.getVar", path: "?" }),
  },
  getVarMames: {
    label: "Get variable names",
    value: JSON.stringify({ command: "tests.getVarNames" }),
  },

  setMode: {
    label: "Set test mode",
    value: JSON.stringify({ command: "tests.setMode", "hide":true }),
  },

  breakTests: {
    label: "Set test mode",
    value: JSON.stringify({ command: "tests.breakTests" }),
  },
};
