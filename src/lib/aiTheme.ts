import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { resolveMasterAccess } from './masterControl';
import { writeAdminAudit } from './audit';
import type { AIThemeConfig, SiteConfig } from '../types';

export const DEFAULT_AI_THEME: AIThemeConfig = {
  primary: '#FF00E5',
  secondary: '#2457FF',
  accent: '#00E0FF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#000000',
  text: '#000000',
  mutedText: '#525252',
  buttonText: '#000000',
  hover: '#FFD600',
  active: '#2457FF',
  inputBackground: '#FFFFFF',
  inputBorder: '#000000',
  userMessage: '#FFFFFF',
  assistantMessage: '#FF00E5',
  source: '#E9E9E9',
  link: '#2457FF',
  icon: '#000000',
  header: '#FF00E5',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const AI_THEME_KEYS: Array<keyof AIThemeConfig> = [
  'primary','secondary','accent','background','surface','border','text','mutedText','buttonText',
  'hover','active','inputBackground','inputBorder','userMessage','assistantMessage','source','link','icon','header'
];

export function normalizeAITheme(input?: Partial<AIThemeConfig> | null): AIThemeConfig {
  const next = { ...DEFAULT_AI_THEME, ...(input || {}) } as AIThemeConfig;
  for (const key of AI_THEME_KEYS) {
    if (!HEX_RE.test(String(next[key]))) next[key] = DEFAULT_AI_THEME[key];
  }
  return next;
}

export function validateAITheme(input: Partial<AIThemeConfig>): { valid: boolean; errors: string[]; theme: AIThemeConfig } {
  const errors: string[] = [];
  const theme = { ...DEFAULT_AI_THEME, ...(input || {}) } as AIThemeConfig;
  for (const key of AI_THEME_KEYS) {
    const value = String(theme[key] ?? '');
    if (!HEX_RE.test(value)) errors.push(`${key} must be a 6-digit HEX color.`);
  }
  const optionalKeys = ['updatedAt','updatedBy'];
  for (const key of Object.keys(input || {})) {
    if (!AI_THEME_KEYS.includes(key as keyof AIThemeConfig) && !optionalKeys.includes(key)) errors.push(`Unsupported AI theme key: ${key}`);
  }
  return { valid: errors.length === 0, errors, theme: normalizeAITheme(theme) };
}

export function subscribeAITheme(callback: (theme: AIThemeConfig) => void): () => void {
  return onSnapshot(doc(db, 'siteConfig', 'global'), snap => {
    const site = snap.exists() ? (snap.data() as Partial<SiteConfig>) : {};
    callback(normalizeAITheme(site.aiTheme));
  }, () => callback(DEFAULT_AI_THEME));
}

export async function getAITheme(): Promise<AIThemeConfig> {
  try {
    const snap = await getDoc(doc(db, 'siteConfig', 'global'));
    return normalizeAITheme(snap.exists() ? (snap.data() as Partial<SiteConfig>).aiTheme : undefined);
  } catch {
    return DEFAULT_AI_THEME;
  }
}

export async function saveAITheme(theme: AIThemeConfig): Promise<void> {
  const actor = auth.currentUser;
  if (!(await resolveMasterAccess(actor))) throw new Error('Master admin access required.');
  const checked = validateAITheme(theme);
  if (!checked.valid) throw new Error(checked.errors.join(' '));
  const ref = doc(db, 'siteConfig', 'global');
  const before = await getDoc(ref).catch(() => null);
  await setDoc(ref, {
    aiTheme: {
      ...checked.theme,
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || '',
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
  try {
    await writeAdminAudit('changed AI theme', 'siteConfig/global.aiTheme', before?.exists() ? before.data()?.aiTheme ?? null : null, checked.theme);
  } catch (error) {
    console.warn('AI theme audit write failed:', error);
  }
}

export function applyAIThemeToDocument(theme: AIThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const normalized = normalizeAITheme(theme);
  const vars: Record<string,string> = {
    '--ai-primary': normalized.primary,
    '--ai-secondary': normalized.secondary,
    '--ai-accent': normalized.accent,
    '--ai-background': normalized.background,
    '--ai-surface': normalized.surface,
    '--ai-border': normalized.border,
    '--ai-text': normalized.text,
    '--ai-muted-text': normalized.mutedText,
    '--ai-button-text': normalized.buttonText,
    '--ai-hover': normalized.hover,
    '--ai-active': normalized.active,
    '--ai-input-background': normalized.inputBackground,
    '--ai-input-border': normalized.inputBorder,
    '--ai-user-message': normalized.userMessage,
    '--ai-assistant-message': normalized.assistantMessage,
    '--ai-source': normalized.source,
    '--ai-link': normalized.link,
    '--ai-icon': normalized.icon,
    '--ai-header': normalized.header,
  };
  Object.entries(vars).forEach(([name,value]) => root.style.setProperty(name,value));
}
