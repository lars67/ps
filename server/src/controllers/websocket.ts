import * as sectors from "../services/sector";
import * as currencies from "../services/currency";
import * as commands from "../services/command";
import * as users from "../services/user";

import * as symbols from "../services/custom/symbols";
import * as logs from "../services/custom/logs";
import * as tools from "../services/custom/tools";

import * as portfolios from "../services/portfolio";
import * as trades from "../services/trade";
import * as tests from "../services/tests/prices";

import * as prices from "../services/custom/prices"
import {getMemberAccessAlowedCommands} from "../services/command";
import {guestAccessAllowed} from "@/controllers/guestAccessAlowed";
//import customServises from '../services/custom';
//const  { logs, symbols } = customServises;

const handlers: { [key: string]: any } = {
  portfolios,
  trades,
  sectors,
  currencies,
  commands,
//tests commands
  tests,
  tools,
  users,

//custom full
  logs, //...Object.keys(customServises).reduce((all,s)=>s,{})
  prices,

  symbols, //...Object.keys(customServises).reduce((all,s)=>s,{})
};

const isFunction = (f: any) => typeof f === "function";


const isAccessAllowed  = (com:string, role:string)=> {
  if (role === 'admin') return true;
  const memberCoimmands=  getMemberAccessAlowedCommands();
  //console.log('isAccessAllowed', com, memberCoimmands.includes(com), memberCoimmands );
  return memberCoimmands.includes(com);
}

// @ts-ignore
export default async function handler(data, sendResponse, userModif, userData, socket) {
  const { command, msgId, ...params } = data;
  if (!command) {
    sendResponse({ error: "Command is absent", msgId });
    return;
  }
  const parts = command.split(".");
  const com = command.toLowerCase();
  if (com.indexOf("subscribequotes") !== -1) {
    console.log("[Instrumentation] subscribeQuotes command received with id: " + (params.id || "N/A") + ", symbols: " + (params.symbols || "N/A"));
  }

//console.log('controller', com);
  if (handlers[com]) {
    sendResponse(await handlers[com].list(params));
  } else {
    try {
      if (handlers[parts[0]] && isFunction(handlers[parts[0]][parts[1]])) {
        if (!isAccessAllowed(com, userData.role)) {
          return sendResponse({error: `Command "${command}" is not allowed`, msgId});
        }
        //console.log('handler:', handlers[parts[0]], params, handlers[parts[0]][parts[1]]);
        const resp = await handlers[parts[0]][parts[1]](
          params,
          sendResponse,
          msgId,
          userModif,
          userData,
          socket
        );
        return sendResponse(resp);
      } else {
        console.error(`Handler group "${parts[0]}" not found.`);
        return sendResponse({error: `Command "${command}" unknown`, msgId});
      }
    } catch (error) {
      console.log('Command execution error:', error);
      return sendResponse({
        error: `Command "${command}" execution error: ${error instanceof Error ? error.message : String(error)}`,
        msgId,
      });
    }
  }
}

//const  getFields = collection => ()
