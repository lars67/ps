import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Table, Button, Select, message, Flex, Spin, RowProps } from "antd";
import "./styles.css";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useAppSelector } from "../../store/useAppSelector";

import { WSMsg } from "../../types/other";
import {
  flagRender,
  numberFormattedRender,
  symbolRender,
} from "./columnRenderers";

import GridToolbar from "./GridToolbar";
import { current } from "@reduxjs/toolkit";
import { Portfolio, QuoteData } from "../../types/portfolio";
import EmulatePriceChange from "./EmulatePriceChange";
import HistoryList from "./HistoryList";
import ConfigPopup from "./ConfigPopup"; // Import CSS file for styling
import { useAppDispatch } from "../../store/useAppDispatch";

import styled from "styled-components";
import { configSlice } from "../../store";
import {BaseConfigParams, ColorDataItem, DisplayKeys, Layout, LayoutKeys} from "../../types/config";
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
  const { userId, token } = useAppSelector((state) => state.user);
  const fullConfig = useAppSelector((state) => state.config);
  const { layout, config, display } = fullConfig;

  const modif = useRef(Math.round(100000 * Math.random()));
  const msgId = useRef(0);
  const url = `${process.env.REACT_APP_WS}?${encodeURIComponent(token)}@${modif.current}`;
  const fragments = useRef<{ [key: string]: string[] }>({});
  const fragmentsMsg = useRef<{ [key: string]: string[] }>({});
  const [tableData, setTableData] = useState<QuoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const handlers = useRef<Record<string, (value: string) => void>>(
    {} as Record<string, (value: string) => void>,
  );
  const canWork = useRef(false);
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

  const [hoveredRowKey, setHoveredRowKey] = useState<string|null>(null);



  const getRowClassName = (record:QuoteData) => {
    return record.key === hoveredRowKey ? 'hovered-row' : '';
  };

  const addToHistory = (dir: string, s: string) => {
    history.current.push(`${dir} ${s}`);
    if (history.current.length > 50) {
      history.current.shift();
    }
  };

  const onMessageCallback = (event: MessageEvent<string>) => {
    if (event.data !== "undefined") {
      const message = JSON.parse(event.data) as WSMsg;

      const { data, msgId = "", total, index } = message;
      if (!msgId) {
        console.log("Wrong command absent msgId");
        return "";
      }
      //  console.log(`msg > ${msgId}, ${total}, ${index}`);
      if (!fragments.current[msgId]) {
        fragments.current[msgId] = [];
      }
      fragments.current[msgId][index] = data;
      if (fragments.current[msgId].length === Number(total)) {
        //setLoading(false);
        const assembledMessage = fragments.current[msgId].join("");
        console.log(
          "Received message msgId:",
          msgId,
          "len",
          assembledMessage.length,
        );
        addToHistory("<", assembledMessage);
        delete fragments.current[msgId];
        console.log(
          "call handler msgId",
          msgId,
          Boolean(handlers.current[msgId]),
          handlers.current[msgId],
        );
        dispatch({ type: "MESSAGE", assembledMessage });
        console.log("reqParams.current", reqParams.current);
        if (Boolean(handlers.current[msgId])) {
          const resp = JSON.parse(assembledMessage);
          handlers.current[msgId](resp);
        }
      }
    }
    console.log("/onMessage");
  };

  const { sendJsonMessage, readyState, getWebSocket } = useWebSocket(url, {
    onMessage: onMessageCallback,
  }); //,  shouldConnect);
  canWork.current = readyState === ReadyState.OPEN;

  async function sendJsonMessageSync(o: object) {
    return new Promise((resolve, reject) => {
      const socket = getWebSocket();

      if (socket) {
        const handleMessageMsg = (event: MessageEvent) => {
          const message = JSON.parse(event.data) as WSMsg;

          const { data, msgId = "", total, index } = message;
          if (!fragmentsMsg.current[msgId]) {
            fragmentsMsg.current[msgId] = [];
          }

          fragmentsMsg.current[msgId][index] = data;
          if (fragmentsMsg.current[msgId].length === Number(total)) {
            const assembledMessage = fragmentsMsg.current[msgId].join("");
            delete fragmentsMsg.current[msgId];
            if (msgId === (o as { msgId: string }).msgId) {
              resolve(assembledMessage);
              // @ts-ignore
              socket.removeEventListener("message", handleMessageMsg); // Remove the event listener
            }
          }
        };

        // @ts-ignore
        socket.addEventListener("message", handleMessageMsg);

        socket.onerror = (error: Event) => {
          reject(error);
        };
        addToHistory(">", JSON.stringify(o));
        sendJsonMessage(o);
      } else {
        reject({ error: "socket is closed" });
      }
    });
  }

  const sendMsg = async (cmd: object) => {
    msgId.current++;
    //console.log("SendMSG", { ...cmd, msgId: msgId.current });
    try {
      const r = await sendJsonMessageSync({ ...cmd, msgId: msgId.current });
      //console.log("SYYYYYYYYYYYYYYNC", r);
      return r;
    } catch (er) {
      console.log("SendMsg error", er);
    }
  };

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

  const prepareData = useCallback(
    (data: QuoteData[]) => {
      const layoutActive = Object.keys(layout).filter(
        (key) => layout[key as LayoutKeys],
      );
      return data.filter((c) => {
        const totalType = c.totalType as string;
        return (layout.contractPositions && !totalType) || layoutActive.includes(totalType);
      });
    },
    [layout],
  );

  useEffect(() => {
    setTableData(prepareData(lastData.current));
  }, [layout]);

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
              return prepareData(newData);
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
    pid && process();
    return () => {
      clearSubscription(pid);
    };
  }, [pid, config]);

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
      /*{
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            align:'right' as const,

            render: (text: number, record: QuoteData) =>  {

                const className = record.blink ? (record.change > 0
                    ? 'blink price-increase'
                    : record.change < 0
                        ? 'blink price-decrease'
                        : '') : '';

                return { props:{className}, children: text}
            }
        }
        {
            title: 'Change',
            dataIndex: 'change',
            key: 'change',
            align: 'right' as const,
            render: (text:number) => (
                <span style={{ color: text > 0 ? 'green' : 'red' }}>{text}</span>
            ),
        },
        {
            title: 'Change Price',
            key: 'changePrice',
            render: (text: string, record: QuoteData) => (
                <Button onClick={() => handlePriceChange(record.key,  Math.round(Math.random()*10)-5)}>
                     Price
                </Button>
            ),
        },*/
    ],
    [display],
  );
  /*const handlePriceChange = (key: string, change: number) => {
    const updatedData: QuoteData[] = tableData.map((item) =>
      item.key === key
        ? { ...item, price: item.price + change, change, blink: true }
        : item,
    );

    setTableData(updatedData);

    setTimeout(() => {
      const resetBlinkData = updatedData.map((item) =>
        item.key === key ? { ...item, blink: false } : item,
      );
      setTableData(resetBlinkData);
    }, 1000); // Reset blinking effect after 1 second
  };*/
  const handleSelectPortfolio = useCallback(
    async (newPid: string) => {
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

  const getRowStyle = useCallback((record:QuoteData) => {
    const totalType = record.totalType;
    const d: ColorDataItem = display[(totalType || 'positions') as DisplayKeys];
    return d ? {
      backgroundColor: d.bkg,
      color: d.color,
      fontWeight: 'bold'
    }: {}

}, [display])//,hoveredRowKey])

  // @ts-ignore
  return (
    <div className={"playground-container"}>
      <GridToolbar
        readyState={readyState}
        portfolios={portfolios}
        pid={pid}
        onSelectPortfolio={handleSelectPortfolio}
        canWork={canWork.current}
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
        {pid && (
          <Table
            size="small"
            rowKey={"symbol"}
            loading={loading}
            columns={columns}
            dataSource={tableData}
            pagination={false}
            scroll={{ y: "calc(var(--top-div-height) - 40px)" }}
            bordered={true}
            className={"resizable-table"}
            onRow={(record) => ({
              style: getRowStyle(record),
              onMouseEnter: () => setHoveredRowKey(record.key),
              onMouseLeave: () => setHoveredRowKey(null),

            })}
            /*components={{
              body: {
                row: (props: any) => {
                  console.log("PROPS", props);
                  return (
                    <StyledRow
                      {...props}
                      bkg={props.record?.bkg}
                      color={props.record?.color}
                    />
                  );
                },
              },
            }}*/
          />
        )}
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
