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

    // Determine effective 'from' and 'till' dates
    let effectiveFrom = par.from;
    let effectiveTill = par.till;

    if (!effectiveFrom && par.date) {
        effectiveFrom = par.date;
        effectiveTill = par.date;
    }

    if (!effectiveFrom) {
        return { error: "Need set 'date' or 'from','till'" };
    }

    if (!isValidDateFormat(effectiveFrom)) {
        return { error: "Wrong 'from'" };
    }
    if (effectiveTill && !isValidDateFormat(effectiveTill)) {
        return { error: "Wrong 'till'" };
    }

    const dateForShift = effectiveFrom; // Use effectiveFrom for dateShift calculation
    const dateShift = moment(dateForShift, formatYMD).add(-7, 'day').format(formatYMD);

    await checkPrices(symbols, dateShift); // Pre-fetch data for a broader range

    // Always use getDatesSymbols, now that effectiveFrom and effectiveTill are guaranteed
    const result = getDatesSymbols(symbols, effectiveFrom, effectiveTill);

    // Format the result for single-date queries if only one date was requested
    if (par.date && !par.from && !par.till) {
        // Find the entry for the specific date
        const singleDateResult = result.find(item => item.date === par.date);
        if (singleDateResult) {
            // Return only the symbol prices for that date, formatted
            const formattedPrices: Record<string, number | null> = {};
            for (const symbol of symbols) {
                if (singleDateResult[symbol] !== undefined) {
                    formattedPrices[symbol] = Number(Number(singleDateResult[symbol]).toFixed(precision));
                } else {
                    formattedPrices[symbol] = null; // Return null for missing prices on that date
                }
            }
            return formattedPrices;
        } else {
            // If no data found for the specific date
            const formattedPrices: Record<string, null> = {};
            for (const symbol of symbols) {
                formattedPrices[symbol] = null;
            }
            return formattedPrices;
        }
    } else {
        // For range queries, return the full result from getDatesSymbols
        return result.map(item => {
            const formattedItem: Record<string, string | number | null> = { date: item.date };
            for (const key in item) {
                if (key !== 'date') {
                    formattedItem[key] = Number(Number(item[key]).toFixed(precision));
                }
            }
            return formattedItem;
        });
    }
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
