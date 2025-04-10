import { CommandDescription } from "../../types/custom";
import {checkPrices, getDatesSymbols, getDateSymbolPrice} from "../../services/app/priceCashe";
import {divideArray, isValidDateFormat, toNum} from "../../utils";
import {SubscribeMsgs} from "../../types/other";
import moment from "moment";
import eventEmitter, {sendEvent} from "../../services/app/eventEmiter";
import SSEService, {QuoteData} from "../../services/app/SSEService";
import { monitorSSEConnection } from "../../monitoring";
import {formatYMD} from "../../constants";
import {UserData} from "../../services/websocket";
import {QuoteChange} from "@/services/portfolio/positions";


type Par = {
    symbols: string;
    date?: string;
    precision: number;
    from?: string;
    till?:string;
}
type ParQuotes = {
    symbols: string;
    requestType: string,
    changes?:Partial<QuoteData[]>,
    eventName?: string,
    precision: number;
    subscribeId?: string;
}

const subscribers: Record<string,SubscribeMsgs> = {}; //userModif-> SubscribeMsgs

export const historical = async (
    par: Par,
    sendResponse: (data: object) => void,
    msgId: string,
    userModif: string,
    userData:UserData,
) => {
    const symbols = par.symbols?.split(',');
    const precision= par.precision || 4;
    if (symbols.length<1) {
        return {error: 'No symbols'}
    }
    if (par?.from ) {
        if (!isValidDateFormat(par.from)) {
            return { error: "Wrong 'from'" };
        }
        if (par.till && !isValidDateFormat(par.till)) {
            return { error: "Wrong 'till'" };
        }
    } else {
        if (!par.date) {
            return { error: "Need set 'date' or 'from','till'" };
        }
        if (!isValidDateFormat(par.date)) {
            return { error: "Wrong 'date'" };
        }

    }
    const date = par?.from ? par?.from  : par.date;
    //console.log('date', date)
    const dateShift = moment(date, formatYMD).add(-7, 'day').format(formatYMD)
   // console.log('date,dateShift', date,dateShift);
    await checkPrices(symbols, dateShift);
    if (par?.from) {
        return getDatesSymbols(symbols, par.from, par?.till)
    }
     return symbols.reduce((o, symbol)=>
          ({...o, [symbol]:Number(getDateSymbolPrice(date as string, symbol)?.toFixed(precision))}), {})

};

let sseServiceNumber=0;
export const quotes = async (
    par: ParQuotes,
    sendResponse: (data: object) => void,
    msgId: string,
    userModif: string,
    userId: string,
) => {
    const {requestType,  eventName:SSEEventName, changes}=  par;

    if (!subscribers[userModif]) {
        subscribers[userModif] = {}
    }
    const symbols = par.symbols?.split(',');
    const precision= par.precision || 4;
    const {subscribeId} = par;
    if (symbols?.length<1) {
        return {error: 'No symbols'}
    }

    sseServiceNumber++;
    const eventName = `SSE_PRICES_${sseServiceNumber}`;

    if (requestType === "3") {
        let err;
        if (!SSEEventName) {
            err="eventName is required for emulation mode\n";
        }
        if (!changes) {
            err=`${err}changes is required for emulation mode`
        }
        if (err) {
            return {error: err};
        }

        if (changes && SSEEventName) {
            setTimeout(()=> {
                console.log(moment().format('HH:mm:ss SSS'),'emulate sendEvent ---------------->',SSEEventName, changes)
                sendEvent(SSEEventName, changes);
            }, 50);
        }
        console.log(moment().format('HH:mm:ss SSS'),'emulator send respomse', SSEEventName)
        return {emulated: true, eventName:SSEEventName, changes};
    }
    if (requestType === "2") {
        if (!subscribeId) {
            return { error: "subscribeId is required  in unsubscrube command" };
        }
        if (subscribers[userModif][subscribeId]) {
            subscribers[userModif][subscribeId].sseService.stop();
            eventEmitter.removeListener(
                subscribers[userModif][subscribeId].sseService.getEventName(),
                subscribers[userModif][subscribeId].handler,
            );
            return {
                msg: `unsubscribed from symbols'${par.symbols}'`,
            };
        } else {
            return { error: `subscribeId=${subscribeId} is unknown` };
        }
    }

    const sseService = new SSEService("quotes", par.symbols, eventName);
    monitorSSEConnection(sseService);
//--




    //-
    subscribers[userModif][msgId] = {
        sseService,
        handler: (data: object) => {
           // console.log("handler event",data);
            const changes = Object.values(data);
            if (requestType === "0") {
                subscribers[userModif][msgId].sseService.stop();
                eventEmitter.removeListener(
                    subscribers[userModif][msgId].sseService.getEventName(),
                    subscribers[userModif][msgId].handler,
                );
            }

            console.log(
                moment().format("HH:mm:ss SSS"),
                "subscriber SSE-> ",
                userModif,
                msgId,
                data,
                "===>",
                changes?.length,
            );
            changes?.length && sendResponse(changes);
        },
    };

    eventEmitter.on(eventName, subscribers[userModif][msgId].handler);
    //const { positions , fees,...rest } = positions;
    return { msg: requestType === "1" ? "subscribed" : "snapshot", eventName };
}




export const description: CommandDescription = {
    historical: {
        label: "Get historical prices",
        value: JSON.stringify({ command: "prices.historical", symbols: "?", "date":"?", "from": "", "till":"", "precision":4 }),
        access: 'member', // Allow members to access this command
    },
    quotes: {
        label: "Get quotes prices",
        value: JSON.stringify({ command: "prices.quotes", symbols: "?", "requestType":"0", "subscribeId":"","precision":4 }),
    },
};
