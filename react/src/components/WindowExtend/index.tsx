import React, { memo, ReactNode } from "react";
import { Modal } from "antd";
import { Rnd } from "react-rnd";
import { CloseOutlined } from "@ant-design/icons";
import EditableTable from "./EditableTable";

type Props = {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  title: string;
};
const Window = ({ visible, children, title = "tttt", onClose }: Props) => {
  return (
    <Rnd
        dragHandleClassName={"handle"}
      default={{
        x: 0,
        y: 0,
        width: 600,
        height: 500,
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ccc",
        borderRadius: "5px",
      }}
    >
      <div
          className={'handle'}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f0f0f0",
          padding: "16px",
          borderBottom: "1px solid #e8e8e8",
          borderTopLeftRadius: "4px",
          borderTopRightRadius: "4px",

        }}
      >
        <div>{title}</div>
        <div style={{ cursor: "pointer" }} onClick={onClose}>
          <CloseOutlined />
        </div>
      </div>

      <div style={{ padding: "8px", backgroundColor: "#fff" }}>
       <EditableTable/>
      </div>
    </Rnd>
  );
};

export default memo(Window);
