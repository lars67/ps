import {Radio, RadioChangeEvent, Select} from "antd";
import SocketConnectionIndicator from "../../SocketConnectionIndicator";
import { ReadyState } from "react-use-websocket";
import { Portfolio } from "../../types/portfolio";
import styled from "styled-components";

type Props = {
  readyState: ReadyState;
  portfolios: Portfolio[];
  pid: string | undefined;
  onSelectPortfolio: (p: string) => void;
  canWork: boolean;
  children: React.ReactNode;
  leftChildren?: React.ReactNode;
  onViewMode: (e: RadioChangeEvent) => void;
  viewMode: string;
};

const RadioGroupStyled = styled(Radio.Group)`
  margin-left: 10px;
`;

const GridToolbar = ({
  readyState,
  portfolios,
  pid,
  onSelectPortfolio,
  canWork,
  children,
  leftChildren,
  onViewMode,
  viewMode,
}: Props) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 8px",
        backgroundColor: "white",
      }}
    >
      Portfolio:
      <Select
        fieldNames={{ label: "name", value: "_id" }}
        value={pid}
        onChange={onSelectPortfolio}
        style={{ marginLeft: "16px", width: "250px" }}
        placeholder="Select portfolio"
        options={portfolios}
        disabled={!canWork}
      ></Select>
      <RadioGroupStyled onChange={onViewMode} value={viewMode} size={'small'}>
        <Radio value={'stocks'}>Stocks</Radio>
        <Radio value={'cash'}>Cash</Radio>
        <Radio value={'dividends'}>Dividends</Radio>
      </RadioGroupStyled>
      {leftChildren}
      <div className="spacer" />
      {children}
      <SocketConnectionIndicator readyState={readyState} />
    </div>
  );
};

export default GridToolbar;
