import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { InlineKeyboard } from "grammy";

export const description = "Show TODOs or forward /todo instructions to the agent";

const PAGE_SIZE = 3;

function getTodosPath(projectCtx) {
  return join(projectCtx.config.cwd, "TODOS.md");
}

function parseTodos(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^- \[([ xX])\] (.+)$/))
    .filter(Boolean)
    .map((match) => ({
      done: match[1].toLowerCase() === "x",
      text: match[2],
    }));
}

function renderPage(todos, page) {
  const totalPages = Math.max(1, Math.ceil(todos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = todos.slice(start, start + PAGE_SIZE);

  const lines = [`TODOs (${safePage + 1}/${totalPages})`, ""];

  if (visible.length === 0) {
    lines.push("No TODOs yet.");
    lines.push("");
    lines.push("Send /todo <instruction> to add the first entry.");
  } else {
    visible.forEach((todo, index) => {
      const absoluteIndex = start + index + 1;
      lines.push(`${absoluteIndex}. [${todo.done ? "x" : " "}] ${todo.text}`);
    });
  }

  return {
    page: safePage,
    totalPages,
    text: lines.join("\n"),
  };
}

function buildKeyboard(page, totalPages) {
  const keyboard = new InlineKeyboard();

  if (page > 0) {
    keyboard.text("Prev", `todo:page:${page - 1}`);
  }

  if (page < totalPages - 1) {
    keyboard.text("Next", `todo:page:${page + 1}`);
  }

  return keyboard;
}

function getReplyMarkup(page, totalPages) {
  if (totalPages <= 1) {
    return undefined;
  }
  return buildKeyboard(page, totalPages);
}

async function loadTodos(projectCtx) {
  try {
    const content = await readFile(getTodosPath(projectCtx), "utf8");
    return parseTodos(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function callbackHandler({ data, gram, projectCtx }) {
  const match = data.match(/^todo:page:(\d+)$/);
  if (!match) {
    await gram.answerCallbackQuery({ text: "Unknown TODO action." });
    return;
  }

  const todos = await loadTodos(projectCtx);
  const page = Number.parseInt(match[1], 10);
  const view = renderPage(todos, page);

  try {
    await gram.api.editMessageText(
      gram.chat.id,
      gram.callbackQuery.message.message_id,
      view.text,
      {
        reply_markup: getReplyMarkup(view.page, view.totalPages),
      },
    );
    await gram.answerCallbackQuery();
  } catch {
    await gram.answerCallbackQuery({ text: "Could not update the TODO list." });
  }
}

export default async function todoCommand({ args, gram, projectCtx }) {
  if (args.length > 0) {
    return { type: "agent" };
  }

  const todos = await loadTodos(projectCtx);
  const view = renderPage(todos, 0);

  await gram.reply(view.text, {
    reply_markup: getReplyMarkup(view.page, view.totalPages),
  });

  return { type: "void" };
}
