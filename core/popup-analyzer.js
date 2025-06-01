/**
 * Block Popup - Popup Analyzer Module
 * Анализатор попапов
 */

// Блокировка попапа (скрытие)
window.BlockPopup.blockPopup = function(element) {
  if (element && element.classList) {
    element.classList.add('popup-blocker-analyzing');
    
    // Сохраняем оригинальный display, если его еще нет
    if (!element.hasAttribute('data-original-display')) {
      const computedStyle = window.getComputedStyle(element);
      element.setAttribute('data-original-display', computedStyle.display);
    }
    
    // Устанавливаем display:none напрямую через style
    element.style.display = 'none !important';
    
    // Добавляем элемент в множество заблокированных
    window.BlockPopup.blockedElements = window.BlockPopup.blockedElements || new Set();
    window.BlockPopup.blockedElements.add(element);
    
    // Восстанавливаем скролл страницы
    window.BlockPopup.restorePageScroll();
  }
};

// Восстановление скролла страницы
window.BlockPopup.restorePageScroll = function() {
  try {
    // Восстанавливаем скролл для body
    if (document.body) {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      if (document.body.style.position === 'fixed') {
        document.body.style.position = '';
      }
      if (document.body.style.top) {
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        document.body.style.top = '';
        if (!isNaN(scrollY)) {
          window.scrollTo(0, scrollY);
        }
      }
    }
    
    // Восстанавливаем скролл для html
    if (document.documentElement) {
      if (document.documentElement.style.overflow === 'hidden') {
        document.documentElement.style.overflow = '';
      }
      if (document.documentElement.style.position === 'fixed') {
        document.documentElement.style.position = '';
      }
    }
    
    // Удаляем все блокировщики скролла
    const scrollBlockers = document.querySelectorAll('.scroll-blocker, .no-scroll, .modal-open');
    for (const blocker of scrollBlockers) {
      if (blocker.classList.contains('scroll-blocker')) {
        blocker.classList.remove('scroll-blocker');
      }
      if (blocker.classList.contains('no-scroll')) {
        blocker.classList.remove('no-scroll');
      }
      if (blocker.classList.contains('modal-open')) {
        blocker.classList.remove('modal-open');
      }
    }
    
    window.BlockPopup.debugLog('Скролл страницы восстановлен');
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при восстановлении скролла:', error);
  }
};

// Разблокировка попапа (показ)
window.BlockPopup.unblockPopup = function(element) {
  if (element && element.classList) {
    element.classList.remove('popup-blocker-analyzing');
    
    // Восстанавливаем оригинальный display, если он был сохранен
    if (element.hasAttribute('data-original-display')) {
      const originalDisplay = element.getAttribute('data-original-display');
      element.style.display = originalDisplay;
      element.removeAttribute('data-original-display');
    } else {
      // Если оригинальный display не был сохранен, просто убираем style.display
      element.style.display = '';
    }
    
    // Удаляем элемент из множества заблокированных, если оно существует
    if (window.BlockPopup.blockedElements) {
      window.BlockPopup.blockedElements.delete(element);
    }
  }
};

// Анализ элемента на предмет блокировки
window.BlockPopup.analyzeElement = function(element, rules) {
  try {
    // Проверяем, что элемент еще существует в DOM
    if (!element || !element.parentNode || !document.contains(element)) {
      return;
    }
    
    // Проверяем, является ли элемент критически важным
    const criticalResult = window.BlockPopup.isCriticalElement(element);
    if (criticalResult.isCritical) {
      // Пропускаем критически важные элементы
      return;
    }

    // Если элемент уже обработан, не анализируем его повторно
    if (window.BlockPopup.processedElements.has(element)) {
      return;
    }

    // Добавляем в множество обработанных
    window.BlockPopup.processedElements.add(element);
    
    
    if (window.BlockPopup.isDetectionMode) {
      // Режим определения - показываем кнопку блокировки
      const Style = window.getComputedStyle(element);
      if(window.BlockPopup.isPotentialPopup(element,Style)){
        if (!window.BlockPopup.detectedPopups.has(element)) {
          element.classList.add('popup-blocker-detected');
          window.BlockPopup.detectedPopups.add(element);
          
          // Добавляем обработчик клика
          element.addEventListener('click', (e) => {
            if (e.target === element || element.contains(e.target)) {
              const rect = element.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              
              // Проверяем, клик по кнопке блокировки (правый верхний угол)
              if (clickX > rect.width - 100 && clickY < 50) {
                e.preventDefault();
                e.stopPropagation();
                window.BlockPopup.handleBlockClick(element);
              }
            }
          }, { capture: true });
          
          window.BlockPopup.debugLog('Найден попап для блокировки:', element);
        }
      }
      window.BlockPopup.unblockPopup(element);
    } else {
      // Обычный режим - проверяем правила блокировки
      window.BlockPopup.debugLog('Проверяем:', element.tagName, element.className, element.textContent,element);
      if (window.BlockPopup.matchesBlockRules(element, rules)) {
        window.BlockPopup.debugLog('Заблокирован попап:', element);
        // Оставляем элемент скрытым
        return;
      } else {
        // Показываем попап, который не подпадает под правила блокировки
        window.BlockPopup.unblockPopup(element);
        window.BlockPopup.debugLog('Разрешен попап:', element);
      }
    }

  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при анализе элемента:', error);
    // В случае ошибки показываем элемент
    if (element && element.classList) {
      window.BlockPopup.unblockPopup(element);
    }
  }
};

// Обработка клика по кнопке блокировки
window.BlockPopup.handleBlockClick = function(element) {
  try {
    // Генерируем варианты правил
    const ruleVariants = window.BlockPopup.generateRuleVariants(element);
    
    // Создаем и показываем диалог выбора
    window.BlockPopup.showRuleSelectionDialog(element, ruleVariants)
      .then(selectedRule => {
        if (selectedRule) {
          // Отправляем выбранное правило в popup
          
          
          chrome.runtime.sendMessage({
            action: 'popupDetected',
            ruleData: selectedRule
          }, (response) => {
            if (response && response.success) {
              window.BlockPopup.debugLog('Правило успешно добавлено:', selectedRule);
            } else {
              window.BlockPopup.debugLog('Ошибка добавления правила:', response ? response.error : 'Нет ответа');
            }
          });
          
          // Убираем индикатор
          element.classList.remove('popup-blocker-detected');
          window.BlockPopup.detectedPopups.delete(element);
          
          window.BlockPopup.debugLog('Создано правило:', selectedRule);
        }
      });
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при обработке клика:', error);
  }
};

// Генерация вариантов правил
window.BlockPopup.generateRuleVariants = function(element) {
  const variants = [];
  
  // 1. Правило только по ID (если есть)
  if (element.id) {
    variants.push({
      enabled: true,
      description: `ID: "${element.id}"`,
      priority: 'high',
      conditions: [{
        type: 'id',
        pattern: element.id
      }]
    });
  }
  
  // 2. Правило только по классу (если есть)
  if (element.className) {
    const classes = element.className.split(' ').filter(c => {
      const trimmed = c.trim();
      return trimmed && 
             trimmed !== 'popup-blocker-detected' &&
             trimmed !== 'popup-blocker-analyzing';
    });
    
    if (classes.length > 0) {
      // Берем самый короткий класс (обычно более стабильный)
      const stableClass = classes.sort((a, b) => a.length - b.length)[0];
      
      variants.push({
        enabled: true,
        description: `Класс: "${stableClass}"`,
        priority: 'high',
        conditions: [{
          type: 'class',
          pattern: stableClass
        }]
      });
    }
  }
  
  // 3. Правило по селектору
  const stableSelector = window.BlockPopup.findStableSelector ? window.BlockPopup.findStableSelector(element) : null;
  if (stableSelector) {
    variants.push({
      enabled: true,
      description: `Селектор: "${stableSelector}"`,
      priority: 'medium',
      conditions: [{
        type: 'selector',
        pattern: stableSelector
      }]
    });
  }
  
  // 4. Правило по содержимому (если есть текст)
  const textContent = element.textContent?.trim();
  if (textContent && textContent.length > 3 && textContent.length < 100) {
    const stablePattern = window.BlockPopup.extractStableTextPattern ? 
                          window.BlockPopup.extractStableTextPattern(textContent) : 
                          textContent.substring(0, 50);
    
    if (stablePattern) {
      // Определяем тип условия: если больше одного слова - используем phrase, иначе content
      const wordCount = stablePattern.split(/\s+/).length;
      const conditionType = wordCount > 1 ? 'phrase' : 'content';
      
      variants.push({
        enabled: true,
        description: `${conditionType === 'phrase' ? 'Словосочетание' : 'Содержимое'}: "${stablePattern}"`,
        priority: 'low',
        conditions: [{
          type: conditionType,
          pattern: stablePattern
        }]
      });
    }
  }
  
  // 5. Комбинированное правило (текущая реализация)
  const combinedRule = window.BlockPopup.createRuleFromElement(element);
  combinedRule.priority = 'low';
  variants.push(combinedRule);
  
  return variants;
};

// Показ диалога выбора правила
window.BlockPopup.showRuleSelectionDialog = function(element, ruleVariants) {
  // Создаем диалог
  const dialog = document.createElement('div');
  dialog.className = 'popup-blocker-rule-dialog';
  
  // Заголовок
  const header = document.createElement('div');
  header.className = 'rule-dialog-header';
  header.textContent = 'Выберите правило блокировки:';
  dialog.appendChild(header);
  
  // Список вариантов
  const variantsList = document.createElement('div');
  variantsList.className = 'rule-variants-list';
  
  // Сортируем варианты по приоритету
  ruleVariants.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority || 'low'] - priorityOrder[b.priority || 'low'];
  });
  
  // Добавляем варианты в список
  ruleVariants.forEach((variant, index) => {
    const variantItem = document.createElement('div');
    variantItem.className = `rule-variant-item ${variant.priority || 'low'}-priority`;
    variantItem.innerHTML = `
      <div class="variant-description">${variant.description}</div>
      <button class="select-variant-btn" data-index="${index}">Выбрать</button>
    `;
    variantsList.appendChild(variantItem);
  });
  
  dialog.appendChild(variantsList);
  
  // Кнопка закрытия
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-dialog-btn';
  closeBtn.textContent = 'Отмена';
  dialog.appendChild(closeBtn);
  
  // Позиционируем диалог рядом с элементом
  const rect = element.getBoundingClientRect();
  dialog.style.position = 'fixed';
  dialog.style.top = `${rect.top + window.scrollY}px`;
  dialog.style.left = `${rect.right + window.scrollX + 10}px`;
  
  // Проверяем, не выходит ли диалог за пределы экрана
  setTimeout(() => {
    const dialogRect = dialog.getBoundingClientRect();
    if (dialogRect.right > window.innerWidth) {
      dialog.style.left = `${window.innerWidth - dialogRect.width - 10}px`;
    }
    if (dialogRect.bottom > window.innerHeight) {
      dialog.style.top = `${window.innerHeight - dialogRect.height - 10}px`;
    }
  }, 0);
  
  // Добавляем диалог на страницу
  document.body.appendChild(dialog);
  
  // Возвращаем Promise, который разрешится выбранным правилом
  return new Promise((resolve) => {
    // Обработчики для кнопок выбора
    dialog.addEventListener('click', (e) => {
      if (e.target.classList.contains('select-variant-btn')) {
        const index = parseInt(e.target.dataset.index);
        document.body.removeChild(dialog);
        resolve(ruleVariants[index]);
      }
    });
    
    // Обработчик для кнопки закрытия
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
    
    // Закрытие по клику вне диалога
    document.addEventListener('click', function closeOutside(e) {
      if (!dialog.contains(e.target) && e.target !== dialog) {
        document.body.removeChild(dialog);
        document.removeEventListener('click', closeOutside);
        resolve(null);
      }
    }, { once: true, capture: true });
  });
};

// Проверка существующих элементов на соответствие правилам (только попапы)
window.BlockPopup.checkExistingPopupsForRules = function(rules) {
  try {
    // Фильтруем только включенные правила
    const enabledRules = rules.filter(rule => rule.enabled !== false);
    
    if (enabledRules.length === 0) {
      window.BlockPopup.debugLog('Нет включенных правил для проверки существующих элементов');
      return;
    }
    
    window.BlockPopup.debugLog('Проверка существующих попапов на соответствие включенным правилам');
    
    // Ищем все элементы с позиционированием
    const allElements = document.querySelectorAll('*');
    let newBlockedCount = 0;
    
    for (const element of allElements) {
      if (element && element.nodeType === Node.ELEMENT_NODE && document.contains(element)) {
        // Пропускаем критически важные элементы
        const criticalResult = window.BlockPopup.isCriticalElement(element);
        if (criticalResult.isCritical) {
          // window.BlockPopup.debugLog('Пропущен критический элемент:', criticalResult.reason);
          continue;
        }
        
        // Проверяем на соответствие включенным правилам блокировки
        if (window.BlockPopup.matchesBlockRules(element, enabledRules)) {
          window.BlockPopup.blockPopup(element);
          newBlockedCount++;
          window.BlockPopup.debugLog('Заблокирован существующий попап:', element);
        }
      }
    }
    
    // Обновляем счетчик и значок
    window.BlockPopup.blockedCount += newBlockedCount;
    window.BlockPopup.updateBadge();
    
    window.BlockPopup.debugLog('Заблокировано существующих попапов:', newBlockedCount);
    
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при проверке существующих элементов:', error);
  }
};

console.log('[Block Popup] Popup Analyzer module loaded');
