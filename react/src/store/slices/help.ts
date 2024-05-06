import {createSlice, PayloadAction} from "@reduxjs/toolkit";


export interface HelpState {
    helpPage: string
}

export const helpSlice = createSlice({
    name: "help",
    initialState: {
        helpPage:''
    },

    reducers: {
        changeHelpPage(state, action: PayloadAction<{ helpPage:string}>) {
            state.helpPage = action.payload.helpPage;
        },
    },
});

export const { changeHelpPage } = helpSlice.actions;

export default helpSlice.reducer;
