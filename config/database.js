import mongoose from 'mongoose';
import { config } from './config.js';
import logger from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  /**
   * 连接MongoDB数据库
   */
  async connect() {
    try {
      // 设置Mongoose配置
      mongoose.set('strictQuery', false);
      
      // 连接选项
      const options = {
        maxPoolSize: 10, // 连接池最大连接数
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        bufferMaxEntries: 0, // 禁用缓冲
        bufferCommands: false, // 禁用命令缓冲
      };

      // 建立连接
      this.connection = await mongoose.connect(config.mongodb.uri, options);
      this.isConnected = true;

      logger.info('MongoDB连接成功', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        database: this.connection.connection.name
      });

      // 监听连接事件
      this.setupEventListeners();

    } catch (error) {
      logger.error('MongoDB连接失败:', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB连接已建立');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB连接错误:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB连接已断开');
      this.isConnected = false;
    });

    // 应用终止时关闭连接
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * 断开数据库连接
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB连接已关闭');
    } catch (error) {
      logger.error('关闭MongoDB连接失败:', error);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

export default new DatabaseConnection();