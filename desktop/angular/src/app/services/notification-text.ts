import * as catalogData from '../../i18n/notifications.zh-CN.json';
import type { Action, Notification } from './notifications.types';

type TextNotification = Pick<Notification, 'EventID' | 'Title' | 'Message'> & Partial<Notification>;
interface MessageRule {
  events: string[];
  title: string[];
  message: string[];
  numbers?: string[];
  requiredAction?: string;
}
interface ActionRule {
  events: string[];
  source: string;
  target: string;
  ID: string;
  Type: string;
  Visibility: string;
  Payload?: unknown;
  notificationType?: number;
  ignoreVisibility?: boolean;
  payloadFrom?: string;
  settingFromEvent?: string;
  profileIndex?: number;
}
const catalog: { messages: MessageRule[]; actions: ActionRule[] } = catalogData;
const tokens = /\{\{([A-Z_]+)\}\}/g;
const isChinese = (locale: string) => /^zh(?:-CN|-Hans)?$/i.test(locale);
const matchesEvent = (events: string[], id: string) => events.some(event => event.endsWith('*')
  ? id.startsWith(event.slice(0, -1)) : id === event);

// ponytail: exact full templates, not natural-language parsing. Ambiguous delimiters fall back.
function matchTemplate(template: string, value: string, params: Map<string, string>): boolean {
  const parts = template.split(tokens);
  let position = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!value.startsWith(parts[i], position)) return false;
      position += parts[i].length;
    } else {
      const name = parts[i];
      let parameter = params.get(name);
      if (parameter === undefined) {
        const delimiter = parts[i + 1];
        const end = delimiter ? value.indexOf(delimiter, position) : value.length;
        if (end < 0 || (delimiter && value.indexOf(delimiter, end + 1) >= 0)) return false;
        parameter = value.slice(position, end);
        params.set(name, parameter);
      }
      if (!value.startsWith(parameter, position)) return false;
      position += parameter.length;
    }
  }
  return position === value.length;
}

function escapeMarkdown(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+\-.!|~]/g, '\\$&');
}
function render(template: string, params: Map<string, string>, markdown: boolean): string {
  // One pass: placeholders contained in names/errors remain data, never another substitution.
  return template.replace(tokens, (_, name) => markdown ? escapeMarkdown(params.get(name)!) : params.get(name)!);
}

export function localizeNotificationText(notification: TextNotification, markdown = false, locale = $localize.locale || 'en') {
  const raw = { title: notification.Title, message: notification.Message };
  if (!isChinese(locale) || !notification.EventID || notification.EventID.startsWith('broadcasts:')
    || typeof raw.title !== 'string' || typeof raw.message !== 'string') return raw;
  for (const rule of catalog.messages) {
    if (!matchesEvent(rule.events, notification.EventID)) continue;
    if (rule.requiredAction && (notification.Type !== 2
      || !notification.AvailableActions?.some(action => action.ID === rule.requiredAction && !action.Type))) continue;
    const params = new Map<string, string>();
    if (!matchTemplate(rule.title[0], raw.title, params) || !matchTemplate(rule.message[0], raw.message, params)) continue;
    if (rule.numbers?.some(name => !/^[0-9]+$/.test(params.get(name) ?? ''))) continue;
    return { title: render(rule.title[1], params, false), message: render(rule.message[1], params, markdown) };
  }
  return raw;
}

function equalPayload(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
    || Array.isArray(actual) || Array.isArray(expected)) return false;
  const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length
    && Object.keys(b).every(key => Object.prototype.hasOwnProperty.call(a, key) && equalPayload(a[key], b[key]));
}

export function localizeNotificationAction(notification: Notification, action: Action, locale = $localize.locale || 'en'): string {
  if (!isChinese(locale) || !notification.EventID || notification.EventID.startsWith('broadcasts:')) return action.Text;
  const payload = 'Payload' in action ? action.Payload : undefined;
  for (const rule of catalog.actions) {
    if (!matchesEvent(rule.events, notification.EventID) || action.Text !== rule.source
      || action.ID !== rule.ID || (rule.ignoreVisibility ? !!action.Type : action.Type !== rule.Type)
      || (!rule.ignoreVisibility && action.Visibility !== rule.Visibility)
      || (rule.notificationType !== undefined && notification.Type !== rule.notificationType)) continue;
    if (Object.prototype.hasOwnProperty.call(rule, 'Payload') && !equalPayload(payload, rule.Payload)) continue;
    if (rule.payloadFrom && (typeof payload !== 'string' || !payload
      || payload !== notification.EventData?.[rule.payloadFrom])) continue;
    if (rule.settingFromEvent && !equalPayload(payload, { Key: notification.EventID.slice(rule.settingFromEvent.length), Profile: '' })) continue;
    if (rule.profileIndex) {
      const profiles = [1, 2].map(index => notification.AvailableActions?.find(item =>
        item.Text === `Change (${index})` && item.Type === 'open-profile' && item.ID === '' && item.Visibility === ''));
      const values = profiles.map(item => item && 'Payload' in item ? item.Payload : undefined);
      if (values.some(value => typeof value !== 'string' || !value)
        || notification.EventID !== `profiles:match-conflict:${values[0]}:${values[1]}`
        || payload !== values[rule.profileIndex - 1]) continue;
    }
    return rule.target;
  }
  return action.Text;
}
