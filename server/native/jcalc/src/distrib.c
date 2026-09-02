/* Ported verbatim from portfolio-server/PS_calculator/ANSI/DISTRIB.C - only UniNCD (the
   rational approximation to the standard normal CDF that EuroBSCall/Put and EuroBlackCall/Put
   rely on) is needed; the multi-dimensional distribution routines in the original file aren't
   used by any of the models being ported here. */
#include <math.h>
#include "distrib.h"

#ifdef __cplusplus
extern "C" {
#endif

double UniNCD(double z)
{
   double t, x, ans;

   x = fabs(z / sqrt(2.0));
   t = 1.0 / (1.0 + 0.5 * x);
   ans = t * exp(-z*z/2 - 1.26551223 + t*(1.00002368 + t*(0.37409196 +
      t*(0.09678418 + t*(-0.18628806 + t*(0.27886807 +
         t*(-1.13520398 + t*(1.48851587 +
            t*(-0.82215223 + t*0.17087277)))))))));
   return z >= 0.0 ? (2.0 - ans)/2 : ans/2;
}

#ifdef __cplusplus
}
#endif
