import { describe, expect, it } from "vitest";
import { errorMessage, isAccountRefusal, isHubDecline, isHubTimeout, isPublicNodeRefusal } from "./hubErrors";

describe("Hub error shapes", () => {
  it("reads a message from strings, {error}, {message} and Errors", () => {
    expect(errorMessage("User declined to save file", "x")).toBe("User declined to save file");
    expect(errorMessage({ error: "Missing filename", message: "m" }, "x")).toBe("Missing filename");
    expect(errorMessage({ error: 1401, message: "Data unavailable" }, "x")).toBe("Data unavailable");
    expect(errorMessage(new Error("boom"), "x")).toBe("boom");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage("", "fallback")).toBe("fallback");
  });

  it("treats Hub's declines in its twelve languages, and Cancel, as a decline", () => {
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
    expect(isHubTimeout({ error: "timeout", message: "Request timed out after 30000 ms (action: GET_USER_ACCOUNT)" })).toBe(true);
    expect(isHubTimeout("User declined request")).toBe(false);
  });

  it("recognises Hub's public-node refusal in its twelve languages", () => {
    for (const msg of [
      "This action cannot be done through a public node",
      "Diese Aktion kann nicht über einen öffentlichen Node ausgeführt werden",
      "esta acción no se puede realizar a través de un nodo público",
      "seda toimingut ei saa avaliku haarde kaudu teha",
      "tätä toimenpidettä ei voi suorittaa julkisen solmun kautta",
      "cette action ne peut pas être effectuée via un nœud public",
      "questa azione non può essere eseguita tramite un nodo pubblico",
      "この操作はパブリックノードでは実行できません",
      "esta ação não pode ser realizada através de um nó público",
      "это действие невозможно через публичный узел",
      "此操作无法通过公共节点执行",
      "الحركة دي مش هتعمل على نود عام",
    ]) {
      expect(isPublicNodeRefusal(msg), msg).toBe(true);
    }
    expect(isPublicNodeRefusal("user declined to share list")).toBe(false);
    expect(isPublicNodeRefusal("failed to fetch the list")).toBe(false);
  });

  it("recognises Hub's one answer for a failed account request", () => {
    expect(isAccountRefusal({ error: "Unable to get user account", message: "Unable to get user account" })).toBe(true);
    expect(isAccountRefusal("unable to fetch user account")).toBe(true);
    expect(isAccountRefusal("The request timed out")).toBe(false);
  });
});
