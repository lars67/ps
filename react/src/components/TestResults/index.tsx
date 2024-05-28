import React from "react";
import { List, Avatar, Checkbox, Button, Modal } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
export interface TestItem {
  description: string;
  result: boolean | string;
}

interface Props {
  items: TestItem[];
  open: boolean;
  onClose: () => void;
}

const Description = ({item}: {item:TestItem}) => {
    if (typeof item.result === 'string')
        return <span><b>{item.description}</b></span>
    return <span>{item.description}</span>
}
const ItemList: React.FC<Props> = ({ items, open, onClose }) => {
  return (
    <Modal
      title={"Tests Result"}
      centered
      open={open}
      onCancel={onClose}
      footer={null}
      width="50vw"
    >
      <List
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item, index) => (
          <List.Item
            style={{
              display: "flex",
              alignItems: "center",
              height: "20px",
              lineHeight: "20px",
            }}
          >
            <Description item={item}/>

            {item.result ? (
              <CheckOutlined
                style={{ color: "green", marginRight: "8px", fontSize: "14px" }}
              />
            ) : (
              <CloseOutlined
                style={{ color: "red", marginRight: "8px", fontSize: "14px" }}
              />
            )}
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default ItemList;
