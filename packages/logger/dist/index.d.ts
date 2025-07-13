/**
 * Winston 日志实例，统一在前端 Node 侧使用。
 *
 * 日志等级： error < warn < info < http < verbose < debug < silly
 * dev 环境输出到控制台，prod 环境输出到文件。
 */
declare const logger: import("winston").Logger;
export default logger;
