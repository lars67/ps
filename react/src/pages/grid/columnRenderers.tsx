import React, { useState } from "react";
import ReactCountryFlag from "react-country-flag";
import styled from "styled-components";
import { Popover } from "antd";
import { HexColorPicker } from "react-colorful";
import {ColorDataItem} from "../../types/config";


const ReactCountryFlagStyled = styled(ReactCountryFlag)`
  font-size: 18px !important;
  margin-right: 3px;
`;
export const formatNumber = (
  value: number | string,
  digits: number = 2,
): string => {
  let numericValue: number;

  // Check if the input is a number or a string
  if (typeof value === "number") {
    numericValue = value;
  } else if (typeof value === "string") {
    numericValue = parseFloat(value);
  } else {
    return "";
  }

  // Format the numeric value with the specified number of digits
  const formattedValue = numericValue
    .toFixed(digits)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return formattedValue;
};

export const numberFormattedRender =
  <T extends Record<string, any>>(field: string, digits: number = 2) =>
  (text: string, record: T) => {
    const value = record[field];
    const blink = record[`${field}_blink`];
    const change = record[`${field}_change`];
    const s = formatNumber(value, digits);

    const className = blink
      ? change > 0
        ? "blink price-increase"
        : change < 0
          ? "blink price-decrease"
          : ""
      : "";

    return { props: { className }, children: s };
  };

export const flagRender = <T extends { a2: string }>(
  field: string,
  record: T,
) => (
  <>
    <ReactCountryFlagStyled countryCode={record.a2} />
    {field}
  </>
);

export const symbolRender = (text: string) =>
  text.startsWith("TOTAL") ? "" : text;

export const ColorSelectRenderComp = ({
  field,
  onColorChange,
  color,
  record,
}: {
  color: string;
  record: ColorDataItem;
  field: string;
  onColorChange: (key: string, field: string, color: string) => void;
}) => {
  const [visiblePopup, setVisiblePopup] = useState<{
    [key: string]: boolean;
  }>({});

  const handleVisiblePopup = (key: string) => (visible: boolean) => {
    setVisiblePopup((data) => ({ ...data, [key]: visible }));
  };
  return (
    <Popover
      trigger="click"
      open={visiblePopup[record.key as string] || false}
      onOpenChange={handleVisiblePopup(record.key as string)}
      content={
        <HexColorPicker
          color={color}
          onChange={(color: string) => onColorChange(record.key as string, field, color)}
        />
      }
    >
      <div
        style={{
          width: "60px",
          height: "20px",
          backgroundColor: color,
          cursor: "pointer",
          border: '1px solid #888',
          color,
        }}
      />
    </Popover>
  );
};

export const colorSelectRender =
  (
    field: string,
    onColorChange: (key: string, field: string, color: string) => void,
  ) =>
  (color: string, record: ColorDataItem) => {
    return (
      <ColorSelectRenderComp
        field={field}
        color={color}
        record={record}
        onColorChange={onColorChange}
      />
    );
  };
