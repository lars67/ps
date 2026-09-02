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

/* Delta and gamma read off the tree rather than bumped, ported from binom.c's DeltaBinom /
   GammaBinom: the tree is built two steps longer (and time prolonged to match) so that today's
   spot sits at level 2, then a parabola is fitted through that level's three nodes and
   differentiated analytically. Bumping a binomial price instead gives noisy greeks, which is
   why the original reads the tree - see rdelta.c/rgamma.c, which use these for
   MODEL_AMBINOMIAL/MODEL_EUROBINOMIAL and DeltaValue/GammaValue for everything else. */
void binomial_delta_gamma(double spot, double strike, double timeToExpiry,
                           double financingRate, double yield, double sigma,
                           int isCall, int isAmerican, int steps,
                           double *outDelta, double *outGamma);

#ifdef __cplusplus
}
#endif

#endif /* JCALC_BINOMIAL_H__ */
