/**
 * Block Popup - Options Script
 * Управление расширенными настройками блокировки попапов
 */

let sitePopupRules = {};

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

// Обновление списка сайтов
function updateSiteList() {
  const siteList = document.getElementById('siteList');
  
  // Очищаем список
  siteList.innerHTML = '';
  
  const sites = Object.keys(sitePopupRules);
  
  if (sites.length === 0) {
    // Создаем элемент пустого состояния заново
    const emptySiteList = document.createElement('div');
    emptySiteList.className = 'empty-state';
    emptySiteList.id = 'emptySiteList';
    emptySiteList.innerHTML = `
      <p>Нет сайтов с настройками блокировки</p>
      <p>Добавьте сайты через popup расширения</p>
    `;
    siteList.appendChild(emptySiteList);
    return;
  }
  
  sites.forEach(hostname => {
    const siteSettings = sitePopupRules[hostname];
    const rulesCount = siteSettings.rules ? siteSettings.rules.length : 0;
    
    const siteItem = document.createElement('div');
    siteItem.className = 'site-list-item';
    siteItem.innerHTML = `
      <div class="site-domain">${hostname}</div>
      <div class="site-info">
        <span class="site-status ${siteSettings.enabled ? 'enabled' : 'disabled'}">
          ${siteSettings.enabled ? 'Включено' : 'Отключено'}
        </span>
        <span class="rules-count">${rulesCount} правил</span>
      </div>
      <div class="site-actions">
        <button class="icon-button edit-site-btn" data-hostname="${hostname}" title="Редактировать">✏️</button>
        <button class="icon-button export-site-btn" data-hostname="${hostname}" title="Экспорт настроек сайта">📤</button>
        <button class="icon-button delete-site-btn" data-hostname="${hostname}" title="Удалить">🗑️</button>
      </div>
    `;
    
    siteList.appendChild(siteItem);
  });
  
  // Добавляем обработчики для кнопок
  document.querySelectorAll('.edit-site-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hostname = e.target.dataset.hostname;
      editSite(hostname);
    });
  });
  
  document.querySelectorAll('.export-site-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hostname = e.target.dataset.hostname;
      exportSiteSettings(hostname);
    });
  });
  
  document.querySelectorAll('.delete-site-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hostname = e.target.dataset.hostname;
      deleteSite(hostname);
    });
  });
}

// Экспорт настроек конкретного сайта
function exportSiteSettings(hostname) {
  const siteSettings = sitePopupRules[hostname];
  if (!siteSettings) {
    showNotification('Настройки сайта не найдены', 'error');
    return;
  }
  
  // Создаем объект с настройками только для этого сайта
  const siteExport = {
    [hostname]: siteSettings
  };
  
  const settingsData = document.getElementById('settingsData');
  const importExportArea = document.getElementById('importExportArea');
  
  settingsData.value = JSON.stringify(siteExport, null, 2);
  importExportArea.style.display = 'block';
  
  showNotification(`Настройки сайта ${hostname} экспортированы`);
  
  // Прокручиваем к области экспорта
  importExportArea.scrollIntoView({ behavior: 'smooth' });
}

// Глобальные переменные для редактирования
let currentEditingSite = null;
let currentEditingRules = [];

// Редактирование сайта
function editSite(hostname) {
  const siteSettings = sitePopupRules[hostname];
  if (!siteSettings) return;
  
  // Устанавливаем текущий редактируемый сайт
  currentEditingSite = hostname;
  currentEditingRules = JSON.parse(JSON.stringify(siteSettings.rules || [])); // Глубокая копия
  
  // Показываем интерфейс редактирования
  showRuleEditor(hostname, siteSettings);
}

// Показ интерфейса редактирования правил
function showRuleEditor(hostname, siteSettings) {
  const ruleEditSection = document.getElementById('ruleEditSection');
  const editingSiteName = document.getElementById('editingSiteName');
  const siteEnabledToggle = document.getElementById('siteEnabled');
  
  // Устанавливаем название сайта
  editingSiteName.textContent = hostname;
  
  // Устанавливаем состояние переключателя
  siteEnabledToggle.checked = siteSettings.enabled;
  
  // Обновляем список правил
  updateEditRulesList();
  
  // Показываем секцию редактирования
  ruleEditSection.style.display = 'block';
  
  // Прокручиваем к секции редактирования
  ruleEditSection.scrollIntoView({ behavior: 'smooth' });
  
  // Добавляем обработчик для переключателя сайта (только один раз)
  setupSiteToggleHandler();
}

// Настройка обработчика переключателя сайта
function setupSiteToggleHandler() {
  const toggleSwitch = document.querySelector('.toggle-switch');
  const siteEnabledToggle = document.getElementById('siteEnabled');
  
  // Удаляем старые обработчики если есть
  const newToggleSwitch = toggleSwitch.cloneNode(true);
  toggleSwitch.parentNode.replaceChild(newToggleSwitch, toggleSwitch);
  
  // Получаем новые ссылки
  const newSiteEnabledToggle = document.getElementById('siteEnabled');
  const newToggleSwitchContainer = document.querySelector('.toggle-switch');
  
  // Обработчик клика по контейнеру переключателя
  newToggleSwitchContainer.addEventListener('click', (e) => {
    // Предотвращаем двойное срабатывание если кликнули по самому input
    if (e.target === newSiteEnabledToggle) return;
    
    newSiteEnabledToggle.checked = !newSiteEnabledToggle.checked;
    handleSiteToggleChange();
  });
  
  // Обработчик изменения состояния input
  newSiteEnabledToggle.addEventListener('change', handleSiteToggleChange);
}

// Обработка изменения состояния переключателя сайта
function handleSiteToggleChange() {
  // Автосохранение изменений
  autoSaveRules();
}

// Обновление списка правил в редакторе
function updateEditRulesList() {
  const editRulesList = document.getElementById('editRulesList');
  
  // Очищаем список
  editRulesList.innerHTML = '';
  
  if (currentEditingRules.length === 0) {
    // Создаем элемент пустого состояния заново
    const emptyRules = document.createElement('div');
    emptyRules.className = 'empty-rules';
    emptyRules.id = 'emptyRules';
    emptyRules.innerHTML = `
      <p>Нет правил блокировки</p>
      <p>Добавьте правила ниже</p>
    `;
    editRulesList.appendChild(emptyRules);
    return;
  }
  
  currentEditingRules.forEach((rule, index) => {
    const ruleItem = document.createElement('div');
    ruleItem.className = `rule-item ${rule.enabled === false ? 'disabled' : ''}`;
    
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
            conditionText = `${getConditionTypeLabel(condition.type)}: "${condition.pattern}"`;
            break;
            
          case 'isPopup':
            conditionText = 'Является попапом';
            break;
            
          case 'isLink':
            conditionText = 'Является ссылкой';
            break;
            
          case 'hasPopupParent':
            conditionText = `Родитель-попап (уровень ${condition.depth || 2})`;
            break;
            
          case 'hasPopupChild':
            conditionText = `Потомок-попап (уровень ${condition.depth || 3})`;
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
          <span class="rule-type">${getConditionTypeLabel(rule.type)}: "${rule.pattern}"</span>
        </div>
      `;
    }
    
    ruleInfoHTML += '</div>';
    
    // Добавляем кнопки управления
    const actionsHTML = `
      <div class="rule-actions">
        <div class="rule-toggle" data-index="${index}">
          <input type="checkbox" ${rule.enabled !== false ? 'checked' : ''} data-index="${index}">
          <span class="rule-toggle-slider"></span>
        </div>
        <button class="edit-rule-btn" data-index="${index}" title="Редактировать">✏️</button>
        <button class="remove-rule-btn" data-index="${index}" title="Удалить">×</button>
      </div>
    `;
    
    ruleItem.innerHTML = ruleInfoHTML + actionsHTML;
    editRulesList.appendChild(ruleItem);
    
    // Добавляем обработчики событий
    const toggleContainer = ruleItem.querySelector('.rule-toggle');
    const toggleInput = ruleItem.querySelector('.rule-toggle input');
    const editBtn = ruleItem.querySelector('.edit-rule-btn');
    const removeBtn = ruleItem.querySelector('.remove-rule-btn');
    
    // Обработчик клика по контейнеру переключателя
    toggleContainer.addEventListener('click', (e) => {
      // Предотвращаем двойное срабатывание если кликнули по самому input
      if (e.target === toggleInput) return;
      
      const ruleIndex = parseInt(toggleContainer.dataset.index);
      toggleInput.checked = !toggleInput.checked;
      toggleEditRule(ruleIndex, toggleInput);
    });
    
    // Обработчик изменения состояния input
    toggleInput.addEventListener('change', (e) => {
      const ruleIndex = parseInt(e.target.dataset.index);
      toggleEditRule(ruleIndex, e.target);
    });
    
    editBtn.addEventListener('click', () => editRule(index));
    removeBtn.addEventListener('click', () => removeEditRule(index));
  });
}

// Получение читаемого названия типа условия
function getConditionTypeLabel(type) {
  const labels = {
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
  return labels[type] || type;
}

// Автосохранение изменений без закрытия интерфейса
function autoSaveRules() {
  if (!currentEditingSite) return;
  
  const siteEnabledToggle = document.getElementById('siteEnabled');
  
  // Обновляем настройки сайта
  sitePopupRules[currentEditingSite].enabled = siteEnabledToggle.checked;
  sitePopupRules[currentEditingSite].rules = currentEditingRules;
  
  // Сохраняем в storage
  saveSiteRules(sitePopupRules).then(() => {
    // Обновляем список сайтов без закрытия интерфейса редактирования
    updateSiteList();
  });
}

// Переключение состояния правила
function toggleEditRule(index, toggleElement) {
  if (currentEditingRules[index]) {
    currentEditingRules[index].enabled = toggleElement.checked;
    
    // Обновляем только класс родительского элемента, не пересоздаем весь список
    const ruleItem = toggleElement.closest('.rule-item');
    if (toggleElement.checked) {
      ruleItem.classList.remove('disabled');
    } else {
      ruleItem.classList.add('disabled');
    }
    
    // Автосохранение изменений
    autoSaveRules();
  }
}

// Редактирование правила
function editRule(index) {
  const rule = currentEditingRules[index];
  if (!rule) return;
  
  // Для старых правил без условий
  if (rule.type && rule.pattern && !rule.conditions) {
    const newPattern = prompt(
      `Редактирование правила типа "${getConditionTypeLabel(rule.type)}"\n\nВведите новый шаблон:`,
      rule.pattern
    );
    
    if (newPattern !== null && newPattern.trim()) {
      rule.pattern = newPattern.trim();
      rule.description = `${getConditionTypeLabel(rule.type)}: ${rule.pattern}`;
      updateEditRulesList();
      
      // Автосохранение изменений
      autoSaveRules();
    }
  } 
  // Для новых правил с условиями
  else if (rule.conditions && Array.isArray(rule.conditions)) {
    // Здесь можно было бы реализовать более сложный интерфейс редактирования,
    // но для простоты просто покажем сообщение
    alert('Для редактирования правил с несколькими условиями используйте popup расширения');
  }
}

// Удаление правила
function removeEditRule(index) {
  if (confirm('Удалить это правило?')) {
    currentEditingRules.splice(index, 1);
    updateEditRulesList();
    
    // Автосохранение изменений
    autoSaveRules();
  }
}

// Добавление нового правила
function addNewRule() {
  try {
    // Получаем описание правила
    const ruleDescription = document.getElementById('newRuleDescription').value.trim();
    
    // Получаем условия из формы
    const conditions = getConditionsFromForm();
    
    // Проверяем, что есть хотя бы одно условие
    if (conditions.length === 0) {
      showNotification('Добавьте хотя бы одно условие', 'error');
      return;
    }
    
    // Создаем новое правило
    const newRule = {
      enabled: true,
      description: ruleDescription || generateRuleDescription(conditions),
      conditions: conditions
    };
    
    // Добавляем правило
    currentEditingRules.push(newRule);
    
    // Очищаем форму
    document.getElementById('newRuleDescription').value = '';
    
    // Очищаем условия и добавляем одно пустое
    const conditionsContainer = document.getElementById('newConditionsContainer');
    conditionsContainer.innerHTML = '';
    addConditionUI(conditionsContainer, null, 0);
    updateConditionButtons();
    
    // Обновляем список
    updateEditRulesList();
    
    showNotification('Правило добавлено');
    
    // Автосохранение изменений
    autoSaveRules();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Добавление UI для условия
function addConditionUI(container, condition = null, index) {
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
  container.appendChild(conditionItem);
  
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
    removeCondition(container, index);
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
  const conditionsContainer = document.getElementById('newConditionsContainer');
  const conditionCount = conditionsContainer.children.length;
  
  // Добавляем новое условие
  addConditionUI(conditionsContainer, null, conditionCount);
  
  // Обновляем кнопки условий
  updateConditionButtons();
}

// Удаление условия
function removeCondition(container, index) {
  const conditionItems = container.querySelectorAll('.condition-item');
  
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
  const conditionsContainer = document.getElementById('newConditionsContainer');
  const conditionItems = conditionsContainer.querySelectorAll('.condition-item');
  
  // Показываем/скрываем кнопки удаления в зависимости от количества условий
  conditionItems.forEach(item => {
    const removeBtn = item.querySelector('.remove-condition-btn');
    removeBtn.style.display = conditionItems.length > 1 ? 'block' : 'none';
  });
}

// Получение условий из формы
function getConditionsFromForm() {
  const conditionsContainer = document.getElementById('newConditionsContainer');
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
        return `${getConditionTypeLabel(condition.type)}: "${condition.pattern}"`;
        
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

// Сохранение изменений
function saveRuleChanges() {
  if (!currentEditingSite) return;
  
  const siteEnabledToggle = document.getElementById('siteEnabled');
  
  // Обновляем настройки сайта
  sitePopupRules[currentEditingSite].enabled = siteEnabledToggle.checked;
  sitePopupRules[currentEditingSite].rules = currentEditingRules;
  
  // Сохраняем в storage
  saveSiteRules(sitePopupRules).then(() => {
    // Скрываем интерфейс редактирования
    hideRuleEditor();
    
    // Обновляем список сайтов
    updateSiteList();
    
    showNotification('Изменения сохранены');
  });
}

// Отмена редактирования
function cancelRuleEdit() {
  if (confirm('Отменить изменения? Несохраненные изменения будут потеряны.')) {
    hideRuleEditor();
  }
}

// Скрытие интерфейса редактирования
function hideRuleEditor() {
  const ruleEditSection = document.getElementById('ruleEditSection');
  ruleEditSection.style.display = 'none';
  
  // Сбрасываем переменные
  currentEditingSite = null;
  currentEditingRules = [];
}

// Удаление сайта
function deleteSite(hostname) {
  if (confirm(`Удалить сайт ${hostname} и все его правила?`)) {
    delete sitePopupRules[hostname];
    saveSiteRules(sitePopupRules).then(() => {
      updateSiteList();
      showNotification('Сайт удален');
    });
  }
}

// Экспорт настроек
function exportSettings() {
  const settingsData = document.getElementById('settingsData');
  const importExportArea = document.getElementById('importExportArea');
  
  settingsData.value = JSON.stringify(sitePopupRules, null, 2);
  importExportArea.style.display = 'block';
  
  showNotification('Настройки экспортированы');
}

// Импорт настроек
function importSettings() {
  const importExportArea = document.getElementById('importExportArea');
  const settingsData = document.getElementById('settingsData');
  
  settingsData.value = '';
  importExportArea.style.display = 'block';
  settingsData.focus();
  
  showNotification('Вставьте данные настроек и нажмите "Применить"');
}

// Копирование настроек в буфер обмена
function copySettings() {
  const settingsData = document.getElementById('settingsData');
  
  if (settingsData.value) {
    navigator.clipboard.writeText(settingsData.value).then(() => {
      showNotification('Настройки скопированы в буфер обмена');
    }).catch(() => {
      // Fallback для старых браузеров
      settingsData.select();
      document.execCommand('copy');
      showNotification('Настройки скопированы в буфер обмена');
    });
  }
}

// Применение импортированных настроек
function applyImport() {
  const settingsData = document.getElementById('settingsData');
  
  try {
    const importedRules = JSON.parse(settingsData.value);
    
    // Валидация данных
    if (typeof importedRules !== 'object' || importedRules === null) {
      throw new Error('Неверный формат данных');
    }
    
    // Проверяем структуру каждого сайта
    for (const [hostname, settings] of Object.entries(importedRules)) {
      if (!settings.hasOwnProperty('enabled') || !Array.isArray(settings.rules)) {
        throw new Error(`Неверная структура данных для сайта ${hostname}`);
      }
    }
    
    // Объединяем настройки: добавляем только отсутствующие сайты и правила
    let addedSites = 0;
    let addedRules = 0;
    
    for (const [hostname, importedSettings] of Object.entries(importedRules)) {
      if (!sitePopupRules[hostname]) {
        // Добавляем новый сайт полностью
        sitePopupRules[hostname] = {
          enabled: importedSettings.enabled,
          rules: [...importedSettings.rules]
        };
        addedSites++;
        addedRules += importedSettings.rules.length;
      } else {
        // Сайт уже существует, добавляем только отсутствующие правила
        const existingRules = sitePopupRules[hostname].rules || [];
        
        for (const importedRule of importedSettings.rules) {
          let isDuplicate = false;
          
          // Проверяем дубликаты в зависимости от структуры правила
          if (importedRule.conditions && Array.isArray(importedRule.conditions)) {
            // Новый формат правил с условиями
            isDuplicate = existingRules.some(existingRule => {
              // Если существующее правило не имеет условий, это не дубликат
              if (!existingRule.conditions || !Array.isArray(existingRule.conditions)) {
                return false;
              }
              
              // Если количество условий разное, это не дубликат
              if (existingRule.conditions.length !== importedRule.conditions.length) {
                return false;
              }
              
              // Проверяем каждое условие
              return importedRule.conditions.every(importedCondition => {
                return existingRule.conditions.some(existingCondition => {
                  // Для условий с pattern
                  if (importedCondition.pattern && existingCondition.pattern) {
                    return importedCondition.type === existingCondition.type && 
                           importedCondition.pattern === existingCondition.pattern;
                  }
                  // Для условий с depth
                  else if (importedCondition.depth && existingCondition.depth) {
                    return importedCondition.type === existingCondition.type && 
                           importedCondition.depth === existingCondition.depth;
                  }
                  // Для простых условий (isPopup, isLink)
                  else {
                    return importedCondition.type === existingCondition.type;
                  }
                });
              });
            });
          } 
          // Старый формат правил
          else if (importedRule.type && importedRule.pattern) {
            isDuplicate = existingRules.some(existingRule => 
              (existingRule.type === importedRule.type && 
               existingRule.pattern === importedRule.pattern) ||
              // Проверяем также, нет ли правила с таким же условием в новом формате
              (existingRule.conditions && Array.isArray(existingRule.conditions) &&
               existingRule.conditions.some(condition => 
                 condition.type === importedRule.type && 
                 condition.pattern === importedRule.pattern
               ))
            );
          }
          
          if (!isDuplicate) {
            // Добавляем правило в соответствующем формате
            if (importedRule.conditions && Array.isArray(importedRule.conditions)) {
              existingRules.push({
                enabled: importedRule.enabled !== false,
                description: importedRule.description || generateRuleDescription(importedRule.conditions),
                conditions: importedRule.conditions
              });
            } else if (importedRule.type && importedRule.pattern) {
              existingRules.push({
                type: importedRule.type,
                pattern: importedRule.pattern,
                enabled: importedRule.enabled !== false,
                description: importedRule.description || `${getConditionTypeLabel(importedRule.type)}: ${importedRule.pattern}`
              });
            }
            addedRules++;
          }
        }
        
        sitePopupRules[hostname].rules = existingRules;
      }
    }
    
    // Сохраняем объединенные настройки в Chrome storage
    saveSiteRules(sitePopupRules).then(() => {
      updateSiteList();
      
      document.getElementById('importExportArea').style.display = 'none';
      
      if (addedSites === 0 && addedRules === 0) {
        showNotification('Все настройки уже существуют, ничего не добавлено');
      } else {
        showNotification(`Импорт завершен: добавлено ${addedSites} сайтов и ${addedRules} правил`);
      }
    });
    
  } catch (error) {
    showNotification('Ошибка импорта: ' + error.message, 'error');
  }
}

// Сброс всех настроек
function resetAllSettings() {
  if (confirm('Удалить все настройки блокировки? Это действие нельзя отменить.')) {
    sitePopupRules = {};
    saveSiteRules(sitePopupRules).then(() => {
      updateSiteList();
      showNotification('Все настройки сброшены');
    });
  }
}

// Сохранение настроек
function saveSettings() {
  saveSiteRules(sitePopupRules).then(() => {
    showNotification('Настройки сохранены');
  });
}

// Показ уведомления
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notificationText');
  
  notificationText.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Инициализация
async function init() {
  try {
    // Загружаем правила
    sitePopupRules = await loadSiteRules();
    
    // Обновляем интерфейс
    updateSiteList();
    
    // Добавляем обработчики событий
    document.getElementById('exportSettings').addEventListener('click', exportSettings);
    document.getElementById('importSettings').addEventListener('click', importSettings);
    document.getElementById('copySettings').addEventListener('click', copySettings);
    document.getElementById('applyImport').addEventListener('click', applyImport);
    document.getElementById('resetAllSettings').addEventListener('click', resetAllSettings);
    
    // Обработчики для интерфейса редактирования правил
    document.getElementById('addRuleBtn').addEventListener('click', addNewRule);
    document.getElementById('saveRulesBtn').addEventListener('click', saveRuleChanges);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelRuleEdit);
    
    // Обработчик для кнопки добавления условия
    document.getElementById('addConditionBtn').addEventListener('click', addCondition);
    
    // Инициализируем форму с одним пустым условием
    const conditionsContainer = document.getElementById('newConditionsContainer');
    if (conditionsContainer && conditionsContainer.children.length === 0) {
      addConditionUI(conditionsContainer, null, 0);
      updateConditionButtons();
    }
    
    // Автосохранение при изменении настроек
    const saveDebounced = debounce(saveSettings, 1000);
    
    // Слушаем изменения настроек из других частей расширения
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sitePopupRules) {
        sitePopupRules = changes.sitePopupRules.newValue || {};
        updateSiteList();
      }
    });
    
  } catch (error) {
    console.error('Ошибка инициализации options:', error);
    showNotification('Ошибка загрузки настроек', 'error');
  }
}

// Утилита для debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Запуск инициализации
document.addEventListener('DOMContentLoaded', init);
