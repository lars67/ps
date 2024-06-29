import { Radio, Select } from "antd";
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
  onViewCash: () => void;
  viewCash: boolean;
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
  onViewCash,
  viewCash,
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
      <RadioGroupStyled onChange={onViewCash} value={viewCash} size={'small'}>
        <Radio value={false}>Stocks</Radio>
        <Radio value={true}>Cash</Radio>
      </RadioGroupStyled>
      {leftChildren}
      <div className="spacer" />
      {children}
      <SocketConnectionIndicator readyState={readyState} />
    </div>
  );
};

export default GridToolbar;
