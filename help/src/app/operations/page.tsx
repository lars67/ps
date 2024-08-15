import CmdLine from "@/components/CmdLine";
import TextDetail from "@/components/TextDetail";
import Link from "next/link";



const Operations = () => {

  return (
    <div>
      <h1 className="firstItem">Operations</h1>
      <ul className="no-bullets">
        <li>
          <Link href={`./operations/#to-buy`}>Buy symbol</Link>
        </li>
        <li>
          <Link href={`./operations/#to-sell`}>Sell symbol</Link>
        </li>
        <li>
          <Link href={`./operations/#to-cash`}>Put Cash</Link>
        </li>

        <li>
          <Link href={`./operations/#to-buyFX`}>Buy currency</Link>
        </li>
        <li>
          <Link href={`./operations/#to-sellFX`}>Sell currency</Link>
        </li>
      </ul>
      Below in Results present fragments of portfolios.positions cash.
      <ul>
        <li>total - cash in portfolio currency</li>
        <li>totalLocal - cash in symbol currency</li>
        <li>
          rate - rate to portfolio currency in moment convertation to portfolio
          currency (now).
        </li>
      </ul>
      <h3 id="to-buy"> Buy symbol</h3>
      <pre>
        <CmdLine
          cmd={`{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"tfx1"</span>,<span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"state"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"B"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"400.0"</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"DKK"</span>,<span class="ͼ1m">"rate"</span>:<span class="ͼ19">"0.2"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"1000"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"2"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"DANSKE:XCSE"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"Danske Bank A/S"</span>,<span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-01-15T00:00:08"</span>}`}
        />
      </pre>
      Will be invested in symbol in portfolio currency 400000DKK. Commision will
      be applied to portfolio currency (EUR).
      <TextDetail
        summary={"Cash Result"}
        detail={`
{
"symbol": "CASH_DKK",
"total": -53605.72187475291,
"rate": 0.13401430468688227,
"totalLocal": -400000
},
{
"symbol": "CASH_EUR",
"total": -0.4,
"rate": 1,
"totalLocal": -0.4
}
`}
      />
      <h3 id="to-sell"> Sell symbol</h3>
      <pre><CmdLine
        cmd={`{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"tfx1"</span>,<span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"state"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"S"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"400.0"</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"DKK"</span>,<span class="ͼ1m">"rate"</span>:<span class="ͼ19">"0.2"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"1000"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"2"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"DANSKE:XCSE"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"Danske Bank A/S"</span>,<span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-01-15T00:00:08"</span>}`}
      /></pre>
      Invested money in symbol back to symbol currency cash. Commision will be
      applied to portfolio currency.
      <TextDetail
        summary={"Cash Result"}
        detail={`
{
      "symbol": "CASH_DKK",
      "total": 53605.72187475291,
      "rate": 0.13401430468688227,
      "totalLocal": 400000
},
{
      "symbol": "CASH_EUR",
      "total": -0.4,
      "rate": 1,
      "totalLocal": -0.4
}            
            `}
      />
      <h3 id="to-cash"> Put cash</h3>
      <pre>
        <CmdLine
          cmd={`{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.putInvestment"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"tfx1"</span>,<span class="ͼ1m">"amount"</span>:<span class="ͼ19">"100000"</span>,<span class="ͼ1m">"shares"</span>:<span class="ͼ19">"1"</span>, <span class="ͼ1m">"currency"</span>:<span class="ͼ19">"DKK"</span>, <span class="ͼ1m">"tradeTime"</span> :<span class="ͼ19">"2024-04-09T00:01:00"</span>}`}
        />
      </pre>
      Put money to currency cash
      <TextDetail
        summary={"Cash Result"}
        detail={`
 {
      "symbol": "CASH_DKK",
      "total": 13401.430468688228,
      "rate": 0.13401430468688227,
      "totalLocal": 100000
 },
 {
      "symbol": "CASH_EUR",
      "total": 0,
      "rate": 1,
      "totalLocal": 0
 }
`}
      />
      <h3 id="to-buyFX"> Buy FX</h3>
      Buy EURDKK:FX mean that money from DKK cash will be moved to EUR cash. Fee
      will be applied to portfolio currency. When rate is not set it will be
      recieved from historical data for current day in moment creation trade.
      <pre>
        <CmdLine
          cmd={`<div className="cm-line">{<span
            className="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"tfx1"</span>,<span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"state"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"B"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"10"</span>,<span class="ͼ1m">"rate"</span>:<span class="ͼ19">"0.1"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"10000"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"0"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"EURDKK:FX"</span>, <span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-04-19T02:00:15"</span>}</div>`}
        />
      </pre>
      <TextDetail
        summary={"Cash Result"}
        detail={`
   {
       "symbol": "CASH_DKK",
       "total": -13401.430468688228,
       "rate": 0.13401430468688227,
       "totalLocal": -100000
   },
                {
                    "symbol": "CASH_EUR",
                    "total": 13404.681987324531,
                    "rate": 1,
                    "totalLocal": 13404.681987324531
                }`}
      />
      <h3 id="to-sellFX"> Sell FX</h3>
      Sell EURDKK:FX mean that money will be adde to DKK cash from EUR
      cash(portfolio baase currency. Fee will be applied to portfolio currency.
      When rate is not set it will be recieved from historical data for current
      day in moment creation trade.
      <pre>
        <CmdLine
          cmd={`<div className="cm-line">{<span
            className="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"tfx1"</span>,<span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"state"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"S"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"10"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"10000"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"20"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"EURDKK:FX"</span>, <span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-04-19T02:00:15"</span>}</div>`}
        />
      </pre>
      <TextDetail
        summary={"Cash Result"}
        detail={`
   {
       "symbol": "CASH_DKK",
       "total": -13401.430468688228,
       "rate": 0.13401430468688227,
       "totalLocal": -100000
   },
                {
                    "symbol": "CASH_EUR",
                    "total": 13404.681987324531,
                    "rate": 1,
                    "totalLocal": 13404.681987324531
                },
 }`}
      />
    </div>
  );
};

export default Operations;
