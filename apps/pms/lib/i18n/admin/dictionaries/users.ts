import { defineArea } from "./area";

export const users = defineArea({
  en: {
    "team.createUser": "Create user",
    "team.createUserBody":
      "Create an active account with a name, email and role. In this demo, the user signs in with their email and the shared admin password. No invitation email is sent.",
    "team.userName": "Full name",
    "team.userNameRequired": "Enter a name of up to 120 characters.",
    "team.userCreated": "{name} has been created and can sign in.",
    "team.userCreating": "Creating user…",
    "team.userFailed": "Could not create the user. Please try again.",
  },
  de: {
    "team.createUser": "Benutzer erstellen",
    "team.createUserBody":
      "Erstellen Sie ein aktives Konto mit Name, E-Mail und Rolle. In dieser Demo meldet sich der Benutzer mit seiner E-Mail und dem gemeinsamen Admin-Passwort an. Es wird keine Einladung versendet.",
    "team.userName": "Vollständiger Name",
    "team.userNameRequired": "Geben Sie einen Namen mit bis zu 120 Zeichen ein.",
    "team.userCreated": "{name} wurde erstellt und kann sich anmelden.",
    "team.userCreating": "Benutzer wird erstellt…",
    "team.userFailed": "Benutzer konnte nicht erstellt werden. Bitte erneut versuchen.",
  },
  ru: {
    "team.createUser": "Создать пользователя",
    "team.createUserBody":
      "Создайте активную учётную запись с именем, email и ролью. В демо пользователь входит по своему email и общему паролю администратора. Приглашение по почте не отправляется.",
    "team.userName": "Полное имя",
    "team.userNameRequired": "Введите имя длиной до 120 символов.",
    "team.userCreated": "Пользователь {name} создан и может войти.",
    "team.userCreating": "Создаём пользователя…",
    "team.userFailed": "Не удалось создать пользователя. Попробуйте ещё раз.",
  },
});
