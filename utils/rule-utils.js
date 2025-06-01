/**
 * Block Popup - Rule Utilities Module
 * Утилиты для работы с правилами
 */

// Проверка на соответствие правилам блокировки (только включенные правила)
window.BlockPopup.matchesBlockRules = function(element, rules) {
  try {
    // Не блокируем критически важные элементы
    const criticalResult = window.BlockPopup.isCriticalElement(element);
    if (criticalResult.isCritical) {
      // window.BlockPopup.debugLog('Пропущен критический элемент:', criticalResult.reason);
      return false;
    }
    
    // Фильтруем только включенные правила
    const enabledRules = rules.filter(rule => rule.enabled !== false);
    
    for (const rule of enabledRules) {
      // Проверяем правила с несколькими условиями
      if (rule.conditions && Array.isArray(rule.conditions)) {
        // Разделяем условия на попап-условия и обычные условия
        const popupConditions = rule.conditions.filter(condition => 
          condition.type === 'isPopup' || 
          condition.type === 'hasPopupParent' || 
          condition.type === 'hasPopupChild'
        );
        
        const otherConditions = rule.conditions.filter(condition => 
          condition.type !== 'isPopup' && 
          condition.type !== 'hasPopupParent' && 
          condition.type !== 'hasPopupChild'
        );
        
        // Проверяем, есть ли попап-условия
        if (popupConditions.length > 0) {
          // Должно выполняться хотя бы одно попап-условие
          let anyPopupConditionMet = false;
          
          for (const condition of popupConditions) {
            if (window.BlockPopup.checkCondition(element, condition)) {
              anyPopupConditionMet = true;
              break;
            }
          }
          
          // Если ни одно попап-условие не выполнено, пропускаем правило
          if (!anyPopupConditionMet) {
            continue;
          }
        }
        
        // Проверяем остальные условия (все должны выполняться)
        let allOtherConditionsMet = true;
        
        for (const condition of otherConditions) {
          // window.BlockPopup.debugLog('Правило:', rule.description);
          if (!window.BlockPopup.checkCondition(element, condition)) {
            // if(element.tagName == 'A' && element.className.includes('yrw-url')) {
            //   window.BlockPopup.debugLog('Проверка:',element.tagName, element);
            //   window.BlockPopup.debugLog('Проверка:',element.tagName,allOtherConditionsMet,condition);
            // }
            allOtherConditionsMet = false;
            break;
          }
        }
        
        // Если все обычные условия выполнены (и хотя бы одно попап-условие, если они есть)
        if (allOtherConditionsMet) {
          window.BlockPopup.debugLog('Совпадение по правилу:', rule.description);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при проверке правил:', error);
    return false;
  }
};

// Проверка отдельного условия
window.BlockPopup.checkCondition = function(element, condition) {
  try {
    switch (condition.type) {
      case 'content':
        return element.textContent && 
               element.textContent.toLowerCase().includes(condition.pattern.toLowerCase());
      
      case 'outerHTML':
        return element.outerHTML && 
               element.outerHTML.toLowerCase().includes(condition.pattern.toLowerCase());
      
      case 'isLink':
        return element.tagName === 'A';
      
      case 'isPopup':
        const style = window.getComputedStyle(element);
        return window.BlockPopup.isPotentialPopup(element, style);
      
      case 'hasPopupParent':
        const maxDepthUp = condition.depth || 2;
        let parent = element.parentElement;
        let depthUp = 0;
        
        while (parent && depthUp < maxDepthUp) {
          const parentStyle = window.getComputedStyle(parent);
          if (window.BlockPopup.isPotentialPopup(parent, parentStyle)) {
            return true;
          }
          parent = parent.parentElement;
          depthUp++;
        }
        return false;
      
      case 'hasPopupChild':
        const maxDepthDown = condition.depth || 3;
        return window.BlockPopup.hasPopupDescendant(element, maxDepthDown);
      
      case 'phrase':
        return element.textContent && 
               window.BlockPopup.containsPhrase(element.textContent, condition.pattern);
      
      case 'selector':
        try {
          return element.matches(condition.pattern);
        } catch (e) {
          window.BlockPopup.debugLog('Неверный селектор:', condition.pattern);
          return false;
        }
      
      case 'class':
        return element.className && 
               element.className.includes(condition.pattern);
      
      case 'id':
        return element.id && 
               element.id.includes(condition.pattern);
      
      default:
        return false;
    }
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при проверке условия:', error);
    return false;
  }
};

// Проверка наличия попапов среди потомков
window.BlockPopup.hasPopupDescendant = function(element, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return false;
  
  for (const child of element.children) {
    const style = window.getComputedStyle(child);
    if (window.BlockPopup.isPotentialPopup(child, style)) {
      return true;
    }
    
    if (window.BlockPopup.hasPopupDescendant(child, maxDepth, currentDepth + 1)) {
      return true;
    }
  }
  
  return false;
};

// Создание правила из элемента
window.BlockPopup.createRuleFromElement = function(element) {
  try {
    const conditions = [];
    let description = '';
    
    // Проверяем, является ли элемент попапом
    const style = window.getComputedStyle(element);
    const isPopup = window.BlockPopup.isPotentialPopup(element, style);
    
    if (isPopup) {
      conditions.push({
        type: 'isPopup',
        value: true
      });
      description += 'Попап';
    }
    
    // Проверяем, является ли элемент ссылкой
    if (element.tagName === 'A') {
      conditions.push({
        type: 'isLink',
        value: true
      });
      description += description ? ' + Ссылка' : 'Ссылка';
    }
    
    // Проверяем текстовое содержимое
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 3 && textContent.length < 100) {
      const stablePattern = window.BlockPopup.extractStableTextPattern(textContent);
      if (stablePattern) {
        // Определяем тип условия: если больше одного слова - используем phrase, иначе content
        const wordCount = stablePattern.split(/\s+/).length;
        const conditionType = wordCount > 1 ? 'phrase' : 'content';
        
        conditions.push({
          type: conditionType,
          pattern: stablePattern
        });
        
        description += description ? ` + ${conditionType === 'phrase' ? 'Словосочетание' : 'Содержимое'}: "${stablePattern}"` : 
                                    `${conditionType === 'phrase' ? 'Словосочетание' : 'Содержимое'}: "${stablePattern}"`;
      }
    }
    
    // Проверяем outerHTML
    const outerHTML = element.outerHTML;
    if (outerHTML && outerHTML.length > 0) {
      // Ищем ключевые слова в outerHTML
      const keywords = ['реклама', 'advert', 'banner', 'promo', 'sponsor'];
      for (const keyword of keywords) {
        if (outerHTML.toLowerCase().includes(keyword)) {
          conditions.push({
            type: 'outerHTML',
            pattern: keyword
          });
          
          description += description ? ` + HTML содержит: "${keyword}"` : `HTML содержит: "${keyword}"`;
          break;
        }
      }
    }
    
    // Проверяем ID
    if (element.id) {
      conditions.push({
        type: 'id',
        pattern: element.id
      });
      
      description += description ? ` + ID: "${element.id}"` : `ID: "${element.id}"`;
    }
    
    // Проверяем классы (только стабильные, исключая служебные классы расширения)
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
        
        conditions.push({
          type: 'class',
          pattern: stableClass
        });
        
        description += description ? ` + Класс: "${stableClass}"` : `Класс: "${stableClass}"`;
      }
    }
    
    // Если у нас меньше двух условий, добавляем дополнительные
    if (conditions.length < 2) {
      // Проверяем родительские элементы на наличие попапов
      let hasPopupParent = false;
      let parent = element.parentElement;
      let depthUp = 0;
      
      while (parent && depthUp < 2) {
        const parentStyle = window.getComputedStyle(parent);
        if (window.BlockPopup.isPotentialPopup(parent, parentStyle)) {
          hasPopupParent = true;
          conditions.push({
            type: 'hasPopupParent',
            depth: depthUp + 1
          });
          
          description += description ? ` + Родитель-попап (до уровня ${depthUp + 1})` : `Родитель-попап (до уровня ${depthUp + 1})`;
          break;
        }
        parent = parent.parentElement;
        depthUp++;
      }
      
      // Если нет родителей-попапов, проверяем потомков
      if (!hasPopupParent && conditions.length < 2) {
        if (window.BlockPopup.hasPopupDescendant(element, 3)) {
          conditions.push({
            type: 'hasPopupChild',
            depth: 3
          });
          
          description += description ? ' + Потомок-попап (до уровня 3)' : 'Потомок-попап (до уровня 3)';
        }
      }
    }
    
    // Если у нас все еще меньше двух условий, добавляем селектор
    if (conditions.length < 2) {
      // Ищем стабильный селектор
      const stableSelector = window.BlockPopup.findStableSelector(element);
      if (stableSelector) {
        conditions.push({
          type: 'selector',
          pattern: stableSelector
        });
        
        description += description ? ` + Селектор: "${stableSelector}"` : `Селектор: "${stableSelector}"`;
      } else {
        // В крайнем случае используем тег с позицией
        const tagName = element.tagName.toLowerCase();
        const siblings = Array.from(element.parentElement?.children || [])
          .filter(el => el.tagName.toLowerCase() === tagName);
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(element) + 1;
          const selector = `${tagName}:nth-of-type(${index})`;
          
          conditions.push({
            type: 'selector',
            pattern: selector
          });
          
          description += description ? ` + Селектор: "${selector}"` : `Селектор: "${selector}"`;
        } else {
          conditions.push({
            type: 'selector',
            pattern: tagName
          });
          
          description += description ? ` + Тег: "${tagName}"` : `Тег: "${tagName}"`;
        }
      }
    }
    
    // Создаем правило с условиями
    return {
      enabled: true,
      description: description || 'Комбинированное правило',
      conditions: conditions
    };
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при создании правила:', error);
    return {
      enabled: true,
      description: 'Правило по умолчанию',
      conditions: [
        {
          type: 'selector',
          pattern: 'div'
        },
        {
          type: 'isPopup',
          value: true
        }
      ]
    };
  }
};

console.log('[Block Popup] Rule Utils module loaded');
