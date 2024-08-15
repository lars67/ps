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
    </div>
  );
};

export default Tools;
