export function getValueByPath(obj: Record<string, any>, path: string): any {
  if (path.endsWith(".*")) {
    const wildcardPath = path.slice(0, -2); // Remove the wildcard indicator '.*'
    return getValueByPath(obj, wildcardPath); // Return the object itself
  }

  return path.split(".").reduce((acc, key) => {
    if (Array.isArray(acc) && /^\d+$/.test(key)) {
      return acc[parseInt(key, 10)];
    } else {
      return acc ? acc[key] : undefined;
    }
  }, obj);
}
function extractAndParseJSONObjects(str: string) {
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

export const preprocessCommand = (
  s: string,
  variables: Record<string, object>,
) => {
  console.log('process', s)
  const matches = findValidVar(s);
  console.log("matches", matches);
  matches.forEach((match: string) => {
    const v = match.substring(6, match.length-1);
    const val = getValueByPath(variables, v);
    console.log("replace", match, `"${val}"`);
    s = s.replace(match, `"${val}"`);
  });
  return s;
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
      console.log(jsonObject);
      if (jsonObject.command) {
        jsonArray.push( parse ? jsonObject : jsonString);
      }
    } catch (error) {
      return [];
    }
  });
  console.log("jsonArray", jsonArray);
  return jsonArray;
};

const regexVar = /["|']+\$var\.([^\"]+)["|']+/g;

export function findValidVar(text: string) {
  const matches = text.match(regexVar);

  return matches || [];
}

function replaceValidVar(text: string, replacement: string) {
  return text.replace(regexVar, replacement);
}
