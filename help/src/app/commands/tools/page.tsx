import CmdLine from "@/components/CmdLine";
import TextDetail from "@/components/TextDetail";
import Link from "next/link";

const Tools = () => {
  const ext =  process.env.NODE_ENV === 'production' ? '.html' : '';

  return (
    <div>
      <h1 className="first-item">Tools</h1>
      <table>
      <tbody>
        <tr>
          <th>Command</th>
          <th>Call</th>
        </tr>

        <tr>
          <td>
            <Link href={`./tools/#to-statistic`}>Statistic</Link>
          </td>
          <td>
            <CmdLine
              cmd={`
                    <div className="cm-activeLine cm-line"><span
                        className="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"tools.statistic"</span>,<span class="ͼ1m">"portfolio"</span>:<span class="ͼ19">"vtest2"</span><span class="cm-matchingBracket">}</span>
                    </div>`}
            />
            <CmdLine
              cmd={`<div className="cm-activeLine cm-line">{<span
                        className="ͼ1m">"command"</span>:<span class="ͼ19">"tools.statistic"</span>,<span class="ͼ1m">"history"</span>:<span class="ͼ19">"SPY"</span>, <span class="ͼ1m">"from"</span>:<span class="ͼ19">"2010-01-04"</span>, <span class="ͼ1m">"till"</span>:<span class="ͼ19">"2013-12-31"</span>}</div>
                               </div>`}
            />
          </td>
        </tr>

        <tr>
          <td>
            <Link href={`./tools/#to-theoprice`}>Theoretical Price</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div className="cm-activeLine cm-line">{<span
                        className="ͼ1m">"command"</span>:<span class="ͼ19">"tools.theoPrice"</span>,<span class="ͼ1m">"underlyingSymbolMic"</span>:<span class="ͼ19">"MSFT:XNAS"</span>, <span class="ͼ1m">"contractType"</span>:<span class="ͼ19">"call"</span>, <span class="ͼ1m">"strike"</span>:400, <span class="ͼ1m">"daysToExpiration"</span>:90}</div>
                               </div>`}
            />
          </td>
        </tr>
      </tbody>
      </table>
      <h3 id="to-statistic">
        Calculate statistic for portfolio or historical data
      </h3>
      <table>
      <tbody>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td>history</td>
          <td>
            Historical data. Symbol name like <b>INTC</b>
          </td>
          <td>Required for historical data</td>
        </tr>
        <tr>
          <td>portfolio</td>
          <td>
            Portfolio <b>_id</b> or <b>name</b> or <b>accountId</b>
          </td>
          <td>Required for portfolio data</td>
        </tr>
        <tr>
          <td>from</td>
          <td>Used historical data from YYYY-MM-DD</td>
          <td>Required for history data</td>
        </tr>
        <tr>
          <td>till</td>
          <td>Till Date for historical data as YYYY-MM-DD</td>
          <td>No</td>
        </tr>
      </tbody>
      </table>
      <p> Command return object with statistics </p>

      <h3 id="to-theoprice">
        Calculate a theoretical price for an option or future/forward
      </h3>
      <p>
        A standalone calculator - not tied to any held position or existing <b>Contract</b>. Every
        field beyond <b>underlyingSymbolMic</b>/<b>contractType</b>/expiration/strike is optional
        and auto-resolved (live spot price, historical realized volatility, risk-free rate,
        dividend yield, execution style, day-count convention, pricing model); pass any of them
        explicitly to override, e.g. for a what-if scenario at a hypothetical spot/volatility.
        Options price via Black-Scholes (European, spot-based), Black-76 (European, future-based -
        set <b>baseContractId</b>), or a binomial tree (American, either basis). Plain
        futures/forwards price via cost-of-carry (<b>F = S * e^((r-q)*T)</b>) instead - no model
        selection applies to them.
      </p>
      <table>
      <tbody>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td>underlyingSymbolMic</td>
          <td>
            Underlying reference, <b>Symbol-Mic</b> form, e.g. <b>MSFT:XNAS</b>. Always drives
            volatility/dividend/currency resolution, even for a future-based option.
          </td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>contractType</td>
          <td>
            One of <b>future</b>, <b>forward</b>, <b>call</b>, <b>put</b> - direction/kind only,
            exercise style is set separately via executionStyle.
          </td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>expirationDate</td>
          <td>YYYY-MM-DD. Provide this OR daysToExpiration, not both.</td>
          <td>Yes, unless daysToExpiration is given</td>
        </tr>
        <tr>
          <td>daysToExpiration</td>
          <td>
            Alternative to expirationDate: resolves to calcDate + this many days. Use this instead
            of a hardcoded date for anything that should stay valid over time.
          </td>
          <td>Yes, unless expirationDate is given</td>
        </tr>
        <tr>
          <td>strike</td>
          <td>Strike price</td>
          <td>Required for call/put, omit for future/forward</td>
        </tr>
        <tr>
          <td>baseContractId</td>
          <td>
            Existing future/forward <b>Contract</b> <b>_id</b> to price this option off of (an
            option-on-future) instead of the cash underlying - triggers Black-76/Black-76-American
            and uses that contract&apos;s own tradable symbol as the live price driver.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>executionStyle</td>
          <td>
            <b>european</b> or <b>american</b>. Overrides the underlying/expiration cascade
            default (american) if set.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>dayCountConvention</td>
          <td>
            <b>actAct</b>, <b>act365</b>, or <b>30/365</b>. Overrides the cascade default
            (act365) if set. Governs time-to-expiry only - ps2 always discounts continuously.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>spotPrice</td>
          <td>
            Overrides the auto-fetched last known price of the price-driver symbol (the
            underlying, or the base future if baseContractId is set).
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>volatility</td>
          <td>
            Percentage points, e.g. 25 for 25%. Full override - if omitted, computed from real
            historical realized volatility (see volatilityDays), falling back to the
            underlying&apos;s vendor-supplied field only if there isn&apos;t enough price history.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>volatilityDays</td>
          <td>Lookback window in days for the historical-volatility calc when volatility is omitted (default 30)</td>
          <td>No</td>
        </tr>
        <tr>
          <td>interestRate</td>
          <td>
            Percentage points. Full override - if omitted, resolved from the underlying
            currency&apos;s yield curve (defaults to 0 if none seeded).
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>dividendRate</td>
          <td>
            Percentage points, continuous yield. Full override - if omitted, resolved from the
            underlying&apos;s Aktia.Symbols document.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>theoModel</td>
          <td>
            Overrides automatic model selection (call/put only). Only blackScholes/black76/
            black76American/americanBinomial/euroBinomial are actually computable today.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>calcDate</td>
          <td>YYYY-MM-DD as-of date for the calculation. Defaults to today.</td>
          <td>No</td>
        </tr>
      </tbody>
      </table>
      <p>
        Command returns <b>theoPrice</b> plus a <b>resolved</b> object showing every input actually
        used (including anything auto-derived), and for options a <b>greeks</b> object. An
        already-expired contract returns an <b>error</b> instead of a stale price.
      </p>
      <h4>Greeks</h4>
      <p>
        Returned automatically with every option price - no extra flag. A plain future/forward has
        none, since it is priced by cost of carry rather than an option model. Delta and gamma are
        closed-form for european contracts and read off the binomial tree for american ones; the
        rest are finite-difference bumps of the price, matching how the original pricing engine
        computed them.
      </p>
      <table>
      <tbody>
        <tr>
          <th>Greek</th>
          <th>Meaning</th>
        </tr>
        <tr>
          <td>delta</td>
          <td>Price change per 1.00 move in the underlying. Call 0..1, put -1..0.</td>
        </tr>
        <tr>
          <td>gamma</td>
          <td>Delta change per 1.00 move in the underlying - how fast delta shifts.</td>
        </tr>
        <tr>
          <td>vega</td>
          <td>Price change per <b>1 percentage point</b> of volatility (22 &rarr; 23).</td>
        </tr>
        <tr>
          <td>theta</td>
          <td>Price given up over <b>one trading day</b>. Friday&apos;s value covers the weekend.</td>
        </tr>
        <tr>
          <td>rho</td>
          <td>Price change per 1 percentage point of interest rate.</td>
        </tr>
        <tr>
          <td>rhoTenBasis / rhoOneBasis</td>
          <td>The same for a 10 basis point / 1 basis point move.</td>
        </tr>
        <tr>
          <td>speed</td>
          <td>Gamma change per 1.00 move in the underlying (third order).</td>
        </tr>
        <tr>
          <td>charm</td>
          <td>Delta change over one trading day.</td>
        </tr>
        <tr>
          <td>color</td>
          <td>Gamma change over one trading day.</td>
        </tr>
      </tbody>
      </table>
      <p>
        Delta and gamma are exact for european contracts (closed form) and come from the binomial
        tree for american ones. The rest are finite-difference bumps of the price. One caveat
        worth knowing: <b>theta</b> steps over weekends but not public holidays - ps2 has no
        trading calendar - so decay is under-stated the day before a market holiday.
      </p>
      <h4>Ready-made samples in the console</h4>
      <p>
        The console&apos;s command dropdown ships six worked examples for this command, so you can
        run one and edit it rather than writing the JSON from scratch:
      </p>
      <table>
      <tbody>
        <tr>
          <th>Sample</th>
          <th>Shows</th>
        </tr>
        <tr>
          <td>Theo Price - option, auto-resolve everything</td>
          <td>The minimal call: only the contract identity, everything else resolved for you</td>
        </tr>
        <tr>
          <td>Theo Price - option, manual what-if scenario</td>
          <td>Every input overridden, so no live market data is involved</td>
        </tr>
        <tr>
          <td>Theo Price - greeks explained</td>
          <td>What each of the ten greeks means and in which units</td>
        </tr>
        <tr>
          <td>Theo Price - greeks, compare strikes and exercise styles</td>
          <td>
            Six calculations in one send - ITM/ATM/OTM and european vs american - so the results
            pane shows the greeks side by side
          </td>
        </tr>
        <tr>
          <td>Theo Price - plain future (cost of carry)</td>
          <td>A future/forward, priced without an option model</td>
        </tr>
        <tr>
          <td>Theo Price - option on a future (Black-76)</td>
          <td>Pricing off a future&apos;s own price via <b>baseContractId</b></td>
        </tr>
      </tbody>
      </table>
    </div>
  );
};

export default Tools;
