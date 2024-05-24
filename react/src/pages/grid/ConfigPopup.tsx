import React, { memo, useCallback, useState } from "react";
import { Popover, Button, Select, Tooltip, Descriptions } from "antd";
import { ToolOutlined } from "@ant-design/icons";

import { ConfigParams } from "./index";

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
  config: ConfigParams;
  disabled: boolean;
  onSave: (config: ConfigParams) => void;
};
const ConfigPopup = ({ config, disabled, onSave }: Props) => {
  const [params, setParams] = useState<ConfigParams>(config);

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean = false) => {
    setOpen(newOpen);
  };

  const handleChange = (field: string) => (value: string) => {
    setParams({ ...params, [field]: value });
  };

  const handleClick = useCallback(() => {
    handleOpenChange(false);
    onSave(params);
  }, [params]);

  const handleClose = () => setOpen(false);

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      content={
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
            <label
              htmlFor="closed"
              style={{ marginRight: "8px", width: "100px" }}
            >
              Show Closed:
            </label>

            <Select
              id={"closed"}
              value={params.closed}
              onChange={handleChange("marketPrice")}
              options={closedItems}
              size={"small"}
              style={{ width: "100px" }}
            ></Select>
          </div>
          <div style={{ display: "flex" }}>
            <Button
              size={"small"}
              onClick={handleClose}
              style={{ marginRight: "10px" }}
            >
              Close
            </Button>
            <Button size={"small"} onClick={handleClick}>
              Apply
            </Button>
          </div>
        </div>
      }
      placement="topRight"
      trigger="click"
    >
      <Tooltip title={"Config positions"}>
        <Button icon={<ToolOutlined />} disabled={disabled} />
      </Tooltip>
    </Popover>
  );
};

export default memo(ConfigPopup);
