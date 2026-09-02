/* Ported verbatim from portfolio-server/PS_calculator/ANSI/EXTMATH.C - trimmed to only the
   functions eurobs.c/black76.c/binomial.c actually call (pexp/psqrt/plog/dmax). */
#include <math.h>
#include "extmath.h"
#include "constants.h"

#ifdef __cplusplus
extern "C" {
#endif

static double minExponent = -1;
static double maxExponent = -1;

double pexp(double x)
{
   if (minExponent < 0)
      minExponent = exp(DSMALLEXPE);
   if (maxExponent < 0)
      maxExponent = exp(DBIGEXPE);

   if (x <= DSMALLEXPE)
      return minExponent;
   if (x >= DBIGEXPE)
      return maxExponent;
   return exp(x);
}

double psqrt(double x)
{
   double RetVal = 0.0;
   if (x > 0.0) RetVal = sqrt(x);
   return RetVal;
}

double plog(double x)
{
   if (x < SMALLDOUBLE) return log(SMALLDOUBLE);
   return log(x);
}

double dmax(double a, double b)
{
   return a > b ? a : b;
}

#ifdef __cplusplus
}
#endif
