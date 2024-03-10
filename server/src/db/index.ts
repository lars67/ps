export const dbConnection = {
    url: process.env.MONGODB_URI as string,
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
};
