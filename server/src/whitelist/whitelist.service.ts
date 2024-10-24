import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Rcon } from 'rcon-client';

@Injectable()
export class WhitelistService {
  private readonly logger = new Logger(WhitelistService.name);
  private bot: TelegramBot;
  private chatId: number;
  private readonly helperChatId = process.env.HELPER_CHAT_ID;
  private readonly token = process.env.TOKEN;
  private state:
    | 'waitingForNick'
    | 'waitingForSource'
    | 'waitingForPlans'
    | null = null;
  private nick: string;
  private source: string;
  private plans: string;
  // private prisma = new PrismaClient();

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

    this.bot.on('callback_query', (callback) => {
      if (callback.message.chat.id !== this.chatId || this.state === null) return;

      switch (this.state) {
        case 'waitingForSource':
          this.handleSource(callback.data);
          break;
      }
    })
  }

  private async handleNick(nick: string) {
    const validationResult = this.validateNick(nick);
    if (validationResult) {
      this.nick = nick;
      this.state = 'waitingForSource';
      // this.whitelistNick(nick);
      await this.bot.sendMessage(this.chatId, 'Откуда вы узнали о сервере?(выберите из предоставленных вариантов или напишите свой)', {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Телеграмм', callback_data:'Телеграмм'}, {text: 'Ютуб', callback_data: 'Ютуб'}],
            [{text: 'Сайт', callback_data: 'Сайт'}, {text: 'Промоутеры', callback_data: 'Промоутеры'}]
          ]
        }
      });
    } else return;
  }

  private async handleSource(source: string) {
    this.source = source;
    this.state = 'waitingForPlans';
    await this.bot.sendMessage(this.chatId, 'Каковы ваши планы на сервере?');
  }

  private async handlePlans(plans: string) {
    this.plans = plans;
    await this.bot.sendMessage(this.chatId, 'Анкета отправлена');
    this.sendSurvey({
      nick: this.nick,
      source: this.source,
      plans: this.plans,
    });
    this.resetState();
  }

  /* private async saveToDatabase(surveyData: {
    nick: string;
    source: string;
    plans: string;
  }) {
    try {
      const existingEntry = await this.prisma.whitelistEntry.findUnique({
        where: {
          chatId: this.chatId, // Предполагается что chatId добавлен в вашу модель
        },
      });

      if (existingEntry) {
        this.bot.sendMessage(this.chatId, 'Вы уже отправили анкету');
        return; // Прекратите выполнение, если запись уже существует
      }

      // Если записи нет, создайте новую запись
      await this.prisma.whitelistEntry.create({
        data: {
          chatId: this.chatId, // Добавьте chatId в ваши данные
          ...surveyData,
        },
      });

      this.logger.log(`Данные для ника ${surveyData.nick} успешно сохранены.`);
    } catch (error) {
      this.logger.error(`Ошибка при сохранении данных: ${error}`);
      this.bot.sendMessage(this.chatId, 'Не удалось сохранить данные.');
    }
  } */

  private async validateNick(nick: string): Promise<boolean> {
    const nickSchema = z
      .string()
      .min(3, { message: 'Ник должен содержать минимум 3 символа' })
      .max(16, { message: 'Ник должен содержать максимум 16 символов' })
      .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/, {
        message:
          'Ник должен начинаться с латинской буквы и содержать только буквы, цифры, _ или -',
      });

    try {
      nickSchema.parse(nick);
      return true;
    } catch (error) {
      const errorMessage = error.errors[0]?.message || 'Ошибка валидации';
      await this.bot.sendMessage(
        this.chatId,
        `Не удалось добавить ник: ${errorMessage}`,
      );
      return false;
    }
  }

    private async whitelistNick(nick: string) {
    const rcon = new Rcon({
      host: process.env.RCON_HOST,
      port: process.env.RCON_PORT,
      password: process.env.RCON_PASSWORD,
    });
    await rcon.connect();
    try {
      await rcon.send(`whitelist add ${nick}`);
      await this.bot.sendMessage(this.helperChatId, process.env.RCON_PASSWORD)
      await this.bot.sendMessage(this.chatId, `${nick} был добавлен в вайтлист!`);
    } catch (error) {
      this.logger.error(`Ошибка при добавлении ника: ${error}`);
      await this.bot.sendMessage(
        this.chatId,
        `Не удалось добавить ${nick} в вайтлист`);
      await this.bot.stopPolling()
    } finally {
      await rcon.end();
    }
  }
  private async sendSurvey(surveyData: {
    nick: string;
    source: string;
    plans: string;
  }) {
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
