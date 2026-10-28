import { describe, expect, it } from "vitest";
import { errorMessage, isHubDecline, isHubTimeout } from "./hubErrors";

describe("Hub error shapes", () => {
  it("reads a message from strings, {error}, {message} and Errors", () => {
    expect(errorMessage("User declined to save file", "x")).toBe("User declined to save file");
    expect(errorMessage({ error: "Missing filename", message: "m" }, "x")).toBe("Missing filename");
    expect(errorMessage({ error: 1401, message: "Data unavailable" }, "x")).toBe("Data unavailable");
    expect(errorMessage(new Error("boom"), "x")).toBe("boom");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage("", "fallback")).toBe("fallback");
  });

  it("treats Hub's declines in its languages, and Cancel, as a decline", () => {
    for (const msg of [
      "User declined to save file",
      "user declined request",
      "Benutzer hat die Anfrage abgelehnt",
      "el usuario rechazó la solicitud",
      "l'utilisateur a refusé la requête",
      "пользователь отклонил запрос",
      "ユーザーがリクエストを拒否しました",
      "用户拒绝请求",
      "käyttäjä kieltäytyi pyynnöstä",
      "kasutaja keeldus taotlusest",
      "l'utente ha rifiutato la richiesta",
      "o usuário recusou a solicitação",
      "المستخدم رفض الطلب",
    ]) {
      expect(isHubDecline(msg), msg).toBe(true);
      expect(isHubDecline({ error: msg, message: msg }), msg).toBe(true);
    }
    expect(isHubDecline({ error: { cancelled: true }, message: "" })).toBe(true);
  });

  it("does not call real failures a decline", () => {
    expect(isHubDecline("The request timed out")).toBe(false);
    expect(isHubDecline({ error: 1401, message: "Data unavailable. Please try again later." })).toBe(false);
    expect(isHubDecline(new Error("Missing filename"))).toBe(false);
    expect(isHubDecline(null)).toBe(false);
  });

  it("recognises both timeout messages", () => {
    expect(isHubTimeout("The request timed out")).toBe(true);
    expect(isHubTimeout({ error: "Request timed out after 30000 ms (action: ADD_LIST_ITEMS)" })).toBe(true);
    expect(isHubTimeout("User declined request")).toBe(false);
  });
});
