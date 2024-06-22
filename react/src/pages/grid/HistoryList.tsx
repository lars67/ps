import React, { memo, useState } from "react";
import { List, Button, Modal } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import styled from "styled-components";

const StyledList = styled(List)`
  .ant-list-item {
    min-height: 24px; // Set the desired minimal row height
    display: flex;
    align-items: center;
    width: 100%;
  }
`;

const StyledListItem = styled(List.Item)`
  padding: 2px 0px !important;
`;

const StyledListItemMeta = styled.div`
  white-space: nowrap;
  color: ${(props) => props.color || "inherit"};
`;

type Props = {
  history: string[];
  portfolioName: string | undefined;
  onClearHistory: () => void;
};
const HistoryList = ({
  history,
  portfolioName = "",
  onClearHistory,
}: Props) => {
  const [visible, setVisible] = useState(false);

  const showModal = () => {
    setVisible(true);
  };

  const handleOk = () => {
    onClearHistory();
    setVisible(false);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  return (
    <>
      <Modal
        title={`History ${portfolioName}`}
        open={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="Clear"
        cancelText={"Close"}
        width={800}
        destroyOnClose={true}
      >
        <div style={{ maxHeight: "600px", overflow: "auto" }}>
          <StyledList
            dataSource={history}
            renderItem={(item) => {
              const s = item as string;
              const clr = s.charAt(0) === ">" ? "#880f41" : "#117207";

              return (
                <StyledListItem>
                  <List.Item.Meta
                    description={
                      <StyledListItemMeta color={clr}>{s}</StyledListItemMeta>
                    }
                  />
                </StyledListItem>
              );
            }}
          />
        </div>
      </Modal>
      <Button icon={<MenuOutlined />} onClick={showModal} />
    </>
  );
};

export default memo(HistoryList);
