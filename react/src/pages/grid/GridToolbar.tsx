import { Select, Button } from "antd";
import SocketConnectionIndicator from "../../SocketConnectionIndicator";
import { ReadyState } from "react-use-websocket";
import { Portfolio } from "../../types/portfolio";
import EmulatePriceChange from "./EmulatePriceChange";

const { Option } = Select;
type Props = {
  readyState: ReadyState;
  portfolios: Portfolio[];
  pid: string | undefined;
  onSelectPortfolio: (p: string) => void;
  canWork: boolean;
  children: React.ReactNode;
};
const GridToolbar = ({
  readyState,
  portfolios,
  pid,
  onSelectPortfolio,
  canWork,
    children
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


      <div className="spacer" />
      {children}
      <SocketConnectionIndicator readyState={readyState} />
    </div>
  );
};

export default GridToolbar;
