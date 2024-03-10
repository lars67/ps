import {
  Button,
  DatePicker,
  Form,
  InputNumber,
  Select,
  Slider,
  Switch,
} from "antd";
import React, { useCallback } from "react";

import { useAppDispatch } from "../store/useAppDispatch";
import { useAppSelector } from "../store/useAppSelector";
import { authLoginThunk } from "../store";
const Home = ({}) => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.user.token);
  const handleButton = useCallback(async () => {
    //dispatch(userSlice.actions.updateUser({ login: "Hi", password: "World" }));

  }, []);
  return (
    <div>
      <Form
        layout="horizontal"
        size={"large"}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 8 }}
      >
        <Form.Item label="Input Number">
          <InputNumber
            min={1}
            max={10}
            style={{ width: 100 }}
            defaultValue={3}
            name="inputNumber"
          />
        </Form.Item>
        <Form.Item label="Switch">
          <Switch defaultChecked />
        </Form.Item>
        <Form.Item label="Slider">
          <Slider defaultValue={70} />
        </Form.Item>
        <Form.Item label="Select">
          <Select
            defaultValue="lucy"
            style={{ width: 192 }}
            options={[
              { value: "jack", label: "Jack" },
              { value: "lucy", label: "Lucy" },
              { value: "Yiminghe", label: "yiminghe" },
              { value: "lijianan", label: "lijianan" },
              { value: "disabled", label: "Disabled", disabled: true },
            ]}
          />
        </Form.Item>
        <Form.Item label="DatePicker">
          <DatePicker showTime />
        </Form.Item>
        <Form.Item style={{ marginTop: 48 }} wrapperCol={{ offset: 8 }}>
          <Button type="primary" htmlType="submit" onClick={handleButton}>
            OK
          </Button>
          <Button style={{ marginLeft: 8 }}>Cancel</Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default Home;
