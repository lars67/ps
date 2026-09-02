/* Ported from portfolio-server/PS_calculator/JCalc/black76.h - European call/put only (Black's
   model for options on futures, not present-value-adjusted - the caller discounts by
   exp(-r*T), matching rtheor.c's MODEL_BLACK76 branch). */
#ifndef JCALC_BLACK76_H__
#define JCALC_BLACK76_H__

#ifdef __cplusplus
extern "C" {
#endif

double EuroBlackCall(double FuturePrice, double StrikePrice, double VolTime, double Sigma);
double EuroBlackPut(double FuturePrice, double StrikePrice, double VolTime, double Sigma);

#ifdef __cplusplus
}
#endif

#endif /* JCALC_BLACK76_H__ */
