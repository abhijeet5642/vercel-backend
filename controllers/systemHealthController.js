const mongoose = require('mongoose');
const os = require('os');

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// System Health Controller
const getSystemHealth = async (req, res) => {
  try {
    const healthData = {
      server: await getServerStatus(),
      database: await getDatabaseStatus(),
      api: await getAPIResponseTime(),
      uptime: getUptime(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    console.error('System health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health',
      data: {
        server: { status: 'Error', message: 'Health check failed' },
        database: { status: 'Error', message: 'Health check failed' },
        api: { status: 'Error', message: 'Health check failed' },
        uptime: '0%',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Get server status and metrics
const getServerStatus = async () => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    // Calculate memory usage percentage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

    return {
      status: 'Healthy',
      memory: {
        used: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        total: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
        system: `${memUsagePercent}%`
      },
      cpu: {
        loadAverage: loadAvg.map(avg => avg.toFixed(2)),
        processTime: `${(cpuUsage.user + cpuUsage.system) / 1000000}s`
      },
      platform: os.platform(),
      nodeVersion: process.version
    };
  } catch (error) {
    return {
      status: 'Error',
      message: error.message
    };
  }
};

// Get database connection status
const getDatabaseStatus = async () => {
  try {
    const startTime = Date.now();
    
    // Test database connection with a simple query
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    
    // Get database stats
    const dbStats = await mongoose.connection.db.stats();
    
    return {
      status: 'Connected',
      responseTime: `${responseTime}ms`,
      collections: dbStats.collections,
      dataSize: `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`,
      indexSize: `${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`,
      connectionState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    };
  } catch (error) {
    return {
      status: 'Disconnected',
      message: error.message,
      connectionState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    };
  }
};

// Measure API response time
const getAPIResponseTime = async () => {
  try {
    const startTime = Date.now();
    
    // Simulate API call by doing a quick database operation
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'Responsive',
      averageResponseTime: `${responseTime}ms`,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'Slow',
      message: error.message,
      lastCheck: new Date().toISOString()
    };
  }
};

// Calculate server uptime
const getUptime = () => {
  try {
    const currentTime = Date.now();
    const uptimeMs = currentTime - serverStartTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    // Calculate uptime percentage based on 24 hours (more practical)
    const totalSecondsIn24Hours = 24 * 60 * 60; // 86,400 seconds
    const uptimePercentage = Math.min((uptimeSeconds / totalSecondsIn24Hours) * 100, 100);

    // Format duration nicely
    let duration = '';
    if (uptimeDays > 0) {
      duration = `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`;
    } else if (uptimeHours > 0) {
      duration = `${uptimeHours}h ${uptimeMinutes % 60}m`;
    } else if (uptimeMinutes > 0) {
      duration = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
    } else {
      duration = `${uptimeSeconds}s`;
    }

    return {
      percentage: `${uptimePercentage.toFixed(1)}%`,
      duration: duration,
      startTime: new Date(serverStartTime).toISOString(),
      processUptime: `${Math.floor(process.uptime())}s`,
      totalSeconds: uptimeSeconds
    };
  } catch (error) {
    return {
      percentage: '0%',
      duration: '0s',
      error: error.message
    };
  }
};

// Get detailed system metrics
const getSystemMetrics = async (req, res) => {
  try {
    const metrics = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
        hostname: os.hostname()
      },
      database: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
};

module.exports = {
  getSystemHealth,
  getSystemMetrics
};
