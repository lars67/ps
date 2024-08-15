import CmdLine from "@/components/CmdLine";
import TextDetail from "@/components/TextDetail";
import Link from "next/link";
import Table from "@/components/Table";

const Collections = () => {
  const page =
    process.env.NODE_ENV === "production" ? "collections.html" : "collections";
;
  return (
    <div>
      <h1 className="first-item">Collections</h1>
      <p>
          Common collection commands are <b>list, add, update, remove</b>. Syntax
        collection_name.method. Examples:
      </p>
      <pre><CmdLine
        cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.list"</span>,<span class="ͼ1m">"filter"</span>:{}}</div>`}
      /></pre>
        <p> It is general description collection methods <b>list, add, update, remove</b> But they can be extended for some collection. More details can be detected in
            <Link href={`/commands/portfolios`}>Portfolios</Link></p>

      <Table
        columns={["Command", "Call"]}
        rows={[
          // eslint-disable-next-line react/jsx-key
          [
            <Link key={'to-list'} href={`./${page}/#to-list`}>List</Link>,
            // eslint-disable-next-line react/jsx-key
            <CmdLine
                cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.list"</span>, <span class="ͼ1m">"filter"</span>: <span class="cm-matchingBracket">{</span><span class="ͼ1m">"name"</span>:<span class="ͼ19">"_Renamed"</span><span class="cm-matchingBracket">}</span>}</div>`}/>

          ],
          [
            // eslint-disable-next-line react/jsx-key
            <Link href={`./${page}/#to-add`}>Add</Link>,
            // eslint-disable-next-line react/jsx-key
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.add"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"_testPortfolio"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"currency"</span>:<span class="ͼ19">"USD"</span>,<span class="ͼ1m">"userId"</span>:<span class="ͼ19">""</span>,<span class="ͼ1m">"baseInstrument"</span>:<span class="ͼ19">"SPY"</span>}</div>`}
            />,
          ],
          [
            // eslint-disable-next-line react/jsx-key
            <Link href={`./${page}/#to-update`}>Update</Link>,
            // eslint-disable-next-line react/jsx-key
            <CmdLine
              cmd={`<div class="cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.update"</span>,<span class="ͼ1m">"_id"</span>:<span class="ͼ19">"$var.pid"</span>,<span class="ͼ1m">"description"</span>:<span class="ͼ19">"Update description and name"</span>,<span class="ͼ1m">"name"</span>:<span class="ͼ19">"_Renamed"</span>}</div>`}
            />,
          ],
          [
            // eslint-disable-next-line react/jsx-key
            <Link href={`./${page}/#to-update`}>Remove</Link>,
            // eslint-disable-next-line react/jsx-key
            <CmdLine
              cmd={`<div class="cm-activeLine cm-line">{<span class="ͼ1m">"command"</span>:<span class="ͼ19">"portfolios.remove"</span>, <span class="ͼ1m">"_id"</span>:<span class="ͼ19">"_testPortfolio"</span>}</div>`}
            />,
          ],
        ]}
      />
    <br/>
        <h3 id="to-list">List</h3>

        <Table
            columns={["Parameter", "Value", "Required"]}
            rows={[
                ['filter', 'Object with collection fields', 'No']
            ]}       />
<br/>
        <h3 id="to-add">Add</h3>
        <Table
            columns={["Parameter", "Value", "Required"]}
            rows={[
                ['some fields','Current collection fields. New record will be added.', '']
            ]}       />
        <br/>
        <h3 id="to-update">Update</h3>
        <Table
            columns={["Parameter", "Value", "Required"]}
            rows={[
                ['_id', 'Mongodb key (_id) for current record', , 'Yes'],
                ['some fields', 'Current collection fields which will be updated', '']
            ]}       />

        <br/>
        <h3 id="to-remove">Remove</h3>
        <Table
            columns={["Parameter", "Value", "Required"]}
            rows={[

                    ['_id', 'Mongodb key (_id) for current record', , 'Yes'],

            ]}       />

    </div>
  );
};

export default Collections;
