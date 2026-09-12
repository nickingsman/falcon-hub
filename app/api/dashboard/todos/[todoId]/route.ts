import { NextResponse } from "next/server";
import {
  requirePersonalTodoMember,
  toPersonalTodoResponse,
  type PersonalTodoRow,
} from "../todo-service";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ todoId: string }>;
};

const todoSelect = "id, title, is_completed, completed_at, created_at, updated_at";

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requirePersonalTodoMember();
  if (!authorization.authorized) return authorization.response;

  try {
    const { todoId } = await params;
    const body = (await request.json()) as { isCompleted?: unknown };

    if (typeof body.isCompleted !== "boolean") {
      return NextResponse.json({ error: "Completion status is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("personal_todos")
      .update({
        is_completed: body.isCompleted,
        completed_at: body.isCompleted ? new Date().toISOString() : null,
      })
      .eq("id", todoId)
      .eq("member_id", authorization.memberId)
      .select(todoSelect)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json(toPersonalTodoResponse(data as PersonalTodoRow));
  } catch (error) {
    console.error("PATCH /api/dashboard/todos/[todoId] error:", error);
    return NextResponse.json({ error: "Unable to update task" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await requirePersonalTodoMember();
  if (!authorization.authorized) return authorization.response;

  try {
    const { todoId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("personal_todos")
      .delete()
      .eq("id", todoId)
      .eq("member_id", authorization.memberId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("DELETE /api/dashboard/todos/[todoId] error:", error);
    return NextResponse.json({ error: "Unable to delete task" }, { status: 500 });
  }
}
