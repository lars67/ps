import React from 'react';
import { Table } from 'antd';
import { ColumnsType } from 'antd/es/table';

export type CsvData = { [key: string]: string };

interface CsvTableProps {
    data: CsvData[];
}

const CsvTable: React.FC<CsvTableProps> = ({ data }) => {
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

export default CsvTable;
