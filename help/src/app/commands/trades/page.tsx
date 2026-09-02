import CmdLine from "@/components/CmdLine";
import Link from "next/link";

const hi: string= 'HI';

const Page = () => {

    return (<div>
        <h1 className="firstItem">Trades</h1>

        <table>
            <tbody>
            <tr>
                <th>Command</th>
                <th>Call</th>
            </tr>
            <tr>
                <td><Link href={`./trades/#to-add`}>Add</Link></td>
                <td>
                    <CmdLine cmd={`<div className="cm-activeLine cm-line">{<span className="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"65f52f98ab7128acd188b300"</span>, <span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"B"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"73.6900"</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"rate"</span>:<span class="ͼ19">"1.0000"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"575"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"21.185875"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"XLC"</span>,<span class="ͼ1m">"tradeTime"</span>:<span class="ͼ19">"2024-01-10T00:00:02"</span>}</div>`} />
                </td>
            </tr>
            <tr>
                <td><Link href={`./trades/#to-removeAll`}>Remove all trades in portfolio </Link></td>
                <td>
                    <CmdLine cmd={`<div className="cm-activeLine cm-line">{<span className="ͼ1m">"command"</span>:<span class="ͼ19">"trades.removeAll"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"65f52f98ab7128acd188b300"</span>}</div></td>`} />
                </td>
            </tr>
            <tr>
                <td><Link href={`./trades/#to-update`}>Update</Link></td>
                <td>
                </td>
            </tr>
            <tr>
                <td><Link href={`./trades/#to-remove`}>Remove</Link></td>
                <td>
                </td>
            </tr>
            </tbody>
        </table>

        <h3 id="to-add">Add trade</h3>
<p>Required fields:</p>
        <table>
            <tbody>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>portfolioId</td>
                <td>Can be used: Portfolio id or name or accountId. Finally this field will contain portfolio id, which detected when used not portfolio id  </td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>tradeType</td>
                <td>Curently this field for  trade must have for trade type &apos;1&apos;</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>side</td>
                <td>Curently this field for  trade must contain for buy: <b>B</b>
                    or <b>S</b> for sell</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>symbol</td>
                <td>Some symbol like <b>INTC</b></td>
                <td>Yes, unless <b>contract</b> is given (see below) - then it is set automatically from the contract&apos;s own tradable symbol</td>
            </tr>
            <tr>
                <td>volume</td>
                <td>Trade Volume</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>price</td>
                <td>Trade Price</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>currency</td>
                <td>Trade Currency</td>
                <td>Yes</td>
            </tr>
            </tbody>
        </table>
<p>Not Required fields which will be set when it not filled:</p>
        <table>
            <tbody>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>userId</td>
                <td>Trade userId. Will be used user id for current user</td>
                <td></td>
            </tr>
            <tr>
                <td>tradeTime</td>
                <td>Trade time YYYY-MM-DDThh:mm:ss</td>
                <td></td>
            </tr>
            <tr>
                <td>rate</td>
                <td>Trade rate to [portfolio currency</td>
                <td></td>
            </tr>
            <tr>
                <td>fee</td>
                <td>Trade fee. Treat as 0</td>
                <td></td>
            </tr>
            </tbody>
        </table>
        <p> Additional not required filelds</p>
        <table>
            <tbody>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>description</td>
                <td>Trade description</td>
                <td>No</td>
            </tr>
            <tr>
                <td>shares</td>
                <td>Trade shares</td>
                <td>No</td>
            </tr>
            <tr>
                <td>tradeId</td>
                <td>Trade Id some external information </td>
                <td>No</td>
            </tr>
            <tr>
                <td>tradeSource</td>
                <td>Trade Source some external information </td>
                <td>No</td>
            </tr>
            <tr>
                <td>orderId</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>accountId</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>exchangeTime</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>updateTime</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>oldTradeId</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>aml</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>contract</td>
                <td>For an option or future trade only - see &quot;Booking an option/future trade&quot; below</td>
                <td>No</td>
            </tr>
            </tbody>
        </table>

        <h3 id="to-add-contract">Booking an option/future trade</h3>
        <p>
            For an option or future, omit <b>symbol</b> and pass a <b>contract</b> object instead -
            the contract is created/upserted by identity (same underlying + contractType + strike +
            expirationDate always resolves to the same contract) and <b>trade.symbol</b>/
            <b>trade.contractId</b> are set from it automatically.
        </p>
        <CmdLine cmd={`<div className="cm-activeLine cm-line">{<span className="ͼ1m">"command"</span>:<span class="ͼ19">"trades.add"</span>,<span class="ͼ1m">"portfolioId"</span>:<span class="ͼ19">"65f52f98ab7128acd188b300"</span>, <span class="ͼ1m">"tradeType"</span>:<span class="ͼ19">"1"</span>,<span class="ͼ1m">"side"</span>:<span class="ͼ19">"B"</span>,<span class="ͼ1m">"price"</span>:<span class="ͼ19">"12.50"</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"volume"</span>:<span class="ͼ19">"10"</span>,<span class="ͼ1m">"fee"</span>:<span class="ͼ19">"6.50"</span>,<span class="ͼ1m">"contract"</span>:{<span class="ͼ1m">"underlyingSymbolMic"</span>:<span class="ͼ19">"MSFT:XNAS"</span>,<span class="ͼ1m">"contractType"</span>:<span class="ͼ19">"call"</span>,<span class="ͼ1m">"strike"</span>:400,<span class="ͼ1m">"expirationDate"</span>:<span class="ͼ19">"2026-09-18"</span>,<span class="ͼ1m">"symbol"</span>:<span class="ͼ19">"MSFT260918C00400000"</span>}}</div>`} />
        <table>
            <tbody>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>contract.underlyingSymbolMic</td>
                <td>Underlying reference, <b>Symbol-Mic</b> form, e.g. <b>MSFT:XNAS</b></td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>contract.contractType</td>
                <td>One of <b>future</b>, <b>forward</b>, <b>call</b>, <b>put</b> - direction/kind only, exercise style is a separate cascading setting</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>contract.expirationDate</td>
                <td>YYYY-MM-DD</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>contract.symbol</td>
                <td>The contract&apos;s own tradable symbol (e.g. an OCC-style option symbol)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>contract.strike</td>
                <td>Strike price</td>
                <td>Required for call/put, omit for future/forward</td>
            </tr>
            <tr>
                <td>contract.baseContractId</td>
                <td>Contract <b>_id</b> to price off of instead of the cash underlying (e.g. an option-on-future&apos;s underlying future)</td>
                <td>No</td>
            </tr>
            <tr>
                <td>contract.multiplier</td>
                <td>Contract/lot size. Falls back to the underlying/expiration cascade default if omitted</td>
                <td>No</td>
            </tr>
            <tr>
                <td>contract.market / contract.feedCode / contract.provider</td>
                <td>Market/feed metadata</td>
                <td>No</td>
            </tr>
            <tr>
                <td>contract.executionStyle</td>
                <td><b>european</b> or <b>american</b> - overrides the underlying/expiration cascade default if set</td>
                <td>No</td>
            </tr>
            <tr>
                <td>contract.dayCountConvention</td>
                <td><b>actAct</b>, <b>act365</b>, or <b>30/365</b> - overrides the cascade default if set</td>
                <td>No</td>
            </tr>
            <tr>
                <td>contract.volatilityOffset / contract.rateOffset</td>
                <td>Additive, percentage points, stacked on top of the underlying&apos;s base volatility/rate and any expiration-level offset</td>
                <td>No</td>
            </tr>
            </tbody>
        </table>
        <p>See also <Link href={`../tools/#to-theoprice`}>tools.theoPrice</Link> to price an option/future before booking a trade for it.</p>

        <h3 id="to-removeAll">Remove all portfolio trades. Portfolio will be fully empty</h3>
<table>
    <tbody>
    <tr>
        <th>Parameter</th>
        <th>Value</th>
        <th>Required</th>
    </tr>
    <tr>
        <td>portfolioId</td>
        <td>Portfolio ID</td>
        <td>Yes</td>
    </tr>

    </tbody>
</table>

        <h3 id="to-update">Update</h3>
        <p> ! For this moment this command is work similar to commoon <Link href={`commands/collections`}>collection.update </Link></p>

        <h3 id="to-update">Remove</h3>
        <p> ! For this moment this command is work similar to commoon <Link href={`commands/collections`}>collection.remove </Link></p>


    </div>)
};

export default Page;
