import {
    Button,
    Checkbox,
    Col,
    Form,
    Flex,

    Input,
    message,
    Row,
    theme,
    Typography, FormInstance,
} from 'antd';
import {useEffect, useMemo, useState} from "react";
import {Portfolio} from "../../../types/portfolio";
import {LabelValue} from "../../../types/LabelValue";


const { Title, Text, Link } = Typography;

type FieldType = {
    name: string;
    description: string;
    currency: string;
    userId: string;
    baseInstrument: string;
};

type Props = {
    value: Portfolio;
    form:FormInstance;
    sendMsg: (o:object)=> Promise<any>
}
const PortfolioForm = ({value, form, sendMsg}:Props) => {


console.log('portfolioform', value, sendMsg)
    const [currencies, setCurrencies] =useState([])

        useEffect(()=> {
            const load = async () => {
                const rez = await sendMsg({command: 'currencies.list'});
                console.log('currencies  rez', rez);
                const currencies = JSON.parse(rez.data)

                console.log('currencies', currencies);
                setCurrencies(currencies.map((c: any) => ({label: `${c.symbol} ${c.name}`, value: c.symbol})));
            };
            load();
            }, [])


    return (

                <Flex
                    vertical
                     justify="center"
                    gap="middle"
                    style={{ height: '100%', padding: '2rem' }}
                >
                          <Form
                              form={form}
                        layout="vertical"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                        initialValues={{ name: value.name, }}

                        autoComplete="off"
                        requiredMark={false}
                    >
                              name: string;
                              description:string;
                              currency: string;
                              userId: string;
                              base_instrument: string;
                        <Row gutter={[8, 0]}>
                            <Col xs={24}>
                                <Form.Item<FieldType>
                                    label="Name"
                                    required={true}
                                    name="name"
                                    rules={[
                                        { required: true, message: 'Please input portfolio name' },
                                    ]}
                                >
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item<FieldType>
                                    label="Description"
                                    name="description"
                                    rules={[
                                        { required: true, message: 'Please input description' },
                                    ]}
                                >
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item<FieldType>
                                    label="Currency"
                                    required={true}
                                    name="currency"
                                    rules={[
                                        { required: true, message: 'Please input currency' },
                                    ]}
                                >
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item<FieldType>
                                    label="Base Instrument"
                                    required={true}
                                    name="baseInstrument"
                                    rules={[
                                        { required: true, message: 'Please input base instrument' },
                                    ]}
                                >
                                    <Input />
                                </Form.Item>
                            </Col>
                        </Row>
                          </Form>

                </Flex>

    );
};

export default PortfolioForm;
