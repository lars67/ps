
import React, {memo, useRef, useState} from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import ConsoleTab from "./ConsoleTab";



const initialItems: TabsProps['items'] = [
  {
    key: 'default-tab',
    label: 'Tab 1',
    children: <ConsoleTab/>,
  },
 ];

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;
export default memo(() => {
  const [activeKey, setActiveKey] = useState(initialItems[0].key);

  const [items, setItems] = useState(initialItems);
  const newTabIndex = useRef(0);
  const add = () => {
    const newActiveKey = `newTab${newTabIndex.current++}`;
    const newPanes = [...items];
    newPanes.push({label: `Tab ${1+newTabIndex.current}`, children: <ConsoleTab/>, key: newActiveKey});
    setItems(newPanes);
    setActiveKey(newActiveKey);

  };

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

  return (<Tabs
      className="custom-tab-bar"
      activeKey={activeKey}
      size={'small'}
      items={items}
      type="editable-card"
      onEdit={handleEdit}
      onChange={onChange}/>)
})
