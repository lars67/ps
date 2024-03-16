import {createSlice, PayloadAction} from "@reduxjs/toolkit";

interface OptionsState {
    clearAlwaysResult: boolean;
    clearAlwaysCommand: boolean;
}

export const optionsSlice = createSlice({
    name: "options",
        initialState: {
        clearAlwaysResult: false,
        clearAlwaysCommand: true
    },
    reducers: {
        changeOption(state, action: PayloadAction<{option: keyof OptionsState , value: boolean}>) {
            state[action.payload.option] = action.payload.value;
        },
    },
});

export const { changeOption } = optionsSlice.actions;

export default optionsSlice.reducer;
