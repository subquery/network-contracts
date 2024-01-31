import { Logger } from '@subql/utils';
import Pino from 'pino';

/* eslint-disable no-unused-vars */
export enum TextColor {
    RED = 31,
    GREEN,
    YELLOW,
    BLUE,
    MAGENTA,
    CYAN,
}

export function colorText(text: string, color = TextColor.CYAN): string {
    return `\u001b[${color}m${text}\u001b[39m`;
}

const logger = new Logger({ level: 'info', outputFormat: 'colored', nestedKey: 'payload' });

export function getLogger(category: string): Pino.Logger {
    return logger.getLogger(category);
}
