"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticate, createSession, destroySession, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const credentials = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    // Deliberately one message for both causes — do not reveal which accounts exist.
    return { error: "Email or password is incorrect." };
  }

  await createSession(user);
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SIGN_IN",
      entity: "User",
      entityId: user.id,
      meta: { role: user.role },
    },
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SIGN_OUT",
        entity: "User",
        entityId: user.id,
      },
    });
  }
  destroySession();
  redirect("/login");
}
