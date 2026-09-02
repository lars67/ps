/* Ported from portfolio-server/PS_calculator/JCalc/eurobs.h - only the plain (non-dividend,
   non-Greek) call/put pricers are needed here; the continuous-dividend adjustment
   (S * exp(-q*T) fed into these) is applied by the caller (addon.cc), matching how
   JCalc/div.c's EuroBSCallDiv/EuroBSPutDiv do it for the zero-discrete-dividends case
   (ps2 has no discrete dividend schedule yet - see docs/derivatives/03-migration-notes.md
   in portfolio-server). */
#ifndef JCALC_EUROBS_H__
#define JCALC_EUROBS_H__

#ifdef __cplusplus
extern "C" {
#endif

double EuroBSCall(double SpotPrice, double StrikePrice, double RateTimeToExp,
                   double VolTimeToExp, double RiskFreeRate, double Sigma);
double EuroBSPut(double SpotPrice, double StrikePrice, double RateTimeToExp,
                  double VolTimeToExp, double RiskFreeRate, double Sigma);

#ifdef __cplusplus
}
#endif

#endif /* JCALC_EUROBS_H__ */
