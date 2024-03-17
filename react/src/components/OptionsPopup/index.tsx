import { Button, Checkbox, CheckboxProps, Flex, Popover, Tooltip } from "antd";
import { useState } from "react";
import { CloseOutlined, MoreOutlined } from "@ant-design/icons";

import { useAppDispatch } from "../../store/useAppDispatch";
import {changeOption, OptionsState} from "../../store/slices/options";
import { useAppSelector } from "../../store/useAppSelector";

type Props = {};

const OptionsPopup = () => {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { clearAlwaysResult, clearAlwaysCommand } = useAppSelector((state) => state.options);
  const onHide = () => {
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const handleCheck: CheckboxProps["onChange"] = (e) => {
    const name = e.target.name as keyof OptionsState
    console.log(`checked ${name} = ${e.target.checked}`);
    dispatch(
      changeOption({ option: name, value: e.target.checked }),
    );
  };

  return (
    <Popover
      content={
        <Flex vertical={true}>
          <Checkbox onChange={handleCheck} name={"clearAlwaysCommand"} checked={clearAlwaysCommand}>
            Clear input pane for each added command
          </Checkbox>
          <Checkbox onChange={handleCheck} name="clearAlwaysResult" checked={clearAlwaysResult}>
            Clear output pane  for each command execution
          </Checkbox>
        </Flex>
      }
      title={
        <Flex
          justify="space-between"
          align={"center"}
          style={{ width: "100%" }}
        >
          <div>Options</div>
          <Button size={"small"} type="text" onClick={onHide}>
            <CloseOutlined style={{ color: "#FF0000" }} />
          </Button>
        </Flex>
      }
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Tooltip title={"Options"}>
        <Button icon={<MoreOutlined />} />
      </Tooltip>
    </Popover>
  );
};

export default OptionsPopup;
