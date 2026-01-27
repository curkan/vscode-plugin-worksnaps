# Worksnaps Time Tracker для VSCode

[Русский](README.md) | [English](README_EN.md)

![Worksnaps VSCode](misc/vscode-worksnaps.png)

---

![VSCode](https://img.shields.io/badge/VSCode-1.74+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)

Отображайте статистику отслеживания времени Worksnaps прямо в строке состояния VSCode.

## Возможности

- 📊 Отображение отработанных часов за сегодня в реальном времени
- 🎯 Процент активности с цветовым кодированием (зеленый ≥80%, желтый 60-79%, красный <60%)
- ⏱️ Оставшееся время до целевого количества часов (настраивается, по умолчанию: 8 часов)
- 🔄 Автоматическое обновление каждые 60 секунд (настраивается)
- 💾 Кэширование для надежности при недоступности API
- ⚙️ Полностью настраиваемый формат отображения
- 🖱️ Клик на виджет для ручного обновления

## Пример отображения

Строка состояния показывает: `WS: 9:30 ↓ -3:10 | ✓ 87%`

Где:
- `9:30` = отработано часов сегодня (часы:минуты, округлено до 10-минутных интервалов)
- `-3:10` = осталось работать 3 часа 10 минут
- `✓ 87%` = процент активности (✓ для ≥80%, ⚠ для 60-79%, ✗ для <60%)

## Требования

- VSCode 1.74 или новее
- Активный аккаунт Worksnaps с доступом к API
- Node.js 18 или новее (только для разработки расширения)

## Установка

### Ручная установка из VSIX

1. Скачайте последний релиз `.vsix` из [Releases](https://github.com/curkan/vscode-plugin-worksnaps/releases)
2. Откройте VSCode
3. Перейдите в **Extensions** (Ctrl+Shift+X / Cmd+Shift+X)
4. Нажмите на меню `...` (три точки) в правом верхнем углу
5. Выберите **Install from VSIX...**
6. Выберите скачанный `.vsix` файл

### Сборка из исходников

```bash
# Клонируйте репозиторий
git clone https://github.com/curkan/vscode-plugin-worksnaps.git
cd vscode-plugin-worksnaps

# Установите зависимости
npm install

# Скомпилируйте расширение
npm run compile

# Создайте VSIX пакет (опционально)
npm install -g @vscode/vsce
vsce package
```

## Настройка

### 1. Получите ваш API токен

1. Войдите в ваш аккаунт Worksnaps
2. Перейдите в **Profile & Settings → Web Service API**
3. Нажмите "Show my API Token"
4. Скопируйте токен

### 2. Получите ID проекта

Вы можете найти ID проекта двумя способами:

**Вариант A: Из URL**
- Откройте ваш проект в веб-интерфейсе Worksnaps
- ID проекта находится в URL: `https://app.worksnaps.com/projects/YOUR_PROJECT_ID`

**Вариант B: Через API**
```bash
curl -u "YOUR_API_TOKEN:" https://api.worksnaps.com/api/projects.xml
```

### 3. Настройте расширение

1. Откройте VSCode
2. Перейдите в **Settings** (Ctrl+, / Cmd+,)
3. Найдите "Worksnaps" или перейдите в **Extensions → Worksnaps Time Tracker**
4. Введите вашу конфигурацию:
   - **Api Token** (обязательно): Ваш Worksnaps API токен
   - **Project Id** (обязательно): ID вашего Worksnaps проекта
   - **User Id** (опционально): Оставьте пустым для автоопределения
   - **Update Interval**: Как часто обновлять данные (по умолчанию: 60 секунд)
   - **Target Hours**: Ваша дневная цель работы (по умолчанию: 8 часов)
   - **Display Options**: Выберите что показывать в строке состояния

**Альтернатива**: Используйте команду **Worksnaps: Open Settings** через Command Palette (Ctrl+Shift+P / Cmd+Shift+P)

## Использование

После настройки расширение автоматически отобразит вашу статистику Worksnaps в строке состояния VSCode (справа внизу).

### Отображение в строке состояния

Виджет показывает:
- Префикс (настраивается, по умолчанию: "WS:")
- Отработанное время (если включено)
- Оставшееся время со стрелкой (если включено)
- Процент активности с иконкой (если включено)
- Индикатор предупреждения (⚠) если используются кэшированные данные из-за ошибки API

### Действия по клику

Нажмите на виджет в строке состояния для ручного обновления данных.

### Команды

Доступны через Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

- **Worksnaps: Refresh Data** - Ручное обновление данных
- **Worksnaps: Open Settings** - Открыть настройки Worksnaps

### Состояния отображения

- `WS: N/A` - API токен или Project ID не настроены
- `WS: Loading...` - Загрузка данных из API
- `WS: 4:50 ↓ -3:10 | ⚠ 78%` - Обычное отображение
- `WS: 8:30 ↑ +0:30 | ✓ 85%` - Переработка (30 минут сверх цели)
- `WS: 4:50 ↓ -3:10 | ⚠ 78% $(warning)` - Используются кэшированные данные из-за ошибки API
- `WS: $(warning) Error` - Ошибка API и нет кэшированных данных

## Справочник настроек

| Настройка | По умолчанию | Описание |
|-----------|--------------|----------|
| `worksnaps.apiToken` | (пусто) | Ваш Worksnaps API токен (обязательно) |
| `worksnaps.projectId` | (пусто) | ID вашего Worksnaps проекта (обязательно) |
| `worksnaps.userId` | (пусто) | Ваш ID пользователя (опционально, автоопределяется если пусто) |
| `worksnaps.updateInterval` | 60 | Интервал обновления в секундах (30-600) |
| `worksnaps.targetHours` | 8 | Дневная цель работы в часах (1-24) |
| `worksnaps.prefix` | "WS:" | Текст перед статистикой |
| `worksnaps.showTime` | true | Показывать отработанные часы |
| `worksnaps.showActivity` | true | Показывать процент активности |
| `worksnaps.showRemaining` | true | Показывать оставшееся время до цели |

### Редактирование через settings.json

Вы можете настроить расширение напрямую в `settings.json`:

```json
{
  "worksnaps.apiToken": "your_api_token_here",
  "worksnaps.projectId": "your_project_id",
  "worksnaps.userId": "",
  "worksnaps.updateInterval": 60,
  "worksnaps.targetHours": 8,
  "worksnaps.showTime": true,
  "worksnaps.showActivity": true,
  "worksnaps.showRemaining": true,
  "worksnaps.prefix": "WS:"
}
```

## Решение проблем

### Виджет показывает "WS: N/A"

**Решение**: Настройте ваш API токен и project ID в **Settings → Extensions → Worksnaps**

### Виджет показывает "WS: $(warning) Error"

Возможные причины:
- Неверный API токен
- Неверный project ID
- Нет подключения к интернету
- Worksnaps API недоступен

**Решение**:
1. Проверьте правильность вашего API токена
2. Проверьте правильность вашего project ID
3. Проверьте интернет-соединение
4. Проверьте API вручную:
   ```bash
   curl -u "YOUR_TOKEN:" https://api.worksnaps.com/api/projects.xml
   ```
5. Откройте Developer Console (Help → Toggle Developer Tools) и проверьте логи

### Данные не обновляются

**Решение**:
1. Кликните на виджет для ручного обновления
2. Используйте команду **Worksnaps: Refresh Data**
3. Проверьте интервал обновления в настройках
4. Перезагрузите VSCode

### Неправильный процент активности

**Примечание**: Worksnaps рассчитывает активность на основе использования клавиатуры и мыши. Расширение показывает среднюю активность по всем 10-минутным записям времени за сегодня.

### Расширение не отображается

**Решение**:
1. Убедитесь, что расширение установлено и включено в **Extensions**
2. Проверьте, что строка состояния видима (View → Appearance → Status Bar)
3. Перезагрузите VSCode

## Как это работает

1. Расширение загружает записи времени из Worksnaps API за текущий день
2. Рассчитывает общее количество отработанных часов и средний процент активности
3. Результаты кэшируются на 60 секунд
4. Если API недоступен, используются кэшированные данные с индикатором предупреждения
5. Строка состояния обновляется автоматически на основе настроенного интервала
6. При изменении настроек данные обновляются автоматически

## Использование API

- **Endpoint**: `https://api.worksnaps.com/api/projects/{project_id}/time_entries.xml`
- **Аутентификация**: HTTP Basic Auth (API токен как имя пользователя, пустой пароль)
- **Ограничение частоты**: Расширение использует кэширование для минимизации запросов к API
- **Формат данных**: XML (парсится с помощью regex)
- **HTTP клиент**: axios

## Конфиденциальность и безопасность

- Ваш API токен хранится в настройках VSCode
- Расширение читает только данные записей времени для вашего настроенного проекта
- Никакие данные не отправляются третьим лицам
- Вся коммуникация с API происходит через HTTPS
- Исходный код открыт и доступен для проверки

## Разработка

### Настройка окружения

```bash
# Клонируйте репозиторий
git clone https://github.com/curkan/vscode-plugin-worksnaps.git
cd vscode-plugin-worksnaps

# Установите зависимости
npm install

# Запустите компиляцию в режиме watch
npm run watch
```

### Запуск в режиме разработки

1. Откройте проект в VSCode
2. Нажмите `F5` или используйте **Run → Start Debugging**
3. Откроется новое окно VSCode с установленным расширением
4. Протестируйте функциональность

### Структура проекта

```
vscode-plugin-worksnaps/
├── src/
│   ├── api/
│   │   └── worksnapsApiClient.ts    # API клиент для Worksnaps
│   ├── service/
│   │   └── worksnapsService.ts      # Сервис с кэшированием и авто-обновлением
│   ├── ui/
│   │   └── statusBarItem.ts         # Виджет строки состояния
│   └── extension.ts                 # Точка входа расширения
├── out/                              # Скомпилированные файлы
├── .vscode/
│   ├── launch.json                  # Конфигурация отладки
│   └── tasks.json                   # Задачи сборки
├── package.json                     # Манифест расширения
├── tsconfig.json                    # Конфигурация TypeScript
└── README.md                        # Документация
```

### Сборка

```bash
# Компиляция
npm run compile

# Компиляция в режиме watch
npm run watch

# Линтинг
npm run lint

# Создание VSIX пакета
vsce package
```

### Отладка

1. Установите точки останова в коде
2. Нажмите `F5` для запуска в режиме отладки
3. В новом окне VSCode используйте расширение
4. Логи доступны в Debug Console исходного окна VSCode

## Участие в разработке

Вклады приветствуются! Не стесняйтесь отправлять Pull Request.

1. Форкните репозиторий
2. Создайте ветку для вашей функции (`git checkout -b feature/amazing-feature`)
3. Закоммитьте ваши изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## Связанные проекты

- [phpstorm-plugin-worksnaps](https://github.com/curkan/phpstorm-plugin-worksnaps) - Плагин Worksnaps для PhpStorm
- [tmux-plugin-worksnaps](https://github.com/curkan/tmux-plugin-worksnaps) - Плагин Worksnaps для tmux

## Лицензия

Лицензия MIT - см. файл [LICENSE](LICENSE) для деталей

## Благодарности

- Вдохновлен [phpstorm-plugin-worksnaps](https://github.com/curkan/phpstorm-plugin-worksnaps)
- Создан с помощью [VSCode Extension API](https://code.visualstudio.com/api)

## Поддержка

Если вы столкнулись с проблемами, сообщите о них на GitHub:
https://github.com/curkan/vscode-plugin-worksnaps/issues

## История изменений

### 1.0.0 (Первый релиз) - 2026-01-27

- ✨ Отображение отработанных часов в строке состояния
- 🎯 Показ процента активности с цветовым кодированием
- ⏱️ Показ оставшегося времени до цели
- ⚙️ Настраиваемые параметры через VSCode Settings
- 🔄 Авто-обновление с кэшированием
- 🖱️ Клик для ручного обновления
- 📋 Команды через Command Palette
- 🌍 Поддержка русского и английского языков

---

**Приятной работы! 🚀**
