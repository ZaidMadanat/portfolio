"use client";

import { createAuthClient } from "better-auth/react";

// Browser side of Better Auth, same origin (/api/auth). Admin pages only.
export const authClient = createAuthClient();
