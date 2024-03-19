import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface UserState {
  loading: "idle" | "pending" | "succeeded" | "failed";
  token?: string;
  username?: string;
  password?: string;
}

const initialState: UserState = {
  loading: "idle",
};
export const authLoginThunk = createAsyncThunk(
  "authLogin",
  async (loginPayload: UserState) => {
    return new Promise<UserState>((resolve, reject) => {
      console.log('process.env.REACT_APP_LOGIN_WS ||', process.env.REACT_APP_LOGIN_WS)
      const ws = new WebSocket( process.env.REACT_APP_LOGIN_WS || 'wss://localhost:3331');
      ws.onopen = () => {
        // Send login command when WebSocket connection is opened
        ws.send(
          JSON.stringify({
            username: loginPayload.username,
            password: loginPayload.password,
          }),
        );
      };

      ws.onmessage = (event) => {
        const response: UserState = JSON.parse(event.data);
        resolve(response);
        ws.close(); // Close WebSocket connection after receiving response
      };

      ws.onerror = (error) => {
        reject(new Error("WebSocket connection error"));
      };
    });
  },
);

//const token = window.localStorage.getItem("token");

export const userSlice = createSlice({
  name: "user",
  initialState: {
    /**
     * authLoginThunk
     */
    token: "",
    hasFetchedToken: false,
    username: "",

    // ---------
  },
  reducers: {
    updateUser(
      state,
      action: PayloadAction<{
        token?: string;
        username?: string;
        password?: string;
      }>,
    ) {
      state.token = action.payload.token || "777";
      state.username = action.payload.username || "";
    },
    /*changeLanguage(state, action) {
			state.lng = action.payload;
		},*/
  },
  extraReducers: (builder) => {
    builder.addCase(authLoginThunk.fulfilled, (state, action) => ({
      ...state,
      token: `${action.payload.token}`,
    }));
  },
  /*extraReducers: (builder) => {
		builder.addCase(authLoginThunk.fulfilled, (state, action) => {
			state.token = action.payload;
			state.hasFetchedToken = true;
		});
		builder.addCase(authLogoutThunk.fulfilled, (state) => {
			return {
				...state,
				token: "",
				hasFetchedToken: false,
				...CONSTANT_USERINFO,
			};
		});
		builder.addCase(userInfoThunk.fulfilled, (state, action) => ({
			...state,
			...action.payload,
			hasFetchedUserInfo: true,
		}));
	},*/
});
