import React, { useRef, useState } from "react";
import { Layout, Select, Divider, Modal, Button, message } from "antd";
import { Resizable } from "re-resizable";
import type { SelectProps } from "antd/es/select";
import styled from "styled-components";
import CSVTable, { CsvData } from "./CSVTable";
import { mapToTrade } from "./mapping";
import TradesTable, { TradesData } from "./TradesTable";
import TradesPortfolio, { TradesPortfolioData } from "./TradesPortfolio";
import useWSClient from "../../hooks/useWSClient";
import { useAppSelector } from "../../store/useAppSelector";
import { Portfolio } from "../../types/portfolio";
import { ErrorType } from "../../types/other";
import { isErrorType } from "../../utils";

const { Header, Content } = Layout;

const StyledLayout = styled.div`
  display: flex;
  flex-direction: column;

  height: calc(100vh - 180px);
  --top-div-height: calc(100vh - 180px);
`;

const StyledHeader = styled(Header)`
  display: flex;
  align-items: center;
  padding: 0 16px;
  background-color: #eee;
`;

const StyledButton = styled(Button)`
margin-right: 8px;
`

const TableContainer = styled.div`
  height: calc(100% - 40px);
  overflow: hidden;
`;
interface ContextPaneProps {
  leftWidth: number;
  onLeftWidthChange: (width: number) => void;
}

const ContextPane: React.FC<ContextPaneProps> = ({
  leftWidth,
  onLeftWidthChange,
}) => {
  return (
    <Content style={{ display: "flex", height: "100%" }}>
      <Resizable
        defaultSize={{
          width: leftWidth,
          height: "100%",
        }}
        onResize={(e, direction, ref, d) => {
          onLeftWidthChange(ref.offsetWidth);
        }}
        enable={{
          right: true,
        }}
        style={{ flex: "0 0 auto", backgroundColor: "#f0f0f0" }}
      >
        <div style={{ padding: 16, height: "100%" }}>Left Pane</div>
      </Resizable>
      <Divider type="vertical" style={{ height: "100%" }} />
      <div style={{ flex: "1 1 auto", padding: 16 }}>Right Pane</div>
    </Content>
  );
};

const parseCSVString = (csvString: string): CsvData[] => {

  const rows = csvString.trim().replace(/"/g,'').split("\n").filter(r=>
      !['BOF','BOA','BOS', 'EOS','EOA', 'EOF'].includes(r.slice(0,3)));

  const headers = rows[0].split(",");

  const data: CsvData[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(",");
    const row: CsvData = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    data.push(row);
  }
  return data;
};

const ImportComp: React.FC = () => {
  const { userId, token, role } = useAppSelector((state) => state.user);

  const [leftWidth, setLeftWidth] = useState(300);

  const handleSelectChange: SelectProps<string>["onChange"] = (value) => {
    console.log("Selected value:", value);
    setIsModalVisible(true);
  };

  const [fileContent, setFileContent] = useState<CsvData[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [trades, setTrades] = useState<TradesData[]>([]);

  const [visiblePortfolio, setVisiblePortfolio] = useState<boolean>(false);
  const [tradesPortfolio, setTradesPortfolio] = useState<{ currency?: string }>(
    {},
  );

  const modif = useRef(Math.round(100000 * Math.random()));
  const msgId = useRef(0);
  const ser = process.env.REACT_APP_WS;
  const url = `${ser}?${encodeURIComponent(token)}@${modif.current}`;

  const {
    canWork,
    handlers,
    sendJsonMessageSync,
    sendMsg,
    clearMsgId,
    readyState,
  } = useWSClient(url);

  const handleFileUpload = (file: File) => {
    setIsModalVisible(false);
    handleFileChange(file);
  };
  const handleFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target) {
        const fileText = event.target.result as string;
        // Convert fileText to object as per your specific requirements
        //  const parsedObject = {}; // Add your logic to parse the file content
        setFileContent(
          parseCSVString(fileText).filter((d) =>
            ["STK", "CASH"].includes(d.AssetClass),
          ).map(d=> d.AssetClass === 'CASH' ? {...d, Symbol: `${d.Symbol.replace('.', '')}:FX`} : d),
        );
      }
    };
    reader.readAsText(file);
  };

  const handleFieldMapping = () => {
    const t = mapToTrade(fileContent);
    console.log(t);
    // @ts-ignore
    setTrades(t.sort((i) => i.tradeDate));
    const b = t.find((i) => i.rate === 1);
    setTradesPortfolio({ currency: b ? b.currency.toString() : "" });
  };

  const handleCreatePortfolio = () => {
    setVisiblePortfolio(true);
  };

  const applyTrades = async (p: TradesPortfolioData) => {
    try {
      const reqPortfolio = {
        command: "portfolios.add",
        ...p,
      };

      const response: ErrorType | { data: Portfolio } = JSON.parse(await sendMsg(reqPortfolio))

      if (isErrorType(response)) {
        message.error(response.error);
      } else {
        const { _id } = response.data;
        setVisiblePortfolio(false);

        for (const trade of trades) {
          const com = { command: "trades.add", portfolioId: _id, ...trade }
          console.log(com);
          await sendMsg(com);
        }
      }
    } catch (err) {
      console.error("Error applying trades:", err);
      message.error("Unable to apply portfolio trades."+err);
    }
  };

  return (
    <StyledLayout>
      <StyledHeader>
        <Select
          style={{ width: 200, marginRight: 16 }}
          onChange={handleSelectChange}
          placeholder="Select import"
        >
          <Select.Option value="csv">CSV Tradess IB</Select.Option>
          <Select.Option value="option2">Some another import</Select.Option>
        </Select>
        <StyledButton
          disabled={fileContent.length < 1 || trades.length > 0}
          type="primary"
          onClick={handleFieldMapping}
        >
          Generate trades
        </StyledButton>
        <StyledButton
          disabled={trades.length < 1}
          type="primary"
          onClick={handleCreatePortfolio}
        >
          Create portfolio with trades
        </StyledButton>
      </StyledHeader>
      <Modal
        title="Select CSV File"
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
      >
        <input
          type="file"
          accept=".csv"
          onChange={(e) => handleFileUpload(e.target.files![0])}
        />
      </Modal>
      {fileContent.length > 0 && trades.length === 0 && (
        <TableContainer>
          <CSVTable data={fileContent} />
        </TableContainer>
      )}
      {trades.length > 0 && (
        <>
          <TableContainer>
            <TradesTable data={trades} />
          </TableContainer>
          <TradesPortfolio
            visible={visiblePortfolio}
            {...tradesPortfolio}
            setVisible={setVisiblePortfolio}
            onApply={applyTrades}
          />
        </>
      )}
    </StyledLayout>
  );
};

export default ImportComp;
