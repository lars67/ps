import React, {useEffect, useState } from "react";
import { Table } from "antd";

import { colorSelectRender } from "../columnRenderers";
import { useAppSelector } from "../../../store/useAppSelector";
import { useDispatch } from "react-redux";
import {
  ColorDataItem,

  DisplayKeys,

} from "../../../types/config";
import { configSlice } from "../../../store";
;

type Props = {
  onClose?: () => void;
};
const ColorsTab = ({ onClose }: Props) => {
  const { display } = useAppSelector((state) => state.config);
  const dispatch = useDispatch();

  const [data, setData] = useState<ColorDataItem[]>([
    // Add more rows as needed
  ]);

  useEffect(() => {
    setData(
      Object.keys(display).map((key) => ({
        ...display[key as DisplayKeys],
        key,
      })),
    );
  }, [display]);

  const handleColorChange = (key: string, field: string, value: string) => {
    const row: ColorDataItem = display[key as DisplayKeys];
    // @ts-ignore
    dispatch(configSlice.actions.updateDisplay({ [key]: { [field]: value } }));
  };

  const columns = [
    {
      title: "Row",
      dataIndex: "label",
    },
    {
      title: "Text",
      dataIndex: "color",
      render: colorSelectRender("color", handleColorChange),
    },
    {
      title: "Bkg",
      dataIndex: "bkg",
      render: colorSelectRender("bkg", handleColorChange),
    },
  ];

  return <Table columns={columns} dataSource={data} pagination={false} />;
};

export default ColorsTab;
