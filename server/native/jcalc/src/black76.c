/* Ported verbatim (formulas unchanged) from portfolio-server/PS_calculator/JCalc/black76.c -
   EuroBlackCall/EuroBlackPut only. */
#include <math.h>
#include "black76.h"
#include "constants.h"
#include "distrib.h"
#include "extmath.h"

#ifdef __cplusplus
extern "C" {
#endif

double EuroBlackCall(double FuturePrice, double StrikePrice, double VolTime, double Sigma)
{
   double F = (FuturePrice > 0.0 ? FuturePrice : MINSPOT);
   double X = (StrikePrice > 0.0 ? StrikePrice : MINSTRIKE);
   double T = VolTime;
   double sigma = (Sigma > 0.0 ? Sigma : MINVOL);

   double d1, d2;

   if (T <= ONEDAY) return dmax(F - X, 0);

   d1 = plog(F) - plog(X) + sigma*sigma/2.0*T;
   d1 /= sigma*psqrt(T);

   d2 = d1 - sigma*psqrt(T);

   return F*UniNCD(d1) - X*UniNCD(d2);
}

double EuroBlackPut(double FuturePrice, double StrikePrice, double VolTime, double Sigma)
{
   double F = (FuturePrice > 0.0 ? FuturePrice : MINSPOT);
   double X = (StrikePrice > 0.0 ? StrikePrice : MINSTRIKE);
   double T = VolTime;
   double sigma = (Sigma > 0.0 ? Sigma : MINVOL);

   double d1, d2;

   if (T <= ONEDAY) return dmax(X - F, 0);

   d1 = plog(F) - plog(X) + sigma*sigma/2.0*T;
   d1 /= sigma*psqrt(T);

   d2 = d1 - sigma*psqrt(T);

   return X*UniNCD(-d2) - F*UniNCD(-d1);
}

#ifdef __cplusplus
}
#endif
