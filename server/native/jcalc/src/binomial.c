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

#ifdef __cplusplus
}
#endif
