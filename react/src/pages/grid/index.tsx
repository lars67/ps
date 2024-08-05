import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {Table, message, Flex, Spin, RadioChangeEvent} from "antd";
import "./styles.css";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useAppSelector } from "../../store/useAppSelector";

import { WSMsg } from "../../types/other";
import {
  flagRender,
  numberFormattedRender,
  symbolRender,
} from "../../components/Grid/columnRenderers";

import GridToolbar from "./GridToolbar";

import { Portfolio, QuoteData } from "../../types/portfolio";
import EmulatePriceChange from "./EmulatePriceChange";
import HistoryList from "./HistoryList";
import ConfigPopup from "./ConfigPopup"; // Import CSS file for styling
import { useAppDispatch } from "../../store/useAppDispatch";

import styled from "styled-components";
import { configSlice } from "../../store";
import {
  BaseConfigParams,
  ColorDataItem,
  DisplayKeys,
  LayoutKeys,
} from "../../types/config";
import { extractAndRemoveSubArray, insertBeforeIndex } from "../../utils";
import useWSClient from "../../hooks/useWSClient";
const valueColumns = [
  "volume",
  "marketPrice",
  "invested",
  "marketValue",
  "result",
  "todayResult",
  "weight",
  "avgPremium",
];
const _ = require("lodash");

// @ts-ignore
const StyledTable = styled((props) => <Table {...props} />)`
  && tbody > tr:hover > td {
    background: rgba(224, 248, 232, 1);
  }
`;
const addChanges = (nowData: QuoteData, newData: Partial<QuoteData>) => {
  const changes = {} as Record<string, number | boolean>;
  if (nowData) {
    valueColumns.forEach((fld: string) => {
      if (newData[fld]) {
        changes[`${fld}_change`] = newData[fld] - nowData[fld];
        changes[`${fld}_blink`] = true;
      } else {
        changes[`${fld}_blink`] = false;
      }
    });
  }
  return changes;
};
/*
const StyledRow = styled.tr`
  background-color: ${(props) => props.bkg};
  transition: background-color 0.3s ease;
  color: ${(props) => props.color};
`;
*/
let counterSub: number = 0;

const QuoteTable = () => {
  const dispatch = useAppDispatch();
  const { userId, token, role } = useAppSelector((state) => state.user);
  const fullConfig = useAppSelector((state) => state.config);
  const { layout, config, display, groups } = fullConfig;

  const modif = useRef(Math.round(100000 * Math.random()));
  const msgId = useRef(0);
  const ser =
    role === "guest"
      ? process.env.REACT_APP_GUEST_WS
      : process.env.REACT_APP_WS;
  const url = `${ser}?${encodeURIComponent(token)}@${modif.current}`;
  const [tableData, setTableData] = useState<QuoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('stocks');

  const portfolioRequested = useRef(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [pid, setPID] = useState<string>();
  const [initialization, setInitialization] = useState(true);
  const reqParams = useRef<{ msg: string; eventName: string }>(
    {} as { msg: string; eventName: string },
  );
  const history = useRef<string[]>([]);

  const subscribeId = useRef<string>();
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio>();
  const lastData = useRef<QuoteData[]>([]);
  //data connect

  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  const addToHistory = (dir: string, s: string) => {
    history.current.push(`${dir} ${s}`);
    if (history.current.length > 50) {
      history.current.shift();
    }
  };

  const {
    canWork,
    handlers,
    sendJsonMessageSync,
    sendMsg,
    clearMsgId,
    readyState,
  } = useWSClient(url, addToHistory);

  const loadPortfolios = async () => {
    console.log("loadPortfolios");
    const reqPortfolios = {
      command: "portfolios.list",
    };
    let portfolios = [];
    try {
      portfolioRequested.current = true;
      const sportfolios = (await sendMsg(reqPortfolios)) as string;
      //console.log("sportfolios", sportfolios);
      portfolios = JSON.parse(sportfolios);
      setPortfolios(portfolios.data);
    } catch (err) {
      console.log("err", err);
      message.error("Problem with loading portfolios list");
    }

    setInitialization(false);
  };

  useEffect(() => {
    if (canWork.current && !portfolioRequested.current) {
      msgId.current = 0;
      console.log("useEffect() []");
      loadPortfolios();
    }
  }, [canWork.current]);

  const clearSubscription = async (pid: string | undefined) => {
    dispatch({ type: "UNSUBSCRIBE", pid, subscribeId: subscribeId.current });
    subscribeId.current && delete handlers.current[subscribeId.current];
    pid &&
      (await sendMsg({
        command: "portfolios.positions",
        _id: pid,
        requestType: "2",
        subscribeId: subscribeId.current,
      }));
  };

  const prepareData = (data: QuoteData[]) => {
    const layoutActive = Object.keys(layout).filter(
      (key) => layout[key as LayoutKeys],
    );
    const filteredData = data.filter((c) => {
      const totalType = c.totalType as string;
      return (
        (layout.contractPositions && !totalType) ||
        layoutActive.includes(totalType)
      );
    });

    // console.log("prepareDATA", groups.group);

    const targetType = `${groups.group}Total`;
    const [symbolPositions, filteredData1] = extractAndRemoveSubArray(
      filteredData,
      "totalType",
      [undefined],
    );
    if (groups.group === "nogroup") {
      return [...symbolPositions, ...filteredData1];
    }
    const arFilter = [targetType];
    let groupWithSymbols = groups.group;

    if (groups.group === "region") {
      if (layout.subregionTotal) {
        arFilter.push("subregionTotal");
        groupWithSymbols = "subRegion";
        if (layout.countryTotal) {
          arFilter.push("countryTotal");
          groupWithSymbols = "country";
        }
      } else if (layout.countryTotal) {
        arFilter.push("countryTotal");
        groupWithSymbols = "country";
      }
    } else if (groups.group === "sector" && layout.industryTotal) {
      arFilter.push("industryTotal");
      groupWithSymbols = "industry";
    }

    const [targetTotalGroups, filteredData2] = extractAndRemoveSubArray(
      filteredData1,
      "totalType",
      arFilter,
    );

    const targetGroups = _.groupBy(symbolPositions, groupWithSymbols) as Record<
      string,
      QuoteData[]
    >;

    let groupData = [...targetTotalGroups] as QuoteData[];
    Object.entries(targetGroups).map(([groupName, items]) => {
      //insert symbols before totalholderss
      const trgName = `TOTAL_${groupName}`;
      const trgIndex = groupData.findIndex((t) => t.name === trgName);
      groupData = insertBeforeIndex(groupData, trgIndex, items);
    });
    return [...groupData, ...filteredData2];
  };
  //  [layout, groups],
  //);

  useEffect(() => {
    dispatch({ type: "useEffect.setTabledata" });
    setTableData(lastData.current);
  }, [layout, groups]);

  useEffect(() => {
    const process = async () => {
      if (pid) {
        setTableData([]);
        setLoading(true);
        subscribeId.current = `sub${++counterSub}_${pid}`;
        // console.log("useEffect keys=", Object.keys(handlers.current));
        handlers.current[subscribeId.current] = (d: any) => {
          console.log("HANDLER>>>>>>>>>>>", d);
          //setCountChangeData(Array.isArray(d.data)?d.data.length:0)
          if (Array.isArray(d.data)) {
            setLoading(false);
            setTableData((data) => {
              const newData = [...data];
              const changes = d.data;
              //console.log("changes", changes.length);
              changes.forEach((t: QuoteData) => {
                const symbol = t.symbol;
                const matchIndex = newData.findIndex(
                  (t) => t.symbol === symbol,
                );
                //  console.log(symbol, ":", matchIndex);
                if (matchIndex >= 0) {
                  newData[matchIndex] = {
                    ...newData[matchIndex],
                    ...t,
                    ...addChanges(data[matchIndex], t),
                  };
                } else {
                  newData.push(t);
                }
              });
              console.log("newData", newData);
              lastData.current = newData;
              return newData;
            });
          }
        };

        console.log("useEffect() SUBSCRIPTIONS", pid, subscribeId.current);
        dispatch({ type: "sendJsonMessageSync", pid });
        const resp = (await sendJsonMessageSync({
          command: "portfolios.positions",
          _id: pid,
          closed: config.closed,
          requestType: "1",
          marketPrice: config.marketPrice,
          basePrice: config.basePrice,
          msgId: subscribeId.current,
        })) as string;
        const respParsed = JSON.parse(resp);
        dispatch({ type: "await_sendJsonMessageSync", respParsed });
        console.log("RESP>>>>>>>", pid, respParsed);
        // @ts-ignore
        reqParams.current = respParsed.data;
        dispatch({ type: "SET_REQPARAMS", reqParams: reqParams.current });
        console.log("reqParams.current", reqParams.current);
      }
    };

    if (pid) {
      dispatch({ type: "call_process", pid });

      process();
    }

    return () => {
      dispatch({ type: "clearSubscription" });
      clearSubscription(pid);
    };
  }, [pid, config]);

  const actualTableData = useMemo(() => {
    const [cash, stock, dividends] = tableData.reduce(
      ([cash, stock, dividends], trade) => {
        if (trade.symbol.startsWith("CASH_")) {
          return [[...cash, trade], stock, dividends];
        } else if (trade.symbol.startsWith("DIVIDENDS_")){
          return [cash, stock, [...dividends, trade]];
        } else {
            return [cash, [...stock, trade], dividends];

        }
      },
      [[] as QuoteData[], [] as QuoteData[], [] as QuoteData[]],
    );
    return [cash, prepareData(stock), dividends];
  }, [tableData, layout, groups]);

  const columnsCash = useMemo(
    () => [
      {
        title: "Currency",
        dataIndex: "symbol",
        key: "symbol",
        ellipsis: true,
        render: (value: string) => value.split("_").pop(),
      },
      {
        title: 'Total local',
        dataIndex: "totalLocal",
        key: "totalLocal",
        ellipsis: true,
        render: numberFormattedRender("totalLocal"),
      },
      {
        title: selectedPortfolio ? `Total (in ${selectedPortfolio?.currency  })` : 'Total',
        dataIndex: "total",
        key: "total",
        ellipsis: true,
        render: numberFormattedRender("total"),
      },
    ],
    [selectedPortfolio]
  );

  const columnsDividends = useMemo(
      () => [
        {
          title: "Currency",
          dataIndex: "symbol",
          key: "symbol",
          ellipsis: true,
          render: (value: string) => value.split("_").pop(),
        },
        {
          title:  'Total',
          dataIndex: "total",
          key: "total",
          ellipsis: true,
          render: numberFormattedRender("total"),
        },
      ],
      [selectedPortfolio]
  );

  const columns = useMemo(
    () => [
      {
        title: "Symbol",
        dataIndex: "symbol",
        key: "symbol",
        ellipsis: true,
        render: symbolRender,
      },
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
        width: "22%",
        render: flagRender,
      },
      {
        title: "Currency",
        dataIndex: "currency",
        key: "currency",
        align: "right" as const,
      },
      {
        title: "Volume",
        dataIndex: "volume",
        key: "volume",
        align: "right" as const,
        render: numberFormattedRender("volume"),
      },
      {
        title: "Price",
        dataIndex: "marketPrice",
        key: "marketPrice",
        align: "right" as const,
        render: numberFormattedRender("marketPrice"),
      },
      {
        title: "Invested Full",
        dataIndex: "investedFull",
        key: "invested",
        align: "right" as const,
        render: numberFormattedRender("investedFull"),
      },
      {
        title: "Market Value",
        dataIndex: "marketValue",
        key: "marketValue",
        align: "right" as const,
        render: numberFormattedRender("marketValue"),
      },
      {
        title: "Weight",
        dataIndex: "weight",
        key: "weight",
        align: "right" as const,
        render: numberFormattedRender("weight"),
      },
      {
        title: "Realized",
        dataIndex: "realized",
        key: "realized",
        align: "right" as const,
        render: numberFormattedRender("realized"),
      },
      {
        title: "Avg.Premium",
        dataIndex: "avgPremium",
        key: "avgPremium",
        align: "right" as const,
        render: numberFormattedRender("avgPremium"),
      },
      {
        title: "Result",
        dataIndex: "result",
        key: "result",
        align: "right" as const,
        render: numberFormattedRender("result"),
      },
      {
        title: "Tod.Result",
        dataIndex: "todayResult",
        key: "todayResult",
        align: "right" as const,
        render: numberFormattedRender("todayResult"),
      },
    ],
    [display],
  );

  const handleSelectPortfolio = useCallback(
    (newPid: string) => {
      setPID(newPid);
      setSelectedPortfolio(portfolios.find((p) => p._id === newPid));
      history.current = [];
    },
    [pid, portfolios],
  );

  const handleEmulate = useCallback(
    (symbol: string, field: string, value: number) => {
      sendJsonMessageSync({
        command: "portfolios.positions",
        _id: pid,
        requestType: "3",
        msgId: subscribeId.current,
        changes: [{ symbol, [field]: value }],
        eventName: reqParams.current.eventName,
      });
    },
    [pid],
  );

  const handleConfig = useCallback((config: BaseConfigParams) => {
    dispatch(configSlice.actions.updateBaseConfig(config));
    history.current = [];
  }, []);

  const handleClearHistory = () => (history.current = []);

  const getRowStyle = useCallback(
    (record: QuoteData) => {
      const totalType = record.totalType;
      const d: ColorDataItem =
        display[(totalType || "positions") as DisplayKeys];
      return record.name === hoveredRowKey
        ? {
            backgroundColor: "#5dd2ec",
            color: d.color,
            fontWeight: totalType ? "bold" : "normal",
          }
        : {
            backgroundColor: d.bkg,
            color: d.color,
            fontWeight: totalType ? "bold" : "normal",
          };
    },
    [display, hoveredRowKey],
  );

  const handleViewMode = useCallback((e:RadioChangeEvent) => {
    setViewMode(e.target.value);
  }, []);


  return (
    <div className={"playground-container"}>
      <GridToolbar
        readyState={readyState}
        portfolios={portfolios}
        pid={pid}
        onSelectPortfolio={handleSelectPortfolio}
        canWork={canWork.current}
        onViewMode={handleViewMode}
        viewMode={viewMode}
        // leftChildren={<SubscriptionDataIndicator count={countChangeData} />}
      >
        <EmulatePriceChange
          disabled={!canWork || !pid}
          positions={tableData}
          onEmulate={handleEmulate}
          config={config}
        />
        <ConfigPopup onSave={handleConfig} disabled={false} config={config} />
        <HistoryList
          history={history.current}
          portfolioName={selectedPortfolio?.name}
          onClearHistory={handleClearHistory}
        />
      </GridToolbar>
      <div className={"table-container"}>
        {pid &&
          (viewMode === 'stocks' ?
              (
                  <Table
                      size="small"
                      rowKey={"symbol"}
                      loading={loading}
                      columns={columns}
                      dataSource={actualTableData[1]}
                      pagination={false}
                      scroll={{ y: "calc(var(--top-div-height) - 86px)" }}
                      bordered={true}
                      rowHoverable={false}
                      onRow={(record) => ({
                style: getRowStyle(record),
                onMouseEnter: () => setHoveredRowKey(record.name),
                onMouseLeave: () => setHoveredRowKey(null),
              })}
                  />) :
              viewMode === 'cash' ?
              (
            <Table
              size="small"
              rowKey={"symbol"}
              loading={loading}
              columns={columnsCash}
              dataSource={actualTableData[0]}
              pagination={false}
              scroll={{ y: "calc(var(--top-div-height) - 86px)" }}
              bordered={true}
              rowHoverable={false}
            />
          ) : (
                      <Table
                          size="small"
                          rowKey={"symbol"}
                          loading={loading}
                          columns={columnsDividends}
                          dataSource={actualTableData[2]}
                          pagination={false}
                          scroll={{ y: "calc(var(--top-div-height) - 86px)" }}
                          bordered={true}
                          rowHoverable={false}
                      />

          ))}

        {initialization && (
          <Flex align="center" gap="middle">
            <Spin />
          </Flex>
        )}
      </div>
    </div>
  );
};

export default QuoteTable;
