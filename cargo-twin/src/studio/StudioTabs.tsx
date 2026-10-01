import type { ComponentProps, KeyboardEvent } from 'react';
import { Icon } from './StudioIcons';

interface StudioTab<Id extends string> {
  id: Id;
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  tabId: string;
  panelId: string;
}

interface StudioTabsProps<Id extends string> {
  label: string;
  options: readonly StudioTab<Id>[];
  value: Id;
  onChange: (value: Id) => void;
}

export function StudioTabs<Id extends string>({ label, options, value, onChange }: StudioTabsProps<Id>) {
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const directions: Record<string, number> = { ArrowRight: (index + 1) % options.length, ArrowLeft: (index - 1 + options.length) % options.length, Home: 0, End: options.length - 1 };
    const next = directions[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(options[next].id);
    document.getElementById(options[next].tabId)?.focus();
  }

  return <div role="tablist" aria-label={label}>
    {options.map((option, index) => <button key={option.id} id={option.tabId} role="tab" type="button"
      aria-controls={option.panelId} aria-selected={value === option.id} tabIndex={value === option.id ? 0 : -1}
      className={value === option.id ? 'active' : ''} onClick={() => onChange(option.id)} onKeyDown={event => navigate(event, index)}>
      <Icon name={option.icon} size={17} />{option.label}
    </button>)}
  </div>;
}
