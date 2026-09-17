import mongoose from 'mongoose';

// One connection, reused across serverless invocations.
//
// A function that calls mongoose.connect() per request opens a new pool every
// time, which is slow on every call and exhausts Atlas's connection limit
// under any real traffic. The promise is cached at module scope, which
// survives as long as the container does, so a warm invocation does no
// connecting at all.
let connecting = null;

export const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    if (connecting) return connecting;

    connecting = mongoose
        .connect(process.env.MONGO_URI, {
            // Small pool: a serverless container serves one request at a time,
            // and dozens of containers each holding ten connections is how a
            // free Atlas cluster runs out.
            maxPoolSize: 5,
            // Fail fast rather than sitting past the function's own timeout.
            serverSelectionTimeoutMS: 8000,
        })
        .then((conn) => {
            console.log(`MongoDB connected: ${conn.connection.host}`);
            return conn.connection;
        })
        .catch((error) => {
            // Cleared so the next invocation retries instead of inheriting a
            // permanently rejected promise.
            connecting = null;
            throw error;
        });

    return connecting;
};
