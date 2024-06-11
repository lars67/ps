import { Select } from "antd";
import SocketConnectionIndicator from "../../SocketConnectionIndicator";
import { ReadyState } from "react-use-websocket";
import { Portfolio } from "../../types/portfolio";
import SelectAnimated from "../../components/SelectAnimated/SelectAnimated";
import { LabelValue } from "../../types/LabelValue";
import { Filter } from "./index";

type Props = {
  readyState: ReadyState;
  canWork: boolean;
  portfolios: LabelValue[];
  currencies: LabelValue[];
  children?: React.ReactNode;
  leftChildren?: React.ReactNode;
  filter: Filter;
  onFilter: (filter: Filter) => void;
};
const GridToolbar = ({
  readyState,
  portfolios,
  currencies,
  canWork,
  children,
  filter,
  onFilter,
  leftChildren,
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
      User:
      <Select
        value={filter.userId}
        onSearch={(v) => onFilter({ userId: v })}
        style={{ marginLeft: "16px",marginRight: "16px", width: "150px" }}
        placeholder="Filter"
        options={portfolios}
        disabled={!canWork}
        showSearch
        optionFilterProp="label"
      ></Select>
      Currency:
      <Select
        value={filter.currency}
        onChange={(currency) => onFilter({ currency })}
        style={{ marginLeft: "16px", width: "100px" }}
        placeholder="Filter"
        options={currencies}
      ></Select>
      {leftChildren}
      <div className="spacer" />
      {children}
      <SocketConnectionIndicator readyState={readyState} />
    </div>
  );
};

export default GridToolbar;
