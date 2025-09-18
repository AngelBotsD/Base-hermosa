// Plugin: main-menu.js
// Descripción: Menú principal del bot

const mainMenu = (prefix) => {
  return `
  ┌───「 📌 Menú Principal 」
  │
  │ ➤ ${prefix}help
  │ ➤ ${prefix}about
  │ ➤ ${prefix}ping
  │
  └───────────────
  `;
};

export default mainMenu;
