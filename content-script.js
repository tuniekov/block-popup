/**
 * Block Popup - Content Script
 * Умная блокировка попапов на основе правил для конкретных сайтов
 */

// Инициализация базового объекта BlockPopup
window.BlockPopup = window.BlockPopup || {};

// Базовые переменные
window.BlockPopup.sitePopupRules = {};
window.BlockPopup.currentHost = window.location.hostname;
window.BlockPopup.popupObserver = null;
window.BlockPopup.isDetectionMode = false;
window.BlockPopup.detectedPopups = new Set();
window.BlockPopup.blockedElements = new Set();
window.BlockPopup.processedElements = new Set();
window.BlockPopup.isInitialized = false;
window.BlockPopup.blockedCount = 0;
window.BlockPopup.debugMode = false;

console.log('[Block Popup] Базовый объект window.BlockPopup создан:', !!window.BlockPopup);

// Функция для динамического импорта модуля
async function importModule(path) {
  try {
    const module = await import(chrome.runtime.getURL(path));
    console.log(`[Block Popup] ES6 модуль ${path} импортирован`);
    return module;
  } catch (error) {
    console.error(`[Block Popup] Ошибка импорта модуля ${path}:`, error);
    throw error;
  }
}

// Загрузка всех модулей
async function loadAllModules() {
  try {
    console.log('[Block Popup] Начинаем загрузку ES6 модулей...');
    console.log('[Block Popup] window.BlockPopup до загрузки модулей:', !!window.BlockPopup);
    
    // Импортируем модули
    const configModule = await importModule('./core/config.js');
    const domUtilsModule = await importModule('./utils/dom-utils.js');
    const ruleUtilsModule = await importModule('./utils/rule-utils.js');
    const popupAnalyzerModule = await importModule('./core/popup-analyzer.js');
    const mutationObserverModule = await importModule('./core/mutation-observer.js');
    const detectionModeModule = await importModule('./core/detection-mode.js');
    
    // Инициализируем функции из модулей
    if (configModule.initConfig) {
      configModule.initConfig(window.BlockPopup);
    }
    
    if (domUtilsModule.initDomUtils) {
      domUtilsModule.initDomUtils(window.BlockPopup);
    }
    
    if (ruleUtilsModule.initRuleUtils) {
      ruleUtilsModule.initRuleUtils(window.BlockPopup);
    }
    
    if (popupAnalyzerModule.initPopupAnalyzer) {
      popupAnalyzerModule.initPopupAnalyzer(window.BlockPopup);
    }
    
    if (mutationObserverModule.initMutationObserver) {
      mutationObserverModule.initMutationObserver(window.BlockPopup);
    }
    
    if (detectionModeModule.initDetectionMode) {
      detectionModeModule.initDetectionMode(window.BlockPopup);
    }
    
    console.log('[Block Popup] Все ES6 модули загружены');
    // console.log('window.BlockPopup:', window.BlockPopup);
    
    // Проверяем, что все необходимые функции доступны
    if (!window.BlockPopup) {
      throw new Error('window.BlockPopup не определен');
    }
    
    if (!window.BlockPopup.loadSiteRules) {
      throw new Error('loadSiteRules не определен');
    }
    
    if (!window.BlockPopup.loadDebugMode) {
      throw new Error('loadDebugMode не определен');
    }
    
    // Инициализация после загрузки всех модулей
    initialize();
  } catch (error) {
    console.error('[Block Popup] Ошибка загрузки ES6 модулей:', error);
    // Fallback к старому методу загрузки
    loadAllModulesOldWay();
  }
}

// Fallback функция для загрузки модулей старым способом
async function loadAllModulesOldWay() {
  try {
    console.log('[Block Popup] Используем fallback загрузку модулей...');
    
    await loadModule('core/config.js');
    console.log('[Block Popup] Config загружен, window.BlockPopup:', !!window.BlockPopup);
    
    await loadModule('utils/dom-utils.js');
    console.log('[Block Popup] DOM Utils загружен');
    
    await loadModule('utils/rule-utils.js');
    console.log('[Block Popup] Rule Utils загружен');
    
    await loadModule('core/popup-analyzer.js');
    console.log('[Block Popup] Popup Analyzer загружен');
    
    await loadModule('core/mutation-observer.js');
    console.log('[Block Popup] Mutation Observer загружен');
    
    await loadModule('core/detection-mode.js');
    console.log('[Block Popup] Detection Mode загружен');
    
    console.log('[Block Popup] Все модули загружены (fallback)');
    
    // Инициализация после загрузки всех модулей
    initialize();
  } catch (error) {
    console.error('[Block Popup] Ошибка fallback загрузки модулей:', error);
  }
}

// Функция для загрузки модуля (fallback)
function loadModule(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => {
      setTimeout(() => {
        script.remove();
        resolve();
      }, 100);
    };
    script.onerror = reject;
    (document.head || document.documentElement).appendChild(script);
  });
}

// Инициализация блокировщика попапов
function initPopupBlocker() {
  try {
    if (window.BlockPopup.isInitialized) {
      if (window.BlockPopup.debugLog) {
        window.BlockPopup.debugLog('Блокировщик уже инициализирован');
      }
      return;
    }
    
    if (window.BlockPopup.debugLog) {
      window.BlockPopup.debugLog('Проверка сайта:', window.BlockPopup.currentHost);
    }
    
    // Проверяем, есть ли сайт в списке
    if (!window.BlockPopup.shouldActivateForSite || !window.BlockPopup.shouldActivateForSite(window.BlockPopup.currentHost)) {
      if (window.BlockPopup.debugLog) {
        window.BlockPopup.debugLog('Сайт не в списке, блокировка не активирована');
      }
      return; // Выходим, не активируя блокировку
    }
    
    if (window.BlockPopup.debugLog) {
      window.BlockPopup.debugLog('Активирована блокировка для', window.BlockPopup.currentHost);
    }
    
    // Получаем правила для текущего сайта
    const siteRules = window.BlockPopup.sitePopupRules[window.BlockPopup.currentHost]?.rules || [];
    
    if (window.BlockPopup.debugLog) {
      window.BlockPopup.debugLog('Загружено правил:', siteRules.length);
    }
    
    // Устанавливаем CSS для временного скрытия
    if (window.BlockPopup.setupTemporaryHidingCSS) {
      window.BlockPopup.setupTemporaryHidingCSS();
    }
    
    // Устанавливаем MutationObserver
    if (window.BlockPopup.setupPopupObserver) {
      window.BlockPopup.setupPopupObserver(siteRules);
    }
    
    // Проверяем существующие попапы на соответствие правилам
    if (siteRules.length > 0 && window.BlockPopup.checkExistingPopupsForRules) {
      setTimeout(() => {
        window.BlockPopup.checkExistingPopupsForRules(siteRules);
      }, 50);
    }
    
    window.BlockPopup.isInitialized = true;
    
  } catch (error) {
    console.error('[Block Popup] Ошибка при инициализации блокировщика:', error);
  }
}

// Функция перезагрузки всех скриптов
function reloadAllScripts() {
  try {
    // Останавливаем текущий наблюдатель
    if (window.BlockPopup && window.BlockPopup.popupObserver) {
      window.BlockPopup.popupObserver.disconnect();
    }
    
    // Удаляем временный CSS
    const tempCSS = document.getElementById('popup-blocker-temp-css');
    if (tempCSS) {
      tempCSS.remove();
    }
    
    // Показываем все скрытые элементы
    const hiddenElements = document.querySelectorAll('.popup-blocker-analyzing');
    for (const element of hiddenElements) {
      if (element && element.classList) {
        if (window.BlockPopup && window.BlockPopup.unblockPopup) {
          window.BlockPopup.unblockPopup(element);
        } else {
          element.classList.remove('popup-blocker-analyzing');
        }
      }
    }
    
    // Очищаем множества
    if (window.BlockPopup) {
      window.BlockPopup.blockedElements.clear();
      window.BlockPopup.processedElements.clear();
      
      // Останавливаем режим определения
      if (window.BlockPopup.stopDetectionMode) {
        window.BlockPopup.stopDetectionMode();
      }
      
      // Сбрасываем флаг инициализации
      window.BlockPopup.isInitialized = false;
    }
    
    // Перезагружаем все модули
    loadAllModules();
    
    console.log('[Block Popup] Скрипты перезагружены');
  } catch (error) {
    console.error('[Block Popup] Ошибка при перезагрузке скриптов:', error);
  }
}

// Обработка сообщений от popup и background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'startPopupDetection') {
      if (window.BlockPopup && window.BlockPopup.startDetectionMode) {
        window.BlockPopup.startDetectionMode();
      }
      sendResponse({ success: true });
    } else if (request.action === 'stopPopupDetection') {
      if (window.BlockPopup && window.BlockPopup.stopDetectionMode) {
        window.BlockPopup.stopDetectionMode();
      }
      sendResponse({ success: true });
    } else if (request.action === 'reloadScripts') {
      // Перезагрузка скриптов
      sendResponse({ success: true });
      setTimeout(() => {
        reloadAllScripts();
      }, 10);
      
    } else if (request.action === 'setDebugMode') {
      // Установка режима отладки
      if (window.BlockPopup) {
        window.BlockPopup.debugMode = request.enabled;
        console.log('[Block Popup] Режим отладки изменен на:', request.enabled);
        
        // Сохраняем в storage для синхронизации между вкладками
        chrome.storage.local.set({ debugMode: request.enabled });
        
        // Тестовое сообщение для проверки
        if (window.BlockPopup.debugLog) {
          window.BlockPopup.debugLog('Тестовое сообщение отладки - режим активен!');
        }
      }
      sendResponse({ success: true });
    } else if (request.action === 'settingsUpdated') {
      // Обновление настроек
      if (window.BlockPopup) {
        window.BlockPopup.sitePopupRules = request.rules;
        if (window.BlockPopup.debugLog) {
          window.BlockPopup.debugLog('Правила обновлены, перезапуск...');
        }
        
        // Останавливаем текущий наблюдатель
        if (window.BlockPopup.popupObserver) {
          window.BlockPopup.popupObserver.disconnect();
        }
        
        // Удаляем временный CSS
        const tempCSS = document.getElementById('popup-blocker-temp-css');
        if (tempCSS) {
          tempCSS.remove();
        }
        
        // Показываем все скрытые элементы
        const hiddenElements = document.querySelectorAll('.popup-blocker-analyzing');
        for (const element of hiddenElements) {
          if (element && element.classList) {
            if (window.BlockPopup && window.BlockPopup.unblockPopup) {
              window.BlockPopup.unblockPopup(element);
            } else {
              element.classList.remove('popup-blocker-analyzing');
            }
          }
        }
        
        // Очищаем множества
        window.BlockPopup.blockedElements.clear();
        window.BlockPopup.processedElements.clear();
        
        // Останавливаем режим определения
        if (window.BlockPopup.stopDetectionMode) {
          window.BlockPopup.stopDetectionMode();
        }
        
        // Сбрасываем флаг инициализации
        window.BlockPopup.isInitialized = false;
        
        // Перезапускаем блокировщик
        setTimeout(() => initPopupBlocker(), 500);
      }
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('[Block Popup] Ошибка при обработке сообщения:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Инициализация с загрузкой правил
async function initialize() {
  try {
    console.log('[Block Popup] Начинаем инициализацию...');
    
    if (window.BlockPopup && window.BlockPopup.isInitialized) {
      console.log('[Block Popup] Уже инициализирован');
      return;
    }
    
    if (!window.BlockPopup) {
      throw new Error('window.BlockPopup не определен в initialize');
    }
    
    // Загружаем правила и настройки дебага
    console.log('[Block Popup] Загружаем правила...');
    if (window.BlockPopup.loadSiteRules) {
      window.BlockPopup.sitePopupRules = await window.BlockPopup.loadSiteRules();
    }
    
    console.log('[Block Popup] Загружаем настройки дебага...');
    if (window.BlockPopup.loadDebugMode) {
      window.BlockPopup.debugMode = await window.BlockPopup.loadDebugMode();
    }
    
    console.log('[Block Popup] Запускаем блокировщик...');
    initPopupBlocker();
    
    // Слушаем изменения настроек
    chrome.storage.onChanged.addListener((changes) => {
      try {
        if (changes.sitePopupRules && window.BlockPopup) {
          window.BlockPopup.sitePopupRules = changes.sitePopupRules.newValue;
          if (window.BlockPopup.debugLog) {
            window.BlockPopup.debugLog('Правила обновлены, перезапуск...');
          }
          
          // Останавливаем текущий наблюдатель
          if (window.BlockPopup.popupObserver) {
            window.BlockPopup.popupObserver.disconnect();
          }
          
          // Удаляем временный CSS
          const tempCSS = document.getElementById('popup-blocker-temp-css');
          if (tempCSS) {
            tempCSS.remove();
          }
          
          // Показываем все скрытые элементы
          const hiddenElements = document.querySelectorAll('.popup-blocker-analyzing');
          for (const element of hiddenElements) {
            if (element && element.classList) {
              if (window.BlockPopup && window.BlockPopup.unblockPopup) {
                window.BlockPopup.unblockPopup(element);
              } else {
                element.classList.remove('popup-blocker-analyzing');
              }
            }
          }
          
          // Очищаем множества
          window.BlockPopup.blockedElements.clear();
          window.BlockPopup.processedElements.clear();
          
          // Останавливаем режим определения
          if (window.BlockPopup.stopDetectionMode) {
            window.BlockPopup.stopDetectionMode();
          }
          
          // Сбрасываем флаг инициализации
          window.BlockPopup.isInitialized = false;
          
          // Перезапускаем блокировщик
          setTimeout(() => initPopupBlocker(), 500);
        }
        
        // Обрабатываем изменения режима отладки
        if (changes.debugMode && window.BlockPopup) {
          window.BlockPopup.debugMode = changes.debugMode.newValue;
          console.log('[Block Popup] Режим отладки обновлен через storage:', changes.debugMode.newValue);
          
          // Тестовое сообщение для проверки
          if (window.BlockPopup.debugLog) {
            window.BlockPopup.debugLog('Режим отладки обновлен через storage listener!');
          }
        }
      } catch (error) {
        console.error('[Block Popup] Ошибка при обработке изменений настроек:', error);
      }
    });
  } catch (error) {
    console.error('[Block Popup] Ошибка инициализации:', error);
  }
}

// Запуск загрузки модулей
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAllModules);
} else {
  loadAllModules();
}

console.log('[Block Popup] Content script loaded');
