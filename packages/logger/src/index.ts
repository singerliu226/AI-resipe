import { createLogger, format, transports } from "winston";

/**
 * Winston 日志实例，统一在前端 Node 侧使用。
 *
 * 日志等级： error < warn < info < http < verbose < debug < silly
 * dev 环境输出到控制台，prod 环境输出到文件。
 */
const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf((info: any) => {
      const { level, message, timestamp } = info as {
        level: string;
        message: string;
        timestamp: string;
      };
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new transports.Console()],
});

export default logger; 