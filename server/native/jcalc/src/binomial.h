#ifndef JCALC_BINOMIAL_H__
#define JCALC_BINOMIAL_H__

#ifdef __cplusplus
extern "C" {
#endif

/* American/European call/put via a CRR-style recombining binomial tree, continuous cost-of-
   carry only (no discrete dividend schedule - see binomial.c for why). yield is the
   dividend/cost-of-carry yield: pass the continuous dividend yield for spot-based options, or
   financingRate for future-based options (cost-of-carry b = financingRate - yield = 0, matching
   how JCalc's rtheor.c prices American options on futures). */
double binomial_price(double spot, double strike, double timeToExpiry,
                       double financingRate, double yield, double sigma,
                       int isCall, int isAmerican, int steps);

#ifdef __cplusplus
}
#endif

#endif /* JCALC_BINOMIAL_H__ */
