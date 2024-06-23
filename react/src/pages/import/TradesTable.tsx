import React from 'react';
import { Table } from 'antd';
import { ColumnsType } from 'antd/es/table';

export type TradesData = { [key: string]: string|number };

interface TradesTableProps {
    data: TradesData[];
}

const TradesTable: React.FC<TradesTableProps> = ({ data }) => {
   if (data.length <1 || Object.keys(data).length <=1) {
       return null
   }
    const columns: ColumnsType<any> = Object.keys(data[0]).map((key) => ({
        title: key,
        dataIndex: key,
        key,
    }));

    return <Table dataSource={data} columns={columns}   pagination={false} size={'small'}
                  scroll={{ y: "calc(var(--top-div-height) - 26px)" }}/>;
};

export default TradesTable;
