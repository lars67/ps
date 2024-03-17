import { Button, Modal } from "antd";

import React from "react";

import { Command } from "../../types/command";
import { ExclamationCircleOutlined } from "@ant-design/icons";

type Props = {
  commandOption: Command;
  onRemove: (commandOption: Command) => void;
};

const ButtonRemoveUserCommand = ({ commandOption, onRemove }: Props) => {
  const [modal, contextHolder] = Modal.useModal();

  const confirm = () => {
    modal.confirm({
      title: "Confirm",
      icon: <ExclamationCircleOutlined />,
      content: `Do you sure that want remove user command ${commandOption.label}`,
      okText: "Yes",
      cancelText: "No",
      onOk: () => onRemove(commandOption),
    });
  };
  const handleClick = () => {
    confirm();
  };

  if (commandOption?.commandType !== "user") {
    return null;
  }
  return (
    <>
      <Button danger onClick={handleClick} style={{marginRight:'5px'}}>
        Remove
      </Button>
      {contextHolder}
    </>
  );
};

export default ButtonRemoveUserCommand;
