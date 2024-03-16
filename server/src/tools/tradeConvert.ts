import { DOMParser } from "@xmldom/xmldom";


const mapAddTrade = {
  trade_id: "tradeId", //"503978",
  type: "tradeType", //"1", dictionary
  state: "state",
  side: "state", //:"B",
  //   portfolio:"ETF2",
  price: "price", //:"73.6900",
  trade_currency: "currency", //"USD",
  //   portfolio_currency:"USD",
  crossRate: "rate",
  volume: "volume", //:"575",
  fee: "fee", //"21.185875",
  //   underlying_id:"4710",
  underlying: "symbol",
  name: "name", //"Communication Services Select Sector SPDR Fund",
  //    contract:"Spot",
  //   user:"test7",
  trade_time: "tradeTime", //"2024-01-10T00:00:02"
};

const xmlString = `<response>
    <row trade_id="503978" type="1" state="1" side="B" portfolio="ETF2" price="73.6900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="575" fee="21.185875" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-10T00:00:02"/>
    <row trade_id="503982" type="1" state="1" side="S" portfolio="ETF2" price="73.8100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="59" fee="2.177395" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-12T00:00:06"/>
    <row trade_id="503985" type="1" state="1" side="S" portfolio="ETF2" price="73.8100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="6" fee="0.221430" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-15T00:00:09"/>
    <row trade_id="503986" type="1" state="1" side="B" portfolio="ETF2" price="72.9400" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="147" fee="5.361090" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-17T00:00:10"/>
    <row trade_id="503990" type="1" state="1" side="S" portfolio="ETF2" price="74.8300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="127" fee="4.751705" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-19T00:00:14"/>
    <row trade_id="503991" type="1" state="1" side="B" portfolio="ETF2" price="74.9800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="163" fee="6.110870" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-22T00:00:15"/>
    <row trade_id="503994" type="1" state="1" side="S" portfolio="ETF2" price="76.1900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="71" fee="2.704745" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-24T00:00:18"/>
    <row trade_id="503998" type="1" state="1" side="B" portfolio="ETF2" price="78.3300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="24" fee="0.939960" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-29T00:00:22"/>
    <row trade_id="503979" type="1" state="1" side="B" portfolio="ETF2" price="25.5500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="296" fee="3.781400" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-10T00:00:03"/>
    <row trade_id="503980" type="1" state="1" side="B" portfolio="ETF2" price="25.7800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="450" fee="5.800500" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-12T00:00:04"/>
    <row trade_id="503984" type="1" state="1" side="S" portfolio="ETF2" price="25.7800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="25" fee="0.322250" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-15T00:00:08"/>
    <row trade_id="503987" type="1" state="1" side="S" portfolio="ETF2" price="25.4500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="286" fee="3.639350" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-17T00:00:11"/>
    <row trade_id="503997" type="1" state="1" side="S" portfolio="ETF2" price="26.5600" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="7" fee="0.092960" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-26T00:00:21"/>
    <row trade_id="503999" type="1" state="1" side="S" portfolio="ETF2" price="26.7100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="60" fee="0.801300" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-29T00:00:23"/>
    <row trade_id="503977" type="1" state="1" side="B" portfolio="ETF2" price="77.8200" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="642" fee="24.980220" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-10T00:00:01"/>
    <row trade_id="503981" type="1" state="1" side="S" portfolio="ETF2" price="76.9300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="94" fee="3.615710" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-12T00:00:05"/>
    <row trade_id="503983" type="1" state="1" side="B" portfolio="ETF2" price="76.9300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="14" fee="0.538510" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-15T00:00:07"/>
    <row trade_id="503988" type="1" state="1" side="S" portfolio="ETF2" price="76.1000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="45" fee="1.712250" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-17T00:00:12"/>
    <row trade_id="503989" type="1" state="1" side="B" portfolio="ETF2" price="77.3200" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="118" fee="4.561880" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-19T00:00:13"/>
    <row trade_id="503992" type="1" state="1" side="S" portfolio="ETF2" price="77.2300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="185" fee="7.143775" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-22T00:00:16"/>
    <row trade_id="503993" type="1" state="1" side="B" portfolio="ETF2" price="76.7300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="102" fee="3.913230" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-24T00:00:17"/>
    <row trade_id="503996" type="1" state="1" side="S" portfolio="ETF2" price="76.5500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="552" fee="21.127801" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-26T00:00:20"/>
    <row trade_id="503995" type="1" state="1" side="B" portfolio="ETF2" price="75.2000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="564" fee="21.206400" underlying_id="4718" underlying="IYC" name="iShares U.S. Consumer Services ETF" contract="Spot" user="test7" trade_time="2024-01-26T00:00:19"/>
    <row trade_id="504000" type="1" state="1" side="S" portfolio="ETF2" price="76.0900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="18" fee="0.684810" underlying_id="4718" underlying="IYC" name="iShares U.S. Consumer Services ETF" contract="Spot" user="test7" trade_time="2024-01-29T00:00:24"/>
    <row trade_id="503976" type="31" state="1" side="P" portfolio="ETF2" price="100000.0000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="0" fee="0.000000" contract="CASH" user="test7" trade_time="2024-01-09T00:00:00"/>

  </response>`;

const convertXmlToJson = (xmlString: string, portfolioId: string): any[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const trades: any[] = [];

  const tradeElements = xmlDoc.getElementsByTagName("row");
  for (let i = 0; i < tradeElements.length; i++) {
    const tradeElement = tradeElements[i];


    const obj = Object.keys(mapAddTrade).reduce(
      (t, attr) => ({

        ...t,
        // @ts-ignore
        [mapAddTrade[attr]]: tradeElement.getAttribute(attr),
      }),
      { command: "trades.add", portfolioId },
    );
    console.log(JSON.stringify(obj));
    trades.push(JSON.stringify(obj));
  }

  return []; //trades;
};

const pid = "65ef5e7e447f2942f66a3a9d";
const trades = convertXmlToJson(xmlString, pid);
console.log(trades);
/*
const xml =`
<response cmd="TRADES" messageId="4">
    <row trade_id="503978" type="1" state="1" side="B" portfolio="ETF2" price="73.6900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="575" fee="21.185875" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-10T00:00:02"/>
    <row trade_id="503982" type="1" state="1" side="S" portfolio="ETF2" price="73.8100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="59" fee="2.177395" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-12T00:00:06"/>
    <row trade_id="503985" type="1" state="1" side="S" portfolio="ETF2" price="73.8100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="6" fee="0.221430" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-15T00:00:09"/>
    <row trade_id="503986" type="1" state="1" side="B" portfolio="ETF2" price="72.9400" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="147" fee="5.361090" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-17T00:00:10"/>
    <row trade_id="503990" type="1" state="1" side="S" portfolio="ETF2" price="74.8300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="127" fee="4.751705" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-19T00:00:14"/>
    <row trade_id="503991" type="1" state="1" side="B" portfolio="ETF2" price="74.9800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="163" fee="6.110870" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-22T00:00:15"/>
    <row trade_id="503994" type="1" state="1" side="S" portfolio="ETF2" price="76.1900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="71" fee="2.704745" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-24T00:00:18"/>
    <row trade_id="503998" type="1" state="1" side="B" portfolio="ETF2" price="78.3300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="24" fee="0.939960" underlying_id="4710" underlying="XLC" name="Communication Services Select Sector SPDR Fund" contract="Spot" user="test7" trade_time="2024-01-29T00:00:22"/>
    <row trade_id="503979" type="1" state="1" side="B" portfolio="ETF2" price="25.5500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="296" fee="3.781400" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-10T00:00:03"/>
    <row trade_id="503980" type="1" state="1" side="B" portfolio="ETF2" price="25.7800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="450" fee="5.800500" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-12T00:00:04"/>
    <row trade_id="503984" type="1" state="1" side="S" portfolio="ETF2" price="25.7800" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="25" fee="0.322250" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-15T00:00:08"/>
    <row trade_id="503987" type="1" state="1" side="S" portfolio="ETF2" price="25.4500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="286" fee="3.639350" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-17T00:00:11"/>
    <row trade_id="503997" type="1" state="1" side="S" portfolio="ETF2" price="26.5600" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="7" fee="0.092960" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-26T00:00:21"/>
    <row trade_id="503999" type="1" state="1" side="S" portfolio="ETF2" price="26.7100" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="60" fee="0.801300" underlying_id="4715" underlying="AMJ" name="J.P. Morgan Alerian MLP Index ETN" contract="Spot" user="test7" trade_time="2024-01-29T00:00:23"/>
    <row trade_id="503977" type="1" state="1" side="B" portfolio="ETF2" price="77.8200" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="642" fee="24.980220" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-10T00:00:01"/>
    <row trade_id="503981" type="1" state="1" side="S" portfolio="ETF2" price="76.9300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="94" fee="3.615710" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-12T00:00:05"/>
    <row trade_id="503983" type="1" state="1" side="B" portfolio="ETF2" price="76.9300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="14" fee="0.538510" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-15T00:00:07"/>
    <row trade_id="503988" type="1" state="1" side="S" portfolio="ETF2" price="76.1000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="45" fee="1.712250" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-17T00:00:12"/>
    <row trade_id="503989" type="1" state="1" side="B" portfolio="ETF2" price="77.3200" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="118" fee="4.561880" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-19T00:00:13"/>
    <row trade_id="503992" type="1" state="1" side="S" portfolio="ETF2" price="77.2300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="185" fee="7.143775" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-22T00:00:16"/>
    <row trade_id="503993" type="1" state="1" side="B" portfolio="ETF2" price="76.7300" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="102" fee="3.913230" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-24T00:00:17"/>
    <row trade_id="503996" type="1" state="1" side="S" portfolio="ETF2" price="76.5500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="552" fee="21.127801" underlying_id="4717" underlying="FDIS" name="Fidelity MSCI Consumer Discretionary Index ETF" contract="Spot" user="test7" trade_time="2024-01-26T00:00:20"/>
    <row trade_id="503995" type="1" state="1" side="B" portfolio="ETF2" price="75.2000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="564" fee="21.206400" underlying_id="4718" underlying="IYC" name="iShares U.S. Consumer Services ETF" contract="Spot" user="test7" trade_time="2024-01-26T00:00:19"/>
    <row trade_id="504000" type="1" state="1" side="S" portfolio="ETF2" price="76.0900" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="18" fee="0.684810" underlying_id="4718" underlying="IYC" name="iShares U.S. Consumer Services ETF" contract="Spot" user="test7" trade_time="2024-01-29T00:00:24"/>
    <row trade_id="503976" type="31" state="1" side="P" portfolio="ETF2" price="100000.0000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="0" fee="0.000000" contract="CASH" user="test7" trade_time="2024-01-09T00:00:00"/>
</response>
`
*/
