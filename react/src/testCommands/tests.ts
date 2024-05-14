import { CommandDescription } from "./index";
import {getValueByPath} from "../utils/command";
import {isVarObject} from "../utils";
import {type} from "os";

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
  | { $lt: number }
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

     const v = path ?  getValueByPath(variables, path) : variables;
     return Object.keys(conditions).every((field:string) =>
      checkDo(v || {}, field, conditions[field], variables))
}

function getDecimalPrecision(number: number | string) {
  const decimalPart = number.toString().split('.')[1];
  console.log('NUMBER', number, 'decimalPart', decimalPart);
  if (decimalPart) {
    return decimalPart.length;
  }
  return 0; // If the number has no decimal part
}
export function checkDo(
  object: any,
  field: string,
  condition: Condition,
  variables: Record<string, any>
): boolean {
  let leftPart = getValueByPath(object, field);
  if (typeof leftPart === 'undefined'){
    leftPart = field;
  }
  if ("$eq" in condition) {
      const t = typeof leftPart
    console.log('$EQ', field, leftPart, condition.$eq ,t, typeof condition.$eq)
      if (t === 'string' )
           return leftPart === condition.$eq.toString();
      else if (t === 'number' ) {
        const p = getDecimalPrecision(condition.$eq);
        console.log('p', p, Number(leftPart.toFixed(p)) ,Number(condition.$eq))
        return Number(leftPart.toFixed(p)) === Number(condition.$eq);
      } else
        return leftPart === condition.$eq;
  } else if ("$gt" in condition) {
    return Number(leftPart) > Number((condition as { $gt: number }).$gt);
  } else if ("$lt" in condition) {
    console.log( Number(leftPart), ' < ',Number((condition as { $lt: number }).$lt))
    return Number(object[field]) < Number((condition as { $lt: number }).$lt);
  } else if ("$isArray" in condition) {
    const o = field === '*' ? object : leftPart;
    return Array.isArray(o) === (condition as { $isArray: boolean }).$isArray;
  } else if ("$isObject" in condition) {
    const o = field === '*' ? object : leftPart;
      return (o !== null && typeof o === 'object' && o.constructor === Object) === (condition as{ $isObject: boolean }).$isObject;
  } else if ("$absent" in condition) {
    return leftPart === undefined || leftPart === null;
  } else if ("$has" in condition) {
    return (
      object.hasOwnProperty(field) === (condition as { $has: boolean }).$has
    );
  } else if ("$isString" in condition) {
    return typeof object === 'string'
  } else if ("$exists" in condition) {
     return Boolean(object)
  } else if ("$sub" in condition) {
    return Math.abs(Number(leftPart)-(condition as { $sub: number }).$sub) <1
  }
  return false; // Default to false if condition is not recognized
}



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
  const o =getValueByPath(variables,path);
  console.log('getVar======================>', path, '=>', typeof o, o );
  //if (isVarObject(o)) return JSON.stringify(o,undefined ,2);
  return o || null;
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

export function min(
    { path, field }: { path: string, field: string},
    variables: Record<string, any>,
) {
 if (!path) {
   return {error:'Path is required property'}
 }
   if (!field) {
     return {error:'Field is required property'}
     }
  const o =getValueByPath(variables,path) as any[];
  return Math.min(...o.map(obj => obj[field]))
}


export async function waitMsg(
    waitMsgPar:{msgId: string ,to: string, delay: number},
    variables: Record<string, any>,
    variablesCallback: (v: object) => void,
    {deleteTestObserver, setTestObserver}: {
      deleteTestObserver: (key:string)=> void,
      setTestObserver: (msgId: string, observer: (data:string)=> void)=>void}
) {

  return new Promise<object>(resolve=>  {
    if (!waitMsgPar.msgId)
      resolve({error: 'property "msgId" is reqired'})
    if (!waitMsgPar.to)
      resolve({error: 'property "to" is reqired'});
    const msgKey = waitMsgPar.msgId as string
    console.log(Date.now(), 'tests.waitMsg subscribe msgKey= ', msgKey)
    let timer = setTimeout(() => {
      console.log(Date.now(), 'stop by timeout observer', msgKey)
      deleteTestObserver(msgKey);
      resolve({msg:'Message is not recieved'})
    }, waitMsgPar.delay || 3000)
    console.log(Date.now(),'set testObservers[msgKey] msgKey=', msgKey)
    setTestObserver(msgKey,(data: string) => {
      clearTimeout(timer)
      variablesCallback({[waitMsgPar.to]: JSON.parse(data).data});
      console.log('tests.waitMsg setvariable to ', waitMsgPar.to)
      deleteTestObserver(msgKey);;
      resolve({msg:'Message processed'})
    })
    console.log('SETTTTTTTTTTT testObservers[msgKey]', msgKey);
  })

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
  getVarNames: {
    label: "Get variable names",
    value: JSON.stringify({ command: "tests.getVarNames" }),
  },

  setMode: {
    label: "Set test mode",
    value: JSON.stringify({ command: "tests.setMode", "hide":true }),
  },

  breakTests: {
    label: "Break tests",
    value: JSON.stringify({ command: "tests.breakTests" }),
  },
  waitMsg: {
    label: "Wait msg by msgIdDelay",
    value: JSON.stringify({ command: "tests.waitMsg", "msgId":"{?}", "to":"{?}","delay": "1000" }),
  },
  min: {
    label: "Find object in arrya with minimal field value",
    value: JSON.stringify({ command: "tests.min", "path":"{?}","field":"?" }),

  }
};
