import { DOMParser } from "@xmldom/xmldom";


const mapAddTrade = {
  trade_id: "tradeId", //"503978",
  type: "tradeType", //"1", dictionary
  state: "state",
  side: "side", //:"B",
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

const xmlString1 = `<response>
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
const xmlString2 = `
<response cmd="TRADES1" messageId="1">
<row trade_id="502203" type="1" state="1" side="B" portfolio="vtest02" price="168.4600" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="10" underlying_id="4" underlying="AMZN" name="Amazon.com Inc." contract="Spot" user="test7" trade_time="2024-02-22T12:49:35"/>
<row trade_id="502167" type="1" state="1" side="B" portfolio="vtest02" price="101.0000" trade_currency="USD" portfolio_currency="DKK" crossRate="6.9226" volume="100" fee="2.000000" underlying_id="21" underlying="INTC" name="Intel Corporation" contract="Spot" user="test7" trade_time="2024-02-16T08:35:35.613"/>
<row trade_id="502190" type="1" state="1" side="S" portfolio="vtest02" price="44.4900" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="100" underlying_id="21" underlying="INTC" name="Intel Corporation" contract="Spot" user="test7" trade_time="2024-02-22T12:42:16"/>
<row trade_id="502202" type="1" state="1" side="B" portfolio="vtest02" price="680.9100" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="2" underlying_id="16" underlying="NVDA" name="NVIDIA Corporation" contract="Spot" user="test7" trade_time="2024-02-22T12:49:34"/>
<row trade_id="502192" type="1" state="1" side="S" portfolio="vtest02" price="192.5000" trade_currency="DKK" portfolio_currency="DKK" crossRate="1.0000" volume="67" underlying_id="120" underlying="DANSKE:XCSE" name="Danske Bank A/S" contract="Spot" user="test7" trade_time="2024-02-22T12:42:23"/>
<row trade_id="502125" type="1" state="1" side="B" portfolio="vtest02" price="163.5000" trade_currency="DKK" portfolio_currency="DKK" crossRate="1.0000" volume="164" fee="13.407000" underlying_id="120" underlying="DANSKE:XCSE" name="Danske Bank A/S" contract="Spot" user="test7" trade_time="2023-03-07T00:00:03"/>
<row trade_id="502127" type="1" state="1" side="S" portfolio="vtest02" price="148.7500" trade_currency="DKK" portfolio_currency="DKK" crossRate="1.0000" volume="97" fee="7.929750" underlying_id="120" underlying="DANSKE:XCSE" name="Danske Bank A/S" contract="Spot" user="test7" trade_time="2023-03-14T00:00:05"/>
<row trade_id="502191" type="1" state="1" side="S" portfolio="vtest02" price="105.4700" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="17" underlying_id="161" underlying="CAH" name="Cardinal Health Inc." contract="Spot" user="test7" trade_time="2024-02-22T12:42:21"/>
<row trade_id="502195" type="1" state="1" side="B" portfolio="vtest02" price="105.4700" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="320" underlying_id="161" underlying="CAH" name="Cardinal Health Inc." contract="Spot" user="test7" trade_time="2024-02-22T12:43:48"/>
<row trade_id="502199" type="1" state="1" side="S" portfolio="vtest02" price="105.4700" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="342" underlying_id="161" underlying="CAH" name="Cardinal Health Inc." contract="Spot" user="test7" trade_time="2024-02-22T12:49:32"/>
<row trade_id="502123" type="1" state="1" side="B" portfolio="vtest02" price="72.9700" trade_currency="USD" portfolio_currency="DKK" crossRate="6.9650" volume="73" fee="2.663405" underlying_id="161" underlying="CAH" name="Cardinal Health Inc." contract="Spot" user="test7" trade_time="2023-03-07T00:00:01"/>
<row trade_id="502194" type="1" state="1" side="B" portfolio="vtest02" price="61.6800" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4556" volume="76" underlying_id="1036" underlying="BN:XPAR" name="DANONE" contract="Spot" user="test7" trade_time="2024-02-22T12:42:41"/>
<row trade_id="502197" type="1" state="1" side="B" portfolio="vtest02" price="61.6800" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4556" volume="498" underlying_id="1036" underlying="BN:XPAR" name="DANONE" contract="Spot" user="test7" trade_time="2024-02-22T12:43:50"/>
<row trade_id="502198" type="1" state="1" side="S" portfolio="vtest02" price="61.6800" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4556" volume="527" underlying_id="1036" underlying="BN:XPAR" name="DANONE" contract="Spot" user="test7" trade_time="2024-02-22T12:49:31"/>
<row trade_id="502201" type="1" state="1" side="B" portfolio="vtest02" price="186.9000" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4556" volume="4" underlying_id="1039" underlying="DB1:XETR" name="DEUTSCHE BOERSE NA O.N." contract="Spot" user="test7" trade_time="2024-02-22T12:49:33"/>
<row trade_id="502193" type="1" state="1" side="B" portfolio="vtest02" price="81.2500" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="42" underlying_id="182" underlying="DELL" name="Dell Technologies Inc Class C" contract="Spot" user="test7" trade_time="2024-02-22T12:42:25"/>
<row trade_id="502196" type="1" state="1" side="B" portfolio="vtest02" price="81.2500" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="252" underlying_id="182" underlying="DELL" name="Dell Technologies Inc Class C" contract="Spot" user="test7" trade_time="2024-02-22T12:43:49"/>
<row trade_id="502200" type="1" state="1" side="S" portfolio="vtest02" price="81.2500" trade_currency="USD" portfolio_currency="DKK" crossRate="6.8695" volume="268" underlying_id="182" underlying="DELL" name="Dell Technologies Inc Class C" contract="Spot" user="test7" trade_time="2024-02-22T12:49:33"/>
<row trade_id="502124" type="1" state="1" side="B" portfolio="vtest02" price="11.8200" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4445" volume="404" fee="2.387640" underlying_id="1978" underlying="CBK:XETR" name="COMMERZBANK AG" contract="Spot" user="test7" trade_time="2023-03-07T00:00:02"/>
<row trade_id="502126" type="1" state="1" side="S" portfolio="vtest02" price="10.3950" trade_currency="EUR" portfolio_currency="DKK" crossRate="7.4452" volume="404" fee="2.387640" underlying_id="1978" underlying="CBK:XETR" name="COMMERZBANK AG" contract="Spot" user="test7" trade_time="2023-03-14T00:00:04"/>
<row trade_id="502122" type="31" state="1" side="P" portfolio="vtest02" price="100000.0000" trade_currency="DKK" portfolio_currency="DKK" crossRate="1.0000" volume="0" fee="0.000000" contract="CASH" user="test7" trade_time="2023-03-06T00:00:00"/>
    </response>`

const xmlString = `
    <response cmd="TRADES" messageId="5">
    <row trade_id="504146" type="1" state="1" side="B" portfolio="VTest0" price="108.0200" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="228" fee="12.314280" underlying_id="143" underlying="MMM" name="3M Company" contract="Spot" user="test7" trade_time="2024-01-22T00:00:01"/>
    <row trade_id="504153" type="1" state="1" side="S" portfolio="VTest0" price="96.1000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="228" fee="10.955400" underlying_id="143" underlying="MMM" name="3M Company" contract="Spot" user="test7" trade_time="2024-01-23T00:00:08"/>
    <row trade_id="504156" type="1" state="1" side="B" portfolio="VTest0" price="93.2400" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="257" fee="11.981340" underlying_id="143" underlying="MMM" name="3M Company" contract="Spot" user="test7" trade_time="2024-01-24T00:00:11"/>
    <row trade_id="504165" type="1" state="1" side="S" portfolio="VTest0" price="95.7500" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="257" fee="12.303875" underlying_id="143" underlying="MMM" name="3M Company" contract="Spot" user="test7" trade_time="2024-01-30T00:00:20"/>
    <row trade_id="504150" type="1" state="1" side="B" portfolio="VTest0" price="1253.0000" trade_currency="DKK" portfolio_currency="USD" crossRate="0.1459" volume="135" fee="84.577500" underlying_id="206" underlying="DSV:XCSE" name="DSV Panalpina A/S" contract="Spot" user="test7" trade_time="2024-01-23T00:00:05"/>
    <row trade_id="504161" type="1" state="1" side="S" portfolio="VTest0" price="1237.5000" trade_currency="DKK" portfolio_currency="USD" crossRate="0.1455" volume="135" fee="83.531250" underlying_id="206" underlying="DSV:XCSE" name="DSV Panalpina A/S" contract="Spot" user="test7" trade_time="2024-01-26T00:00:16"/>
    <row trade_id="504162" type="1" state="1" side="B" portfolio="VTest0" price="1237.0000" trade_currency="DKK" portfolio_currency="USD" crossRate="0.1455" volume="135" fee="83.497500" underlying_id="206" underlying="DSV:XCSE" name="DSV Panalpina A/S" contract="Spot" user="test7" trade_time="2024-01-29T00:00:17"/>
    <row trade_id="504148" type="1" state="1" side="B" portfolio="VTest0" price="97.3200" trade_currency="SEK" portfolio_currency="USD" crossRate="0.0956" volume="2653" fee="129.094980" underlying_id="1162" underlying="ELUX-B:XSTO" name="Electrolux, AB ser. B" contract="Spot" user="test7" trade_time="2024-01-22T00:00:03"/>
    <row trade_id="504154" type="1" state="1" side="S" portfolio="VTest0" price="97.7200" trade_currency="SEK" portfolio_currency="USD" crossRate="0.0956" volume="2653" fee="129.625581" underlying_id="1162" underlying="ELUX-B:XSTO" name="Electrolux, AB ser. B" contract="Spot" user="test7" trade_time="2024-01-23T00:00:09"/>
    <row trade_id="504147" type="1" state="1" side="B" portfolio="VTest0" price="21.6200" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0892" volume="1048" fee="11.328880" underlying_id="1904" underlying="DWNI:XETR" name="DEUTSCHE WOHNEN SE INH" contract="Spot" user="test7" trade_time="2024-01-22T00:00:02"/>
    <row trade_id="504157" type="1" state="1" side="S" portfolio="VTest0" price="21.8000" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0931" volume="1048" fee="11.423199" underlying_id="1904" underlying="DWNI:XETR" name="DEUTSCHE WOHNEN SE INH" contract="Spot" user="test7" trade_time="2024-01-24T00:00:12"/>
    <row trade_id="504160" type="1" state="1" side="B" portfolio="VTest0" price="21.7800" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0847" volume="1030" fee="11.216700" underlying_id="1904" underlying="DWNI:XETR" name="DEUTSCHE WOHNEN SE INH" contract="Spot" user="test7" trade_time="2024-01-26T00:00:15"/>
    <row trade_id="504163" type="1" state="1" side="S" portfolio="VTest0" price="22.0800" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0844" volume="1030" fee="11.371200" underlying_id="1904" underlying="DWNI:XETR" name="DEUTSCHE WOHNEN SE INH" contract="Spot" user="test7" trade_time="2024-01-29T00:00:18"/>
    <row trade_id="504152" type="1" state="1" side="B" portfolio="VTest0" price="10.6100" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0877" volume="2140" fee="11.352700" underlying_id="1978" underlying="CBK:XETR" name="COMMERZBANK AG" contract="Spot" user="test7" trade_time="2024-01-23T00:00:07"/>
    <row trade_id="504159" type="1" state="1" side="S" portfolio="VTest0" price="10.5450" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0882" volume="2140" fee="11.283150" underlying_id="1978" underlying="CBK:XETR" name="COMMERZBANK AG" contract="Spot" user="test7" trade_time="2024-01-25T00:00:14"/>
    <row trade_id="504164" type="1" state="1" side="B" portfolio="VTest0" price="10.7100" trade_currency="EUR" portfolio_currency="USD" crossRate="1.0834" volume="2091" fee="11.197305" underlying_id="1978" underlying="CBK:XETR" name="COMMERZBANK AG" contract="Spot" user="test7" trade_time="2024-01-30T00:00:19"/>
    <row trade_id="504149" type="1" state="1" side="B" portfolio="VTest0" price="597.5000" trade_currency="GBP" portfolio_currency="USD" crossRate="1.2700" volume="32" fee="9.560000" underlying_id="4722" underlying="CBG:XLON" name="CLOSE BROTHERS GROUP PLC ORD 25" contract="Spot" user="test7" trade_time="2024-01-22T00:00:04"/>
    <row trade_id="504155" type="1" state="1" side="S" portfolio="VTest0" price="602.5000" trade_currency="GBP" portfolio_currency="USD" crossRate="1.2715" volume="32" fee="9.640000" underlying_id="4722" underlying="CBG:XLON" name="CLOSE BROTHERS GROUP PLC ORD 25" contract="Spot" user="test7" trade_time="2024-01-23T00:00:10"/>
    <row trade_id="504158" type="1" state="1" side="B" portfolio="VTest0" price="550.0000" trade_currency="GBP" portfolio_currency="USD" crossRate="1.2719" volume="34" fee="9.350000" underlying_id="4722" underlying="CBG:XLON" name="CLOSE BROTHERS GROUP PLC ORD 25" contract="Spot" user="test7" trade_time="2024-01-25T00:00:13"/>
    <row trade_id="504151" type="1" state="1" side="B" portfolio="VTest0" price="5382.0000" trade_currency="GBP" portfolio_currency="USD" crossRate="1.2715" volume="3" fee="8.073000" underlying_id="4726" underlying="CRH:XLON" name="CRH PLC ORD EUR 0.32" contract="Spot" user="test7" trade_time="2024-01-23T00:00:06"/>
    <row trade_id="504145" type="31" state="1" side="P" portfolio="VTest0" price="100000.0000" trade_currency="USD" portfolio_currency="USD" crossRate="1.0000" volume="0" fee="0.000000" contract="CASH" user="test7" trade_time="2024-01-21T00:00:00"/>
</response>`
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

//const pid = "65ef5e7e447f2942f66a3a9d";
//const trades = convertXmlToJson(xmlString, pid);
const pid = "65fd4da55e7f16b5c35d57c8";///VTrst0 1004
const trades = convertXmlToJson(xmlString, pid);

//console.log(trades);
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
