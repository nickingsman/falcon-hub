import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";

export const personalTodoTitleMaxLength = 200;
export const incompleteTodoLimit = 20;
export const completedTodoLimit = 5;

export async function requirePersonalTodoMember() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    } as const;
  }

  if (authContext.profile?.status !== "active") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Active user profile is required" },
        { status: 403 },
      ),
    } as const;
  }

  if (!authContext.profile.member_id) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Linked member profile is required" },
        { status: 403 },
      ),
    } as const;
  }

  return {
    authorized: true,
    memberId: authContext.profile.member_id,
  } as const;
}

export function parsePersonalTodoTitle(value: unknown) {
  if (typeof value !== "string") return null;

  const title = value.trim();
  return title.length >= 1 && title.length <= personalTodoTitleMaxLength ? title : null;
}

export type PersonalTodoRow = {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toPersonalTodoResponse(todo: PersonalTodoRow) {
  return {
    id: todo.id,
    title: todo.title,
    isCompleted: todo.is_completed,
    completedAt: todo.completed_at,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

