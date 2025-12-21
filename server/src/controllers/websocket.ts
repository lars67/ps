import * as sectors from "../services/sector";
import * as currencies from "../services/currency";
import * as commands from "../services/command";
import * as users from "../services/user";

import * as symbols from "../services/custom/symbols";
import * as logs from "../services/custom/logs";
import * as tools from "../services/custom/tools";

import * as portfolios from "../services/portfolio";
import { attribution as attributionHandler } from "../services/portfolio/attribution";
import * as trades from "../services/trade";
import * as tests from "../services/tests/prices";

import * as prices from "../services/custom/prices"
import {getMemberAccessAlowedCommands} from "../services/command";
import {guestAccessAllowed} from "@/controllers/guestAccessAlowed";
//import customServises from '../services/custom';
//const  { logs, symbols } = customServises;

const handlers: { [key: string]: any } = {
  portfolios,
  "portfolios.attribution": attributionHandler,
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
  
  // 1. Priority: Direct handler match (case-insensitive)
  // Check exact string from map (e.g. "portfolios.attribution")
  const directHandler = Object.keys(handlers).find(k => k.toLowerCase() === com);
  
  if (directHandler && isFunction(handlers[directHandler])) {
    if (!isAccessAllowed(directHandler, userData.role)) {
      return sendResponse({error: `Command "${command}" is not allowed`, msgId});
    }
    const resp = await handlers[directHandler](
      params,
      sendResponse,
      msgId,
      userModif,
      userData,
      socket
    );
    return sendResponse(resp);
  }

  // 2. Collection-style check (calls .list() by default)
  if (handlers[com] && isFunction(handlers[com].list)) {
    sendResponse(await handlers[com].list(params));
    return;
  }

  // 3. Fallback: Split-dot logic (portfolios.positions)
  if (parts.length === 2 && handlers[parts[0]] && isFunction(handlers[parts[0]][parts[1]])) {
    if (!isAccessAllowed(com, userData.role)) {
      return sendResponse({error: `Command "${command}" is not allowed`, msgId});
    }
    const resp = await handlers[parts[0]][parts[1]](
      params,
      sendResponse,
      msgId,
      userModif,
      userData,
      socket
    );
    return sendResponse(resp);
  }

  console.error(`Command "${command}" unknown. Checked direct and split-dot handlers.`);
  return sendResponse({error: `Command "${command}" unknown`, msgId});
}
