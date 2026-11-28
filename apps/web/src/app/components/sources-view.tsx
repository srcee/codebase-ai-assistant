import type {
  CodebaseResponse,
  DocumentCollectionResponse,
} from '@codebase-ai/contracts';
import {
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconFiles, IconGitBranch } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { RegisterCollectionForm } from './register-collection-form';
import { RegisterRepositoryForm } from './register-repository-form';
import { SourceCard } from './source-card';
import classes from './sources-view.module.css';

interface SourcesViewProps {
  codebases: CodebaseResponse[];
  collections: DocumentCollectionResponse[];
  onChanged: () => void;
  onDeleted: (id: string) => void;
}

interface SourceSectionProps {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  count: number;
  empty: string;
  form: ReactNode;
  children: ReactNode;
}

function SourceSection({
  id,
  title,
  description,
  icon,
  count,
  empty,
  form,
  children,
}: SourceSectionProps) {
  return (
    <section aria-labelledby={id}>
      <Group gap="sm" mb={4} wrap="nowrap">
        <ThemeIcon size="lg" variant="light" aria-hidden>
          {icon}
        </ThemeIcon>
        <Title order={2} size="h3" id={id}>
          {title}
        </Title>
        <Badge variant="default" radius="sm">
          {count}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {description}
      </Text>
      <Stack gap="md">
        {count === 0 && (
          <Paper withBorder p="lg" className={classes.empty}>
            <Text size="sm" c="dimmed" ta="center">
              {empty}
            </Text>
          </Paper>
        )}
        {children}
        <Paper withBorder p="md" className={classes.formPanel}>
          {form}
        </Paper>
      </Stack>
    </section>
  );
}

export function SourcesView({
  codebases,
  collections,
  onChanged,
  onDeleted,
}: SourcesViewProps) {
  return (
    <Stack gap={48}>
      <SourceSection
        id="repositories-heading"
        title="Repositories"
        description="Local Git repositories indexed for code search and chat."
        icon={<IconGitBranch size={20} />}
        count={codebases.length}
        empty="No repositories yet."
        form={<RegisterRepositoryForm onRegistered={onChanged} />}
      >
        <ul className={classes.list} aria-label="Repositories">
          {codebases.map((codebase) => (
            <SourceCard
              key={codebase.id}
              source={{ kind: 'codebase', id: codebase.id }}
              name={codebase.name}
              relativePath={codebase.relativePath}
              status={codebase.status}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      </SourceSection>
      <SourceSection
        id="collections-heading"
        title="Document collections"
        description="Folders or uploaded files such as specs, notes, and manuals."
        icon={<IconFiles size={20} />}
        count={collections.length}
        empty="No document collections yet."
        form={<RegisterCollectionForm onRegistered={onChanged} />}
      >
        <ul className={classes.list} aria-label="Document collections">
          {collections.map((collection) => (
            <SourceCard
              key={collection.id}
              source={{ kind: 'collection', id: collection.id }}
              name={collection.name}
              relativePath={collection.relativePath}
              status={collection.status}
              origin={collection.origin}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      </SourceSection>
    </Stack>
  );
}
