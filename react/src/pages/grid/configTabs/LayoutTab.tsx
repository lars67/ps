import React, { useCallback, useState } from "react";
import { Checkbox } from "antd";
import { useAppSelector } from "../../../store/useAppSelector";
import { useDispatch } from "react-redux";
import { LayoutKeys } from "../../../types/config";
import { configSlice } from "../../../store";

const displayLayoutLabels: Record<LayoutKeys, string> = {
  currencyTotal: "Currency Total",
  //underlyingTotal: "Asset type Total",
  portfoliosTotal: 'Portfolios total',
  industryTotal: "Industry Total",
  sectorTotal: "Sector Total",
  subregionTotal: "Subregion Total",
  regionTotal: "Region Total",
  total: "Total",
  contractPositions: 'Contract positions'
};
const LayoutTab: React.FC = () => {
  const { layout } = useAppSelector((state) => state.config);
  const dispatch = useDispatch();

  const handleCheckboxChange = useCallback(
    (key: LayoutKeys) => {
      const v = layout[key];
      dispatch(configSlice.actions.updateLayout({ [key]: !v }));
    },
    [layout],
  );

  return (
    <div>
      {Object.keys(layout).map((key, index) => (
        <div key={key} style={{ display: "flex", alignItems: "center" }}>
          <Checkbox
            checked={layout[key as LayoutKeys]}
            onChange={() => handleCheckboxChange(key as LayoutKeys)}
          />
          <span style={{ marginLeft: "8px" }}>
            {displayLayoutLabels[key as LayoutKeys]}
          </span>
        </div>
      ))}
    </div>
  );
};

export default LayoutTab;
