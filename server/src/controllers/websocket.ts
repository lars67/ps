import * as sectors from "../services/sector";
import * as currencies from "../services/currency";
import * as commands from "../services/command";
import * as plays from "../services/play";
import * as symbols from "../services/custom/symbols";
import * as logs from "../services/custom/logs";
import * as portfolios from "../services/portfolio";
import * as trades from "../services/trade";
import * as tests from "../services/tests/prices";

import * as prices from "../services/custom/prices"
import {CommandModel} from "@/models/command";
//import customServises from '../services/custom';
//const  { logs, symbols } = customServises;

const handlers: { [key: string]: any } = {
  portfolios,
  trades,
  sectors,
  currencies,
  commands,
  plays,
//tests commands
  tests,

//custom full
  logs, //...Object.keys(customServises).reduce((all,s)=>s,{})
  prices,

  symbols, //...Object.keys(customServises).reduce((all,s)=>s,{})
};

const isFunction = (f: any) => typeof f === "function";
// @ts-ignore
export default async function handler(data, sendResponse, userModif, userId) {
  const { command, msgId, ...params } = data;
  if (!command) {
    sendResponse({ error: "Command is absent", msgId });
  }
  const parts = command.split(".");
  const com = command.toLowerCase();


  if (handlers[com]) {
    // console.log('LIST', params);
    sendResponse(await handlers[com].list(params));
  } else {
    try {
      if (handlers[parts[0]] && isFunction(handlers[parts[0]][parts[1]])) {
        //console.log('handler:', handlers[parts[0]], params, handlers[parts[0]][parts[1]]);
        const resp = await handlers[parts[0]][parts[1]](
          params,
          sendResponse,
          msgId,
          userModif,
          userId,
        );
        return sendResponse(resp);
      } else {
        console.error(`Handler group "${parts[0]}" not found.`);
        return sendResponse({error: `Command "${command}" unknown`, msgId});
      }
    } catch (error) {
      console.log(error);
      return sendResponse({
        error: `Command "${command}" execution error`,
        msgId,
      });
    }
  }
}

//const  getFields = collection => ()
