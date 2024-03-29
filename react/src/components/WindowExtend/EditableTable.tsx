import React, { useState } from 'react';
import { Table, Input, InputNumber, Popconfirm, Form } from 'antd';
import { ColumnsType } from 'antd/es/table';

interface Item {
    key: string;
    name: string;
    age: number;
}

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
    title: string; // Fixing the type of 'title'
    editable: boolean;
    children: React.ReactNode;
    dataIndex: keyof Item;
    record: Item;
    handleSave: (record: Item) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
                                                       title,
                                                       editable,
                                                       children,
                                                       dataIndex,
                                                       record,
                                                       handleSave,
                                                       ...restProps
                                                   }) => {
    const [editing, setEditing] = useState(false);
    // @ts-ignore
    const inputRef = React.createRef<Input>();

    const toggleEdit = () => {
        setEditing(!editing);
    };

    const save = () => {
        console.log('save',dataIndex, inputRef.current.input);
        //handleSave({ ...record, [dataIndex]: inputRef.current?.state.value });
        toggleEdit();
    };

    let childNode: React.ReactNode = children;

    if (editable) {
        childNode = editing ? (
            <Form.Item style={{ margin: 0 }}>
                <InputNumber ref={inputRef} onPressEnter={save} onBlur={save} />
            </Form.Item>
        ) : (
            <div style={{ paddingRight: 24 }} onClick={toggleEdit}>
                {children}
            </div>
        );
    }

    return <td {...restProps}>{childNode}</td>;
};

const EditableTable: React.FC = () => {
    const [dataSource, setDataSource] = useState<Item[]>([
        {
            key: '1',
            name: 'John',
            age: 32,
        },
        {
            key: '2',
            name: 'Doe',
            age: 42,
        },
    ]);

    const columns: ColumnsType<Item> = [
        {
            title: 'Name',
            dataIndex: 'name',
            render: (_, record) => (
                <EditableCell
                    editable
                    title="Name"
                    dataIndex="name"
                    record={record}
                    handleSave={handleSave}
                >
                    {record.name}
                </EditableCell>
            ),
        },
        {
            title: 'Age',
            dataIndex: 'age',
            render: (_, record) => (
                <EditableCell
                    editable
                    title="Age"
                    dataIndex="age"
                    record={record}
                    handleSave={handleSave}
                >
                    {record.age}
                </EditableCell>
            ),
        },
        {
            title: 'Operation',
            dataIndex: 'operation',
            render: (_, record) =>
                dataSource.length >= 1 ? (
                    <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.key)}>
                        <a>Delete</a>
                    </Popconfirm>
                ) : null,
        },
    ];

    const handleDelete = (key: React.Key) => {
        const newDataSource = dataSource.filter(item => item.key !== key);
        setDataSource(newDataSource);
    };

    const handleSave = (row: Item) => {
        const newData = dataSource.map(item =>
            item.key === row.key ? { ...item, ...row } : item
        );
        setDataSource(newData);
    };

    return (
        <Form component={false}>
            <Table
                bordered
                dataSource={dataSource}
                columns={columns}
                rowClassName="editable-row"
                pagination={false}
            />
        </Form>
    );
};

export default EditableTable;
