import Link from "next/link";
import CmdLine from "@/components/CmdLine";
import Text from "@/components/Text";

const Page = () => {
    const ext =  process.env.NODE_ENV === 'production' ? '.html' : '';
    return (<div>

            <h1 className="firstItem">Auth</h1>
            <ul className="no-bullets">
                <li>
                    <Link href={`./auth${ext}/#to-login`}>Login</Link>
                </li>
                <li>
                    <Link href={`./auth${ext}/#to-signup`}>Signup</Link>
                </li>
            </ul>
        <p>These commands need send to special login websocket</p>
        <h3 id="to-login"> Login</h3>
        <pre>
        <CmdLine
            cmd={`<div class="cm-activeLine cm-line"><span class="cm-matchingBracket">{</span><span class="ͼ1m">"cmd"</span>:<span class="ͼ19">"login"</span>,<span class="ͼ1m">"login"</span>:<span class="ͼ19">"login"</span>,<span class="ͼ1m">"password"</span>:<span class="ͼ19">"password"</span><span class="cm-matchingBracket">}</span></div>`} />
      </pre>
        <table>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>login</td>
                <td>User Login</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>password</td>
                <td>User password</td>
                <td>Yes</td>
            </tr>
        </table>
        <p> Result:</p> <p>Successfull:</p><Text html={`<pre>{
"token":"eyJhbGciOiJIU......",
"role":"member",
"userId":"66450cb15e1f94688db59355"}</pre>`}/>
        <p>Error: </p><pre><Text html={`{error:'some error'}`}/></pre>
        <p>When login success token can be used for open app websocket </p>

        <h3 id="to-signup">Signup</h3>
        <pre>
        <CmdLine
            cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"cmd"</span>:<span class="ͼ19">"signup"</span>,<span class="ͼ1m">"login"</span>:<span class="ͼ19">"login"</span>,<span class="ͼ1m">"password"</span>:<span class="ͼ19">"password"</span>, <span class="ͼ1m">"email"</span>:<span class="ͼ19">"cat@test.com"</span>,}</div>`} />
        </pre>
        <table>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
            </tr>
            <tr>
                <td>login</td>
                <td>User login</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>firstName</td>
                <td>First Name</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>secondName</td>
                <td>Second Name</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>accountNumber</td>
                <td>Account Number</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>telephone</td>
                <td>Telephone</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>country</td>
                <td>Country</td>
                <td>Yes</td>
            </tr>

            <tr>
                <td>password</td>
                <td>User password</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>email</td>
                <td>User email</td>
                <td>Yes</td>
            </tr>
        </table>
        <p>Result:</p> <p>Successfull:</p>
        <p>Return new user json </p>
        <p>Error: </p><pre><Text html={`{error:'some error'}`}/></pre>


    </div>)
};

export default Page;
