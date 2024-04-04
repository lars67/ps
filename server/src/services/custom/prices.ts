import { CommandDescription } from "../../types/custom";
import {checkPrices, getDateSymbolPrice} from "../../services/app/priceCashe";
import {isValidDateFormat} from "../../utils";


type Par = {
    symbols: string;
    date: string;
}
export const historical = async (
    par: Par,
    sendResponse: (data: object) => void,
    msgId: string,
    userModif: string,
    userId: string,
) => {
    const symbols = par.symbols?.split(',');
    if (symbols.length<1) {
        return {error: 'No symbols'}
    }
    if (!isValidDateFormat(par.date)) {
        return { error: "Wrong 'date'" };
    }
    const date = par.date
    await checkPrices(symbols, date);
     return symbols.reduce((o, symbol)=>
          ({...o, [symbol]:getDateSymbolPrice(date, symbol)}), {})

};

export const description: CommandDescription = {
    historical: {
        label: "Get historical prices",
        value: JSON.stringify({ command: "prices.historical", symbols: "?", "date":"?" }),
    },

};
