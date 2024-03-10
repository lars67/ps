import {

    Select,
    Col, Row, Typography, Flex,

} from "antd";
import React, {memo, useCallback, useState} from "react";
import {LabelValue} from "../types/LabelValue";

const Logs = ({}) => {
   const [logs, setLogs] = useState<LabelValue[]>([])

    return (
        <div>
            <Row>
            <Col sm={24} md={24} xl={18}>
                <Flex align="center" justify="space-between">
                    <Typography.Title level={4}>Logs</Typography.Title>
                    <Select
                        defaultValue="Popular"
                        style={{ width: 120 }}
                        options={logs}
                    />
                </Flex>
            </Col>
            </Row>
        </div>
    );
};

export default memo(Logs);
