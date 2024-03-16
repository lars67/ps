import React, { memo, useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card, Modal, Col, Form, Input, Row, message } from "antd";
import { getCommands } from "../../utils";
import { Command } from "../../types/command";

const { TextArea } = Input;

type FieldType = {
  label: string;
  description?: string;
  value: string;
};
type Params = {
  open: boolean;
  onClose: (c?: Command | undefined, isAdd?: boolean) => void;
  value?: string;
  sendMsg: (o: object) => Promise<any>;
  commandOption?: Command | undefined;
};
const UserCommand = ({
  open,
  commandOption,
  value = "",
  onClose,
  sendMsg,
}: Params) => {
  const [form] = Form.useForm<FieldType>();
  const [saving, setSaving] = useState(false);
  console.log("COMMAND", commandOption);

  useEffect(() => {
    const isUserType = commandOption?.commandType === "user";
    console.log(
      "CM",
      commandOption,
      commandOption?.label,
      "isUserType",
      isUserType,
    );
    form.setFieldsValue({
      value,
      label: isUserType ? commandOption?.label ?? "" : "New command",
      description: isUserType ? commandOption?.description ?? "" : "",
    });
  }, [commandOption, value]);

  const handleOk = useCallback(async () => {
    try {
      const parsedValue = getCommands(value);
    } catch (err) {
      message.error("JSON format is wrong");
      return;
    }
    const r = await form.validateFields();
    console.log("VALIDATION $$$$$", r);
    if (r) {
      setSaving(true);
      const formValues = form.getFieldsValue();
      console.log("formValues", formValues);
      const isAdd =
        commandOption?.commandType !== "user" ||
        commandOption?.label !== formValues.label;
      const command = isAdd ? "commands.add" : "commands.update";
      const cmd = {
        command,
        label: formValues.label,
        value: JSON.stringify(value),
        commandType: "user",
        _id: (isAdd ? undefined : commandOption._id),
      };
      const successMsg = isAdd ? `New command successfully added` : `Command successfully updated`
      const unSuccessMsg = isAdd ? `New command is not added` : `Command is not updated`
      try {
        const rez = await sendMsg(cmd);
        const rezParsed = JSON.parse(rez);
       // console.log("RRRRRRRRRRRRRRRRRRRRRRRRRRREZ", rezParsed.data);
        const msg = rezParsed.data; //JSON.parse(rez.data)
      //  console.log("data", msg);
        setSaving(false);
        if (msg?._id) {
          message.success(successMsg);
          form.resetFields();
          onClose(msg, isAdd);
        } else {
          message.error(unSuccessMsg);
        }
      } catch (err) {
        console.log(err);
        message.error(unSuccessMsg);
      }
      setSaving(false);
    }
  }, [onClose, form, commandOption]);

  const handleClose = useCallback(() => {
    setSaving(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      title="User command"
      centered
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={saving} onClick={handleOk}>
          Submit
        </Button>,
      ]}
    >
      <Card>
        <Form
          name="user-com"
          layout="vertical"
          form={form}
          autoComplete="on"
          requiredMark={false}
        >
          <Row gutter={[16, 0]}>
            <Col sm={24} lg={24}>
              <Form.Item<FieldType>
                label="Name"
                name="label"
                rules={[
                  { required: true, message: "Please input command label" },
                ]}
              >
                <Input />
              </Form.Item>
              <div style={{ color: "#888", margin: "-22px 0px 24px 0px" }}>
                {commandOption?.commandType === "user" &&
                  "You can select another name if want to save this  user command as another user command"}
              </div>
            </Col>
            <Col sm={24} lg={24}>
              <Form.Item<FieldType> label="Command" name="value">
                <TextArea rows={4} readOnly={true} />
              </Form.Item>
            </Col>
            <Col sm={24} lg={24}>
              <Form.Item<FieldType> label="Description" name="description">
                <TextArea rows={4} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </Modal>
  );
};

export default memo(UserCommand);
