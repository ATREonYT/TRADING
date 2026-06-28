import { log } from "./logger.js";

const API = "https://api.telegram.org";

interface TgMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string };
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export type CommandHandler = (args: string[], chatId: number) => Promise<string | void> | string | void;

export type InlineButton = { text: string; url: string };

/** Thin Telegram Bot API client: send messages + long-poll for commands. */
export class TelegramBot {
  private offset = 0;
  private polling = false;
  private handlers = new Map<string, CommandHandler>();

  constructor(private token: string, private defaultChatId: string) {}

  private url(method: string) {
    return `${API}/bot${this.token}/${method}`;
  }

  async send(
    text: string,
    chatId: string | number = this.defaultChatId,
    buttons?: InlineButton[][],
  ): Promise<void> {
    if (!this.token || !chatId) {
      log.warn("Telegram not configured — message suppressed:\n" + text);
      return;
    }
    try {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      if (buttons?.length) {
        body.reply_markup = { inline_keyboard: buttons };
      }
      const res = await fetch(this.url("sendMessage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.text();
        log.warn(`sendMessage ${res.status}: ${body}`);
      }
    } catch (err) {
      log.warn("sendMessage failed:", (err as Error).message);
    }
  }

  on(command: string, handler: CommandHandler): this {
    this.handlers.set(command.toLowerCase(), handler);
    return this;
  }

  /** Verify token and return the bot username. */
  async getMe(): Promise<string | null> {
    try {
      const res = await fetch(this.url("getMe"));
      const data = (await res.json()) as { ok: boolean; result?: { username: string } };
      return data.ok && data.result ? data.result.username : null;
    } catch {
      return null;
    }
  }

  /** Long-poll for updates and dispatch slash commands. Resolves never (until stop()). */
  async startPolling(): Promise<void> {
    if (!this.token) {
      log.warn("No TELEGRAM_BOT_TOKEN — command polling disabled (alerts-only mode).");
      return;
    }
    this.polling = true;
    log.ok("Telegram command polling started.");
    while (this.polling) {
      try {
        const res = await fetch(this.url("getUpdates") + `?timeout=30&offset=${this.offset}`);
        const data = (await res.json()) as { ok: boolean; result?: TgUpdate[] };
        if (!data.ok || !data.result) continue;
        for (const u of data.result) {
          this.offset = u.update_id + 1;
          await this.dispatch(u);
        }
      } catch (err) {
        log.warn("getUpdates failed (retrying):", (err as Error).message);
        await sleep(3000);
      }
    }
  }

  stop() {
    this.polling = false;
  }

  private async dispatch(u: TgUpdate): Promise<void> {
    const msg = u.message;
    if (!msg?.text) return;
    const text = msg.text.trim();
    if (!text.startsWith("/")) return;
    // "/set@MyBot key val" -> cmd "set", args ["key","val"]
    const [rawCmd, ...args] = text.slice(1).split(/\s+/);
    const cmd = rawCmd!.split("@")[0]!.toLowerCase();
    const handler = this.handlers.get(cmd);
    if (!handler) {
      await this.send(`Unknown command /${cmd}. Try /help`, msg.chat.id);
      return;
    }
    try {
      const reply = await handler(args, msg.chat.id);
      if (reply) await this.send(reply, msg.chat.id);
    } catch (err) {
      await this.send(`Error: ${(err as Error).message}`, msg.chat.id);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
