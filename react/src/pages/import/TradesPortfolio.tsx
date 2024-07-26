import React, { useState } from "react";
import { Modal, Form, Input, Select, Button } from "antd";

export interface TradesPortfolioData {
  name: string;
  id?: string;
  description: string;
  accountId: string;
  access: string;
  currency: string;
  baseInstrument: string;
}

type Props = {
  visible: boolean;
  setVisible: (value: boolean) => void;
  currency?: string;
  baseInstrument?: string;
  onApply: (d: TradesPortfolioData) => void;
};
const TradesPortfolio: React.FC<Props> = (props: Props) => {
  const [form] = Form.useForm<TradesPortfolioData>();
  const [loading, setLoading] = useState(false);

  const handleOk = () => {
    setLoading(true);
    form.submit();
  };

  const handleCancel = () => {
    props.setVisible(false);
  };

  const onFinish = async (values: TradesPortfolioData) => {
    console.log("Received values of form:", values);
    await props.onApply(values);
    console.log("form sended loading =false");
    setLoading(false);
  };

  return (
    <>
      <Modal
        title="Input Form"
        open={props.visible}
        onOk={handleOk}
        onCancel={handleCancel}
        forceRender
        footer={[
          <Button
            type="primary"
            onClick={handleOk}
            loading={loading}
            style={{ marginRight: "16px" }}
          >
            Submit
          </Button>,
          <Button onClick={handleCancel} style={{ marginRight: "8px" }}>
            Cancel
          </Button>,
        ]}
      >
        <Form form={form} name="modal_form" onFinish={onFinish}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please input the name!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>

          <Form.Item
            name="accountId"
            label="Account ID"
            rules={[
              { required: true, message: "Please input the account ID!" },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="access"
            label="Access"
            rules={[{ required: true, message: "Please select the access!" }]}
          >
            <Select>
              <Select.Option value="public">Public</Select.Option>
              <Select.Option value="private">Private</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="currency"
            label="Currency"
            initialValue={props.currency}
            rules={[{ required: true, message: "Please input the currency!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="baseInstrument"
            label="Base Instrument"
            initialValue={props.baseInstrument}
            rules={[
              { required: true, message: "Please input the base instrument!" },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TradesPortfolio;
