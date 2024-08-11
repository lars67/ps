import CmdLine from "@/components/CmdLine";
import Text from "@/components/Text";
import Link from "next/link";

const Prices = () => {
  const ext = process.env.NODE_ENV === "production" ? ".html" : "";

  return (
    <div>
      <h1 className="first-item">Prices</h1>

      <table>
        <tr>
          <th>Command</th>
          <th>Call</th>
        </tr>
        <tr>
          <td>
            <Link href={`./prices${ext}/#to-prices`}>Prices</Link>
          </td>
          <td>
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"prices.historical"</span>,<span class="ͼ1m">"symbols"</span>:<span class="ͼ19">"INTC,AAPL"</span>,<span class="ͼ1m">"date"</span>:<span class="ͼ19">"2024-01-10"</span>,<span class="ͼ1m">"precision"</span>:<span class="ͼ1a">4</span><span class="cm-matchingBracket">}</span></div>`}
            />
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"command"</span>:<span class="ͼ19">"prices.historical"</span>,<span class="ͼ1m">"symbols"</span>:<span class="ͼ19">"INTC,AAPL"</span>,<span class="ͼ1m">"from"</span>:<span class="ͼ19">"2024-01-10"</span>,<span class="ͼ1m">"till"</span>: <span class="ͼ19">"2024-01-15"</span>,<span class="ͼ1m">"precision"</span>:<span class="ͼ1a">4</span><span class="cm-matchingBracket">}</span></div>`}
            />
          </td>
        </tr>
      </table>

      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
          <th>Required</th>
        </tr>
        <tr>
          <td>symbols</td>
          <td>List of symbols like &apos;INTC,META&apos;</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>date</td>
          <td>
            Date for retrieve prices as <b>YYYY-MM-DD</b>
          </td>
          <td>need set date or from</td>
        </tr>
        <tr>
          <td>from</td>
          <td>
            From Date for retrieve prices from date as <b>YYYY-MM-DD</b>
          </td>
          <td>need set date or from</td>
        </tr>
        <tr>
          <td>till</td>
          <td>
            Till Date for retrieve prices as <b>YYYY-MM-DD</b>
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>precision</td>
          <td>Number digits after point</td>
          <td>No. default 4</td>
        </tr>
      </table>
      <Text
        html={`
      <p>
      
        Command return object with symbols when used parameter <b>date</b></p>
        <pre>
          "data": {
            "INTC": 47.25,
            "AAPL": 186.19
          }
        </pre>
      <p>or array of objects when used <b>from</b></p>
        <pre>
           "data": [
          {
            "date": "2024-01-10",
            "INTC": 47.25,
            "AAPL": 186.19
          },
          {
            "date": "2024-01-11",
            "INTC": 47.11,
            "AAPL": 185.59
          },
          ....
          ]
        </pre>
      `}
      />
    </div>
  );
};

export default Prices;
