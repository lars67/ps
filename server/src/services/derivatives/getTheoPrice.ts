import moment from "moment";
import { MongoClient } from "mongodb";
import { ContractModel } from "../../models/contract";
import {
  ContractType,
  DayCountConvention,
  ExecutionStyle,
  TheoModel,
  isOptionContractType,
} from "../../types/contract";
import { formatYMD } from "../../constants";
import { checkPrices, getLastKnownPrice } from "../app/priceCashe";
import { calcHistoricalVolatility } from "./calcHistoricalVolatility";
import { resolveVolatility } from "./resolveVolatility";
import { resolveDividendYield } from "./resolveDividendYield";
import { resolveRiskFreeRate } from "./resolveRiskFreeRate";
import { resolveContractSettings } from "./resolveContractSettings";
import { selectTheoModel } from "./selectTheoModel";
import { calcYearFraction } from "./dayCount";
import { calcFutureTheoPrice, calcOptionTheoPrice } from "./calcTheoPrice";
import { Greeks, calcGreeks } from "./calcGreeks";

export type GetTheoPriceParams = {
  underlyingSymbolMic: string;
  contractType: string; // ContractType enum value
  // Exactly one of expirationDate/daysToExpiration is required. daysToExpiration exists so
  // callers (and this file's own test script) don't have to hardcode an absolute date that
  // eventually falls into the past - it resolves to calcDate + daysToExpiration days.
  expirationDate?: string; // YYYY-MM-DD
  daysToExpiration?: number;
  strike?: number; // required for call/put, ignored for future/forward
  // References an existing Contract (a future/forward) this option is priced off of, instead of
  // the cash underlying - an option-on-future. When set, the spot input (below) is auto-resolved
  // from that contract's own tradable symbol rather than underlyingSymbolMic, and Black-76/
  // Black-76-American apply instead of Black-Scholes/binomial-on-spot. underlyingSymbolMic is
  // still used for volatility/dividend/currency resolution either way (see
  // buildContractCalcContexts.ts - Black-76 still uses the underlying's own volatility, just
  // applied to the future's price).
  baseContractId?: string;
  executionStyle?: string; // ExecutionStyle enum value - overrides the underlying/expiration cascade default if set
  dayCountConvention?: string; // DayCountConvention enum value - overrides the cascade default if set
  spotPrice?: number; // overrides the auto-fetched last known price of the price-driver symbol
  volatility?: number; // percentage points - full override (not stacked with the cascade's volatilityOffset)
  volatilityDays?: number; // lookback window for the historical-vol calc when volatility is omitted
  interestRate?: number; // percentage points - full override (not stacked with the cascade's rateOffset)
  dividendRate?: number; // percentage points, continuous yield - full override
  theoModel?: string; // TheoModel enum value - overrides selectTheoModel()'s auto-deduction (call/put only)
  calcDate?: string; // YYYY-MM-DD, defaults to today
};

export type GetTheoPriceResult = {
  theoPrice?: number;
  // Options only - a future/forward priced by cost of carry has no option greeks. See
  // calcGreeks.ts for what each one means and how it is computed.
  greeks?: Greeks;
  resolved?: {
    spotPrice: number;
    priceDriverSymbol: string;
    volatility: number;
    interestRate: number;
    dividendRate: number;
    dayCountConvention: DayCountConvention;
    executionStyle?: ExecutionStyle; // absent for future/forward
    futureBased: boolean;
    theoModel?: TheoModel; // absent for future/forward
    timeToExpiry: number;
    calcDate: string;
  };
  error?: string;
};

// GetTheoPrice: an ad-hoc theoretical-price calculator, not tied to any persisted Contract or
// held position - unlike calcTheoPrice.ts (used by positions.ts for real holdings), every input
// here either comes from the caller or is resolved fresh from Aktia.Symbols/the yield-curve/
// historical prices, the same sources buildContractCalcContexts.ts uses for real contracts, so a
// manual "what would this option be worth" query gets the same answer a real position would.
export async function getTheoPrice(params: GetTheoPriceParams): Promise<GetTheoPriceResult> {
  const { underlyingSymbolMic } = params;
  if (!underlyingSymbolMic) return { error: "underlyingSymbolMic is required" };
  if (params.expirationDate && params.daysToExpiration != null) {
    return { error: "Pass either expirationDate or daysToExpiration, not both" };
  }
  if (!params.expirationDate && params.daysToExpiration == null) {
    return { error: "expirationDate or daysToExpiration is required" };
  }

  const calcDate = params.calcDate || moment().format(formatYMD);
  const expirationDate =
    params.expirationDate || moment(calcDate, formatYMD).add(params.daysToExpiration, "days").format(formatYMD);

  const contractType = params.contractType as ContractType;
  if (!Object.values(ContractType).includes(contractType)) {
    return { error: `contractType must be one of ${Object.values(ContractType).join(", ")}` };
  }

  const isOption = isOptionContractType(contractType);
  if (isOption && params.strike == null) {
    return { error: "strike is required for call/put" };
  }

  const executionStyleOverride = params.executionStyle as ExecutionStyle | undefined;
  if (executionStyleOverride && !Object.values(ExecutionStyle).includes(executionStyleOverride)) {
    return { error: `executionStyle must be one of ${Object.values(ExecutionStyle).join(", ")}` };
  }
  const dayCountOverride = params.dayCountConvention as DayCountConvention | undefined;
  if (dayCountOverride && !Object.values(DayCountConvention).includes(dayCountOverride)) {
    return { error: `dayCountConvention must be one of ${Object.values(DayCountConvention).join(", ")}` };
  }
  const theoModelOverride = params.theoModel as TheoModel | undefined;
  if (theoModelOverride && !Object.values(TheoModel).includes(theoModelOverride)) {
    return { error: `theoModel must be one of ${Object.values(TheoModel).join(", ")}` };
  }

  const aktiaClient = new MongoClient(process.env.MONGODB_URI as string);
  try {
    await aktiaClient.connect();
    const aktiaSymbols = aktiaClient.db("Aktia").collection("Symbols");
    const underlyingDoc = await aktiaSymbols.findOne({ "Symbol-Mic": underlyingSymbolMic });
    const currency = (underlyingDoc?.Currency as string | undefined) || "";

    // Priced-instrument's own spot: the cash underlying, unless this is an option-on-future
    // (baseContractId set), in which case it's the future's own tradable symbol instead.
    let priceDriverSymbol = underlyingSymbolMic;
    let futureBased = false;
    if (params.baseContractId) {
      const baseContract = await ContractModel.findById(params.baseContractId).lean();
      if (!baseContract) return { error: `baseContractId ${params.baseContractId} not found` };
      priceDriverSymbol = baseContract.symbol;
      futureBased = true;
    }

    let spotPrice = params.spotPrice;
    if (spotPrice == null) {
      const warmupFrom = moment(calcDate, formatYMD).subtract(10, "days").format(formatYMD);
      await checkPrices([priceDriverSymbol], warmupFrom);
      const lastKnown = getLastKnownPrice(priceDriverSymbol);
      if (!lastKnown) {
        return { error: `No price available for ${priceDriverSymbol} - pass spotPrice explicitly` };
      }
      spotPrice = lastKnown.price;
    }

    const settings = await resolveContractSettings({
      underlyingSymbolMic,
      expirationDate,
      executionStyle: executionStyleOverride,
      dayCountConvention: dayCountOverride,
    });

    const dividendRate = params.dividendRate ?? resolveDividendYield(underlyingDoc);
    const interestRate =
      params.interestRate ?? (await resolveRiskFreeRate(currency)) + settings.rateOffset;

    let volatility = params.volatility;
    if (volatility == null) {
      const historical = await calcHistoricalVolatility(underlyingSymbolMic, params.volatilityDays);
      volatility = (historical ?? resolveVolatility(underlyingDoc)) + settings.volatilityOffset;
    }

    const timeToExpiry = calcYearFraction(calcDate, expirationDate, settings.dayCountConvention);

    if (!isOption) {
      // Plain future/forward - cost-of-carry, not one of the option models. No execution
      // style/theoModel applies (see selectTheoModel.ts).
      const theoPrice = calcFutureTheoPrice({ spotPrice, timeToExpiry, riskFreeRate: interestRate, dividendRate });
      return {
        theoPrice,
        error: theoPrice === undefined ? "Contract has already expired as of calcDate" : undefined,
        resolved: {
          spotPrice,
          priceDriverSymbol,
          volatility,
          interestRate,
          dividendRate,
          dayCountConvention: settings.dayCountConvention,
          futureBased,
          timeToExpiry,
          calcDate,
        },
      };
    }

    const theoModel =
      theoModelOverride ?? selectTheoModel(contractType, settings.executionStyle, futureBased);

    const optionInputs = {
      theoModel,
      isCall: contractType === ContractType.Call,
      european: settings.executionStyle === ExecutionStyle.European,
      futureBased,
      spotPrice,
      strike: params.strike as number,
      timeToExpiry,
      riskFreeRate: interestRate,
      dividendRate,
      volatility,
    };

    const theoPrice = calcOptionTheoPrice(optionInputs);

    // Greeks are only meaningful once there is a price to differentiate - an unported model or
    // an expired contract yields neither.
    const greeks =
      theoPrice === undefined
        ? undefined
        : calcGreeks({ ...optionInputs, calcDate, executionStyle: settings.executionStyle });

    return {
      theoPrice,
      greeks,
      error:
        theoPrice === undefined
          ? timeToExpiry <= 0
            ? "Contract has already expired as of calcDate"
            : `theoModel "${theoModel}" is not yet computable (unported model, or the native addon isn't built)`
          : undefined,
      resolved: {
        spotPrice,
        priceDriverSymbol,
        volatility,
        interestRate,
        dividendRate,
        dayCountConvention: settings.dayCountConvention,
        executionStyle: settings.executionStyle,
        futureBased,
        theoModel,
        timeToExpiry,
        calcDate,
      },
    };
  } finally {
    await aktiaClient.close();
  }
}
