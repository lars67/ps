import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface UserState {
  loading?: "idle" | "pending" | "succeeded" | "failed";
  token?: string;
  name?: string;
  password?: string;
  email?: string;
  role?: string;
  userId?: string
}

const initialState: UserState = {
  loading: "idle",
};
export const authLoginThunk = createAsyncThunk(
  "authLogin",
  async (loginPayload: UserState) => {
    return new Promise<UserState>((resolve, reject) => {
      console.log(
        "process.env.REACT_APP_LOGIN_WS ||",
        process.env.REACT_APP_LOGIN_WS,
      );

      const isGuest = loginPayload.role === 'guest'
      const ws = new WebSocket(

          process.env.REACT_APP_LOGIN_WS || "wss://localhost:3331",
      );
      ws.onopen = () => {
        // Send login command when WebSocket connection is opened
        ws.send(
          JSON.stringify({
            name: loginPayload.name,
            ...(isGuest ? {role:'guest'} : {password: loginPayload.password}),
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

export const authSignUpThunk = createAsyncThunk(
  "authLogin",
  async (payload: UserState) => {
    return new Promise<UserState>((resolve, reject) => {
      console.log(
        "process.env.REACT_APP_LOGIN_WS ||",
        process.env.REACT_APP_LOGIN_WS,
      );
      const ws = new WebSocket(
        process.env.REACT_APP_LOGIN_WS || "wss://localhost:3331",
      );
      ws.onopen = () => {
        // Send signup command when WebSocket connection is opened
        ws.send(
          JSON.stringify({
            name: payload.name,
            password: payload.password,
            email: payload.email,
            cmd: "signup",
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

export const userSlice = createSlice({
  name: "user",
  initialState: {
    /**
     * authLoginThunk
     */
    token: "",
    hasFetchedToken: false,
    name: "",
    role: "member",
    userId:undefined
    // ---------
  },
  reducers: {
    updateUser(
      state,
      action: PayloadAction<{
        token?: string;
        name?: string;
        password?: string;
        role?: string;
        userId?: string;
      }>,
    ) {
      console.log("store.updateUser", action.payload, ">", state);
      Object.assign(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(authLoginThunk.fulfilled, (state, action) => ({
      ...state,
      token: `${action.payload.token}`,
      role: `${action.payload.role}`
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

export const { updateUser } = userSlice.actions;
