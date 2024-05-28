import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import {
  BaseConfigParamsKeys,
  ColorDataItem,
  DisplayKeys,
  LayoutKeys,
} from "../../types/config";


const defaultState = {
  layout: {
    currencyTotal: true,
    underlyingTotal: false,
    industryTotal: false,
    sectorTotal: false,
    subregionTotal: false,
    regionTotal: false,
    total: true,
    contractPositions: true
  },
  display: {
    positions: { color: "#000000", bkg: "#FFFFFF", bold: false, label:'Positions' },
//    zero: { color: "#BBBBBB", bkg: "#FFFFFF", bold: false, label:'Zero' },
//    negative: { color: "#800000", bkg: "#FFFFFF", bold: false, label: 'Negative' },
    underlyingTotal: {
      color: "#000000",
      bkg: "#FFFF80",
      bold: true,
      label: 'Underlying Total'
    },
    currencyTotal: { color: "#FF0000", bkg: "#AAFFAA", bold: true, label:"Currency Total" },
    industryTotal: { color: "#FF0000", bkg: "#FFAA99", bold: true, label:'Industry Total' },
    sectorTotal: { color: "#FF0000", bkg: "#FFAA40", bold: true, label:'Sector Total' },
    subregionTotal: {
      color: "#000000",
      bkg: "#FF9955",
      bold: true,
      label:'Subregion Total'
    },
    regionTotal: { color: "#000000", bkg: "#FF9900", bold: true, label:'Region Total' },
    total: { color: "#0000FF", bkg: "#AAAAAA", bold: true,  label:'Total' },
   /* currencyExposure: {
      color: "#FFFF00",
      bkg: "#AAFFAA",
      bold: true,
    },
    currencyExposureHeader: {
      color: "#FFFF00",
      bkg: "#AAFFAA",
      bold: true,
    },*/
  },
  config: {
    basePrice: "4",
    marketPrice: "4",
    closed: "no"
  }
/*
  group: "underlying", //'no',
  contractPosition: true,
  currencyExposure: true,
  floatFormat: "0,0.00",
  basePrice: 4,
  marketPrice: 2,
*/
 };

export const configSlice = createSlice({
  name: "config",
  initialState: defaultState,
  reducers: {
    updateBaseConfig(
        state,
        action: PayloadAction<Partial<{
          [K in BaseConfigParamsKeys]: string;
        }>>,
    ) {
      state.config = { ...state.config, ...action.payload };
    },
    updateLayout(
      state,
      action: PayloadAction<Partial<{
        [K in LayoutKeys]: boolean;
      }>>,
    ) {
      state.layout = { ...state.layout, ...action.payload };
    },
    updateDisplay(
      state,
      action: PayloadAction<{ [K in DisplayKeys]: Partial<ColorDataItem> }>,
    ) {
      for (const key in action.payload) {
        // @ts-ignore
        state.display[key] = {
          ...state.display[key as DisplayKeys],
          ...action.payload[key as DisplayKeys],
        };
      }
    },
  },
});

export const { updateBaseConfig,  updateLayout, updateDisplay } = configSlice.actions;

export default configSlice.reducer;
