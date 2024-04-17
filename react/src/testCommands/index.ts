import * as tests from "./tests";

const handlers: { [key: string]: any } = {
  tests,
};
export type CommandDescription = {
  [key: string]: { label?: string; value?: string; extended?: object[] } | null;
};

const testsCommands = { tests };
export const testCommands: {
  label: string;
  value: string;
  commandType: string;
  description?: string;
  extended?: object[];
}[] = [];

Object.keys(testsCommands).map((g) => {
  // @ts-ignore
  const { description, ...rest } = testsCommands[g];
  //      console.log(description, rest);
  if (description) {
    Object.keys(description).map((c) => {
      testCommands.push({
        label: description[c].label,
        value: description[c].value || `{"command": "${g}.${c}"}`,
        commandType: "tests",
      });
    });
  }
});

const isFunction = (f: any) => typeof f === "function";

export const processTestCommand = async (
  variables: Record<string, any>,
  commandObj: object,
  variablesCallback: (v:object)=> void,
  pars: {
    deleteTestObserver: (key:string)=> void,
    setTestObserver: (msgId: string, observer: (data:string)=> void)=>void

  }
) => {
  const { command, ...params } = commandObj as { command: string };

  console.log("processTestCommand", command,"|", pars);
  const parts = command.split(".");
  const com = command.toLowerCase();
  if (handlers[parts[0]] && isFunction(handlers[parts[0]][parts[1]])) {
   /* console.log(
      "handler:",
      handlers[parts[0]],
      params,
      handlers[parts[0]][parts[1]],
    );*/
    const resp = await handlers[parts[0]][parts[1]](params, variables, variablesCallback, pars);
    return {...commandObj, data:resp};
  }
};
