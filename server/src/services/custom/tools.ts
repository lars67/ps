import { CommandDescription } from "../../types/custom";
import { DataPoint } from "./statistics/utils";
import moment from "moment";
import statistics from "./statistics";
import {
  getPortfolioInstanceByIDorName,
  PutCash,
  putSpecialTrade,
} from "../../services/portfolio/helper";
import { UserData } from "../../services/websocket";

import { checkPrices, getDatesSymbols } from "../../services/app/priceCashe";
import { errorMsgs, formatYMD } from "../../constants";
import { isValidDateFormat } from "../../utils";
import {
  DayType,
} from "../../services/portfolio/portfolioCalculator";
import {
  history as historyService,
} from "../../services/portfolio/history";

const data = `3/10/2004,13.84,25.37,492.1
3/11/2004,13.575,25.09,486.2
3/12/2004,13.78,25.38,493.1
3/15/2004,13.225,25.16,491.2
3/16/2004,12.91,25.18,499.9
3/17/2004,13.095,25.13,508.2
3/18/2004,12.835,24.89,512.8
3/19/2004,12.93,24.63,503.4
3/22/2004,12.93,24.5,496.1
3/23/2004,12.645,24.15,498`;

const symbolData: DataPoint[] = data.split("\n").map((row) => {
  const ar = row.split(",");
  const d = ar[0].split("/");
  return [
    moment([Number(d[2]), Number(d[0]) - 1, Number(d[1])]),
    Number(ar[1]),
  ];
});

type StatisticsData = {
  portfolio?: string;
  history?: string;
  data?: { date: string; value: string }[];
  from?: string;
  till?: string;
};

export async function statistic(
  { history, portfolio, from, till }: StatisticsData,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
) {
  if (!history && !portfolio) {
    return errorMsgs.error('Need set history or portfolio')
  }
  if (from) {
    if (!isValidDateFormat(from)) {
      return  errorMsgs.error("Wrong 'from'" );
    }
    from = `${from.split("T")[0]}T00:00:00`;
  } else if (history) {
    return { error: "Please set 'from'" };
  }
  if (till) {
    if (!isValidDateFormat(till)) {
      return { error: "Wrong 'till'" };
    }
    till = `${till.split("T")[0]}T23:59:59`;
  } else {
    till = moment().format(`${formatYMD}T23:59:59`);
  }
  try {
    if (history) {
      const dateShift = moment(from, formatYMD)
        .add(-7, "day")
        .format(formatYMD);
      await checkPrices([history], dateShift);
      const prices = getDatesSymbols([history], from as string, till)
        .map((p) => [
          moment(p.date, formatYMD),
          Number(p[history] as keyof number),
        ])
        .filter((p) => p[1]) as DataPoint[];
      const statistic = statistics.statistics(prices, 0);
      return { statistic };
    } else if (portfolio) {
      const {
        _id: realId,
        error,
        instance,
      } = await getPortfolioInstanceByIDorName(portfolio, userData);
      if (error) {
        return error;
      }
      if (!instance) {
        return { error: `Portfolio with _id=${realId} is not exists` };
      }
      const h = await historyService(
        { _id: realId, detail: "0", sample: "1", precision: 2 },
        sendResponse,
        msgId,
        userModif,
        userData,
      );
      const prices = (h as { days: DayType[] }).days
        .map((p) => [moment(p.date, formatYMD), Number(p.invested)])
        .filter((p) => p[1]) as DataPoint[];
      const statistic = statistics.statistics(prices, 0);
      return { statistic };
    }
  } catch (err) {
    return errorMsgs.failed("tools.statistic");
  }
}

export const description: CommandDescription = {
  statistic: {
    label: "Statistic",
    access: "public",
    value: JSON.stringify({
      command: "tools.statistic",
      history: "",
      portfolio: "",
      from: "",
      till: "",
    }),
  },
};
