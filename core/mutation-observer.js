/**
 * Block Popup - Mutation Observer Module
 * Наблюдатель за DOM
 */

// Установка MutationObserver для отслеживания новых элементов
window.BlockPopup.setupPopupObserver = function(rules) {

  
  // Фильтруем только включенные правила
  const enabledRules = rules.filter(rule => rule.enabled !== false);
  
  // Наблюдатель за DOM
  window.BlockPopup.popupObserver = new MutationObserver((mutations) => {
    try {
      let newBlockedCount = 0;
      
      for (const mutation of mutations) {
        // Обработка добавленных элементов
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            
            if (node && node.nodeType === Node.ELEMENT_NODE && document.contains(node)) {
              
              window.BlockPopup.debugLog('Добавлен элемент ',node.tagName, node.className, node.textContent, node);
              // Проверяем, добавлен ли элемент со стилями, влияющими на скролл
              
              // Пропускаем критически важные элементы
              let isCritical = window.BlockPopup.isCriticalElement(node);
              if (isCritical.isCritical) {
                window.BlockPopup.debugLog('isCriticalElement ',isCritical, node.tagName, node.className, node.textContent, node);
                continue;
              }
              // Сначала проверяем на соответствие включенным правилам блокировки
              if (window.BlockPopup.matchesBlockRules(node, enabledRules)) {
                window.BlockPopup.blockPopup(node);
                continue; // Не анализируем дальше
              }
              
              // Анализируем элемент с небольшой задержкой
              setTimeout(() => {
                // Сначала проверяем на соответствие включенным правилам блокировки
                if (window.BlockPopup.matchesBlockRules(node, enabledRules)) {
                  window.BlockPopup.blockPopup(node);
                }
              }, 50);
            }
          }
        }
        
        // Защита от изменений заблокированных элементов
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          
          // Проверяем, соответствует ли изменяемый элемент правилам блокировки ПОСЛЕ изменения
          if (target && target.nodeType === Node.ELEMENT_NODE && document.contains(target)) {
            // Пропускаем изменения, вызванные самой блокировкой
            if (mutation.attributeName === 'class' && 
                (target.classList.contains('popup-blocker-analyzing') || 
                 target.classList.contains('popup-blocker-detected'))) {
              window.BlockPopup.debugLog('Пропускаем изменение класса, вызванное блокировкой:', target);
              continue;
            }
            
            window.BlockPopup.debugLog('Изменен элемент ',target.tagName, target.textContent,target.className, target);
            // Пропускаем критически важные элементы
            let isCritical = window.BlockPopup.isCriticalElement(target);
            if (isCritical.isCritical) {
              window.BlockPopup.debugLog('isCriticalElement ',isCritical, target.tagName, target.className, target.textContent, target);
              continue;
            }else{
              // Проверяем, соответствует ли элемент правилам блокировки
              if (window.BlockPopup.matchesBlockRules(target, enabledRules)) {
                window.BlockPopup.blockPopup(target);
                window.BlockPopup.debugLog('Восстановлена блокировка попапа после изменения:', target);
              }
            }
          }
        }
        // Для изменений содержимого
        if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target && target.nodeType === Node.TEXT_NODE && document.contains(target)) {
            if(target.textContent.includes('c29dda069')) window.BlockPopup.debugLog('Изменено содержимое тега c29dda069:', {
                oldValue: mutation.oldValue,
                newValue: target.textContent,
                element: parentElement
              });
            const parentElement = target.parentElement;
            if (parentElement && parentElement.tagName === 'STYLE') {
              window.BlockPopup.debugLog('Изменено содержимое тега style:', {
                oldValue: mutation.oldValue,
                newValue: target.textContent,
                element: parentElement
              });
            }
          }
        }
      }
      
      // Обновляем счетчик и значок если были заблокированы новые элементы
      if (newBlockedCount > 0) {
        window.BlockPopup.blockedCount += newBlockedCount;
        window.BlockPopup.updateBadge();
      }
    } catch (error) {
      console.warn('[Block Popup] Ошибка в MutationObserver:', error);
    }
  });
  
  // Запускаем наблюдение с расширенными параметрами
  window.BlockPopup.popupObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true
  });
  
  window.BlockPopup.debugLog('MutationObserver установлен для', window.BlockPopup.currentHost);
  return window.BlockPopup.popupObserver;
};

console.log('[Block Popup] Mutation Observer module loaded');
