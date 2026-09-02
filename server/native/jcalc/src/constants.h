/* Numerical constants ported verbatim from portfolio-server/PS_calculator/JCalc/const2.h
   and PS_calculator/ANSI/CONST.H - only the subset EuroBSCall/EuroBSPut/EuroBlackCall/
   EuroBlackPut/binomial_price actually use. */
#ifndef JCALC_CONSTANTS_H__
#define JCALC_CONSTANTS_H__

#define ONEDAY 0.0025 /* one day ~= 1/365, per const2.h */
#define MINSPOT .001
#define MINSTRIKE .001
#define MINRATE 0.
#define MINVOL .01

#define DBIGEXPE 460
#define DSMALLEXPE -460
#define SMALLDOUBLE 1.e-200

#endif /* JCALC_CONSTANTS_H__ */
