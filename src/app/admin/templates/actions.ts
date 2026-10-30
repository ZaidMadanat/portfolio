"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

// Templates admin actions (spec §7). Each checks the admin session first.

const templateId = z.string().min(1).max(64);

/**
 * Deletes a template saved from a post. Built-ins can't be deleted. Posts
 * started from it keep their blocks; their templateId is cleared.
 */
export async function deleteTemplate(id: string): Promise<void> {
  await requireAdmin();
  const tid = templateId.parse(id);
  const template = await db.template.findUnique({ where: { id: tid }, select: { builtIn: true } });
  if (!template) return;
  if (template.builtIn) throw new Error("built-in");
  await db.template.delete({ where: { id: tid } });
}
