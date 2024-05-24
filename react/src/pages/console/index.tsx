
import React, {memo, useRef, useState} from 'react';
import {Avatar, Dropdown, MenuProps, message, Tabs} from 'antd';
import type { TabsProps } from 'antd';
import ConsoleTab from "./ConsoleTab";
import {LabelValue} from "../../types/LabelValue";
import {QuoteGrid} from "../index";
import {LogoutOutlined, PlusOutlined, SettingOutlined, UnorderedListOutlined, UserOutlined} from "@ant-design/icons";
import {PATH_LOGIN} from "../../constants/routes";



const initialItems: TabsProps['items'] = [
  {
    key: 'default-tab',
    label: 'Tab 1',
    children: <ConsoleTab tabIndex={1}/>,
  },
 ];
export const historyCommands:LabelValue[] =[];

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;
export default memo(() => {
  const [activeKey, setActiveKey] = useState(initialItems[0].key);

  const [items, setItems] = useState(initialItems);



  //const historyCommands= useRef<LabelValue[]>([])
  const newTabIndex = useRef(0);
  const add = () => {
    const newActiveKey = `newTab${++newTabIndex.current}`;
    const newPanes = [...items];
    const tabIndex= 1+newTabIndex.current
    newPanes.push({label: `Tab ${tabIndex}`, children: <ConsoleTab tabIndex={tabIndex}/>, key: newActiveKey});
    setItems(newPanes);
    setActiveKey(newActiveKey);

  };
  const addPositions = () => {
    const newActiveKey = `newTab${++newTabIndex.current}`;
    const newPanes = [...items];
    const tabIndex= 1+newTabIndex.current
    newPanes.push({label: `Positions`, children: <QuoteGrid/>, key: newActiveKey});
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const tabActions : MenuProps["items"] = [
    {
      key: "tab-portfolio",
      label: "Positions",
      icon: <UnorderedListOutlined />,
      onClick:addPositions
    },


  ];
  const onChange = (key: string) => {
    setActiveKey(key);
  };
  const remove = (targetKey: TargetKey) => {
    let newActiveKey = activeKey;
    let lastIndex = -1;
    items.forEach((item, i) => {
      if (item.key === targetKey) {
        lastIndex = i - 1;
      }
    });
    const newPanes = items.filter((item) => item.key !== targetKey);
    if (newPanes.length && newActiveKey === targetKey) {
      if (lastIndex >= 0) {
        newActiveKey = newPanes[lastIndex].key;
      } else {
        newActiveKey = newPanes[0].key;
      }
    }
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const handleEdit = (
      targetKey: React.MouseEvent | React.KeyboardEvent | string,
      action: 'add' | 'remove',
  ) => {
    if (action === 'add') {
      add();
    } else {
      remove(targetKey);
    }
  };



  const toolPanel = (
      <div>
      <Dropdown menu={{items:tabActions}} placement="bottomRight" >
        <Avatar style={{ backgroundColor: '#3e3c42', marginRight:'10px' }}  size="small" icon={<PlusOutlined />} />
      </Dropdown>
      </div>
  );

  return (<Tabs
      tabBarExtraContent={toolPanel}
      className="custom-tab-bar"
      activeKey={activeKey}
      size={'small'}
      items={items}
      type="editable-card"
      onEdit={handleEdit}
      onChange={onChange}/>)
})
