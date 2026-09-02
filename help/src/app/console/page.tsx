import Link from "next/link";

const Console = () => {
  return (
    <div>
      <h1 className="firstItem">Console</h1>
      <p>
        The console sends commands to the server and shows the replies. Anything you can do
        through the application you can do here by hand, which makes it the quickest way to try a
        command out, to check what the server actually returns, or to script a sequence of steps.
      </p>

      <h3 id="co-scripts">Writing a script</h3>
      <p>
        The editor is a buffer, not a single command line. Every JSON object in it that carries a{" "}
        <b>command</b> field is sent, in the order it appears, and each reply is appended to the
        results pane. So a whole sequence - create a portfolio, fund it, book a trade, read the
        positions back - can be prepared and run in one go.
      </p>
      <p>
        <b>Everything outside those objects is ignored</b>, which is what makes comments possible.
        There is no comment marker to learn: any line that is not part of a command is simply not
        sent. A leading <b>#</b> is only a convention, and prose that happens to contain braces -
        writing about <b>{"{}"}</b> in a filter, for example - is fine too.
      </p>
      <p>
        Comment lines are shown greyed and italic in the editor. That styling is not decoration:
        it is derived from the same reading of the buffer the send uses, so what looks like a
        comment is exactly what will be skipped. If a command loses its greying, it is about to be
        treated as text; if text turns dark, it is about to be sent.
      </p>

      <h3 id="co-mistakes">When a command is malformed</h3>
      <p>
        A command whose JSON does not parse - a missing quote, a trailing comma - is underlined in
        the editor as you type, and the send is refused with the line number rather than running
        the commands that happen to be valid. This is deliberate: a half-executed script leaves the
        data in a state nobody intended, and that is worse than a script that refuses to start.
      </p>

      <h3 id="co-commands">Finding a command</h3>
      <p>
        The dropdown lists everything your role may run, grouped by a prefix so related commands
        sit together:
      </p>
      <table>
      <tbody>
        <tr>
          <th>Group</th>
          <th>Contains</th>
        </tr>
        <tr>
          <td>Portfolio</td>
          <td>Positions, history, cash and dividend bookings, reports</td>
        </tr>
        <tr>
          <td>Trades</td>
          <td>Booking equity and option/future trades, and the live trade feed</td>
        </tr>
        <tr>
          <td>Calc</td>
          <td>Statistics and theoretical option/future pricing</td>
        </tr>
        <tr>
          <td>Data</td>
          <td>Prices, quotes and symbol subscriptions</td>
        </tr>
        <tr>
          <td>Admin</td>
          <td>Log files and health checks</td>
        </tr>
        <tr>
          <td>Collection</td>
          <td>Raw list/add/update/remove for each collection</td>
        </tr>
        <tr>
          <td>Test</td>
          <td>The scripting helpers described under <Link href={`/tests`}>Test commands</Link></td>
        </tr>
      </tbody>
      </table>
      <p>
        Commands you have saved yourself stay at the top of the list. Picking any entry drops a
        worked example into the editor, comments and all, so most of the time it is easier to start
        from one and edit it than to type a command from scratch. The search box matches on the
        label, so typing a group name narrows the list to that group.
      </p>

      <h3 id="co-variables">Passing a result into the next command</h3>
      <p>
        A command can store its reply in a variable with <b>&quot;_as&quot;</b>, and later commands
        can read it back with <b>$var.</b> - useful when a step needs an id that the previous step
        created. The details, along with the rest of the scripting helpers, are on the{" "}
        <Link href={`/tests`}>Test commands</Link> page.
      </p>
    </div>
  );
};

export default Console;
