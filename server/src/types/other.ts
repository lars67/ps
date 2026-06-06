import SSEService from "../services/app/SSEService";

export type ErrorType = {
    error: string;
};

export type StringRecord = Record<string, string>;

export type SubscriptionData = {
  rates: Record<string, number>;
  fees: Record<string, { fee: number; feeSym: number }>;
  cashes: Record<string, number>;
  portfolioPositions: Record<string, any>;
  currencyInvested: Record<string, any>;
  regionInvested: Record<string, any>;
  subRegionInvested: Record<string, any>;
  countryInvested: Record<string, any>;
  sectorInvested: Record<string, any>;
  industryInvested: Record<string, any>;
  portfoliosInvested: Record<string, any>;
  isFirst: boolean;
  investedPortfolio: number;
  totalRealized: number;
};

export type SubscribeObj = {
  handler: (o: object) => void;
  registeredHandler: (o: object) => void;
  sseService: SSEService;
  tradeHandler?: (ev: any) => void;
  data?: SubscriptionData;
};
export type SubscribeMsgs = Record<string, SubscribeObj>
