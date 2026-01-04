import {StringRecord} from "../types/other";
import moment from "moment";
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export type  HistoricalDataInput =
    {
        date: string,
        open?: string,
        high?: string,
        low?: string,
        close:string,
        ['adj close']? : string,
        volume?: string,
        [key: string]: any
    }


export type  HistoricalData = {
    dateUnix?: Date,
    date: string,
    open?: number,
    high?: number,
    low?: number,
    close: number,
    volume?: number
}




const baseUrl = process.env.DATA_PROXY || 'https://top.softcapital.com/scproxy'

export const getDataUrl = (endPoint:string, query:string='') =>
    `${baseUrl}/${endPoint}?${query}`;

export const toQueryString = (query: StringRecord) =>
    Object.entries(query)
        .map(([key, val]) => `${key}=${encodeURI(val)}`)
        .join('&');

export const fetchHistory =  async function(query:StringRecord):Promise<HistoricalData[]> {
    try {
        const symbol = query.symbol;

        // First, try to read from local CSV files (high precision data)
        const localData = await readLocalCSVData(symbol, query);
        if (localData && localData.length > 0) {
            console.log(`✅ Using high-precision local CSV data for ${symbol} (${localData.length} records)`);
            return localData;
        }

        // If local data not available, fall back to external API (lower precision)
        console.log(`⚠️  Local CSV data not available for ${symbol}, falling back to external API`);

        // console.log(getDataUrl('historical', toQueryString(query)));
        const response = await fetch(getDataUrl('historical', toQueryString(query)) );
         const data = await response.json();
         // console.log('DATA FROM PROXY', data);
        let prevValue: HistoricalDataInput;
        const targetData = (Array.isArray(data) ? data : []).map((item:HistoricalDataInput) => {
            const closeValue = item.close || item['adj close'] || (symbol && item[symbol]) || (prevValue && (prevValue.close || prevValue['adj close'] || (symbol && prevValue[symbol])));
            const preparedItem = {
                date: item.date,
                dateUnix: moment(item.date, 'YYYY-MM-DD').toDate(), //unix(),utoDate(),
                open: parseFloat(item.open || ''),
                high: parseFloat(item.high|| ''),
                low: parseFloat(item.low || ''),
                close: parseFloat(closeValue || ''),
                volume: parseFloat(item.volume || '0')
            };
            if (item['adj close'] || item.close || (symbol && item[symbol])) {
                prevValue = item;
            }
            return preparedItem;
        });

        return targetData;
    } catch (err) {
        console.log('Error', query, err);
        return [];
    }
}

export async function fetchHistoryDate(symbol:string, date:string):Promise<HistoricalData | {}> {
    try {
        const rnd = Date.now();
        const response = await fetch(
            getDataUrl(`historical/${symbol}/${date}`, `rnd=${rnd}`)
        );
        const data = await response.json();
        return data;
    } catch (err) {
        console.log('Error', err);
        return {};
    }
}



export async function getDividends(symbol:string) {
    try {
        const response = await fetch(getDataUrl(`dividends`,toQueryString({symbol,range:'max'})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error', err);
        return '';
    }
}

export async function loadCompany(symbol:string) {
    try {
        const response = await fetch(getDataUrl(`company`,toQueryString({symbol})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error getCompany', err);
        return null;
    }
}

export async function loadInstruments(symbols:string) {
    try {
        const response = await fetch(getDataUrl(`instruments`,toQueryString({symbols})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error getInstruments', err);
        return null;
    }
}

export async function loadCurrenciesList(symbols: StringRecord) {
    try {
        const response = await fetch(getDataUrl(`instruments/currencies`,toQueryString(symbols)));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error loadCurrenciesList', err);
        return [];
    }
}

/**
 * Read historical data from local CSV files created by CustomYahooDownload.py
 * This prioritizes local data over external API calls for better precision and performance
 */
async function readLocalCSVData(symbol: string, query: StringRecord): Promise<HistoricalData[] | null> {
    try {
        // PS2 symbol format matches CSV filename format
        // Both use DANSKE:XCSE format (with colons)
        const csvSymbol = symbol;
        const csvDir = '/home/lars/projects/Finex/FastCla/Data/symbols/MicSymbols';
        const csvPath = path.join(csvDir, `${csvSymbol}.csv`);

        // Check if CSV file exists
        if (!fs.existsSync(csvPath)) {
            console.log(`CSV file not found: ${csvPath}, attempting to download...`);
            // Try to download the missing data using the Python script
            const downloadSuccess = await downloadMissingCSVData(symbol);
            if (!downloadSuccess) {
                console.log(`Failed to download CSV data for ${symbol}`);
                return null;
            }
        }

        // Re-check if file exists after download attempt
        if (!fs.existsSync(csvPath)) {
            console.log(`CSV file still not found after download attempt: ${csvPath}`);
            return null;
        }

        // Read and parse CSV file
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            console.log(`CSV file ${csvPath} has insufficient data`);
            return null;
        }

        // Parse header to understand column positions
        const header = lines[0].split(',');
        const dateIndex = header.findIndex(col => col.toLowerCase().includes('date'));
        const openIndex = header.findIndex(col => col.toLowerCase().includes('open'));
        const highIndex = header.findIndex(col => col.toLowerCase().includes('high'));
        const lowIndex = header.findIndex(col => col.toLowerCase().includes('low'));
        const closeIndex = header.findIndex(col => col.toLowerCase().includes('close'));
        const volumeIndex = header.findIndex(col => col.toLowerCase().includes('volume'));

        if (dateIndex === -1 || closeIndex === -1) {
            console.log(`CSV file ${csvPath} missing required columns (date, close)`);
            return null;
        }

        // Parse data rows
        const historicalData: HistoricalData[] = [];
        const fromDate = query.from ? moment(query.from) : null;
        const toDate = query.till ? moment(query.till) : null;

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');

            if (columns.length <= dateIndex) continue;

            const dateStr = columns[dateIndex].trim();
            // Handle different date formats: YYYY-MM-DD HH:MM:SS+TZ or just YYYY-MM-DD
            const datePart = dateStr.split(' ')[0]; // Take only the date part
            const date = moment(datePart);

            // Filter by date range if specified
            if (fromDate && date.isBefore(fromDate)) continue;
            if (toDate && date.isAfter(toDate)) continue;

            // Parse values with full precision - read as strings first to preserve exact values
        const openStr = openIndex !== -1 && columns[openIndex] ? columns[openIndex].trim() : '';
        const highStr = highIndex !== -1 && columns[highIndex] ? columns[highIndex].trim() : '';
        const lowStr = lowIndex !== -1 && columns[lowIndex] ? columns[lowIndex].trim() : '';
        const closeStr = columns[closeIndex].trim();
        const volumeStr = volumeIndex !== -1 && columns[volumeIndex] ? columns[volumeIndex].trim() : '';

        // Convert to numbers only when needed, preserving precision
        const open = openStr ? parseFloat(openStr) : undefined;
        const high = highStr ? parseFloat(highStr) : undefined;
        const low = lowStr ? parseFloat(lowStr) : undefined;
        const close = parseFloat(closeStr);
        const volume = volumeStr ? parseFloat(volumeStr) : undefined;

            if (!isNaN(close)) {
                historicalData.push({
                    date: date.format('YYYY-MM-DD'),
                    dateUnix: date.toDate(),
                    open,
                    high,
                    low,
                    close,
                    volume
                });
            }
        }

        // Sort by date ascending
        historicalData.sort((a, b) => moment(a.date).diff(moment(b.date)));

        console.log(`Successfully read ${historicalData.length} records from ${csvPath}`);
        return historicalData;

    } catch (error) {
        console.error(`Error reading local CSV data for ${symbol}:`, error);
        return null;
    }
}

/**
 * Download missing CSV data by calling the Python script CustomYahooDownload.py
 */
async function downloadMissingCSVData(symbol: string): Promise<boolean> {
    return new Promise((resolve) => {
        const pythonScript = '/home/lars/projects/Finex/FastCla/src/CustomYahooDownload.py';
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        console.log(`Calling Python script to download data for ${symbol}`);

        const child = spawn(pythonCmd, [pythonScript, '--symbols', symbol, '--force'], {
            cwd: '/home/lars/projects/Finex/FastCla/src',
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`Python script completed successfully for ${symbol}`);
                resolve(true);
            } else {
                console.error(`Python script failed for ${symbol} (exit code: ${code})`);
                console.error('stdout:', stdout);
                console.error('stderr:', stderr);
                resolve(false);
            }
        });

        child.on('error', (error) => {
            console.error(`Failed to start Python script for ${symbol}:`, error);
            resolve(false);
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            child.kill();
            console.error(`Python script timed out for ${symbol}`);
            resolve(false);
        }, 5 * 60 * 1000);
    });
}
