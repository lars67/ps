import React, { memo, useCallback, useState } from "react";
import { Button, Select } from "antd";

import { BaseConfigParams } from "../../../types/config";

const items = [
  { label: "Automatic", value: "8" },
  { label: "Bid", value: "0" },
  { label: "Ask", value: "1" },
  { label: "Last", value: "2" },
  { label: "Open", value: "3" },
  { label: "Close", value: "4" },
  { label: "High", value: "5" },
  { label: "Low", value: "6" },
  { label: "Midle", value: "7" },
];

const closedItems = [
  { label: "Without", value: "no" },
  { label: "With", value: "all" },
  { label: "Only", value: "only" },
];
type Props = {
  config: BaseConfigParams;
  disabled: boolean;
  onSave: (config: BaseConfigParams) => void;
};
const ConfigTab = ({ config, onSave }: Props) => {
  const [params, setParams] = useState<BaseConfigParams>(config);

  const handleChange = (field: string) => (value: string) => {
    setParams({ ...params, [field]: value });
  };

  const handleClick = useCallback(() => {
    onSave(params);
  }, [params]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 8px",
        backgroundColor: "white",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          backgroundColor: "#eee",
          fontWeight: "bold",
          width: "100%",
          marginBottom: "5px",
          textAlign: "center",
        }}
      >
        Config
      </div>
      <div style={{ display: "flex", marginBottom: "10px" }}>
        <label
          htmlFor="basePrice"
          style={{ marginRight: "8px", width: "100px" }}
        >
          Base Price:
        </label>

        <Select
          id={"basePrice"}
          value={params.basePrice}
          onChange={handleChange("basePrice")}
          options={items}
          size={"small"}
          style={{ width: "100px" }}
        ></Select>
      </div>
      <div style={{ display: "flex", marginBottom: "10px" }}>
        <label
          htmlFor="marketPrice"
          style={{ marginRight: "8px", width: "100px" }}
        >
          Market Price:
        </label>

        <Select
          id={"marketPrice"}
          value={params.marketPrice}
          onChange={handleChange("marketPrice")}
          options={items}
          size={"small"}
          style={{ width: "100px" }}
        ></Select>
      </div>
      <div style={{ display: "flex", marginBottom: "10px" }}>
        <label htmlFor="closed" style={{ marginRight: "8px", width: "100px" }}>
          Show Closed:
        </label>

        <Select
          id={"closed"}
          value={params.closed}
          onChange={handleChange("closed")}
          options={closedItems}
          size={"small"}
          style={{ width: "100px" }}
        ></Select>
      </div>
      <div style={{ display: "flex" }}>
        <Button size={"small"} onClick={handleClick}>
          Apply
        </Button>
      </div>
    </div>
  );
};

export default memo(ConfigTab);
