import React, { memo, useCallback, useState } from "react";
import { Popover, Button, Tooltip, Tabs, TabsProps } from "antd";
import { CloseOutlined, ToolOutlined } from "@ant-design/icons";

import LayoutTab from "./configTabs/LayoutTab";
import { BaseConfigParams } from "../../types/config";
import ColorsTab from "./configTabs/ColorsTab";
import GroupsTab from "./configTabs/GroupsTab";
import ConfigTab from "./configTabs/ConfigTab";

type Props = {
  config: BaseConfigParams;
  disabled: boolean;
  onSave: (config: BaseConfigParams) => void;
};
const ConfigPopup = ({ config, disabled, onSave }: Props) => {
  const [params, setParams] = useState<BaseConfigParams>(config);

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean = false) => {
    setOpen(newOpen);
  };



  const handleClose = () => setOpen(false);

  const tabItems: TabsProps["items"] = [
    {
      key: "t1",
      label: "General",
      children: (
        <ConfigTab config={config} disabled={disabled} onSave={onSave} />
      ),
    },
    {
      key: "layoutTab",
      label: "Layout",
      children: <LayoutTab />,
    },
    {
      key: "displayTab",
      label: "Display",
      children: <ColorsTab />,
    },
    {
      key: "groupsTab",
      label: "Groups",
      children: <GroupsTab />,
    },
  ];
  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      content={
        <Tabs
          items={tabItems}
          size="small"
          tabBarExtraContent={
            <Button
              icon={<CloseOutlined style={{ color: "red" }} />}
              size={"small"}
              onClick={handleClose}
              style={{ marginLeft: "4px" }}
            />
          }
        />
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
