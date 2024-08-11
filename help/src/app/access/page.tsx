import Link from "next/link";

const Page = () => {
  const ext = process.env.NODE_ENV === "production" ? ".html" : "";

  return (
    <div>
      <h1 className="first-item">Access</h1>

      <h3 className="first-item">Roles</h3>
        <p>There are 3 main roles: </p>
      <ul>
          <li/>
        <li> <b>admin</b> - has full access to all commands and data. Can do commands with any userId, so instead user!!!!?? </li>
        <li/>
          <li>
          <b>member</b> - has <Link href={`#to-member`}>restricted access</Link> to
          commands and data<br/>
        </li>
          <li/>
        <li>
          <b>guest</b> - use
          <Link href={`#to-guest`}> not authorized guest access</Link> to public
          portfolios and some limited number commands{" "}
        </li>
      </ul>

      <h3 id="to-member"> Member</h3>
        Member must present in db (login and password) communication via websocket


            <p>
              Have access to own portfolios and public portfolios other users
            </p>
            <ul>
              <li>portfolios.list - show public and own portfolios</li>
              <li>portfolios.add - add own portfolio</li>
              <li>portfolios.update- update own portfolio</li>
              <li>portfolios.list - remove own portfolio.</li>
              <li>portfolios.history</li>
              <li>portfolios.positions</li>
              <li>portfolios.putCash</li>
              <li>portfolios.putInvestment</li>
              <li>portfolios.putDividends</li>
              <li>portfolios.trades</li>
              <li>trades.add</li>
              <li>trades.update</li>
              <li>trades.remove</li>

            </ul>

      <h3 id="to-guest"> Guest</h3>
        Guest used communication via separated websocket, which can do only limited number of commands.
        For communication not need to have login.

            <p>Have access to public portfolios and commands</p>
            <ul>
              <li>portfolios.history</li>
              <li>portfolios.positions</li>
            </ul>

    </div>
  );
};

export default Page;
