import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed } from '@angular/core';

export type IconName =
  | 'refresh'
  | 'signal'
  | 'alert'
  | 'wrench'
  | 'clock'
  | 'car'
  | 'map'
  | 'pin'
  | 'clipboard'
  | 'phone'
  | 'mic'
  | 'bell'
  | 'search'
  | 'user'
  | 'lock'
  | 'shield'
  | 'folder'
  | 'eye'
  | 'edit'
  | 'check'
  | 'mail'
  | 'chevron-left'
  | 'menu'
  | 'calendar'
  | 'download'
  | 'trending-up';

type IconDef = {
  viewBox: string;
  strokeWidth?: number;
  paths: string[];
};

const ICONS: Record<IconName, IconDef> = {
  refresh: {
    viewBox: '0 0 24 24',
    paths: ['M20 11a8 8 0 1 0 2 5.3', 'M20 4v7h-7']
  },
  signal: {
    viewBox: '0 0 24 24',
    paths: ['M3 18h3', 'M7 14h3', 'M11 10h3', 'M15 6h3', 'M19 3h2']
  },
  alert: {
    viewBox: '0 0 24 24',
    paths: ['M12 3 2.6 19h18.8L12 3Z', 'M12 9v4.5', 'M12 17h.01']
  },
  wrench: {
    viewBox: '0 0 24 24',
    paths: ['M14.7 6.3a4 4 0 0 0 5 5l-8.9 8.9a2 2 0 1 1-2.8-2.8l8.9-8.9a4 4 0 0 0-5-5l2.4 2.4-1.4 1.4-2.2-2.2']
  },
  clock: {
    viewBox: '0 0 24 24',
    paths: ['M12 6v6l4 2', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z']
  },
  car: {
    viewBox: '0 0 24 24',
    paths: ['M5 16 3.5 12l2-5h13l2 5L19 16', 'M5 16h14', 'M7.5 16v2', 'M16.5 16v2', 'M6.5 12h.01', 'M17.5 12h.01']
  },
  map: {
    viewBox: '0 0 24 24',
    paths: ['M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20V6.5Z', 'M8.5 4v13.5', 'M15.5 6.5V20']
  },
  pin: {
    viewBox: '0 0 24 24',
    paths: ['M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z']
  },
  clipboard: {
    viewBox: '0 0 24 24',
    paths: ['M9 4h6', 'M9 3a1 1 0 0 0-1 1v1h8V4a1 1 0 0 0-1-1', 'M8 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M9 10h6', 'M9 14h6']
  },
  phone: {
    viewBox: '0 0 24 24',
    paths: ['M4.5 5.5a2 2 0 0 1 2-2h1.8a1 1 0 0 1 1 .8l.8 3.6a1 1 0 0 1-.5 1.1l-1.6.9a15 15 0 0 0 5.8 5.8l.9-1.6a1 1 0 0 1 1.1-.5l3.6.8a1 1 0 0 1 .8 1v1.8a2 2 0 0 1-2 2h-1C9.9 20.5 3.5 14.1 3.5 6.5v-1Z']
  },
  mic: {
    viewBox: '0 0 24 24',
    paths: ['M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3', 'M9 21h6']
  },
  bell: {
    viewBox: '0 0 24 24',
    paths: ['M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9', 'M10 20a2 2 0 0 0 4 0']
  },
  search: {
    viewBox: '0 0 24 24',
    paths: ['M21 21l-4.3-4.3', 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z']
  },
  user: {
    viewBox: '0 0 24 24',
    paths: ['M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0']
  },
  lock: {
    viewBox: '0 0 24 24',
    paths: ['M7 11V8a5 5 0 0 1 10 0v3', 'M6 11h12v10H6z', 'M12 15v2']
  },
  shield: {
    viewBox: '0 0 24 24',
    paths: ['M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6l-7-3Z', 'M9.5 12.5 11 14l3.5-4']
  },
  folder: {
    viewBox: '0 0 24 24',
    paths: ['M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z']
  },
  eye: {
    viewBox: '0 0 24 24',
    paths: ['M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z']
  },
  edit: {
    viewBox: '0 0 24 24',
    paths: ['M4 20h4l10-10-4-4L4 16v4Z', 'M13.5 6.5 17.5 10.5', 'M15.5 4.5l4 4']
  },
  check: {
    viewBox: '0 0 24 24',
    paths: ['M5 12.5 9.5 17 19 7.5']
  },
  mail: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16v12H4z', 'M4.5 7 12 13l7.5-6']
  },
  'chevron-left': {
    viewBox: '0 0 24 24',
    paths: ['M15 18l-6-6 6-6']
  },
  menu: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16', 'M4 12h16', 'M4 18h16']
  },
  calendar: {
    viewBox: '0 0 24 24',
    paths: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z', 'M16 3v4', 'M8 3v4', 'M4 11h16']
  },
  download: {
    viewBox: '0 0 24 24',
    paths: ['M12 3v12', 'M8 11l4 4 4-4', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2']
  },
  'trending-up': {
    viewBox: '0 0 24 24',
    paths: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6']
  }
};

export function getIconDefinition(name: IconName): IconDef {
  return ICONS[name] ?? ICONS.alert;
}

export function buildInlineIconSvg(
  name: IconName,
  options?: { size?: number; strokeWidth?: number; className?: string }
): string {
  const definition = getIconDefinition(name);
  const size = options?.size ?? 18;
  const strokeWidth = options?.strokeWidth ?? definition.strokeWidth ?? 1.9;
  const className = options?.className ? ` class="${options.className}"` : '';
  const paths = definition.paths.map((path) => `<path d="${path}"></path>`).join('');

  return `<svg${className} viewBox="${definition.viewBox}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      class="app-icon"
      [attr.viewBox]="definition().viewBox"
      [style.width.px]="size"
      [style.height.px]="size"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="definition().strokeWidth ?? strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path *ngFor="let path of definition().paths" [attr.d]="path"></path>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      line-height: 0;
      flex-shrink: 0;
    }
    .app-icon {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppIconComponent {
  @Input() name: IconName = 'alert';
  @Input() size = 18;
  @Input() strokeWidth = 1.9;

  readonly definition = computed(() => getIconDefinition(this.name));
}
