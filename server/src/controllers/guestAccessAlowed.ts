export const guestAccessAllowed = (socket: any, msg: any) => {
  const allowed = [
    "login",
    "signup",
    "portfolios.list",
    "portfolios.positions",
    "portfolios.attribution",
    "portfolios.history",
    "currencies.list",
    "sectors.list",
    "commands.list",
    "trades.list",
    "prices.getcurrent",
    "prices.gethistorical",
  ];
  return allowed.includes(msg.command?.toLowerCase());
};
