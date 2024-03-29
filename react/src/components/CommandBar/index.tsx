import { Button, Checkbox, CheckboxProps, Flex, Popover, Tooltip } from "antd";
import {memo, useState} from "react";
import { CloseOutlined, MoreOutlined } from "@ant-design/icons";

import { useAppDispatch } from "../../store/useAppDispatch";
import {changeOption, OptionsState} from "../../store/slices/options";
import { useAppSelector } from "../../store/useAppSelector";
import {Command} from "../../types/command";

type Props = {commandbar: Command};

const CommandBar = ({commandbar}:Props) => {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const onHide = () => {
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };
  if (!commandbar.extended) {
    return null
  }

  return (
      <Tooltip title={"Options"}>
        <Button icon={<MoreOutlined />} />
      </Tooltip>
  );
};

export default memo(CommandBar);
