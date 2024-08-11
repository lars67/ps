import CmdLine from "@/components/CmdLine";
import TextDetail from "@/components/TextDetail";
import Link from "next/link";

const Portfolios = () => {
  const ext = process.env.NODE_ENV === "production" ? ".html" : "";

  return (
    <div>
        <h1 className="firstItem">Portfolios</h1>

        <table>
        <tr>
          <th>Command</th>
          <th>Call</th>
        </tr>
        <tr>
          <td><Link href={`./portfolios${ext}/#to-list`}>List</Link></td>
          <td>
             <CmdLine
              cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.list"</span>,<span class="ͼ1m">"filter"</span>:{}<span class="cm-matchingBracket">}</span></div>`}
            />
          </td>
        </tr>
          <tr>
            <td><Link href={`./portfolios${ext}/#to-detailList`}>detailList</Link></td>
            <td>
              <CmdLine
                  cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.detailList"</span>,<span class="ͼ1m">"filter"</span>:{}<span class="cm-matchingBracket">}</span></div>`} />
            </td>
          </tr>

        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-add`}>Add</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.add"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"PortfolioName"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"baseInstrument"</span>:<span class="ͼ19">"SPY"</span>}</div>`}
            />
            `
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-update`}>Update</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.update"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"PortfolioName"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"baseInstrument"</span>:<span class="ͼ19">"SPY"</span>}</div>`}
            />
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-remove`}>Remove</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.remove"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"?"</span><span class="cm-matchingBracket">}</span></div>`}
            />
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-history`}>History</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.history"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"from"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"till"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"detail"</span>:<span class="ͼ1a">0</span>}</div>`}
            />
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-positions`}>Positions</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.positions"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"requestType"</span>:<span class="ͼ19">"0"</span>,<span class="ͼ1m">"marketPrice"</span>:<span class="ͼ19">"4"</span>,<span class="ͼ1m">"basePrice"</span>:<span class="ͼ19">"4"</span>}</div>`}
            />
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-trades`}>Trades</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolio.trades"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"from"</span>:<span class="ͼ19">""</span>}</div>`}
            />
          </td>
        </tr>
        <tr>
          <td>
            <Link href={`./portfolios${ext}/#to-putCash`}>Put Cash</Link>
          </td>
          <td>
            <CmdLine
              cmd={`div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.putCash"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"amount"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"?"</span>,<span class="ͼ1m">"rate"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span><span class="cm-matchingBracket">}</span></div>`}
            />
          </td>
        </tr>
        <tr>
          <td><Link href={`./portfolios${ext}/#to-putDividends`}>Put Dividends</Link></td>
          <td>
            <CmdLine
              cmd={`<div class="cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.putDividends"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"_testCashPortfolio2"</span>,<span class="ͼ1m">"tradeId"</span>:<span class="ͼ19">"t4"</span>,<span class="ͼ1m">"amount"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"CBK:XETR"</span>,  <span class="ͼ1m">"description"</span>:<span class="ͼ19">"put dividends CBK:XETR"</span>, <span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-01-15T00:00:02"</span>}</div>`}/>
          </td>
        </tr>
      </table>
      <p>
        In all portfolio commands which used <b>_id</b> as portfolio id, can be used also
        instead field _id: portfolio name or portfolio accountId. Examples:
      </p>
      <p> Remove with usage portfolio name instead _id:</p>
      <pre><CmdLine
        cmd={`<div className="cm-activeLine cm-line">{<span
               className="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.remove"</span>, <span class="ͼ1m">"_id"</span>:<span class="ͼ19">"_testPortfolio"</span>}</div>`}
      /></pre>
      <p> Usage portfolio field name instead _id:</p>
      <pre><CmdLine
        cmd={`<div className="cm-activeLine cm-line">{<span
               className="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.history"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"$var.pid"</span>,<span class="ͼ1m">"detail"</span>:<span class="ͼ1a">1</span>, <span class="ͼ1m">"_as"</span>:<span class="ͼ19">"history2"</span>}</div>`}
      /></pre>
      <br/>

      <h3 id="to-list">List portfolios</h3>
      <p>Used filter parameter similar  to common list filter parameter.</p>
      <p>For user with role member avaiable only own portfolios or public portfolios.</p>

      <h3 id="to-detailList">Detail List portfolios</h3>
      <p>Only admin command. Used similar to list , additionally added portfolio user name. </p>


      <h3 id="to-add">Add portfolio</h3>
      <pre><CmdLine
        cmd={`<div className="cm-line">{<span
               className="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.add"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"_testPortfolio"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"baseInstrument"</span>:<span class="ͼ19">"SPY"</span>}</div>`}
      /></pre>
      `
      <pre><CmdLine
        cmd={`<div className="cm-line">{<span
               className="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.add"</span>,<span class="ͼ1m">"_id"</span>: <span class="ͼ19">"65f52f98ab7128acd188b301"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"testPortfolioName"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"baseInstrument"</span>:<span class="ͼ19">"SPY"</span>}</div>`}
      /></pre>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td>name</td>
          <td>Portfolio name. Must be unique</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>currency</td>
          <td>Portfolio currency value laike : USD, DKK...</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>baseInstrument</td>
          <td>Some symbol like: SPY</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>description</td>
          <td>Desscriptiion</td>
          <td>No</td>
        </tr>
        <tr>
          <td>userId</td>
          <td>Automaticallly assign current user _id</td>
          <td>No</td>
        </tr>
        <tr>
          <td>portfolioIds</td>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <td>
            Children portfolios _id or names. [child1,  661fb59b6d472d966c0a7521]
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>userId</td>
          <td>
            UserId, when not set will be used userId of current logined User.{" "}
            <span color="red">
              Basically this field must set only automatically for current user.
            </span>
          </td>
          <td>No</td>
        </tr>
      </table>
      <TextDetail
        summary={"Output"}
        detail={`
{
    "command": "portfolios.add",
    "msgId": 64,
    "data": {
    "name": "_testPortfolioHistory",
    "currency": "USD",
    "userId": "65dd09760689c3bd1c0ff45a",
    "baseInstrument": "SPY",
    "portfolioIds": [],
    "_id": "661fb59b6d472d966c0a7521",
}`}
      />
      <h3 id="to-update">Update</h3>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> _id</td>
          <td>Portfolio , can be portfolio fields: _id or name</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>updated portfolio fields</td>
          <td>description,currency,baseInstrument</td>
          <td>No</td>
        </tr>
      </table>
      <h3 id="to-remove">Remove</h3>
      Remove portfolio with all portfolio trades
      <pre><CmdLine
        cmd={`<div class="cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.remove"</span>, <span class="ͼ1m">"_id"</span>:<span class="ͼ19">"_testPortfolio"</span>}</div>`}
      /></pre>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> _id</td>
          <td>Portfolio , can be portfolio fields: _id or name or accountId</td>
          <td>Yes</td>
        </tr>
      </table>
      <TextDetail
        summary={"Output Succesful:"}
        detail={`
{
    "command": "portfolios.remove",
    "msgId": 63,
    "data": {
    "_id": "661fb52d6d472d966c0a747e",
    "name": "_testPortfolioHistory",
    "currency": "USD",
    "userId": "65dd09760689c3bd1c0ff45a",
    "baseInstrument": "SPY",
    "portfolioIds": [],
    "__v": 0
}
}`}
      />
      <TextDetail
        summary={"Output Error:"}
        detail={`
{
    "command": "portfolios.remove",
    "msgId": 1,
    "error": "Can't find record with this _id or name"
}
`}
      />
      <h3 id="to-history">History</h3>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> _id</td>
          <td>Portfolio selection, can be portfolio fields: _id or name</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>from</td>
          <td>Date from trades will be returned. Format YYYY-MM-DD</td>
          <td>No</td>
        </tr>
        <tr>
          <td>till</td>
          <td>
            Date till trades will be returned. Format YYYY-MM-DD. Without will
            be used all from first{" "}
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>sample</td>
          <td>
            Output date
            <ul>
              <li> not set or 0 - trade dates(default)</li>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <li> 'day' or 1 - date step</li>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <li> 'week' or 2 - week step</li>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <li> 'month' or 3 - month step</li>
            </ul>
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>detail</td>
          <td>
            <ul>
              <li>0: show summary result only by trade dates</li>
              <li>1: show summary and trades result</li>
            </ul>
          </td>
          <td>No</td>
        </tr>
      </table>

      <p>
        Output contain array with date history result in property &apos;days&apos;, and
        when detail=1 property &apos;details&apos; with symbol information
        <br />
        Each day contain nav, cash, invested, investedWithoutTrades, where{" "}
        <b>nav=cash+invested+investedWithoutTrades</b>
        <br />
        invested - part invested via trade in this day, investedWithoutTrade-
        part invested early, but without trade in this day but in current
        prices, cash- is not invested in symbols yet.
      </p>
      <TextDetail
        summary={"Output:"}
        detail={`
{
    "command": "portfolios.history",
    "data": {
    "days": [
{
    "date": "2024-01-29",
    "invested": 101975.6,
    "investedWithoutTrades": 0,
    "cash": 1083.7146,
    "nav": 103059.3146
},
    ..................
    ],
    "details": [
{
    "symbol": "XLC",
    "operation": "BUY",
    "tradeTime": "2024-01-29T00:00:22",
    "currency": "USD",
    "rate": 1,
    "volume": 24,
    "price": 78.33,
    "fee": 0.93996,
    "cash": -1887.02,
    "newVolume": 646,
    "nav": 48714.160694,
    "invested": 50601.18,
    "investedSymbol": 50601.18,
    "cashChangeSymbol": -1880.86
},
    .............
{
    "symbol": "AMJ",
    "operation": "SELL",
    "tradeTime": "2024-01-29T00:00:23",
    "currency": "USD",
    "rate": 1,
    "volume": 60,
    "price": 26.71,
    "fee": 0.8013,
    "cash": -285.22,
    "newVolume": 368,
    "nav": 60145.239394,
    "invested": 60430.46,
    "investedSymbol": 9829.28,
    "cashChangeSymbol": 1601.7987
},
    ........
    ]
}
  `}
      />
      <h3 id="to-positions">Positions</h3>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> _id</td>
          <td>Portfolio selection, can beportfolio fields _id or name</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>requestType</td>
          <td>
            <ul>
              <li>0:Snapshot(default)</li>
              <li>1:Subscribe</li>
              <li>2:Unsubscribe</li>
            </ul>
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>marketType</td>
          <td>
            {" "}
            <ul>
              {" "}
              <li>0 bid</li>
              <li>1 offer</li>
              <li>2 last</li>
              <li>3 open</li>
              <li>4 close</li>
              <li>5 high</li>
              <li>6 low</li>
              <li>7 average</li>
            </ul>
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>basePrice</td>
          <td>
            <ul>
              <li>0 bid</li>
              <li>1 offer</li>
              <li>2 last</li>
              <li>3 open</li>
              <li>4 close</li>
              <li>5 high</li>
              <li>6 low</li>
              <li>7 average</li>
            </ul>
          </td>
          <td>No</td>
        </tr>
      </table>
      <h3 id="to-trades">Return portfolio trades</h3>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> _id</td>
          <td>Portfolio selection, can beportfolio fields _id or name</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>from</td>
          <td>Date from trades will be returned. Format YYYY-MM-DD</td>
          <td>No</td>
        </tr>
      </table>
      <h3 id="to-putCash">Put Cash</h3>
      <p>Put/Get cash to/from portfolio </p>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> portfolioId</td>
          <td>
            Portfolio selection, can be used portfolio fields: _id or name or
            accountId
          </td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>amount</td>
          <td>value in currency </td>
          <td>Yes</td>
        </tr>

        <tr>
          <td>currency</td>
          <td>value . Example USD,DKK,EUR...</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>rate</td>
          <td>
            Cash currency rate. When rate is not set and currency is not
            portfolio.currency will be used currency rate from server or used
            from historical date according tradeTime. Rate used for calculate
            value this currency in base currency
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>tradeTime</td>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <td>
            When not set will be used current time. Format: &quot;tradeTime&quot;
            :&quot;2024-03-05T08:00:00&quot;
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>fee</td>
          <td>
            Fee for command in current currency. Fee applied to portfolio
            currency as -fee*rate
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>description</td>
          <td>Description</td>
          <td>No</td>
        </tr>
        <tr>
          <td>tradeType</td>
          <td>
            Trade Type: cash|dividends|investment|correction. Default type :
            cash{" "}
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>aml</td>
          <td>AML</td>
          <td>No</td>
        </tr>
        <tr>
          <td>tradeId</td>
          <td>Some external system id</td>
          <td>No</td>
        </tr>
      </table>

      <h3 id="to-putDividends">Put Dividends</h3>
      <p>To current cash currency will be added value = current_symbol_volume*amount</p>
      <p>Put symnol dividends</p>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td> portfolioId</td>
          <td>
            Portfolio selection, can be used portfolio fields: _id or name or
            accountId
          </td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>symbol</td>
          <td>Symbol</td>
          <td>Yes</td>
        </tr>

        <tr>
          <td>amount</td>
          <td>value in currency.  </td>
          <td>Yes</td>
        </tr>

        <tr>
          <td>currency</td>
          <td>value . Example USD,DKK,EUR...</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>tradeTime</td>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <td>
            When not set will be used current time. Format: &quot;tradeTime&quot;
            :&quot;2024-03-05T08:00:00&quot;
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>fee</td>
          <td>
            Fee for command in current currency. Fee applied to portfolio
            currency as -fee*rate
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>description</td>
          <td>Description</td>
          <td>No</td>
        </tr>

        <tr>
          <td>aml</td>
          <td>AML</td>
          <td>No</td>
        </tr>
        <tr>
          <td>tradeId</td>
          <td>Some external system id</td>
          <td>No</td>
        </tr>
      </table>



    </div>
  );
};

export default Portfolios;
