import {lazy} from "react";
import Console from './console';
import Home from './Home';
import Test from './test'
import { SignInPage}  from './authentication';
import {ErrorPage} from './errors';

const QuoteGrid = lazy(() => import('./grid'));
const Import = lazy(() => import('./import'));


export {
  Console,
  Home,
   SignInPage,
    ErrorPage,
    Test,
    QuoteGrid,
    Import
};
