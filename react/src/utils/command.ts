import {isVarObject} from "./index";

export function getValueByPath(obj: Record<string, any>, path: string): any {
  if (path.endsWith(".*")) {
    const wildcardPath = path.slice(0, -2); // Remove the wildcard indicator '.*'
    return getValueByPath(obj, wildcardPath); // Return the object itself
  }

  return path.split(".").reduce((acc, key) => {
    console.log('path', path, 'acc', acc, 'key', key);
    if (Array.isArray(acc)) {
      if ( /^\d+$/.test(key)) {
        return acc[parseInt(key, 10)];
      } else if (/\[\w*[a-zA-Z0-9_-]+\=[:^a-zA-Z0-9_-]+\]/.test((key))) {
        const [field, value] = key.substring(1,key.length -1).split('=');
        console.log('array compare', acc, field, value, '>', acc.find(a => a[field] == value));
        const r = acc.filter(a => a[field] == value)
        if (Array.isArray(r)){
          if (r.length ===1)
            return r[0];

        }
        return r;
      } else if (key === 'length'){
        return acc.length;
      }
    } else {
      return acc ? acc[key] : undefined;
    }
  }, obj);
}
function extractAndParseJSONObjects0(str: string) {
  const jsonObjects = [];
  let start = -1;
  let bracesCount = 0;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "{") {
      if (bracesCount === 0) {
        start = i;
      }
      bracesCount++;
    } else if (str[i] === "}") {
      bracesCount--;
      if (bracesCount === 0 && start !== -1) {
        const jsonObjectStr = str.substring(start, i + 1);
        jsonObjects.push(jsonObjectStr);
      }
    }
  }

  return jsonObjects;
}

function extractAndParseJSONObjects(input: string): any[] {
  const fragments: any[] = [];
  let start = 0;
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    if (input[i] === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (input[i] === '}') {
      depth--;
      if (depth === 0) {
        const fragment = input.slice(start, i + 1);
        try {
          const parsedFragment = JSON.parse(fragment);
          if (parsedFragment.hasOwnProperty('command')) {
            fragments.push(fragment);
          }
        } catch (e) {
          // Ignore any errors, as the input may not be valid JSON
        }
      }
    }
  }

  return fragments;
}

function calculateExpression(expression: string, variables:Record<string, object>) {
  // Regular expression to match variables like $var.a, $var.b
  const regex = /\$var\.(\w+)/g;

  // Replace variable references with their corresponding values from the data object
  const replacedExpression = expression.replace(regex, (match, varName) => getValueByPath(variables, varName));
  const parts = replacedExpression.split(',')
  // Evaluate the replaced expression to perform the calculation
  let v = eval(parts[0]);
  if (parts[1]) {
    v = Number(v.toFixed(Number(parts[1])))
  }
  return v;
}

function replaceCalculationWithResult(text:string, variables:Record<string, object>) {
  const regexCalc = /calc\((.*?)\)/g;
  const regexInested = /invested\((.*?)\)/g;

  let replacedText = text.replace(regexCalc, (match, expression) => {
    const result = calculateExpression(expression, variables);
    return result;
  });
  /*replacedText = replacedText.replace(regexInvested, (match, expression) => {
    const result = calculateExpression(expression, variables);
    return result;
  });*/

  return replacedText;
}

const toNumber = (v:any, toNum:boolean) => {
  if (toNum && (typeof v === 'string' || typeof v === 'number')) return  Number(v);
  return v;
}

function checkTextForCalcExpression(text:string) {
  // Remove all instances of "calc(" and ")" that are inside existing "calc(" and ")" pairs
  const cleanedText = text.replace(/calc\((?:[^()]*(?:\([^)]*\))?[^()]*)*\)/g, '');

  // Check if the cleaned text still contains "calc(" or ")"
  return /calc\(|[\)]/g.test(cleanedText);
}

function replaceTextMarker(data: any, marker: string, markerChange: any): any {
  if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (typeof data[key] === 'string' && data[key] === marker) {
          data[key] = markerChange;
        } else if (typeof data[key] === 'object') {
          replaceTextMarker(data[key], marker, markerChange);
        }
      }
    }
  }
  return data;
}
export const preprocessCommand = (
  s: string,
  variables: Record<string, object>,
) => {
 // console.log('process', s)
  //s = replaceCalculationWithResult(s, variables)
  const isCalc = s.indexOf('calc(')>=0;
  const matches = findValidVar(s);
  //console.log("matches", matches);
  matches.forEach((match: string) => {
    const v = match.substring(5, match.length);
    const val = toNumber(getValueByPath(variables, v), isCalc);
    console.log("replace", match, `${val}`);
    if (!Array.isArray(val) && !isVarObject(val)) {//replace if this can be done setVar not need
      s = s.replace(match, `${val}`);
    } else {
      const parsed = JSON.parse(s)
      console.log('parsed=', parsed);
      s = JSON.stringify(replaceTextMarker(parsed, match, val));
      //s = s.replace(match, `${JSON.stringify(val, undefined,2)}`);
    }
  });
  console.log('S', s);
  const prepared = replaceCalculationWithResult(s, variables);
  console.log('PPPPPPPREPARED', prepared)
  return prepared;
};

export const getCommands = (
  text: string,
  parse: boolean=true
) => {
  const jsonMatches = extractAndParseJSONObjects(text); // text.match(jsonRegex);
  const jsonArray: any[] = [];

  jsonMatches?.forEach((jsonString) => {
    try {
      const jsonObject = JSON.parse(jsonString);
      //console.log(jsonObject);
      if (jsonObject.command) {
        jsonArray.push( parse ? jsonObject : jsonString);
      }
    } catch (error) {
      return [];
    }
  });
  console.log("jsonArray.length", jsonArray.length);
  return jsonArray;
};

const regexVar =  /\$var\.([^\"\-\+\/\*\)\,]+)/g;
const regex0 = /\[(.*?)\]/g;

export function findValidVar(text: string) {
  const matches0 = text.match(regex0);
  console.log('matches0', matches0);
  matches0?.forEach((m,i)=> {
    text = text.replace(m, `_$_m${i}`);
  })
  const matches = text.match(regexVar) || [];
  console.log('matches', matches);
  matches?.map((m, l)=> {
    console.log(m,'>');
    matches0?.map((b, i)=> {m = m.replace(`_$_m${i}`, b)})
    console.log(m,'>>>');
    matches[l] =m;

  })
  matches0?.map((b, i)=> {
    const ar = findValidVar0(b);
    // @ts-ignore
    ar.length > 0 && matches.push(...ar);
  });
  console.log('matches=>', matches);
  return matches || [];
}

function findValidVar0(text: string) {
  const matches = text.match(regexVar);

  return matches || [];
}
