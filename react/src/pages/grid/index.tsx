import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Table, Button, Select, message, Flex, Spin } from "antd";
import "./styles.css";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useAppSelector } from "../../store/useAppSelector";

import { WSMsg } from "../../types/other";
import { numberFormattedRender } from "./columnRenderers";

import GridToolbar from "./GridToolbar";
import { current } from "@reduxjs/toolkit";
import { Portfolio, QuoteData } from "../../types/portfolio";
import EmulatePriceChange from "./EmulatePriceChange";
import HistoryList from "./HistoryList";
import ConfigPopup from "./ConfigPopup"; // Import CSS file for styling
import { useAppDispatch } from "../../store/useAppDispatch";
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

export type ConfigParams = {
  marketPrice: string;
  basePrice: string;
  closed: string;
};
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

let counterSub: number = 0;

const QuoteTable = () => {
  const dispatch = useAppDispatch();
  const { userId, token } = useAppSelector((state) => state.user);
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
  const [config, setConfig] = useState<ConfigParams>({
    basePrice: "4",
    marketPrice: "4",
    closed: "no",
  });
  const subscribeId = useRef<string>();
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio>();
  console.log("QuteTable start pid", pid);

  //data connect

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
            if (msgId === (o as {msgId: string}).msgId){
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

  useEffect(() => {
    const process = async () => {
      if (pid) {
        setTableData([]);
        setLoading(true);
        subscribeId.current = `sub${++counterSub}_${pid}`;
       // console.log("useEffect keys=", Object.keys(handlers.current));
        handlers.current[subscribeId.current] = (d: any) => {
          console.log("HANDLER>>>>>>>>>>>", d);
          if (Array.isArray(d.data)) {
            setLoading(false);
            setTableData((data) => {
              const newData = [...data];
              const changes = d.data;
              console.log("changes", changes.length);
              changes.forEach((t: QuoteData) => {
                const symbol = t.symbol;
                const matchIndex = newData.findIndex(
                  (t) => t.symbol === symbol,
                );
                console.log(symbol, ":", matchIndex);
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
              return newData;
            });
          }
        };

        console.log("useEffect() SUBSCRIPTIONS", pid, subscribeId.current);
   ;
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
      },
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
        width: '18%'
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
    [],
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

  const handleConfig = useCallback(
    (config: ConfigParams) => {
      setConfig(config);
    },
    [setConfig],
  );

  const handleClearHistory = () => (history.current = []);
  return (
    <div className={"playground-container"}>
      <GridToolbar
        readyState={readyState}
        portfolios={portfolios}
        pid={pid}
        onSelectPortfolio={handleSelectPortfolio}
        canWork={canWork.current}
      >
        <EmulatePriceChange
          disabled={!canWork || !pid}
          positions={tableData}
          onEmulate={handleEmulate}
          config={config}
        />
        <ConfigPopup config={config} onSave={handleConfig} disabled={false} />
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
