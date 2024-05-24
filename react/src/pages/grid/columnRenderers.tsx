import React from 'react';
import ReactCountryFlag from "react-country-flag";
import styled from "styled-components";

const ReactCountryFlagStyled = styled(ReactCountryFlag)`
font-size: 18px!important;
margin-right: 3px;  
`
export const formatNumber = (value: number | string, digits: number = 2): string => {
    let numericValue: number;

    // Check if the input is a number or a string
    if (typeof value === 'number') {
        numericValue = value;
    } else if (typeof value === 'string') {
        numericValue = parseFloat(value);
    } else {
        return '';
    }

    // Format the numeric value with the specified number of digits
    const formattedValue = numericValue.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formattedValue;
};


export const numberFormattedRender =<T extends Record<string, any>>(field:string, digits: number=2) => (text: string,record:T) => {
    const value = record[field];
    const blink = record[`${field}_blink`];
    const change = record[`${field}_change`];
    const s = formatNumber (value, digits);

    const className = blink ? (change > 0
        ? 'blink price-increase'
        : change < 0
            ? 'blink price-decrease'
            : '') : '';

    return { props:{className}, children: s}
};

export const flagRender = <T extends {a2:string}>( field:string, record:T) =>
    <><ReactCountryFlagStyled countryCode={record.a2} />{field}</>
;
