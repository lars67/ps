import * as sectors from '../services/sector'
import * as currencies from '../services/currency'
import * as commands from '../services/command'
import * as plays from '../services/play'
import * as symbols  from '../services/custom/symbols'
import * as logs  from '../services/custom/logs'
//import customServises from '../services/custom';
//const  { logs, symbols } = customServises;



const handlers: { [key: string]: any } = {
    sectors,
    currencies,
    commands,
    plays,
    logs,
    symbols,//...Object.keys(customServises).reduce((all,s)=>s,{})
}

const isFunction=(f:any)=> typeof f === 'function'
// @ts-ignore
export default async function handler(data,sendResponse, userModif, userId) {
    const {command,msgId, ...params}= data;
    if (!command) {
        sendResponse({error:'Command is absent', msgId})
    }
    const parts = command.split('.');
    const com = command.toLowerCase();
    if (handlers[com] ) {
       // console.log('LIST', params);
        sendResponse( await handlers[com].list(params))
    } else {
        if (handlers[parts[0]] && isFunction(handlers[parts[0]][parts[1]])) {
            console.log('handler:',handlers[parts[0]],params, handlers[parts[0]][parts[1]]);
            return sendResponse(await handlers[parts[0]][parts[1]](params, sendResponse, msgId, userModif, userId))
        } else {
            console.error(`Handler group "${parts[0]}" not found.`);
            return sendResponse({error:`Command "${command}" unknown`, msgId})
        }


    }
}

//const  getFields = collection => ()
