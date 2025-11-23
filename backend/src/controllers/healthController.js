const getConnectionStatus = require('../utils/dbStatus');

exports.getHealthStatus = async (req, res) => {
  try {
    const dbStatus = getConnectionStatus();
    
    res.status(200).json({
      status: 'success',
      data: {
        database: {
          ...dbStatus,
          isConnected: dbStatus.readyState === 1
        },
        server: {
          uptime: process.uptime(),
          timestamp: Date.now(),
          environment: process.env.NODE_ENV
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}; 