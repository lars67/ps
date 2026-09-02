import {
  ContractType,
  ExecutionStyle,
  TheoModel,
  isOptionContractType,
} from "../../types/contract";

// Automatic model selection, driven by contract shape (option vs. future/forward, future- vs.
// spot-basis) and the resolved execution style (see resolveContractSettings.ts's Underlying ->
// Expiration -> Strike cascade - exercise style is no longer part of ContractType itself, see
// types/contract.ts). The dividend yield itself (resolveDividendYield.ts) is a parameter fed into
// whichever model this picks, not a fifth branch here - there's no discrete dividend-schedule data
// yet to justify branching beyond exercise style and future- vs spot-basis (see
// docs/derivatives/03-migration-notes.md in portfolio-server).
//
// American contracts (spot- or future-based) get the binomial tree rather than Bjerksund/Whaley/
// Black76American: only Black-Scholes, Black-76, and a CRR binomial tree are ported into the
// native JCalc addon so far (server/native/jcalc - see docs/derivatives/03-migration-notes.md's
// "Implementation status" for what's built). Bjerksund/BaroneAdesi/Geske/MacMillan remain valid
// manual TheoModel overrides for later, once ported - see calcTheoPrice.ts's SUPPORTED_MODELS.
//
// Plain future/forward contracts (not options) have no theoModel - futures price by cost-of-carry,
// not by one of this catalogue's models. executionStyle is meaningless for them too, so callers
// pass undefined in that case.
export function selectTheoModel(
  contractType: ContractType,
  executionStyle: ExecutionStyle | undefined,
  hasBaseContract: boolean,
): TheoModel | undefined {
  if (!isOptionContractType(contractType)) return undefined; // Future / Forward - no option pricing model applies

  const isFutureBased = hasBaseContract; // priced off a future/forward, not the cash underlying

  if (executionStyle === ExecutionStyle.European) {
    return isFutureBased ? TheoModel.Black76 : TheoModel.BlackScholes;
  }

  return TheoModel.AmericanBinomial; // American (the default - see resolveContractSettings.ts)
}
