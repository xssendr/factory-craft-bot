import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { z } from 'zod';
import { Rcon } from "rcon-client";

@Injectable()
export class WhitelistService {
    private readonly logger = new Logger(WhitelistService.name);
    private bot: TelegramBot;
    private chatId: number;
    private readonly helperChatId = '2043879022'
    private readonly token = "7757888274:AAFsfe08YZC0gdL3pzO7TeHPhtMi7MWqtic";
    private state: 'waitingForNick' | 'waitingForSource' | 'waitingForPlans' | null = null;
    private nick: string;
    private source: string;
    private plans: string;

    constructor() {
        this.bot = new TelegramBot(this.token, { polling: true });
        this.initializeBot();
    }

    private initializeBot() {
        this.bot.onText(/\/start/, (msg) => {
            this.chatId = msg.chat.id;
            this.state = 'waitingForNick';
            this.bot.sendMessage(this.chatId, 'Введите ваш ник для вайтлиста:');
        });

        this.bot.on('message', (msg) => {
            if (msg.chat.id !== this.chatId || this.state === null) return;

            switch (this.state) {
                case 'waitingForNick':
                    this.handleNick(msg.text);
                    break;
                case 'waitingForSource':
                    this.handleSource(msg.text);
                    break;
                case 'waitingForPlans':
                    this.handlePlans(msg.text);
                    break;
            }
        });
    }

    private handleNick(nick: string) {
        const validationResult = this.validateNick(nick);
        if (validationResult) {
            this.nick = nick;
            this.state = 'waitingForSource';
            this.whitelistNick(nick)
            this.bot.sendMessage(this.chatId, 'Откуда вы узнали о сервере?');
        } else return
    }

    private handleSource(source: string) {
        this.source = source;
        this.state = 'waitingForPlans';
        this.bot.sendMessage(this.chatId, 'Каковы ваши планы на сервере?');
    }

    private handlePlans(plans: string) {
        this.plans = plans;
        this.bot.sendMessage(this.chatId, 'Анкета отправлена');
        this.sendSurvey({ nick: this.nick, source: this.source, plans: this.plans });
        this.resetState();
    }

    private validateNick(nick: string): boolean {
        const nickSchema = z.string()
    .min(3, { message: 'Ник должен содержать минимум 3 символа' })
    .max(16, { message: 'Ник должен содержать максимум 16 символов' })
    .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/, { message: 'Ник должен начинаться с латинской буквы и содержать только буквы, цифры, _ или -' })
        
        try {
            nickSchema.parse(nick);
            return true;
        } catch (error) {
            const errorMessage = error.errors[0]?.message || 'Ошибка валидации';
            this.bot.sendMessage(this.chatId, `Не удалось добавить ник: ${errorMessage}`);
            return false;
        }
    }

    private async whitelistNick(nick: string) {
        const rcon = new Rcon({
            host: 'YOUR_RCON_HOST',
            port: 4200,
            password: 'YOUR_RCON_PASSWORD',
        });
        await rcon.connect();
        try {
            await rcon.send(`whitelist add ${nick}`);
            this.bot.sendMessage(this.chatId, `Игрок ${nick} был добавлен в вайтлист!`);
        } catch (error) {
            this.logger.error(`Ошибка при добавлении ника: ${error}`);
            this.bot.sendMessage(this.chatId, `Не удалось добавить игрока ${nick} в вайтлист.`);
        } finally {
            await rcon.end();
        }
    }

    private async sendSurvey(surveyData: { nick: string, source: string, plans: string }) {
        const message = `
Ник: ${surveyData.nick}
Откуда узнал о сервере: ${surveyData.source}
Планы: ${surveyData.plans}
        `;
        await this.bot.sendMessage(this.helperChatId, message);
    }

    private resetState() {
        this.state = null;
        this.nick = '';
        this.source = '';
        this.plans = '';
    }
}