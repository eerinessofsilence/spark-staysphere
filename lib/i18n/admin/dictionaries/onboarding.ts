import { defineArea } from './area';

/**
 * The guided hints a team member meets the first time they open the back
 * office (`components/admin/onboarding`), and the card on `/admin/account`
 * that plays them again. One entry per step, plus the controls around them.
 */
export const onboarding = defineArea({
  en: {
    'tour.title': 'Quick tour',
    'tour.step': 'Step {current} of {total}',
    'tour.back': 'Back',
    'tour.next': 'Next',
    'tour.done': 'Got it',
    'tour.skip': 'Skip',
    'tour.close': 'Close the tour',

    'tour.property.title': 'This property',
    'tour.property.body': 'Everything in here belongs to the hotel named above. Open it to switch between the properties you run.',
    'tour.nav.title': "The hotel's own screens",
    'tour.nav.body': 'Operations first — the desk, reservations, rates, what money came in — then the content guests actually see.',
    'tour.orbit.title': '360 Orbit',
    'tour.orbit.body': 'The building a guest turns on the arrival screen. Upload its frames, then draw the zones that open each room.',
    'tour.menu.title': 'Every screen',
    'tour.menu.body': 'The desk, reservations, rates and the site content all live behind this button.',
    'tour.bell.title': 'New reservations',
    'tour.bell.body': 'Every booking made on the site lands here, newest first, until you have looked at it.',
    'tour.assistant.title': 'Ask instead of clicking',
    'tour.assistant.body': 'Describe the change in your own words — a rate, a new room type, a whole booking. It shows you what would change before anything is written.',

    'tour.settingsTitle': 'Guided hints',
    'tour.settingsBody': 'Walk through the back office again, the way it opened the first time.',
    'tour.settingsButton': 'Show the hints',
  },
  de: {
    'tour.title': 'Kurze Tour',
    'tour.step': 'Schritt {current} von {total}',
    'tour.back': 'Zurück',
    'tour.next': 'Weiter',
    'tour.done': 'Alles klar',
    'tour.skip': 'Überspringen',
    'tour.close': 'Tour schließen',

    'tour.property.title': 'Dieses Hotel',
    'tour.property.body': 'Alles hier drin gehört zum oben genannten Hotel. Öffnen Sie es, um zwischen Ihren Häusern zu wechseln.',
    'tour.nav.title': 'Die Bildschirme des Hotels',
    'tour.nav.body': 'Zuerst der Betrieb – Rezeption, Reservierungen, Preise, eingegangene Zahlungen – danach die Inhalte, die Gäste sehen.',
    'tour.orbit.title': '360 Orbit',
    'tour.orbit.body': 'Das Gebäude, das ein Gast auf dem Startbildschirm dreht. Laden Sie die Frames hoch und zeichnen Sie die Zonen, die zu den Zimmern führen.',
    'tour.menu.title': 'Alle Bildschirme',
    'tour.menu.body': 'Rezeption, Reservierungen, Preise und die Inhalte der Website liegen hinter dieser Schaltfläche.',
    'tour.bell.title': 'Neue Reservierungen',
    'tour.bell.body': 'Jede Buchung von der Website landet hier, die neueste zuerst, bis Sie sie angesehen haben.',
    'tour.assistant.title': 'Fragen statt klicken',
    'tour.assistant.body': 'Beschreiben Sie die Änderung in eigenen Worten – einen Preis, einen neuen Zimmertyp, eine ganze Buchung. Sie sehen, was sich ändern würde, bevor etwas geschrieben wird.',

    'tour.settingsTitle': 'Geführte Hinweise',
    'tour.settingsBody': 'Gehen Sie noch einmal durch die Verwaltung, so wie beim ersten Öffnen.',
    'tour.settingsButton': 'Hinweise zeigen',
  },
  ru: {
    'tour.title': 'Короткий тур',
    'tour.step': 'Шаг {current} из {total}',
    'tour.back': 'Назад',
    'tour.next': 'Дальше',
    'tour.done': 'Понятно',
    'tour.skip': 'Пропустить',
    'tour.close': 'Закрыть тур',

    'tour.property.title': 'Этот отель',
    'tour.property.body': 'Всё здесь относится к отелю, названному выше. Откройте, чтобы переключиться между своими объектами.',
    'tour.nav.title': 'Экраны отеля',
    'tour.nav.body': 'Сначала операции — ресепшен, брони, тарифы, поступившие деньги, — потом контент, который видят гости.',
    'tour.orbit.title': '360 Orbit',
    'tour.orbit.body': 'Здание, которое гость крутит на первом экране. Загрузите кадры и обведите зоны, ведущие в номера.',
    'tour.menu.title': 'Все экраны',
    'tour.menu.body': 'Ресепшен, брони, тарифы и контент сайта — всё за этой кнопкой.',
    'tour.bell.title': 'Новые брони',
    'tour.bell.body': 'Каждая бронь с сайта попадает сюда, новые сверху, пока вы её не откроете.',
    'tour.assistant.title': 'Спросить вместо кликов',
    'tour.assistant.body': 'Опишите изменение своими словами — тариф, новый тип номера, целую бронь. Он покажет, что именно изменится, до того как что-то запишется.',

    'tour.settingsTitle': 'Подсказки по системе',
    'tour.settingsBody': 'Пройдите по админке ещё раз — так же, как при первом входе.',
    'tour.settingsButton': 'Показать подсказки',
  },
});
