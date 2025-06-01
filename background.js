/**
 * Block Popup - Background Script
 * Управление настройками и состоянием расширения
 */

// Загрузка правил по умолчанию из default-rule.json
async function loadDefaultRules() {
  try {
    const response = await fetch(chrome.runtime.getURL('default-rule.json'));
    const defaultRules = await response.json();
    return defaultRules;
  } catch (error) {
    console.error('[Block Popup] Ошибка загрузки default-rule.json:', error);
    return {};
  }
}

// Умное объединение правил (аналогично логике импорта в options.js)
function mergeRulesWithDefaults(existingRules, defaultRules) {
  const mergedRules = { ...existingRules };
  
  for (const [hostname, defaultSettings] of Object.entries(defaultRules)) {
    if (!mergedRules[hostname]) {
      // Добавляем новый сайт полностью
      mergedRules[hostname] = {
        enabled: defaultSettings.enabled,
        rules: [...defaultSettings.rules]
      };
    } else {
      // Сайт уже существует, добавляем только отсутствующие правила
      const existingRulesForSite = mergedRules[hostname].rules || [];
      
      for (const defaultRule of defaultSettings.rules) {
        // Проверяем дубликаты по типу и паттерну (игнорируем состояние enabled)
        const isDuplicate = existingRulesForSite.some(existingRule => 
          existingRule.type === defaultRule.type && 
          existingRule.pattern === defaultRule.pattern
        );
        
        if (!isDuplicate) {
          existingRulesForSite.push({
            type: defaultRule.type,
            pattern: defaultRule.pattern,
            enabled: defaultRule.enabled,
            description: defaultRule.description || `${getRuleTypeLabel(defaultRule.type)}: ${defaultRule.pattern}`
          });
        }
      }
      
      mergedRules[hostname].rules = existingRulesForSite;
    }
  }
  
  return mergedRules;
}

// Получение читаемого названия типа правила
function getRuleTypeLabel(type) {
  const labels = {
    'class': 'Класс',
    'id': 'ID',
    'selector': 'Селектор',
    'content': 'Содержимое',
    'phrase': 'Словосочетание'
  };
  return labels[type] || type;
}

// Инициализация расширения
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Первая установка - загружаем правила по умолчанию
    console.log('[Block Popup] Первая установка - загружаем правила по умолчанию');
    
    const defaultRules = await loadDefaultRules();
    
    chrome.storage.sync.set({
      sitePopupRules: defaultRules
    });
    
    console.log('[Block Popup] Расширение установлено с правилами по умолчанию');
  } else if (details.reason === 'update') {
    // Обновление - проверяем совместимость настроек и добавляем новые правила по умолчанию
    console.log('[Block Popup] Обновление - мигрируем настройки и добавляем новые правила по умолчанию');
    
    // Сначала мигрируем старые настройки
    await migrateSettings();
    
    // Затем добавляем новые правила по умолчанию
    const defaultRules = await loadDefaultRules();
    
    chrome.storage.sync.get(['sitePopupRules'], (result) => {
      const existingRules = result.sitePopupRules || {};
      const mergedRules = mergeRulesWithDefaults(existingRules, defaultRules);
      
      chrome.storage.sync.set({ sitePopupRules: mergedRules });
      console.log('[Block Popup] Правила по умолчанию добавлены при обновлении');
    });
    
    console.log('[Block Popup] Расширение обновлено');
  }
});

// Миграция настроек при обновлении
function migrateSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['globalSettings', 'siteSettings'], (result) => {
      // Если есть старые настройки, мигрируем их
      if (result.globalSettings || result.siteSettings) {
        console.log('[Block Popup] Миграция старых настроек...');
        
        // Создаем новую структуру настроек
        const newSiteRules = {};
        
        // Мигрируем настройки для сайтов
        if (result.siteSettings) {
          for (const [hostname, settings] of Object.entries(result.siteSettings)) {
            if (!settings.whitelist) { // Не мигрируем сайты из белого списка
              newSiteRules[hostname] = {
                enabled: settings.enabled !== false,
                rules: [] // Пустые правила - пользователь должен настроить их заново
              };
            }
          }
        }
        
        // Сохраняем новые настройки
        chrome.storage.sync.set({
          sitePopupRules: newSiteRules
        });
        
        // Удаляем старые настройки
        chrome.storage.sync.remove(['globalSettings', 'siteSettings']);
        
        console.log('[Block Popup] Миграция завершена');
      }
      resolve();
    });
  });
}

// Проверка на дублирование правил
function isDuplicateRule(rules, ruleData) {
  // Проверка для правил нового формата с массивом conditions
  if (ruleData.conditions && Array.isArray(ruleData.conditions)) {
    return rules.some(rule => {
      // Если существующее правило тоже имеет conditions
      if (rule.conditions && Array.isArray(rule.conditions)) {
        // Проверяем, совпадает ли хотя бы одно условие
        return rule.conditions.some(existingCondition => 
          ruleData.conditions.some(newCondition => 
            existingCondition.type === newCondition.type && 
            existingCondition.pattern === newCondition.pattern
          )
        );
      }
      // Если существующее правило старого формата
      else if (rule.type && rule.pattern) {
        // Проверяем, совпадает ли оно с любым из новых условий
        return ruleData.conditions.some(condition => 
          rule.type === condition.type && 
          rule.pattern === condition.pattern
        );
      }
      return false;
    });
  }
  // Проверка для правил старого формата
  else if (ruleData.type && ruleData.pattern) {
    return rules.some(rule => {
      // Если существующее правило имеет conditions
      if (rule.conditions && Array.isArray(rule.conditions)) {
        return rule.conditions.some(condition => 
          condition.type === ruleData.type && 
          condition.pattern === ruleData.pattern
        );
      }
      // Если существующее правило старого формата
      else if (rule.type && rule.pattern) {
        return rule.type === ruleData.type && 
               rule.pattern === ruleData.pattern;
      }
      return false;
    });
  }
  
  return false;
}

// Обработка сообщений от content script и popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSiteRules') {
    // Получение правил для конкретного сайта
    const hostname = request.hostname;
    
    chrome.storage.sync.get(['sitePopupRules'], (result) => {
      const siteRules = result.sitePopupRules || {};
      const rules = siteRules[hostname] || null;
      
      sendResponse({ rules });
    });
    
    return true; // Асинхронный ответ
  }
  
  if (request.action === 'logBlockedPopup') {
    // Логирование заблокированного попапа
    console.log('[Block Popup] Заблокирован попап на', sender.tab.url, ':', request.details);
  }
  
  if (request.action === 'updateBadge') {
    // Обновление значка расширения
    const tabId = sender.tab.id;
    const count = request.count || 0;
    
    if (count > 0) {
      chrome.action.setBadgeText({
        tabId: tabId,
        text: count.toString()
      });
      
      chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: '#d93025'
      });
    } else {
      chrome.action.setBadgeText({
        tabId: tabId,
        text: ''
      });
    }
  }
  
  // Обработка сообщений от popup для управления режимом определения
  if (request.action === 'startPopupDetection') {
    // Пересылаем сообщение в content script активной вкладки
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startPopupDetection'
        }).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('[Block Popup] Ошибка отправки сообщения в content script:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: 'Нет активной вкладки' });
      }
    });
    
    return true; // Асинхронный ответ
  }
  
  if (request.action === 'stopPopupDetection') {
    // Пересылаем сообщение в content script активной вкладки
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stopPopupDetection'
        }).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('[Block Popup] Ошибка отправки сообщения в content script:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: 'Нет активной вкладки' });
      }
    });
    
    return true; // Асинхронный ответ
  }
  
  // Обработка сообщений о режиме отладки
  if (request.action === 'setDebugMode') {
    // Пересылаем сообщение во все content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setDebugMode',
            enabled: request.enabled
          }).catch(() => {
            // Игнорируем ошибки для вкладок без content script
          });
        }
      });
    });
    
    sendResponse({ success: true });
  }
  
  // Обработка сообщений от content script о найденных попапах
  if (request.action === 'popupDetected') {
    const ruleData = request.ruleData;
    
    // Получаем hostname из URL вкладки отправителя
    if (sender.tab && sender.tab.url) {
      const url = new URL(sender.tab.url);
      const hostname = url.hostname;
      
      // Загружаем текущие настройки
      chrome.storage.sync.get(['sitePopupRules'], (result) => {
        const siteRules = result.sitePopupRules || {};
        
        // Проверяем, что сайт добавлен в список блокировки
        if (!siteRules[hostname] || !siteRules[hostname].enabled) {
          console.log('[Block Popup] Сайт не в списке блокировки или отключен:', hostname);
          sendResponse({ success: false, error: 'Сайт не в списке блокировки' });
          return;
        }
        
        // Инициализируем правила если их нет
        if (!siteRules[hostname].rules) {
          siteRules[hostname].rules = [];
        }
        
        // Проверяем на дублирование
        if (isDuplicateRule(siteRules[hostname].rules, ruleData)) {
          console.log('[Block Popup] Правило уже существует:', ruleData.pattern);
          sendResponse({ success: false, error: 'Правило уже существует' });
          return;
        }
        
        // Добавляем новое правило
        siteRules[hostname].rules.push(ruleData);
        
        // Сохраняем обновленные настройки
        chrome.storage.sync.set({ sitePopupRules: siteRules }, () => {
          console.log('[Block Popup] Правило автоматически добавлено:', ruleData);
          
          // Показываем уведомление
          let ruleDescription = ruleData.description || 'Новое правило';
          
          // Если нет описания, но есть pattern, используем его
          if (!ruleData.description && ruleData.pattern) {
            ruleDescription = `${ruleData.type}: ${ruleData.pattern}`;
          }
          // Если нет описания и pattern, но есть conditions, используем первое условие
          else if (!ruleData.description && !ruleData.pattern && ruleData.conditions && ruleData.conditions.length > 0) {
            const firstCondition = ruleData.conditions[0];
            ruleDescription = `${firstCondition.type}: ${firstCondition.pattern}`;
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon16.svg',
            title: 'Block Popup',
            message: `Добавлено правило: ${ruleDescription}`
          });
          
          // Пересылаем сообщение в popup (если он открыт)
          chrome.runtime.sendMessage({
            action: 'ruleAdded',
            ruleData: ruleData,
            hostname: hostname
          }).catch(() => {
            // Popup может быть закрыт - это нормально
            console.log('[Block Popup] Popup закрыт, уведомление не отправлено');
          });
          
          sendResponse({ success: true });
        });
      });
    } else {
      console.error('[Block Popup] Не удалось получить URL вкладки');
      sendResponse({ success: false, error: 'Не удалось получить URL вкладки' });
    }
    
    return true; // Асинхронный ответ
  }
});

// Очистка значка при закрытии вкладки
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({
    tabId: tabId,
    text: ''
  });
});

// Обновление значка при переходе на другую вкладку
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Сбрасываем значок для новой активной вкладки
  chrome.action.setBadgeText({
    tabId: activeInfo.tabId,
    text: ''
  });
});

// Обработка изменений в настройках
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.sitePopupRules) {
    console.log('[Block Popup] Настройки обновлены');
    
    // Уведомляем все вкладки об изменении настроек
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            rules: changes.sitePopupRules.newValue
          }).catch(() => {
            // Игнорируем ошибки для вкладок без content script
          });
        }
      });
    });
  }
});

// Контекстное меню для быстрого добавления сайта
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addSiteToBlockList',
    title: 'Добавить сайт в список блокировки',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'openPopupBlockerOptions',
    title: 'Настройки Block Popup',
    contexts: ['page']
  });
});

// Обработка контекстного меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addSiteToBlockList') {
    // Добавляем текущий сайт в список блокировки
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    chrome.storage.sync.get(['sitePopupRules'], (result) => {
      const siteRules = result.sitePopupRules || {};
      
      if (!siteRules[hostname]) {
        siteRules[hostname] = {
          enabled: true,
          rules: []
        };
        
        chrome.storage.sync.set({ sitePopupRules: siteRules });
        
        // Показываем уведомление
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon16.svg',
          title: 'Block Popup',
          message: `Сайт ${hostname} добавлен в список блокировки`
        });
      } else {
        // Сайт уже в списке
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon16.svg',
          title: 'Block Popup',
          message: `Сайт ${hostname} уже в списке блокировки`
        });
      }
    });
  }
  
  if (info.menuItemId === 'openPopupBlockerOptions') {
    // Открываем страницу настроек
    chrome.runtime.openOptionsPage();
  }
});

// Обработка команд клавиатуры (если добавлены в manifest.json)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-popup-blocker') {
    // Переключение блокировки для текущего сайта
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        chrome.storage.sync.get(['sitePopupRules'], (result) => {
          const siteRules = result.sitePopupRules || {};
          
          if (siteRules[hostname]) {
            siteRules[hostname].enabled = !siteRules[hostname].enabled;
            chrome.storage.sync.set({ sitePopupRules: siteRules });
            
            const status = siteRules[hostname].enabled ? 'включена' : 'отключена';
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon16.svg',
              title: 'Block Popup',
              message: `Блокировка для ${hostname} ${status}`
            });
          }
        });
      }
    });
  }
});

console.log('[Block Popup] Background script загружен');
