import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {Table, message, Flex, Spin, Space, Button, Modal, Tooltip} from "antd";
import "./styles.css";

import { useAppSelector } from "../../store/useAppSelector";

import GridToolbar from "./GridToolbar";

import { Portfolio} from "../../types/portfolio";

import { useAppDispatch } from "../../store/useAppDispatch";

import styled from "styled-components";

import useWSClient from "../../hooks/useWSClient";
import { LabelValue } from "../../types/LabelValue";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import {ErrorType} from "../../types/other";
import {isErrorType} from "../../utils";

type DetailPortfolio = Portfolio & {
  children?: DetailPortfolio[];
  userRole: string;
  userName: string;
};

export type Filter = {
  userId?: string;
  currency?: string;
};

const RedButton = styled(Button)`
  color: #f00;
`;
const showModal = async (
  title: string,
  content: string,
  okText = "OK",
  cancelText: string = "Cancel",
) =>
  await Modal.confirm({
    title,
    content,
    okText,
    cancelText,
  });

const portfolioRender =
  (
    handleDelete: (record: DetailPortfolio) => void,
    handleAccess: (record: DetailPortfolio) => void,
  ) =>
  (text: string, record: DetailPortfolio) => {
    const handleDeleteClick = () => handleDelete(record);
    const handleAccessClick = () => handleAccess(record);

    return (
      <Space size="middle">
       <Tooltip title={"Switch access"}><Button
          type="primary"
          shape="circle"
          icon={<EditOutlined />}
          onClick={handleAccessClick}
        /></Tooltip>
        <Tooltip title={"Delete"}><RedButton  shape="circle"  icon={<DeleteOutlined />} onClick={handleDeleteClick}/></Tooltip>
       </Space>
    );
  };

const PortfoliosTable = () => {
  const dispatch = useAppDispatch();
  const { userId, token, role } = useAppSelector((state) => state.user);
   const [portfoliosLabelValue, setPortfoliosLabelValue] = useState<
    LabelValue[]
  >([]);
  const [currencysLabelValue, setCurrencyLabelValue] = useState<LabelValue[]>(
    [],
  );

  const modif = useRef(Math.round(100000 * Math.random()));
  const [filter, setFilter] = useState<Filter>({});
  const ser =
    role === "guest"
      ? process.env.REACT_APP_GUEST_WS
      : process.env.REACT_APP_WS;
  const url = `${ser}?${encodeURIComponent(token)}@${modif.current}`;
  const [loading, setLoading] = useState(true);

  const portfolioRequested = useRef(false);
  const [portfolios, setPortfolios] = useState<DetailPortfolio[]>([]);
  const [initialization, setInitialization] = useState(true);
  const [applyChanges, setApplyChanges] = useState<number>(0);
  const reqParams = useRef<{ msg: string; eventName: string }>(
    {} as { msg: string; eventName: string },
  );
  const preparedData = useRef<DetailPortfolio[]>([]);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const {
    canWork,
    handlers,
    sendJsonMessageSync,
    sendMsg,
    clearMsgId,
    readyState,
  } = useWSClient(url);

  const prepareData = (portfolios: DetailPortfolio[]): DetailPortfolio[] => {
    const fillChildren = (p: DetailPortfolio) => {
      p.portfolioIds?.map((nm) => {
        const trg = portfolios.find((pp) => pp.name === nm);
        if (trg) {
          if (!p.children) p.children = [];
          p.children.push(trg);
          if (trg.portfolioIds && trg.portfolioIds.length > 0) {
            fillChildren(trg);
          }
        }
      });
    };

    portfolios.forEach((p) => {
      if (p.portfolioIds && p.portfolioIds.length > 0) {
        fillChildren(p);
      }
    });
    return portfolios;
  };

  const loadPortfolios = async () => {
    console.log("loadPortfolios");
    setLoading(true);
    const reqPortfolios = {
      command: "portfolios.detailList",
    };
    let portfolios = [];
    const curencies = new Set<string>();
    const owners = new Map<string, string>();

    try {
      portfolioRequested.current = true;
      const sportfolios = (await sendMsg(reqPortfolios)) as string;
      //console.log("sportfolios", sportfolios);
      portfolios = JSON.parse(sportfolios);

      portfolios.data?.forEach((p: Portfolio) => {
        curencies.add(p.currency);
      });
      setCurrencyLabelValue([
        { label: "All", value: "" },
        ...Array.from(curencies).map((name: string) => ({
          label: name,
          value: name,
        })),
      ]);
      preparedData.current = prepareData(portfolios.data);
      preparedData.current?.forEach((p: DetailPortfolio) => {
        owners.set(p.userName, p.userId);
      });
      const array = Array.from(owners, ([label, value]) => ({ label, value }));
      setPortfoliosLabelValue([{ label: "all", value: "" }, ...array]);
      setPortfolios(preparedData.current);
    } catch (err) {
      console.log("err", err);
      message.error("Problem with loading portfolios list");
    }
    setLoading(false);
    setInitialization(false);
  };

  useEffect(() => {
    setPortfolios(
      preparedData.current.filter((p) => {
        if (filter.userId && p.userId !== filter.userId) return false;
        if (filter.currency && p.currency !== filter.currency) return false;
        return true;
      }),
    );
  }, [filter, applyChanges]);

  useEffect(() => {
    if (canWork.current && !portfolioRequested.current) {
      clearMsgId();
      loadPortfolios();
    }
  }, [canWork.current]);

  const handleAccess = useCallback(async (record: DetailPortfolio) => {
    if (record.userId !== userId) {
      if (
        !(await showModal(
          "Switch Access",
          "You are not the owner of this portfolio. Are you sure to switch access? ",
        ))
      ) {
        return;
      }
    }
    const rez :ErrorType | {data:Portfolio}| unknown = await sendMsg({
      command: "portfolios.access",
      _id: record._id,
      access: record.access === "public" ? "" : "public",
    },true);
    if (isErrorType(rez)) {
      message.error((rez as ErrorType).error)
    } else{
      const newAccess = (rez as {data:Portfolio}).data.access
      preparedData.current = preparedData.current.map((p) =>
        p._id === record._id ? { ...p, access: newAccess } : p,
      );
      setApplyChanges((c) => c + 1);
    }
  }, []);

  const handleDelete = useCallback(async (record: DetailPortfolio) => {
    const isNotOwner =record.userId !== userId ? 'You are not the owner of this portfolio. ' : '';
      if (
          !(await showModal(
              "Full remove portfolio(with trades)",
              `${isNotOwner}\n "${record.name}"?`,
          ))
      ) {
        return;
      }
    const rez = await sendMsg({
      command: "portfolios.remove",
      _id: record._id,
    });
    if (isErrorType(rez)) {
      message.error((rez as ErrorType).error)
    } else {
      preparedData.current = preparedData.current.filter((p) =>
          p._id !== record._id,
      );
      setApplyChanges((c) => c + 1);
    }

  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
      },
      {
        title: "AccountId",
        dataIndex: "accountId",
        key: "accountId",
        ellipsis: true,
      },
      {
        title: "Owner",
        dataIndex: "userName",
        key: "userName",
        ellipsis: true,
      },
      {
        title: "Currency",
        dataIndex: "currency",
        key: "currency",
        align: "right" as const,
      },
      {
        title: "Access1",
        dataIndex: "access",
        key: "access",
      },
      {
        title: "Action",
        key: "action",
        render: portfolioRender(handleDelete, handleAccess),
      },
    ],
    [handleDelete, handleAccess],
  );

  const getRowStyle = useCallback(
    (record: Portfolio) => {
      return record.name === hoveredRowKey
        ? {
            backgroundColor: "#5dd2ec",
          }
        : {};
    },
    [hoveredRowKey],
  );

  const handleFilter = useCallback((f: Filter) => {
    setFilter((filter) => ({ ...filter, ...f }));
  }, []);

  // @ts-ignore
  return (
    <div className={"playground-container"}>
      <GridToolbar
        readyState={readyState}
        canWork={canWork.current}
        filter={filter}
        onFilter={handleFilter}
        portfolios={portfoliosLabelValue}
        currencies={currencysLabelValue}
        // leftChildren={<SubscriptionDataIndicator count={countChangeData} />}
      ></GridToolbar>
      <div className={"table-container"}>
        <Table
          size="small"
          rowKey={"symbol"}
          loading={loading}
          columns={columns}
          dataSource={portfolios}
          pagination={false}
          scroll={{ y: "calc(var(--top-div-height) - 86px)" }}
          bordered={true}
          rowHoverable={false}
          onRow={(record: DetailPortfolio) => ({
            style: getRowStyle(record),
            onMouseEnter: () => setHoveredRowKey(record.name),
            onMouseLeave: () => setHoveredRowKey(null),
          })}
        />
        -
        {initialization && (
          <Flex align="center" gap="middle">
            <Spin />
          </Flex>
        )}
      </div>
    </div>
  );
};

export default PortfoliosTable;
