import React, {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Popover, Button, Input, InputRef, Select, Tooltip } from "antd";
import {
  CaretRightOutlined, CloseCircleOutlined,
  SendOutlined,

} from "@ant-design/icons";
import { QuoteData } from "../../types/portfolio";
import { isSymbol } from "../../utils";
import {getBasePriceFieldName} from "./helpers";
import {ConfigParams} from "./index";

const fields = [
  { label: "marketPrice", value: "marketPrice" },
  { label: "marketRate", value: "marketRate" , disabled: true},
  { label: "marketClose", value: "marketClose" },
];

type Props = {
  positions: QuoteData[];
  disabled: boolean;
  onEmulate: (symbol: string, field: string, value: number) => void;
  config:ConfigParams
};
const EmulatePriceChange = ({ positions = [], disabled, onEmulate, config }: Props) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("marketPrice");

  const symbols = positions.filter((p) => isSymbol(p.symbol)) || [];
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);
  const handleSelectSymbol = useCallback((value: string) => {
    setSelectedSymbol(value);
  }, []);
  const handleSelectField = useCallback((value: string) => {
    setSelectedField(value);
  }, []);
  useEffect(() => {
    if (selectedSymbol) {
      const v = positions.find((p) => p.symbol === selectedSymbol);
      setInputValue(v ? v[selectedField] : "");
    }
  }, [selectedField, selectedSymbol]);
  const handleClick = useCallback(() => {
    let iexField = 'close';
    if (selectedField === 'marketPrice') {
      iexField = getBasePriceFieldName(config.marketPrice);
    }
    onEmulate(selectedSymbol, iexField, Number(inputValue));
  }, [selectedField, selectedSymbol, inputValue, onEmulate]);

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean=false) => {
    setOpen(newOpen);
  };

  const handleClose= ()=> setOpen(false);

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
          }}
        >
          <Select
            fieldNames={{ label: "symbol", value: "symbol" }}
            value={selectedSymbol}
            onChange={handleSelectSymbol}
            style={{ marginLeft: "16px", width: "250px" }}
            placeholder="Select symbol"
            options={symbols}
            size={"small"}
          ></Select>
          <Select
            size={"small"}
            value={selectedField}
            onChange={handleSelectField}
            placeholder="Select field"
            options={fields}
          ></Select>
          <Input
            value={inputValue}
            onChange={handleChange}
            placeholder={`Set ${selectedField}`}
            style={{ width: "200px" }}
            size={"small"}
          />
          <Button
            icon={<CaretRightOutlined style={{ color: 'green' }} />}
            size={"small"}
            onClick={handleClick}
          />
          <Button
              icon={<CloseCircleOutlined style={{ color: 'red' }} />}
              size={"small"}
              onClick={handleClose}
              style={{marginLeft:'4px'}}
          />


        </div>
      }
      placement="topRight"
      trigger="click"
    >
      <Tooltip title={"Emulate change"}>
        <Button icon={<SendOutlined />} disabled={disabled} />
      </Tooltip>
    </Popover>
  );
};

export default memo(EmulatePriceChange);
