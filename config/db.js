const mongoose = require('mongoose');
<<<<<<< HEAD
const dotenv = require('dotenv');

dotenv.config();

console.log(process.env.MONGO_URI);
=======
>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
