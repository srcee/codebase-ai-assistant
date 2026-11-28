import {
  ActionIcon,
  ColorSwatch,
  Group,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
  type MantineColorScheme,
} from '@mantine/core';
import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { useAccent } from '../theme/accent-context';
import { ACCENTS } from '../theme/accents';

const SCHEMES: Record<
  MantineColorScheme,
  { next: MantineColorScheme; label: string; Icon: typeof IconSun }
> = {
  light: { next: 'dark', label: 'Light', Icon: IconSun },
  dark: { next: 'auto', label: 'Dark', Icon: IconMoon },
  auto: { next: 'light', label: 'System', Icon: IconDeviceDesktop },
};

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function ThemeControls() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { accent, setAccent } = useAccent();
  const theme = useMantineTheme();
  const scheme = SCHEMES[colorScheme];

  return (
    <Group gap="xs" wrap="nowrap">
      <Group gap={6} role="group" aria-label="Accent color" wrap="nowrap">
        {ACCENTS.map((option) => (
          <Tooltip key={option} label={capitalize(option)} withArrow>
            <ColorSwatch
              component="button"
              type="button"
              size={18}
              color={theme.colors[option][6]}
              aria-label={`${capitalize(option)} accent`}
              aria-pressed={accent === option}
              onClick={() => setAccent(option)}
              style={{ color: 'white', cursor: 'pointer' }}
            >
              {accent === option && <IconCheck size={12} stroke={3} />}
            </ColorSwatch>
          </Tooltip>
        ))}
      </Group>
      <Tooltip label={`Theme: ${scheme.label}`} withArrow>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={`Theme: ${scheme.label}`}
          onClick={() => setColorScheme(scheme.next)}
        >
          <scheme.Icon size={18} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
