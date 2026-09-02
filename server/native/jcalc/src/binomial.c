/* Reentrant port of portfolio-server/PS_calculator/JCalc/binom.c's Construct_Binomial_Tree /
   Construct_Option_Tree / Binom. The tree-construction formulas (up/down factors per Hull's
   footnote 7 p.337, backward induction, early-exercise clamp) are unchanged from the original -
   only the plumbing differs:

   - JCalc's originals read/write a global UnderlyingParams struct `u`, populated by the old
     PS_instrument DB-assembly layer (contractCache, dividendCache, etc.) that ps2 doesn't have
     and doesn't need - ps2 assembles calc inputs itself (buildContractCalcContexts.ts). These
     functions take explicit parameters instead of touching `u`, so they're safe to call
     concurrently.
   - Continuous cost-of-carry (yield) only - the original's discrete-dividend branch
     (numberOfDivs > 0, PV-adjusting the tree) is not ported: ps2 has no discrete dividend-
     schedule collection yet (see docs/derivatives/03-migration-notes.md in portfolio-server,
     same gap already noted for selectTheoModel.ts's GENERIC_AMERICAN branching).
   - The original scales financingRate/yield/sigma by rateTime/timeToExpiry ratios to account
     for day-count conventions that differ between rate-time and vol-time. ps2 has no such
     convention infrastructure (a single T, in years, is used everywhere) so those ratios are
     always 1 and are omitted here - not a behavior change under ps2's simpler time model.
*/
#include <math.h>
#include <stdlib.h>
#include "extmath.h"
#include "constants.h"
#include "binomial.h"

#ifdef __cplusplus
extern "C" {
#endif

static double **alloc_matrix(int n)
{
   int i;
   double **m = (double **)malloc((size_t)(n + 1) * sizeof(double *));
   for (i = 0; i <= n; i++) m[i] = (double *)calloc((size_t)(n + 1), sizeof(double));
   return m;
}

static void free_matrix(double **m, int n)
{
   int i;
   for (i = 0; i <= n; i++) free(m[i]);
   free(m);
}

/* Ported from Construct_Binomial_Tree (binom.c) - up/down factors and recombining tree fill,
   formulas unchanged. */
static void construct_binomial_tree(double spot, double financingRate, double yield, double sigma,
                                     double **tree, double *prob_up, double *delta,
                                     double timeToExpiry, int steps)
{
   double up, down, a, b2;
   int i, j;

   *delta = timeToExpiry / steps;

   a = pexp((financingRate - yield) * (*delta));
   b2 = a * a * (pexp(sigma * sigma * (*delta)) - 1);

   up = (a*a + b2 + 1 + sqrt((a*a + b2 + 1)*(a*a + b2 + 1) - 4*a*a)) / (2*a);
   down = 1.0 / up;

   *prob_up = (a - down) / (up - down);

   tree[0][0] = spot;

   for (i = 1; i <= steps; i++) tree[i][i] = up * tree[i-1][i-1];

   for (i = 1; i <= steps; i++)
   {
      tree[i][0] = down * tree[i-1][0];
      for (j = 1; j <= steps - i; j++) tree[i+j][j] = tree[i+j-2][j-1];
   }
}

/* Ported from Construct_Option_Tree (binom.c) - backward induction and early-exercise clamp,
   formulas unchanged (call/put branches merged via isCall since the original's two branches
   were otherwise identical). */
static void construct_option_tree(double financingRate, double **stock_tree, double **option_tree,
                                   double prob_up, double delta, int steps,
                                   double strike, int isCall, int isAmerican)
{
   int i, j;
   double keep_value, exercise_value, rate_factor;
   double prob_down = 1.0 - prob_up;

   rate_factor = pexp(-financingRate * delta);

   for (i = 0; i <= steps; i++)
      option_tree[steps][i] = isCall
         ? dmax(0, stock_tree[steps][i] - strike)
         : dmax(0, strike - stock_tree[steps][i]);

   for (i = steps - 1; i >= 0; i--)
   {
      for (j = 0; j <= i; j++)
      {
         keep_value = rate_factor * (prob_up*option_tree[i+1][j+1] + prob_down*option_tree[i+1][j]);
         if (isAmerican)
         {
            exercise_value = isCall ? (stock_tree[i][j] - strike) : (strike - stock_tree[i][j]);
            option_tree[i][j] = dmax(keep_value, exercise_value);
         }
         else
         {
            option_tree[i][j] = keep_value;
         }
      }
   }
}

double binomial_price(double spot, double strike, double timeToExpiry,
                       double financingRate, double yield, double sigma,
                       int isCall, int isAmerican, int steps)
{
   double prob_up, delta, res;
   double **stock_tree;
   double **option_tree;

   /* if we are at expiry, the option has no time value - ported from Binom() */
   if (timeToExpiry <= ONEDAY)
      return isCall ? dmax(spot - strike, 0) : dmax(strike - spot, 0);

   stock_tree = alloc_matrix(steps);
   option_tree = alloc_matrix(steps);

   construct_binomial_tree(spot, financingRate, yield, sigma, stock_tree, &prob_up, &delta, timeToExpiry, steps);
   construct_option_tree(financingRate, stock_tree, option_tree, prob_up, delta, steps, strike, isCall, isAmerican);

   res = option_tree[0][0];

   free_matrix(stock_tree, steps);
   free_matrix(option_tree, steps);

   return res;
}

/* Ported from binom.c's DeltaBinom / GammaBinom. Both originals build the identical tree and
   differ only in which derivative they take from it, so they are merged here into one call that
   returns both - halving the work when (as in ps2) delta and gamma are always wanted together.

   The technique, unchanged from the original: extend the tree by 2 steps and prolong time by
   (n+2)/n so the extra levels sit "before" today, leaving today's spot as the middle node of
   level 2. Fitting a parabola through that level's three (stock, option) pairs and taking its
   first/second derivative gives delta/gamma directly from the tree, which is far steadier than
   bumping a piecewise-linear tree price. The algebraic expressions below are the original's
   verbatim. */
void binomial_delta_gamma(double spot, double strike, double timeToExpiry,
                           double financingRate, double yield, double sigma,
                           int isCall, int isAmerican, int steps,
                           double *outDelta, double *outGamma)
{
   double prob_up, delta_t, denom;
   double **stock_tree;
   double **option_tree;
   double x1, x2, x3, y1, y2, y3;
   double timeProlongation;
   double prolongedTime;
   int n;

   /* At expiry the option has no time value - the original returns the step function directly
      (DeltaBinom) and a spike at the strike (GammaBinom). */
   if (timeToExpiry <= ONEDAY)
   {
      if (isCall) *outDelta = (spot > strike) ? 1.0 : 0.0;
      else        *outDelta = (spot > strike) ? 0.0 : -1.0;
      *outGamma = (fabs(spot - strike) > LEASTCURRENCYUNIT) ? 0.0 : 1.0;
      return;
   }

   timeProlongation = (steps + 2) / (double)steps;
   n = steps + 2;
   prolongedTime = timeToExpiry * timeProlongation;

   stock_tree = alloc_matrix(n);
   option_tree = alloc_matrix(n);

   construct_binomial_tree(spot, financingRate, yield, sigma, stock_tree, &prob_up, &delta_t, prolongedTime, n);
   construct_option_tree(financingRate, stock_tree, option_tree, prob_up, delta_t, n, strike, isCall, isAmerican);

   x1 = stock_tree[2][0];
   x2 = stock_tree[2][1];
   x3 = stock_tree[2][2];
   y1 = option_tree[2][0];
   y2 = option_tree[2][1];
   y3 = option_tree[2][2];

   denom = (-x1 + x2) * (-x1 + x3) * (-x2 + x3);

   if (denom == 0.0)
   {
      /* Degenerate tree (zero vol collapses the nodes onto each other) - the original would
         divide by zero here; ps2 reports "no value" rather than an inf/NaN. */
      *outDelta = 0.0;
      *outGamma = 0.0;
   }
   else
   {
      *outDelta = (-x2*x2*y1 + 2*x2*x3*y1 - x3*x3*y1 - x1*x1*y2 + 2*x1*x2*y2
                   - 2*x2*x3*y2 + x3*x3*y2 + x1*x1*y3 - 2*x1*x2*y3 + x2*x2*y3) / denom;
      *outGamma = 2 * (-x2*y1 + x3*y1 + x1*y2 - x3*y2 - x1*y3 + x2*y3) / denom;
   }

   free_matrix(stock_tree, n);
   free_matrix(option_tree, n);
}

#ifdef __cplusplus
}
#endif
