export  type LayoutKeys = 'portfoliosTotal'| 'currencyTotal' | /*'underlyingTotal' |*/ 'industryTotal' |
    'sectorTotal' | 'countryTotal' |'subregionTotal' |    'regionTotal' | 'total' | 'contractPositions'

export  type GroupKeys = 'nogroup'| 'currency' | 'sector' | 'region'

export type Layout= Record<LayoutKeys, boolean>

export type ColorDataItem = {
    key?: string;
    label: string;
    color: string;
    bkg: string;
    bold?: boolean;
}
export type DisplayKeys = 'positions' | 'currencyTotal' | 'industryTotal' |
   'sectorTotal' |'subregionTotal' | 'regionTotal' | 'total';//| 'currencyExposure' | 'currencyExposureHeader'

export type ColorDataRecord = Record <DisplayKeys, ColorDataItem>


export type BaseConfigParams = {
    marketPrice: string;
    basePrice: string;
    closed: string;
};

export type BaseConfigParamsKeys = 'marketPrice' | 'basePrice' | 'closed';


export type Config = {
    layout: {
        currencyTotal: boolean,
        //underlyingTotal: boolean,
        portfoliosTotal: boolean,
        industryTotal: boolean,
        sectorTotal: boolean,
        subregionTotal: boolean,
        regionTotal: boolean,
        total: boolean
    },
    display: ColorDataRecord,
    config: BaseConfigParams,
    groups: {
         group: string
    }

};
