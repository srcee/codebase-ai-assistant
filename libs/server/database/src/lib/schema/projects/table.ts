import { pgTable } from 'drizzle-orm/pg-core';
import { columns } from './columns';

export const projects = pgTable('projects', columns);
