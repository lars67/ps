
import React, {memo, useCallback, useState} from 'react';

import {Button, Card, Modal, Col, Form, Input, Radio, Row, Select, Typography, FormProps, message} from 'antd';


const  {TextArea} = Input;

type FieldType = {
    label: string;
    description?: string;
    value: string;
};
type Params = {
    open: boolean;
    onClose: ()=>void;
    value?: string;
    sendMsg: (o:object)=> Promise<any>
}
const UserCommand = ({open, value='', onClose, sendMsg}:Params) => {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

    const handleOk = useCallback(async ()=> {
        const parsedValue = JSON.parse(value)
        const r = await form.validateFields()
        console.log('VALIDATION $$$$$', r)
        if (r){
            setSaving(true);
            const formValues = form.getFieldsValue();
            console.log('formValues', formValues);
            const cmd = {command: 'commands.add',label:formValues.label,
                value:JSON.stringify(value), commandType:'user'}
            try {
                const rez = await sendMsg(cmd)
                console.log('RRRRRRRRRRRRRRRRRRRRRRRRRRREZ', rez)
                const msg = JSON.parse(rez.data)
                console.log('data', msg.data)
                setSaving(false);
                if (msg.data?._id) {
                    message.success('New command successfully added')
                    form.resetFields();
                    onClose();
                } else {
                    message.error('New command is not added')
                }
            } catch (err) {
                message.error('New command is not added')
            }
            setSaving(false);
        }
    }, [onClose, form]);


    const handleClose = useCallback(()=> {
        setSaving(false);
        onClose();
    }, [onClose])

    return (   <Modal
        title="User command"
        centered
        open={open}
        onCancel={handleClose}
        footer={[
            <Button key="cancel" onClick={handleClose}>
                Cancel
            </Button>,
            <Button key="submit" type="primary" loading={saving}  onClick={handleOk}>
                Submit
            </Button>
        ]}
    >
        <Card>
            <Form
                name="user-profile-details-form"
                layout="vertical"
                form={form}
                initialValues={{
                    value,
                    label:'New command',
                    description: '',
                }}
                autoComplete="on"
                requiredMark={false}
            >
                <Row gutter={[16, 0]}>
                    <Col sm={24} lg={24}>
                        <Form.Item<FieldType>
                            label="Label"
                            name="label"
                            rules={[{ required: true, message: 'Please input command label' }]}
                        >
                            <Input/>
                        </Form.Item>
                    </Col>
                    <Col sm={24} lg={24}>
                        <Form.Item<FieldType>
                            label="Command"
                            name="value"

                        >
                            <TextArea rows={4}   readOnly={true}/>
                        </Form.Item>
                    </Col>
                    <Col sm={24} lg={24}>
                        <Form.Item<FieldType>
                            label="Description"
                            name= "description"

                        >
                            <TextArea rows={4}  />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Card>

    </Modal>)

}

export default memo(UserCommand);
