/**
 * Block Popup - Configuration Module
 * Конфигурация и основные переменные
 */

// Функция для условного вывода в консоль
function debugLog(...args) {
  if (window.BlockPopup && window.BlockPopup.debugMode) {
    console.log('[Block Popup]', ...args);
  }
}

// Обновление значка расширения с количеством заблокированных попапов
function updateBadge() {
  try {
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      count: window.BlockPopup.blockedCount
    }).catch(() => {
      // Игнорируем ошибки если background script недоступен
    });
  } catch (error) {
    // Игнорируем ошибки
  }
}

// Загрузка правил блокировки из настроек
function loadSiteRules() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['sitePopupRules'], (result) => {
      if (result.sitePopupRules) {
        resolve(result.sitePopupRules);
      } else {
        // Пустой список правил по умолчанию
        resolve({});
      }
    });
  });
}

// Загрузка настроек дебага
function loadDebugMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['debugMode'], (result) => {
      resolve(result.debugMode || false);
    });
  });
}

// Проверка, нужно ли активировать блокировку для текущего сайта
function shouldActivateForSite(hostname) {
  return window.BlockPopup.sitePopupRules.hasOwnProperty(hostname) && 
         window.BlockPopup.sitePopupRules[hostname].enabled;
}

// Установка CSS для временного скрытия элементов
function setupTemporaryHidingCSS() {
  const style = document.createElement('style');
  style.id = 'popup-blocker-temp-css';
  style.textContent = `
    .popup-blocker-analyzing {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: none !important;
      display: none !important;
    }
    .popup-blocker-detected::after {
      content: "🚫 Блокировать";
      position: absolute;
      top: 10px;
      right: 10px;
      background: #d93025;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid #fff;
    }
    .popup-blocker-detected::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid #d93025;
      border-radius: 4px;
      z-index: 999998;
      pointer-events: none;
      animation: popup-blocker-pulse 2s infinite;
    }
    @keyframes popup-blocker-pulse {
      0% { border-color: #d93025; }
      50% { border-color: #ff6b6b; }
      100% { border-color: #d93025; }
    }
    
    /* Стили для диалога выбора правил */
    .popup-blocker-rule-dialog {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      width: 300px;
      max-width: 90vw;
      z-index: 2147483647; /* Максимальный z-index */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 14px;
      color: #333;
    }
    
    .rule-dialog-header {
      font-weight: bold;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e1e4e8;
    }
    
    .rule-variants-list {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 12px;
    }
    
    .rule-variant-item {
      padding: 8px;
      margin-bottom: 8px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .rule-variant-item.high-priority {
      background-color: #e8f5e8;
      border-left: 3px solid #2e7d32;
    }
    
    .rule-variant-item.medium-priority {
      background-color: #e8f0fe;
      border-left: 3px solid #1a73e8;
    }
    
    .rule-variant-item.low-priority {
      background-color: #f8f9fa;
      border-left: 3px solid #5f6368;
    }
    
    .variant-description {
      flex-grow: 1;
      font-size: 13px;
    }
    
    .select-variant-btn {
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .select-variant-btn:hover {
      background-color: #3367d6;
    }
    
    .close-dialog-btn {
      background-color: #f1f3f4;
      color: #5f6368;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
    }
    
    .close-dialog-btn:hover {
      background-color: #e8eaed;
    }
  `;
  document.head.appendChild(style);
}

// Функция инициализации модуля
export function initConfig(BlockPopup) {
  console.log('[Block Popup] Инициализация Config модуля');
  
  // Добавляем функции к объекту BlockPopup
  BlockPopup.debugLog = debugLog;
  BlockPopup.updateBadge = updateBadge;
  BlockPopup.loadSiteRules = loadSiteRules;
  BlockPopup.loadDebugMode = loadDebugMode;
  BlockPopup.shouldActivateForSite = shouldActivateForSite;
  BlockPopup.setupTemporaryHidingCSS = setupTemporaryHidingCSS;
  
  console.log('[Block Popup] Config модуль инициализирован');
}

// Экспорт функций для использования в других модулях
export {
  debugLog,
  updateBadge,
  loadSiteRules,
  loadDebugMode,
  shouldActivateForSite,
  setupTemporaryHidingCSS
};

console.log('[Block Popup] Config ES6 module loaded');
