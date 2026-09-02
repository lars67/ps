#include <napi.h>
#include <cmath>

extern "C" {
  double EuroBSCall(double, double, double, double, double, double);
  double EuroBSPut(double, double, double, double, double, double);
  double EuroBlackCall(double, double, double, double);
  double EuroBlackPut(double, double, double, double);
  double binomial_price(double, double, double, double, double, double, int, int, int);
}

static double GetNum(const Napi::Object& p, const char* key)
{
  return p.Get(key).As<Napi::Number>().DoubleValue();
}

static bool GetBool(const Napi::Object& p, const char* key)
{
  return p.Get(key).As<Napi::Boolean>().Value();
}

// calcTheoPrice(params) -> number
//
// params:
//   isCall         boolean
//   european       boolean  - European vs American exercise
//   futureBased    boolean  - priced off a future/forward (Black76) vs cash spot (Black-Scholes) -
//                              see services/derivatives/calcTheoPrice.ts for how this maps from
//                              Contract.theoModel/baseContractId
//   spot           number   - live price of the pricing driver: the underlying's cash spot when
//                              !futureBased, the base future contract's own live price when
//                              futureBased (see buildContractCalcContexts.ts)
//   strike         number
//   timeToExpiry   number   - years
//   riskFreeRate   number   - decimal (0.05 = 5%)
//   dividendYield  number   - decimal continuous yield; ignored when futureBased (Black76 has none)
//   volatility     number   - decimal (0.30 = 30%)
//
// Dispatch mirrors portfolio-server/PS_calculator/JCalc/rtheor.c's CalcTheorPrice_Call/_Put:
// MODEL_BLACKSCHOLES -> EuroBSCall/Put on a dividend-adjusted spot; MODEL_BLACK76 -> EuroBlackCall/
// Put on the future's own price, discounted by exp(-r*T); American exercise (both asset classes) ->
// the binomial tree, with futureBased options priced at cost-of-carry b=0 (yield=riskFreeRate),
// exactly as JCalc's American futures-option pricers do.
Napi::Value CalcTheoPrice(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "calcTheoPrice expects a params object").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object p = info[0].As<Napi::Object>();

  bool isCall = GetBool(p, "isCall");
  bool european = GetBool(p, "european");
  bool futureBased = GetBool(p, "futureBased");
  double spot = GetNum(p, "spot");
  double strike = GetNum(p, "strike");
  double T = GetNum(p, "timeToExpiry");
  double r = GetNum(p, "riskFreeRate");
  double q = GetNum(p, "dividendYield");
  double sigma = GetNum(p, "volatility");

  double result;

  if (european && !futureBased) {
    double dividendAdjustedSpot = spot * std::exp(-q * T);
    result = isCall
      ? EuroBSCall(dividendAdjustedSpot, strike, T, T, r, sigma)
      : EuroBSPut(dividendAdjustedSpot, strike, T, T, r, sigma);
  } else if (european && futureBased) {
    result = isCall
      ? EuroBlackCall(spot, strike, T, sigma)
      : EuroBlackPut(spot, strike, T, sigma);
    result *= std::exp(-r * T);
  } else {
    double carryYield = futureBased ? r : q;
    result = binomial_price(spot, strike, T, r, carryYield, sigma, isCall ? 1 : 0, /*isAmerican=*/1, /*steps=*/60);
  }

  if (result < 0) result = 0;

  return Napi::Number::New(env, result);
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  exports.Set("calcTheoPrice", Napi::Function::New(env, CalcTheoPrice));
  return exports;
}

NODE_API_MODULE(jcalc, Init)
