import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const connectDB = async (): Promise<boolean> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/saheli', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    console.log(`\n📦 MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error: any) {
    console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
    return false;
  }
};

mongoose.connection.on('disconnected', () => {
  console.error('⚠️ MongoDB disconnected. API routes requiring DB will return 503 until reconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB runtime error: ${err.message}`);
});
