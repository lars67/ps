//get
export function getBasePriceFieldName(basePrice: string): string {
    switch (basePrice) {
        case "0":
            return 'iexBidPrice';
        case "1":
            return 'iexAskPrice';
        case "2":
            return 'latestPrice';
        //case 3: return 'open'
        case "4":
            return 'close';
        case "5":
            return 'high';
        case "6":
            return 'low';
        case "7":
            /*if (
                q.iexBidPrice &&
                q.iexAskPrice &&
                q.iexBidPrice > 0 &&
                q.iexAskPrice > 0
            ) {
              return 0.5 * (q.iexBidPrice + q.iexAskPrice);
            }
            if (q.iexBidPrice && q.iexBidPrice > 0) {
              return q.iexBidPrice;
            }
            if (q.iexAskPrice && q.iexAskPrice > 0) {
              return q.iexAskPrice;
            }*/
            return 'close';
        case "8":
            return 'latestPrice';
        default:
            return 'close';
    }
}
