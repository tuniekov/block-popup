/**
 * Block Popup - Popup Script
 * Управление настройками блокировки попапов для конкретных сайтов
 */

let currentHost = '';
let sitePopupRules = {};
let isDetecting = false;
let editingRuleIndex = -1; // Индекс редактируемого правила
let debugMode = false; // Режим отладки

// Получение текущего домена
function getCurrentHost() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        resolve(url.hostname);
      } else {
        resolve('unknown');
      }
    });
  });
}

// Загрузка правил блокировки
function loadSiteRules() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['sitePopupRules'], (result) => {
      resolve(result.sitePopupRules || {});
    });
  });
}

// Сохранение правил блокировки
function saveSiteRules(rules) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ sitePopupRules: rules }, resolve);
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

// Сохранение настроек дебага
function saveDebugMode(enabled) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ debugMode: enabled }, resolve);
  });
}

// Обработка переключения дебага
function handleDebugToggle(enabled) {
  debugMode = enabled;
  saveDebugMode(enabled);
  
  // Отправляем сообщение в content script
  chrome.runtime.sendMessage({
    action: 'setDebugMode',
    enabled: enabled
  });
  
  showNotification(enabled ? 'Режим отладки включен' : 'Режим отладки отключен');
}

// Перезагрузка скриптов на активной вкладке
function reloadScripts() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'reloadScripts'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('chrome.runtime.lastError',chrome.runtime.lastError)
          // Переинъектируем content script
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content-script.js']
            }).then(() => {
              // Пробуем снова отправить сообщение после инъекции
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadScripts' }, (response) => {
                  if (chrome.runtime.lastError) {
                    showNotification('Ошибка: перезагрузите страницу', 'error');
                  } else {
                    showNotification('Скрипты перезагружены');
                  }
                });
              }, 500);
            }).catch((error) => {
              showNotification('Ошибка: перезагрузите страницу', 'error');
            });
        } else {
          showNotification('Скрипты перезагружены');
        }
      });
    }
  });
}

// Проверка, добавлен ли сайт в список
function isSiteInList(hostname) {
  return sitePopupRules.hasOwnProperty(hostname);
}

// Проверка на дублирование правил
function isDuplicateRule(ruleData, excludeIndex = -1) {
  if (!isSiteInList(currentHost)) return false;
  
  const rules = sitePopupRules[currentHost].rules || [];
  return rules.some((rule, index) => 
    index !== excludeIndex &&
    rule.type === ruleData.type && 
    rule.pattern === ruleData.pattern
  );
}

// Обновление статуса сайта
function updateSiteStatus() {
  const statusText = document.getElementById('statusText');
  const removeSiteBtn = document.getElementById('removeSite');
  const siteEnabledToggle = document.getElementById('siteEnabled');
  const rulesSection = document.getElementById('rulesSection');
  
  if (isSiteInList(currentHost)) {
    statusText.textContent = 'Сайт добавлен в список блокировки';
    removeSiteBtn.style.display = 'inline-block';
    siteEnabledToggle.disabled = false;
    
    // Показываем настройки сайта
    const siteSettings = sitePopupRules[currentHost];
    siteEnabledToggle.checked = siteSettings.enabled;
    
    if (siteSettings.enabled) {
      rulesSection.style.display = 'block';
      updateRulesList();
    } else {
      rulesSection.style.display = 'none';
    }
  } else {
    statusText.textContent = 'Включите блокировку для добавления сайта';
    removeSiteBtn.style.display = 'none';
    siteEnabledToggle.disabled = false;
    siteEnabledToggle.checked = false;
    rulesSection.style.display = 'none';
  }
}

// Обновление списка правил
function updateRulesList() {
  const rulesList = document.getElementById('rulesList');
  rulesList.innerHTML = '';
  
  if (!isSiteInList(currentHost)) return;
  
  const rules = sitePopupRules[currentHost].rules || [];
  
  if (rules.length === 0) {
    rulesList.innerHTML = '<div class="empty-rules">Нет правил блокировки</div>';
    return;
  }
  
  rules.forEach((rule, index) => {
    const isEnabled = rule.enabled !== undefined ? rule.enabled : true;
    
    const ruleElement = document.createElement('div');
    ruleElement.className = `rule-item ${!isEnabled ? 'disabled' : ''}`;
    
    // Формируем HTML для отображения правила
    let ruleInfoHTML = `
      <div class="rule-info">
        <div class="rule-description">${rule.description || 'Правило без описания'}</div>
    `;
    
    // Если у правила есть условия, отображаем их
    if (rule.conditions && Array.isArray(rule.conditions)) {
      ruleInfoHTML += '<div class="rule-conditions">';
      
      rule.conditions.forEach(condition => {
        let conditionText = '';
        
        // Отображаем разные типы условий
        switch (condition.type) {
          case 'content':
          case 'phrase':
          case 'outerHTML':
          case 'class':
          case 'id':
          case 'selector':
            conditionText = `${getConditionTypeText(condition.type)}: "${condition.pattern}"`;
            break;
            
          case 'isPopup':
            conditionText = 'Является попапом';
            break;
            
          case 'isLink':
            conditionText = 'Является ссылкой';
            break;
            
          case 'hasPopupParent':
            conditionText = `Родитель-попап (до уровня ${condition.depth || 2})`;
            break;
            
          case 'hasPopupChild':
            conditionText = `Потомок-попап (до уровня ${condition.depth || 3})`;
            break;
            
          default:
            conditionText = condition.type;
        }
        
        ruleInfoHTML += `<span class="rule-type">${conditionText}</span>`;
      });
      
      ruleInfoHTML += '</div>';
    } 
    // Обратная совместимость со старыми правилами
    else if (rule.type && rule.pattern) {
      ruleInfoHTML += `
        <div class="rule-conditions">
          <span class="rule-type">${getConditionTypeText(rule.type)}: "${rule.pattern}"</span>
        </div>
      `;
    }
    
    ruleInfoHTML += '</div>';
    
    // Добавляем кнопки управления
    const actionsHTML = `
      <div class="rule-actions">
        <label class="rule-toggle" title="${isEnabled ? 'Отключить правило' : 'Включить правило'}">
          <input type="checkbox" ${isEnabled ? 'checked' : ''} data-index="${index}">
          <span class="rule-toggle-slider"></span>
        </label>
        <button class="edit-rule-btn" data-index="${index}" title="Редактировать">✏️</button>
        <button class="remove-rule-btn" data-index="${index}" title="Удалить">×</button>
      </div>
    `;
    
    ruleElement.innerHTML = ruleInfoHTML + actionsHTML;
    rulesList.appendChild(ruleElement);
  });
  
  // Добавляем обработчики для переключателей
  document.querySelectorAll('.rule-toggle input').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      toggleRule(index, e.target.checked);
    });
  });
  
  // Добавляем обработчики для кнопок
  document.querySelectorAll('.edit-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      startEditRule(index);
    });
  });
  
  document.querySelectorAll('.remove-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeRule(index);
    });
  });
}

// Переключение состояния правила
function toggleRule(index, enabled) {
  if (!isSiteInList(currentHost)) return;
  
  const rules = sitePopupRules[currentHost].rules || [];
  if (index < 0 || index >= rules.length) return;
  
  // Обновляем состояние правила
  sitePopupRules[currentHost].rules[index].enabled = enabled;
  
  // Сохраняем настройки
  saveSettings();
  
  // Обновляем список для отображения изменений
  updateRulesList();
  
  const action = enabled ? 'включено' : 'отключено';
  showNotification(`Правило ${action}: ${rules[index].pattern}`);
}

// Получение текста типа условия
function getConditionTypeText(type) {
  const types = {
    'class': 'Класс',
    'id': 'ID',
    'selector': 'Селектор',
    'content': 'Текст',
    'phrase': 'Словосочетание',
    'outerHTML': 'HTML',
    'isPopup': 'Попап',
    'isLink': 'Ссылка',
    'hasPopupParent': 'Родитель-попап',
    'hasPopupChild': 'Потомок-попап'
  };
  return types[type] || type;
}

// Начало редактирования правила
function startEditRule(index) {
  if (!isSiteInList(currentHost)) return;
  
  const rules = sitePopupRules[currentHost].rules || [];
  if (index < 0 || index >= rules.length) return;
  
  const rule = rules[index];
  editingRuleIndex = index;
  
  // Очищаем контейнер условий
  const conditionsContainer = document.getElementById('conditionsContainer');
  conditionsContainer.innerHTML = '';
  
  // Заполняем описание правила
  document.getElementById('ruleDescription').value = rule.description || '';
  
  // Если у правила есть условия, заполняем их
  if (rule.conditions && Array.isArray(rule.conditions)) {
    rule.conditions.forEach((condition, condIndex) => {
      addConditionUI(condition, condIndex);
    });
  } 
  // Обратная совместимость со старыми правилами
  else if (rule.type && rule.pattern) {
    addConditionUI({
      type: rule.type,
      pattern: rule.pattern
    }, 0);
  }
  
  // Обновляем интерфейс
  updateEditUI();
  updateConditionButtons();
  
  showNotification(`Редактирование правила: ${rule.description || 'Без описания'}`);
}

// Отмена редактирования
function cancelEdit() {
  editingRuleIndex = -1;
  
  // Очищаем форму
  document.getElementById('ruleDescription').value = '';
  
  // Очищаем условия и добавляем одно пустое
  const conditionsContainer = document.getElementById('conditionsContainer');
  conditionsContainer.innerHTML = '';
  addConditionUI(null, 0);
  
  // Обновляем интерфейс
  updateEditUI();
  updateConditionButtons();
}

// Добавление UI для условия
function addConditionUI(condition = null, index) {
  const conditionsContainer = document.getElementById('conditionsContainer');
  
  // Создаем элемент условия
  const conditionItem = document.createElement('div');
  conditionItem.className = 'condition-item';
  conditionItem.dataset.index = index;
  
  // Заголовок условия
  const conditionHeader = document.createElement('div');
  conditionHeader.className = 'condition-header';
  conditionHeader.innerHTML = `
    <span class="condition-title">Условие ${index + 1}</span>
    <button type="button" class="remove-condition-btn" title="Удалить условие">×</button>
  `;
  
  // Содержимое условия
  const conditionContent = document.createElement('div');
  conditionContent.className = 'condition-content';
  
  // Выбор типа условия
  const typeSelect = document.createElement('select');
  typeSelect.className = 'condition-type';
  typeSelect.innerHTML = `
    <option value="content">Текст содержит</option>
    <option value="phrase">Словосочетание</option>
    <option value="outerHTML">HTML содержит</option>
    <option value="class">Класс</option>
    <option value="id">ID</option>
    <option value="selector">Селектор</option>
    <option value="isPopup">Является попапом</option>
    <option value="isLink">Является ссылкой</option>
    <option value="hasPopupParent">Родитель-попап</option>
    <option value="hasPopupChild">Потомок-попап</option>
  `;
  
  // Контейнер для значения условия
  const valueContainer = document.createElement('div');
  valueContainer.className = 'condition-value-container';
  
  // Поле для ввода шаблона
  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.className = 'condition-pattern';
  patternInput.placeholder = 'Введите шаблон';
  
  // Контейнер для глубины (для hasPopupParent и hasPopupChild)
  const depthContainer = document.createElement('div');
  depthContainer.className = 'condition-depth-container';
  depthContainer.style.display = 'none';
  depthContainer.innerHTML = `
    <label>Уровень:</label>
    <input type="number" class="condition-depth" min="1" max="5" value="2">
  `;
  
  // Добавляем элементы в контейнер значения
  valueContainer.appendChild(patternInput);
  valueContainer.appendChild(depthContainer);
  
  // Добавляем элементы в содержимое условия
  conditionContent.appendChild(typeSelect);
  conditionContent.appendChild(valueContainer);
  
  // Добавляем заголовок и содержимое в элемент условия
  conditionItem.appendChild(conditionHeader);
  conditionItem.appendChild(conditionContent);
  
  // Добавляем элемент условия в контейнер
  conditionsContainer.appendChild(conditionItem);
  
  // Если передано условие, заполняем поля
  if (condition) {
    typeSelect.value = condition.type || 'content';
    
    // Заполняем значение в зависимости от типа
    if (condition.type === 'isPopup' || condition.type === 'isLink') {
      patternInput.style.display = 'none';
    } else if (condition.type === 'hasPopupParent' || condition.type === 'hasPopupChild') {
      patternInput.style.display = 'none';
      depthContainer.style.display = 'flex';
      depthContainer.querySelector('.condition-depth').value = condition.depth || 2;
    } else {
      patternInput.value = condition.pattern || '';
    }
  }
  
  // Добавляем обработчики событий
  typeSelect.addEventListener('change', function() {
    updateConditionVisibility(conditionItem);
  });
  
  // Кнопка удаления условия
  const removeBtn = conditionHeader.querySelector('.remove-condition-btn');
  removeBtn.addEventListener('click', function() {
    removeCondition(index);
  });
  
  // Обновляем видимость полей в зависимости от типа
  updateConditionVisibility(conditionItem);
  
  return conditionItem;
}

// Обновление видимости полей условия в зависимости от типа
function updateConditionVisibility(conditionItem) {
  const typeSelect = conditionItem.querySelector('.condition-type');
  const patternInput = conditionItem.querySelector('.condition-pattern');
  const depthContainer = conditionItem.querySelector('.condition-depth-container');
  
  const type = typeSelect.value;
  
  // Скрываем/показываем поля в зависимости от типа
  if (type === 'isPopup' || type === 'isLink') {
    patternInput.style.display = 'none';
    depthContainer.style.display = 'none';
  } else if (type === 'hasPopupParent' || type === 'hasPopupChild') {
    patternInput.style.display = 'none';
    depthContainer.style.display = 'flex';
  } else {
    patternInput.style.display = 'block';
    depthContainer.style.display = 'none';
  }
}

// Добавление нового условия
function addCondition() {
  const conditionsContainer = document.getElementById('conditionsContainer');
  const conditionCount = conditionsContainer.children.length;
  
  // Добавляем новое условие
  addConditionUI(null, conditionCount);
  
  // Обновляем кнопки условий
  updateConditionButtons();
}

// Удаление условия
function removeCondition(index) {
  const conditionsContainer = document.getElementById('conditionsContainer');
  const conditionItems = conditionsContainer.querySelectorAll('.condition-item');
  
  // Если осталось только одно условие, не удаляем его
  if (conditionItems.length <= 1) {
    showNotification('Должно быть хотя бы одно условие', 'error');
    return;
  }
  
  // Удаляем условие
  conditionItems[index].remove();
  
  // Обновляем индексы оставшихся условий
  conditionItems.forEach((item, i) => {
    if (i > index) {
      item.dataset.index = i - 1;
      item.querySelector('.condition-title').textContent = `Условие ${i}`;
    }
  });
  
  // Обновляем кнопки условий
  updateConditionButtons();
}

// Обновление кнопок условий
function updateConditionButtons() {
  const conditionsContainer = document.getElementById('conditionsContainer');
  const conditionItems = conditionsContainer.querySelectorAll('.condition-item');
  
  // Показываем/скрываем кнопки удаления в зависимости от количества условий
  conditionItems.forEach(item => {
    const removeBtn = item.querySelector('.remove-condition-btn');
    removeBtn.style.display = conditionItems.length > 1 ? 'block' : 'none';
  });
}

// Получение условий из формы
function getConditionsFromForm() {
  const conditionsContainer = document.getElementById('conditionsContainer');
  const conditionItems = conditionsContainer.querySelectorAll('.condition-item');
  const conditions = [];
  
  conditionItems.forEach(item => {
    const typeSelect = item.querySelector('.condition-type');
    const patternInput = item.querySelector('.condition-pattern');
    const depthInput = item.querySelector('.condition-depth');
    
    const type = typeSelect.value;
    let condition = { type };
    
    // Добавляем дополнительные параметры в зависимости от типа
    if (type === 'isPopup' || type === 'isLink') {
      condition.value = true;
    } else if (type === 'hasPopupParent' || type === 'hasPopupChild') {
      condition.depth = parseInt(depthInput.value) || 2;
    } else {
      condition.pattern = patternInput.value.trim();
      
      // Проверяем, что шаблон не пустой
      if (!condition.pattern) {
        throw new Error(`Введите шаблон для условия ${parseInt(item.dataset.index) + 1}`);
      }
    }
    
    conditions.push(condition);
  });
  
  return conditions;
}

// Обновление интерфейса редактирования
function updateEditUI() {
  const addButton = document.getElementById('addRule');
  const cancelButton = document.getElementById('cancelEdit');
  const formTitle = document.querySelector('.add-rule-section h3');
  
  if (addButton && cancelButton) {
    if (editingRuleIndex >= 0) {
      // Режим редактирования
      addButton.textContent = 'Сохранить изменения';
      cancelButton.style.display = 'inline-block';
      if (formTitle) {
        formTitle.textContent = 'Редактирование правила';
      }
    } else {
      // Режим добавления
      addButton.textContent = 'Добавить правило';
      cancelButton.style.display = 'none';
      if (formTitle) {
        formTitle.textContent = 'Добавить правило';
      }
    }
  }
}

// Добавление или обновление правила
function addRule() {
  try {
    if (!isSiteInList(currentHost)) {
      showNotification('Сначала включите блокировку', 'error');
      return;
    }
    
    // Получаем описание правила
    const ruleDescription = document.getElementById('ruleDescription').value.trim();
    
    // Получаем условия из формы
    const conditions = getConditionsFromForm();
    
    // Проверяем, что есть хотя бы одно условие
    if (conditions.length === 0) {
      showNotification('Добавьте хотя бы одно условие', 'error');
      return;
    }
    
    // Создаем новое правило
    const newRule = {
      enabled: true, // Новые правила включены по умолчанию
      description: ruleDescription || generateRuleDescription(conditions),
      conditions: conditions
    };
    
    // Инициализируем массив правил если нужно
    if (!sitePopupRules[currentHost].rules) {
      sitePopupRules[currentHost].rules = [];
    }
    
    if (editingRuleIndex >= 0) {
      // Обновляем существующее правило, сохраняя его состояние enabled
      const existingRule = sitePopupRules[currentHost].rules[editingRuleIndex];
      newRule.enabled = existingRule.enabled !== undefined ? existingRule.enabled : true;
      
      sitePopupRules[currentHost].rules[editingRuleIndex] = newRule;
      showNotification('Правило обновлено');
      cancelEdit();
    } else {
      // Добавляем новое правило
      sitePopupRules[currentHost].rules.push(newRule);
      showNotification('Правило добавлено');
      
      // Очищаем форму
      document.getElementById('ruleDescription').value = '';
      
      // Очищаем условия и добавляем одно пустое
      const conditionsContainer = document.getElementById('conditionsContainer');
      conditionsContainer.innerHTML = '';
      addConditionUI(null, 0);
      updateConditionButtons();
    }
    
    // Сохраняем настройки
    saveSettings();
    
    // Обновляем список
    updateRulesList();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Генерация описания правила на основе условий
function generateRuleDescription(conditions) {
  if (!conditions || conditions.length === 0) {
    return 'Новое правило';
  }
  
  // Формируем описание на основе первых двух условий
  const descriptions = conditions.slice(0, 2).map(condition => {
    switch (condition.type) {
      case 'content':
      case 'phrase':
      case 'outerHTML':
      case 'class':
      case 'id':
      case 'selector':
        return `${getConditionTypeText(condition.type)}: "${condition.pattern}"`;
        
      case 'isPopup':
        return 'Является попапом';
        
      case 'isLink':
        return 'Является ссылкой';
        
      case 'hasPopupParent':
        return `Родитель-попап (до уровня ${condition.depth || 2})`;
        
      case 'hasPopupChild':
        return `Потомок-попап (до уровня ${condition.depth || 3})`;
        
      default:
        return condition.type;
    }
  });
  
  // Если условий больше двух, добавляем "и другие"
  if (conditions.length > 2) {
    return `${descriptions.join(' + ')} и другие`;
  }
  
  return descriptions.join(' + ');
}

// Добавление правила из автоматического определения
function addRuleFromDetection(ruleData) {
  if (!isSiteInList(currentHost)) {
    showNotification('Сначала включите блокировку', 'error');
    return;
  }
  
  // Проверяем на дублирование
  if (isDuplicateRule(ruleData)) {
    showNotification(`Правило уже существует: ${ruleData.pattern}`, 'error');
    return;
  }
  
  // Добавляем поле enabled если его нет
  if (ruleData.enabled === undefined) {
    ruleData.enabled = true;
  }
  
  // Добавляем правило
  if (!sitePopupRules[currentHost].rules) {
    sitePopupRules[currentHost].rules = [];
  }
  
  sitePopupRules[currentHost].rules.push(ruleData);
  
  // Сохраняем настройки
  saveSettings();
  
  // Обновляем список
  updateRulesList();
  
  showNotification(`Правило добавлено: ${ruleData.pattern}`);
}

// Удаление правила
function removeRule(index) {
  if (!isSiteInList(currentHost)) return;
  
  const rules = sitePopupRules[currentHost].rules || [];
  if (index < 0 || index >= rules.length) return;
  
  const rule = rules[index];
  
  if (confirm(`Удалить правило "${rule.pattern}"?`)) {
    sitePopupRules[currentHost].rules.splice(index, 1);
    
    // Если удаляем редактируемое правило, отменяем редактирование
    if (editingRuleIndex === index) {
      cancelEdit();
    } else if (editingRuleIndex > index) {
      // Корректируем индекс если удаляем правило выше редактируемого
      editingRuleIndex--;
    }
    
    // Сохраняем настройки
    saveSettings();
    
    updateRulesList();
    showNotification('Правило удалено');
  }
}

// Добавление сайта в список (автоматически при включении блокировки)
function addSite() {
  sitePopupRules[currentHost] = {
    enabled: true,
    rules: []
  };
  
  // Сохраняем настройки
  saveSettings();
  
  updateSiteStatus();
  showNotification('Сайт добавлен в список блокировки');
}

// Удаление сайта из списка
function removeSite() {
  if (confirm('Удалить сайт из списка блокировки? Все правила будут потеряны.')) {
    delete sitePopupRules[currentHost];
    
    // Отменяем редактирование если активно
    cancelEdit();
    
    // Сохраняем настройки
    saveSettings();
    
    updateSiteStatus();
    showNotification('Сайт удален из списка');
  }
}

// Обработка переключения блокировки
function handleToggleBlocking(enabled) {
  if (enabled) {
    // Включаем блокировку - автоматически добавляем сайт
    if (!isSiteInList(currentHost)) {
      addSite();
    } else {
      sitePopupRules[currentHost].enabled = true;
      saveSettings();
      updateSiteStatus();
      showNotification('Блокировка включена');
    }
  } else {
    // Отключаем блокировку
    if (isSiteInList(currentHost)) {
      sitePopupRules[currentHost].enabled = false;
      
      // Отменяем редактирование
      cancelEdit();
      
      saveSettings();
      updateSiteStatus();
      showNotification('Блокировка отключена');
    }
  }
}

// Автоматическое определение попапов
function startPopupDetection() {
  if (!isSiteInList(currentHost)) {
    showNotification('Сначала включите блокировку', 'error');
    return;
  }
  
  isDetecting = true;
  updateDetectionUI();
  
  // Отправляем сообщение через background script
  chrome.runtime.sendMessage({
    action: 'startPopupDetection',
    hostname: currentHost
  }, (response) => {
    if (chrome.runtime.lastError) {
      showNotification('Ошибка: перезагрузите страницу', 'error');
      stopPopupDetection();
    } else {
      showNotification('Поиск попапов начат. Взаимодействуйте со страницей.');
    }
  });
}

// Остановка определения попапов
function stopPopupDetection() {
  isDetecting = false;
  updateDetectionUI();
  
  // Отправляем сообщение через background script
  chrome.runtime.sendMessage({
    action: 'stopPopupDetection',
    hostname: currentHost
  }, () => {
    showNotification('Поиск попапов остановлен');
  });
}

// Обновление интерфейса определения
function updateDetectionUI() {
  const detectButton = document.getElementById('detectPopups');
  const detectStatus = document.getElementById('detectStatus');
  const detectStatusText = document.getElementById('detectStatusText');
  
  if (isDetecting) {
    detectButton.style.display = 'none';
    detectStatus.style.display = 'flex';
    detectStatusText.textContent = 'Поиск попапов активен...';
  } else {
    detectButton.style.display = 'block';
    detectStatus.style.display = 'none';
  }
}

// Сохранение настроек
function saveSettings() {
  saveSiteRules(sitePopupRules).then(() => {
    console.log('[Block Popup] Настройки сохранены');
  }).catch((error) => {
    console.error('[Block Popup] Ошибка сохранения настроек:', error);
    showNotification('Ошибка сохранения настроек', 'error');
  });
}

// Сброс настроек для сайта
function resetSiteSettings() {
  if (!isSiteInList(currentHost)) return;
  
  if (confirm('Сбросить все настройки для этого сайта?')) {
    sitePopupRules[currentHost] = {
      enabled: true,
      rules: []
    };
    
    // Отменяем редактирование
    cancelEdit();
    
    saveSettings();
    updateSiteStatus();
    showNotification('Настройки сброшены');
  }
}

// Показ уведомления
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notificationText');
  
  if (notification && notificationText) {
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

// Открытие страницы расширенных настроек
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Обработка сообщений от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'popupDetected') {
    // Получили информацию о найденном попапе (старый способ)
    const ruleData = request.ruleData;
    
    // Показываем уведомление о найденном попапе
    showNotification(`Найден попап: ${ruleData.pattern}`);
    
    // Автоматически добавляем правило
    addRuleFromDetection(ruleData);
    
    sendResponse({ success: true });
  }
  
  if (request.action === 'ruleAdded') {
    // Правило было автоматически добавлено background script
    const ruleData = request.ruleData;
    const hostname = request.hostname;
    
    // Если это текущий сайт, обновляем интерфейс
    if (hostname === currentHost) {
      // Перезагружаем правила из storage
      loadSiteRules().then((rules) => {
        sitePopupRules = rules;
        updateSiteStatus();
        showNotification(`Автоматически добавлено правило: ${ruleData.pattern}`);
      });
    }
    
    sendResponse({ success: true });
  }
});

// Инициализация
async function init() {
  try {
    // Получаем текущий домен
    currentHost = await getCurrentHost();
    const currentSiteElement = document.getElementById('currentSite');
    if (currentSiteElement) {
      currentSiteElement.textContent = currentHost;
    }
    
    // Загружаем правила и настройки дебага
    sitePopupRules = await loadSiteRules();
    debugMode = await loadDebugMode();
    
    // Устанавливаем состояние переключателя дебага
    const debugModeElement = document.getElementById('debugMode');
    if (debugModeElement) {
      debugModeElement.checked = debugMode;
    }
    
    // Обновляем интерфейс
    updateSiteStatus();
    updateDetectionUI();
    updateEditUI();
    
    // Добавляем обработчики событий
    const siteEnabledElement = document.getElementById('siteEnabled');
    if (siteEnabledElement) {
      siteEnabledElement.addEventListener('change', (e) => {
        handleToggleBlocking(e.target.checked);
      });
    }
    
    // Обработчик для переключателя дебага
    if (debugModeElement) {
      debugModeElement.addEventListener('change', (e) => {
        handleDebugToggle(e.target.checked);
      });
    }
    
    const detectPopupsElement = document.getElementById('detectPopups');
    if (detectPopupsElement) {
      detectPopupsElement.addEventListener('click', startPopupDetection);
    }
    
    const stopDetectElement = document.getElementById('stopDetect');
    if (stopDetectElement) {
      stopDetectElement.addEventListener('click', stopPopupDetection);
    }
    
    const addRuleElement = document.getElementById('addRule');
    if (addRuleElement) {
      addRuleElement.addEventListener('click', addRule);
    }
    
    const cancelEditElement = document.getElementById('cancelEdit');
    if (cancelEditElement) {
      cancelEditElement.addEventListener('click', cancelEdit);
    }
    
    const removeSiteElement = document.getElementById('removeSite');
    if (removeSiteElement) {
      removeSiteElement.addEventListener('click', removeSite);
    }
    
    const saveSiteSettingsElement = document.getElementById('saveSiteSettings');
    if (saveSiteSettingsElement) {
      saveSiteSettingsElement.addEventListener('click', saveSettings);
    }
    
    const resetSiteSettingsElement = document.getElementById('resetSiteSettings');
    if (resetSiteSettingsElement) {
      resetSiteSettingsElement.addEventListener('click', resetSiteSettings);
    }
    
    const openOptionsElement = document.getElementById('openOptions');
    if (openOptionsElement) {
      openOptionsElement.addEventListener('click', openOptions);
    }
    
    // Обработчик для кнопки перезагрузки скриптов
    const reloadScriptsElement = document.getElementById('reloadScripts');
    if (reloadScriptsElement) {
      reloadScriptsElement.addEventListener('click', reloadScripts);
    }
    
    // Обработчик для кнопки добавления условия
    const addConditionElement = document.getElementById('addCondition');
    if (addConditionElement) {
      addConditionElement.addEventListener('click', addCondition);
    }
    
    // Инициализируем форму с одним пустым условием
    const conditionsContainer = document.getElementById('conditionsContainer');
    if (conditionsContainer && conditionsContainer.children.length === 0) {
      addConditionUI(null, 0);
      updateConditionButtons();
    }
    
  } catch (error) {
    console.error('Ошибка инициализации popup:', error);
    showNotification('Ошибка загрузки настроек', 'error');
  }
}

// Запуск инициализации
document.addEventListener('DOMContentLoaded', init);
