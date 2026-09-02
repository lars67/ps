// Public commands accessible on guest port (3334) without authentication.
// Added: ping for health checks (monitoring system, load balancers)
export const guestAccessAllowed = (socket: any, msg: any) => {
  const allowed = [
    "login",
    "signup",
    "ping",  // Health check - required for institutional monitoring
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
    "tools.statistic",
    "tools.theoprice",
  ];
  return allowed.includes(msg.command?.toLowerCase());
};
