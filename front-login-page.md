Login page UI elements (current state)

- Header block
  - Product tag: “VLESS + TINC MESH”
  - Title: “ВХОД И ЗАЯВКИ НА ДОСТУП”
  - Subtitle/description: one paragraph explaining access via mesh-IP and the request flow
  - Beta badge (pill with glow)

- Left column: “Вход”
  - Section title: “Вход”
  - Helper text: “Для уже зарегистрированных пользователей mesh.”
  - Input: “Почта или логин” (text field, accepts login/email)
  - Input: “Пароль / токен” (password field)
  - Primary button: “Войти”
  - Helper text under button: “Нет доступа? Оставьте заявку справа.”
  - Status line (appears after submit): success/error message

- Right column: “Заявка на регистрацию”
  - Section title: “Заявка на регистрацию”
  - Helper text: краткое описание, что заявка увидится и подтвердится админом
  - Input: “Почта”
  - Textarea: “Комментарий”
  - Primary button: “Отправить заявку”

- Background / layout
  - Two cards/columns aligned under the header
  - Gradient background with radial glows
  - Page-level container with padding/margins around header and cards

- State hints (dynamic)
  - Success/error text under login form
  - (Optional) error text under request form on failure
