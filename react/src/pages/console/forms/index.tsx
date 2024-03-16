
import React, {memo, useCallback, useMemo, useState} from 'react';

import {Button, Card, Modal, Col, Form, Input, Radio, Row, Select, Typography, FormProps, message} from 'antd';
import ProtectedRoute from "../../../routes/ProtectedRoute";
import PortfolioForm from "./PortfolioForm";
//import PortfolioForm from "./PortfolioForm";




type FieldType = {
    label: string;
    description?: string;
    value: string;
};
type Params = {
    open: boolean;
    onClose: (value?:string | undefined)=>void;
    value?: string;
    label:string,
    sendMsg: (o:object)=> Promise<any>
}
const Forms = ({open, value='{}', label, onClose,sendMsg }:Params) => {
      console.log('VVVVVVVVVVVVVVVVVVVVVVVVVV', value);
    const comObj = useMemo(() => value ?JSON.parse(value): {},[value]);
    console.log('VVVVVVVVVVVVVVVVVVVVVVVVVV=', comObj);



    const [form] = Form.useForm();


    const handleOk = useCallback(async ()=> {
         const r = await form.validateFields()
        console.log('VALIDATION $$$$$', r)
        if (r) {
            const formValues = form.getFieldsValue();
            console.log('formValues', formValues);
            onClose(JSON.stringify(formValues))
        }
    }, [onClose, form]);


    const handleClose = useCallback(()=> {
;
        onClose();
    }, [onClose])

    const renderComponent = useMemo(() => {
        const command = comObj?.command;
        switch (command) {
            case 'portfolios.add':
                return <PortfolioForm value={comObj} form={form} sendMsg={sendMsg}/>
            default:
                return null;
        }
    }, [comObj]);

    if (!comObj?.command) {
        return null;
    }
    return (   <Modal
        title={label}
        centered
        open={open}
        onCancel={handleClose}
        footer={[
            <Button key="cancel" onClick={handleClose}>
                Cancel
            </Button>,
            <Button key="submit" type="primary"  onClick={handleOk}>
                Submit
            </Button>
        ]}
    >

        <div>{renderComponent}</div>

    </Modal>)

}

export default memo(Forms);
