/**
 * Shared Formula Evaluator
 * Evaluates a saved formula block-set against a rawLevel value.
 * Used by ALL pages to ensure consistent water level display.
 *
 * Formula block types:
 *   { type: 'number', value: '1.6', label: 'Bank' }
 *   { type: 'operator', value: '-' }
 *   { type: 'variable', value: 'RAW', label: 'Raw Level' }
 *   { type: 'customVar', id: 'var_xxx', label: 'Name' }
 *
 * @param {Array} formula - Array of formula blocks
 * @param {number} rawLevel - The current raw sensor value
 * @param {Array} customVariables - Custom variables from settings
 * @returns {number|null} Evaluated result, or null if formula is empty/invalid
 */
export function evaluateFormula(formula, rawLevel, customVariables) {
  if (!formula || !Array.isArray(formula) || formula.length === 0) return null;

  let expression = '';
  for (const block of formula) {
    if (block.type === 'number') {
      expression += block.value + ' ';
    } else if (block.type === 'customVar') {
      const cv = (customVariables || []).find(v => v.id === block.id);
      const val = cv ? cv.value : 0;
      expression += val + ' ';
    } else if (block.type === 'variable' && block.value === 'RAW') {
      expression += rawLevel + ' ';
    } else if (block.type === 'operator') {
      expression += block.value + ' ';
    }
  }

  try {
    const evalExpr = expression.replace(/×/g, '*').replace(/÷/g, '/');
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + evalExpr)();
    if (!isFinite(result) || isNaN(result)) return null;
    return Number(Number(result).toFixed(3));
  } catch (e) {
    return null;
  }
}

/**
 * Calculate the display water level for a station.
 * Priority:
 *   1. If displayMode === 'raw' → use rawValue
 *   2. If station has a formula → evaluate formula dynamically
 *   3. Fallback → rawValue + offset
 *
 * @param {Object} config - Station config from settings (e.g. settings.stations[id])
 * @param {number} rawValue - True raw sensor value
 * @param {string} displayMode - 'raw' | 'calibrated'
 * @param {Array} customVariables - Custom variables from settings
 * @returns {number} Display water level
 */
export function getDisplayWaterLevel(config, rawValue, displayMode, customVariables) {
  if (displayMode === 'raw') return rawValue;

  const offset = parseFloat(config?.offset) || 0;

  // 🎯 Prefer dynamic formula evaluation over fixed offset
  if (config?.formula && Array.isArray(config.formula) && config.formula.length > 0) {
    const formulaResult = evaluateFormula(config.formula, rawValue, customVariables);
    if (formulaResult !== null) return formulaResult;
  }

  return rawValue + offset;
}
