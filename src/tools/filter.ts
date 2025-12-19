/**
 * Generates a filter expression string with placeholder parameters.
 *
 * @param expr - The filter expression with placeholders (e.g., "title = {:title}")
 * @param params - The parameter values to bind
 * @returns The formatted filter string
 */
export function filter(
  expr: string,
  params: Record<string, unknown> = {}
): string {
  if (!params || Object.keys(params).length === 0) {
    return expr;
  }

  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{:${key}}`;
    const replacement = formatValue(value);
    expr = expr.split(placeholder).join(replacement);
  }

  return expr;
}

/**
 * Formats a value for use in a filter expression.
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    // Format as PocketBase datetime string
    return `'${value.toISOString().replace('T', ' ').replace('Z', '')}'`;
  }

  if (typeof value === 'string') {
    // Escape single quotes and wrap in single quotes
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  // For objects and arrays, use JSON.stringify
  return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
}

