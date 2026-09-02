/* Ported verbatim (formulas unchanged) from portfolio-server/PS_calculator/JCalc/eurobs.c -
   EuroBSCall/EuroBSPut only. The Greeks and implied-value solvers in the original file aren't
   needed for theoPrice and are left unported for now. */
#include <math.h>
#include "eurobs.h"
#include "constants.h"
#include "distrib.h"
#include "extmath.h"

#ifdef __cplusplus
extern "C" {
#endif

double EuroBSCall(double SpotPrice, double StrikePrice, double RateTimeToExp,
                   double VolTimeToExp, double RiskFreeRate, double Sigma)
{
   double S = (SpotPrice > 0.0 ? SpotPrice : MINSPOT);
   double X = (StrikePrice > 0.0 ? StrikePrice : MINSTRIKE);
   double rT = RateTimeToExp;
   double vT = VolTimeToExp;
   double r = (RiskFreeRate > 0.0 ? RiskFreeRate : MINRATE);
   double sigma = (Sigma > 0.0 ? Sigma : MINVOL);

   double d1, d2;

   if (vT <= ONEDAY) return dmax(S - X, 0);

   d1 = plog(S) - plog(X) + r*rT + sigma*sigma/2.0*vT;
   d1 /= sigma*sqrt(vT);

   d2 = d1 - sigma*sqrt(vT);

   return S * UniNCD(d1) - X*pexp(-r*rT)*UniNCD(d2);
}

double EuroBSPut(double SpotPrice, double StrikePrice, double RateTimeToExp,
                  double VolTimeToExp, double RiskFreeRate, double Sigma)
{
   double S = (SpotPrice > 0.0 ? SpotPrice : MINSPOT);
   double X = (StrikePrice > 0.0 ? StrikePrice : MINSTRIKE);
   double rT = RateTimeToExp;
   double vT = VolTimeToExp;
   double r = (RiskFreeRate > 0.0 ? RiskFreeRate : MINRATE);
   double sigma = (Sigma > 0.0 ? Sigma : MINVOL);

   double d1, d2;

   if (vT <= ONEDAY) return dmax(X - S, 0.0);

   d1 = plog(S) - plog(X) + r*rT + sigma*sigma/2.0*vT;
   d1 /= sigma*sqrt(vT);

   d2 = d1 - sigma*sqrt(vT);

   return X*pexp(-r*rT)*UniNCD(-d2) - S*UniNCD(-d1);
}

#ifdef __cplusplus
}
#endif
