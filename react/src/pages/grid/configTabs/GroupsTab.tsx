import React, { useCallback } from "react";
import { Radio, RadioChangeEvent, Space } from "antd";
import { useAppSelector } from "../../../store/useAppSelector";
import { useDispatch } from "react-redux";
import { configSlice } from "../../../store";

const GroupsTab: React.FC = () => {
  const { groups } = useAppSelector((state) => state.config);
  const dispatch = useDispatch();

  const handleChange = useCallback((e: RadioChangeEvent) => {
    const gr = e.target.value;
    dispatch(configSlice.actions.updateGroup(gr));
    if (gr !== "nogroup") {
      dispatch(configSlice.actions.updateLayout({ [`${gr}Total`]: true }));
    }
  }, []);

  return (
    <div>
      <Radio.Group onChange={handleChange} value={groups.group}>
        <Space direction="vertical">
          <Radio value={"nogroup"}>No group</Radio>
          <Radio value={"currency"}>Currency</Radio>
          <Radio value={"sector"}>Sector</Radio>
          <Radio value={"region"}>Region</Radio>
        </Space>
      </Radio.Group>
    </div>
  );
};

export default GroupsTab;
